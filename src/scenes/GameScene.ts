import Phaser from 'phaser';
import type { GameState } from '../core/types';
import {
  addEmptyContainer,
  getTopRunLength,
  isContainerLocked,
  isLevelComplete,
  isStuck,
  tryMove,
} from '../core/gameLogic';
import { UndoStack } from '../core/undoStack';
import { createDemoLevel } from '../core/levels/demoLevel';
import { levelConfigFor } from '../core/difficultyCurve';
import { dailyPuzzleConfig } from '../core/dailyPuzzle';
import { todayKey } from '../core/dailyReward';
import { generateVerifiedLevel } from '../core/levelGenerator';
import { drawItemArt, strokeArc } from './itemVisuals';
import { JUICE } from './juiceConfig';
import { COLORS, RADIUS, hexToNum, shade } from './theme';
import { readSafeAreaInsets } from './safeArea';
import { getDebugLevelParam } from './debugLevelParam';
import { type HapticService, WebVibrationHapticService } from '../services/HapticService';
import { type SoundService, WebAudioSoundService } from '../services/SoundService';
import { LocalStorageSaveService, type SaveData, type SaveService } from '../services/SaveService';
import { type AdService, MockAdService, type RewardedPlacement, shouldShowInterstitial } from '../services/AdService';
import { type AnalyticsService, ConsoleAnalyticsService } from '../services/AnalyticsService';
import { t } from '../i18n/translations';
import type { Language } from '../i18n/translations';

const PROGRESS_LEVEL_STARS = 10;
const DAILY_PUZZLE_STARS = 15;
const DOUBLE_OFFER_WINDOW_MS = 2500;

export interface GameSceneData {
  readonly mode?: 'progress' | 'daily';
  readonly levelNumber?: number;
}

type SessionMode = 'progress' | 'daily' | 'debug' | 'demo';
type FeedbackKind = 'tap' | 'land' | 'complete' | 'invalid' | 'medium';

interface LoadedLevel {
  readonly state: GameState;
  readonly mode: SessionMode;
  readonly label: string;
}

// "Taban" (en fazla 2 satır / 6 kap olan erken seviyeler için) boyutlar. Daha fazla kap
// gerektiren ileri seviyelerde computeLayouts() bunları satır sayısına göre küçültüp
// this.containerWidth/this.slotHeight üzerinden kullanır -- aksi halde kap ızgarası alt
// butonların arkasına taşıp ekrandan kesilirdi (bkz. 12 kaplı seviyelerde gözlenen taşma).
const BASE_CONTAINER_WIDTH = 150;
const BASE_SLOT_HEIGHT = 54;
const COLS = 3;
const COL_GAP = 16;
const ROW_GAP = 22;
const TOP_MARGIN = 170;
const BASE_ITEM_INSET_X = 12;
const BASE_ITEM_INSET_Y = 5;
const MIN_GRID_SCALE = 0.52;
const DRAG_THRESHOLD = 8;
const BUTTON_WIDTH = 160;
const BUTTON_HEIGHT = 52;

interface Layout {
  readonly rect: Phaser.Geom.Rectangle;
  readonly centerX: number;
  readonly topY: number;
}

interface Button {
  readonly setEnabled: (enabled: boolean) => void;
}

const INK = hexToNum(COLORS.ink);
const CREAM = hexToNum(COLORS.cream);

export class GameScene extends Phaser.Scene {
  private readonly saveService: SaveService = new LocalStorageSaveService(window.localStorage);
  private readonly hapticService: HapticService = new WebVibrationHapticService();
  private readonly soundService: SoundService = new WebAudioSoundService();
  private readonly adService: AdService = new MockAdService();
  private readonly analytics: AnalyticsService = new ConsoleAnalyticsService();

  // Aşağıdaki alanların hepsi create()'de sıfırdan atanır: Phaser sahne örneğini
  // scene.start() ile her yeniden başlatışta YENİDEN KULLANIR, constructor tekrar
  // çalışmaz -- bu yüzden "field initializer" ile başlatmak bir önceki oturumdan
  // kalan durumu (eski seviye, eski undo geçmişi vb.) sessizce sızdırır.
  private gameState!: GameState;
  private saveData!: SaveData;
  private lang: Language = 'tr';
  private sessionMode: SessionMode = 'demo';
  private levelNumber: number | null = null;
  private undoStack = new UndoStack<GameState>();

  private layouts = new Map<string, Layout>();
  private selectedId: string | null = null;
  private comboCount = 0;
  private isAnimating = false;
  private wasStuck = false;
  private levelStartTime = 0;
  private undoCount = 0;
  private safeTop = 20;
  private safeBottom = 20;
  private starAnchor = { x: 0, y: 0 };
  private containerWidth = BASE_CONTAINER_WIDTH;
  private slotHeight = BASE_SLOT_HEIGHT;
  private itemInsetX = BASE_ITEM_INSET_X;
  private itemInsetY = BASE_ITEM_INSET_Y;

  private framesLayer!: Phaser.GameObjects.Container;
  private itemsLayer!: Phaser.GameObjects.Container;
  private statusSubText!: Phaser.GameObjects.Text;
  private stuckBanner!: Phaser.GameObjects.Text;
  private undoButton!: Button;

  private activePointerId: string | null = null;
  private dragRunLength = 0;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragging = false;
  private moveCount = 0;

  private tutorialActive = false;
  private tutorialHand?: Phaser.GameObjects.Container;
  private tutorialTimers: Phaser.Time.TimerEvent[] = [];

  constructor() {
    super('GameScene');
  }

  create(data: GameSceneData): void {
    this.saveData = this.saveService.load();
    this.lang = this.saveData.language;

    const loaded = this.loadLevel(data);

    this.gameState = loaded.state;
    this.sessionMode = loaded.mode;
    this.levelNumber = data.levelNumber ?? null;
    this.undoStack = new UndoStack<GameState>();
    this.layouts = new Map();
    this.selectedId = null;
    this.comboCount = 0;
    this.isAnimating = false;
    this.wasStuck = false;
    this.levelStartTime = Date.now();
    this.undoCount = 0;
    this.activePointerId = null;
    this.dragRunLength = 0;
    this.dragging = false;
    this.moveCount = 0;
    this.tutorialActive = false;
    this.tutorialHand = undefined;
    this.tutorialTimers = [];

    const insets = readSafeAreaInsets(this.sys.game.canvas as HTMLCanvasElement);
    this.safeTop = insets.top;
    this.safeBottom = insets.bottom;

    this.analytics.track({ name: 'level_start', levelNumber: this.levelNumber ?? 0, mode: loaded.mode });

    this.drawBackground();

    const headerY = this.safeTop + 26;

    if (this.sessionMode === 'progress' || this.sessionMode === 'daily') {
      this.createBackButton(insets.left + 30, headerY, () => {
        if (!this.isAnimating) this.scene.start('RoomScene');
      });
    }

    const labelText = this.add
      .text(0, headerY, loaded.label, {
        fontFamily: 'Fredoka, sans-serif',
        fontSize: '17px',
        fontStyle: '600',
        color: COLORS.ink,
      })
      .setOrigin(0.5)
      .setDepth(1);

    const maxPillW = this.scale.width - 2 * (insets.left + 56);
    if (labelText.width + 72 > maxPillW) {
      labelText.setFontSize(13); // debug modunda çok uzun etiketler (ör. "#450, kilitli kap") için
    }
    const pillW = Math.min(maxPillW, Math.max(180, labelText.width + 72));
    labelText.setX(this.scale.width / 2 - 14);

    const pill = this.add.graphics();
    pill.fillStyle(hexToNum(COLORS.surface), 0.82);
    pill.fillRoundedRect(this.scale.width / 2 - pillW / 2, headerY - 20, pillW, 40, 20);
    pill.lineStyle(2, hexToNum(COLORS.coral), 0.5);
    pill.strokeRoundedRect(this.scale.width / 2 - pillW / 2, headerY - 20, pillW, 40, 20);

    this.starAnchor = { x: this.scale.width / 2 + pillW / 2 - 24, y: headerY };
    this.drawStarGlyph(this.starAnchor.x, this.starAnchor.y, 9);

    this.statusSubText = this.add
      .text(this.scale.width / 2, headerY + 32, '', {
        fontFamily: 'Fredoka, sans-serif',
        fontSize: '13px',
        color: COLORS.inkSoft,
      })
      .setOrigin(0.5);

    this.stuckBanner = this.add
      .text(this.scale.width / 2, headerY + 56, t('stuckBanner', this.lang), {
        fontFamily: 'Fredoka, sans-serif',
        fontSize: '13px',
        color: COLORS.cream,
        backgroundColor: COLORS.danger,
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.framesLayer = this.add.container(0, 0);
    this.itemsLayer = this.add.container(0, 0);

    const buttonY = this.scale.height - this.safeBottom - BUTTON_HEIGHT / 2 - 6;
    this.undoButton = this.createButton(
      this.scale.width / 2 - (BUTTON_WIDTH + 20) / 2,
      buttonY,
      t('undoButton', this.lang),
      'undo',
      () => this.onUndo(),
    );
    this.createButton(
      this.scale.width / 2 + (BUTTON_WIDTH + 20) / 2,
      buttonY,
      t('extraContainerButton', this.lang),
      'plus',
      () => this.onAddExtraContainer(),
    );

    this.undoButton.setEnabled(false);
    this.refreshAll();
    this.checkStuckOrWin();

    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);

    if (this.sessionMode === 'progress' && this.levelNumber === 1) {
      this.time.delayedCall(500, () => this.startTutorialHand());
    }
  }

  private loadLevel(data: GameSceneData): LoadedLevel {
    const debugLevel = getDebugLevelParam();
    if (debugLevel !== null) {
      const result = generateVerifiedLevel(levelConfigFor(debugLevel));
      const lockNote = result.hasLock ? t('lockedContainerNote', this.lang) : '';
      return {
        state: result.initialState,
        mode: 'debug',
        label: `${t('generatedLevelLabel', this.lang, { n: debugLevel })}${lockNote}`,
      };
    }

    if (data.mode === 'daily') {
      const result = generateVerifiedLevel(dailyPuzzleConfig(todayKey(new Date())));
      return { state: result.initialState, mode: 'daily', label: t('dailyPuzzleLabel', this.lang) };
    }

    if (data.mode === 'progress' && data.levelNumber) {
      const result = generateVerifiedLevel(levelConfigFor(data.levelNumber));
      const lockNote = result.hasLock ? t('lockedContainerNote', this.lang) : '';
      return {
        state: result.initialState,
        mode: 'progress',
        label: `${t('levelLabel', this.lang, { n: data.levelNumber })}${lockNote}`,
      };
    }

    return { state: createDemoLevel(), mode: 'demo', label: t('demoLevelLabel', this.lang) };
  }

  /** Haptic + ses geri bildirimini tek yerden, ayarlara saygılı biçimde tetikler. */
  private feedback(kind: FeedbackKind): void {
    if (this.saveData.hapticEnabled) {
      if (kind === 'tap' || kind === 'land') this.hapticService.light();
      else if (kind === 'complete') this.hapticService.success();
      else if (kind === 'invalid') this.hapticService.warning();
      else this.hapticService.medium();
    }
    if (this.saveData.soundEnabled) {
      if (kind === 'tap') this.soundService.tap();
      else if (kind === 'land' || kind === 'medium') this.soundService.land();
      else if (kind === 'complete') this.soundService.complete();
      else if (kind === 'invalid') this.soundService.invalid();
    }
  }

  // ---------------------------------------------------------------------
  // Görsel: arkaplan, header, butonlar, yıldız ikonu
  // ---------------------------------------------------------------------

  private drawBackground(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const wallBottom = h * 0.58;

    const g = this.add.graphics();
    g.fillGradientStyle(
      hexToNum(COLORS.bgTop),
      hexToNum(COLORS.bgTop),
      shade(COLORS.bgTop, -0.06),
      shade(COLORS.bgTop, -0.06),
      1,
      1,
      1,
      1,
    );
    g.fillRect(0, 0, w, wallBottom);

    g.fillGradientStyle(
      shade(COLORS.bgBottom, 0.08),
      shade(COLORS.bgBottom, 0.08),
      shade(COLORS.bgBottom, -0.12),
      shade(COLORS.bgBottom, -0.12),
      1,
      1,
      1,
      1,
    );
    g.fillRect(0, wallBottom, w, h - wallBottom);

    g.fillStyle(0xffffff, 0.22);
    g.fillRect(0, wallBottom - 2, w, 3);

    g.fillStyle(hexToNum(COLORS.ink), 0.05);
    for (let i = 0; i < 5; i++) {
      const ly = wallBottom + 18 + i * ((h - wallBottom - 24) / 5);
      g.fillRect(0, ly, w, 1.5);
    }

    g.fillStyle(hexToNum(COLORS.turquoise), 0.07);
    g.fillCircle(w * 0.86, h * 0.14, 110);
    g.fillStyle(hexToNum(COLORS.coral), 0.06);
    g.fillCircle(w * 0.08, h * 0.46, 130);

    // Kapların altındaki boş zemini bir "halı" illüstrasyonuyla doldurur -- az sayıda kap olan
    // (erken) seviyelerde ekranın alt yarısı çıplak kalmasın diye.
    const rugY = h * 0.78;
    const rugW = w * 0.76;
    const rugH = h * 0.2;
    g.fillStyle(hexToNum(COLORS.coral), 0.1);
    g.fillEllipse(w / 2, rugY, rugW, rugH);
    g.lineStyle(2, hexToNum(COLORS.coral), 0.18);
    g.strokeEllipse(w / 2, rugY, rugW * 0.78, rugH * 0.72);
    g.fillStyle(hexToNum(COLORS.turquoise), 0.07);
    g.fillCircle(w / 2, rugY, 10);
  }

  private createBackButton(x: number, y: number, onTap: () => void): void {
    const r = 22;
    const g = this.add.graphics();
    g.fillStyle(hexToNum(COLORS.surface), 0.85);
    g.fillCircle(x, y, r);
    g.lineStyle(2, hexToNum(COLORS.coral), 0.6);
    g.strokeCircle(x, y, r);
    g.lineStyle(3, INK, 0.75);
    g.lineBetween(x + 5, y - 7, x - 5, y);
    g.lineBetween(x - 5, y, x + 5, y + 7);

    const zone = this.add.zone(x, y, r * 2, r * 2).setInteractive({ useHandCursor: true });
    zone.on('pointerup', onTap);
  }

  private drawStarGlyph(x: number, y: number, r: number): void {
    const g = this.add.graphics({ x, y });
    g.fillStyle(hexToNum(COLORS.gold), 1);
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < 10; i++) {
      const angle = (Math.PI / 5) * i - Math.PI / 2;
      const radius = i % 2 === 0 ? r : r * 0.45;
      points.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
    }
    g.fillPoints(points, true);
  }

  private createButton(x: number, y: number, label: string, icon: 'undo' | 'plus', onTap: () => void): Button {
    const bg = this.add.graphics();
    const draw = (enabled: boolean) => {
      bg.clear();
      // Not: büyük yarıçaplı (hap) bir fillRoundedRect'e fillGradientStyle uygulamak bu Phaser
      // sürümünde WebGL'de köşelerde görünür hatalı facet/çentik üretiyor -- bu yüzden hap
      // butonlarda düz dolgu + üstte ayrı bir "parlama" şerit kullanılır (gradient değil).
      bg.fillStyle(enabled ? hexToNum(COLORS.coral) : hexToNum(COLORS.surfaceMuted), 1);
      bg.fillRoundedRect(x - BUTTON_WIDTH / 2, y - BUTTON_HEIGHT / 2, BUTTON_WIDTH, BUTTON_HEIGHT, BUTTON_HEIGHT / 2);
      if (enabled) {
        bg.fillStyle(0xffffff, 0.18);
        bg.fillRoundedRect(
          x - BUTTON_WIDTH / 2 + 6,
          y - BUTTON_HEIGHT / 2 + 4,
          BUTTON_WIDTH - 12,
          BUTTON_HEIGHT * 0.42,
          BUTTON_HEIGHT * 0.3,
        );
      }
      const iconColor = enabled ? CREAM : hexToNum(COLORS.inkSoft);
      const ix = x - BUTTON_WIDTH / 2 + 26;
      bg.lineStyle(3, iconColor, 1);
      if (icon === 'undo') {
        strokeArc(bg, ix, y, 8, 160, 430);
        bg.fillStyle(iconColor, 1);
        bg.fillTriangle(ix - 10, y - 7, ix - 10, y + 1, ix - 3, y - 3);
      } else {
        bg.lineBetween(ix - 7, y, ix + 7, y);
        bg.lineBetween(ix, y - 7, ix, y + 7);
      }
    };
    draw(true);

    const text = this.add
      .text(x + 10, y, label, { fontFamily: 'Fredoka, sans-serif', fontSize: '15px', fontStyle: '600', color: COLORS.cream })
      .setOrigin(0.5);

    const zone = this.add.zone(x, y, BUTTON_WIDTH, BUTTON_HEIGHT).setInteractive({ useHandCursor: true });
    let enabled = true;
    zone.on('pointerup', () => {
      if (enabled && !this.isAnimating) onTap();
    });

    return {
      setEnabled: (value: boolean) => {
        enabled = value;
        draw(value);
        text.setAlpha(value ? 1 : 0.6);
        text.setColor(value ? COLORS.cream : COLORS.inkSoft);
      },
    };
  }

  // ---------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------

  private computeLayouts(): void {
    this.layouts.clear();
    const ids = this.gameState.containers.map((c) => c.id);

    // Kap sayısı artıp 2'den fazla satır gerektiğinde (ileri seviyeler) ızgarayı buton
    // satırının üstünde kalacak şekilde küçültür -- aksi halde alt satırlar butonların
    // arkasında kesilirdi.
    const rows = Math.max(1, Math.ceil(ids.length / COLS));
    const buttonTop = this.scale.height - this.safeBottom - BUTTON_HEIGHT - 26;
    const availableHeight = Math.max(100, buttonTop - TOP_MARGIN);
    const neededAtBase = rows * 4 * BASE_SLOT_HEIGHT + (rows - 1) * ROW_GAP;
    const scale = Math.max(MIN_GRID_SCALE, Math.min(1, availableHeight / neededAtBase));

    this.slotHeight = BASE_SLOT_HEIGHT * scale;
    this.containerWidth = BASE_CONTAINER_WIDTH * scale;
    this.itemInsetX = BASE_ITEM_INSET_X * scale;
    this.itemInsetY = BASE_ITEM_INSET_Y * scale;
    const colGap = COL_GAP * scale;
    const rowGap = ROW_GAP * scale;

    ids.forEach((id, index) => {
      const container = this.gameState.containers.find((c) => c.id === id)!;
      const row = Math.floor(index / COLS);
      const col = index % COLS;
      const itemsInRow = Math.min(COLS, ids.length - row * COLS);
      const rowWidth = itemsInRow * this.containerWidth + (itemsInRow - 1) * colGap;
      const rowStartX = this.scale.width / 2 - rowWidth / 2;

      const boxHeight = container.capacity * this.slotHeight;
      const x = rowStartX + col * (this.containerWidth + colGap);
      const y = TOP_MARGIN + row * (4 * this.slotHeight + rowGap);

      this.layouts.set(id, {
        rect: new Phaser.Geom.Rectangle(x, y, this.containerWidth, boxHeight),
        centerX: x + this.containerWidth / 2,
        topY: y,
      });
    });
  }

  /** Kap sayısı/dizilimi değiştiğinde (ör. ekstra kap eklenince) layout+çerçeve+içerik tamamen yenilenir. */
  private refreshAll(): void {
    this.computeLayouts();
    this.drawFrames();
    this.render();
  }

  private drawFrames(): void {
    this.framesLayer.removeAll(true);
    for (const c of this.gameState.containers) {
      const layout = this.layouts.get(c.id)!;
      const isSelected = this.selectedId === c.id;
      const locked = isContainerLocked(c, this.gameState);
      const lift = isSelected ? 4 : 0;
      const rx = layout.rect.x;
      const ry = layout.rect.y - lift;
      const rw = layout.rect.width;
      const rh = layout.rect.height;

      const g = this.add.graphics();

      if (isSelected) {
        g.fillStyle(hexToNum(COLORS.coral), 0.18);
        g.fillRoundedRect(rx - 5, ry - 5, rw + 10, rh + 10, RADIUS.lg + 5);
      }

      // gövde: hafif degrade "raf içi" zemin
      g.fillGradientStyle(
        locked ? shade(COLORS.surfaceMuted, -0.05) : hexToNum(COLORS.surface),
        locked ? shade(COLORS.surfaceMuted, -0.05) : hexToNum(COLORS.surface),
        locked ? shade(COLORS.surfaceMuted, -0.15) : shade(COLORS.surface, -0.06),
        locked ? shade(COLORS.surfaceMuted, -0.15) : shade(COLORS.surface, -0.06),
        locked ? 0.75 : 0.88,
        locked ? 0.75 : 0.88,
        locked ? 0.75 : 0.88,
        locked ? 0.75 : 0.88,
      );
      g.fillRoundedRect(rx, ry, rw, rh, RADIUS.lg);

      // kapasite bölme çizgileri (boş gözler hafifçe belli olsun)
      g.lineStyle(1, hexToNum(COLORS.inkSoft), 0.14);
      for (let i = 1; i < c.capacity; i++) {
        const ly = ry + i * this.slotHeight;
        g.lineBetween(rx + 8, ly, rx + rw - 8, ly);
      }

      // dış çerçeve (ahşap/raf kenarı hissi)
      g.lineStyle(isSelected ? 4 : 3, isSelected ? hexToNum(COLORS.coral) : locked ? hexToNum(COLORS.inkSoft) : shade(COLORS.amber, -0.1), isSelected ? 1 : locked ? 0.55 : 0.75);
      g.strokeRoundedRect(rx, ry, rw, rh, RADIUS.lg);

      this.framesLayer.add(g);

      if (locked) {
        this.framesLayer.add(this.createLockGlyph(layout.centerX, ry + 22));
      }
    }
  }

  private createLockGlyph(x: number, y: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics({ x, y });
    g.fillStyle(INK, 0.8);
    g.lineStyle(3, INK, 0.8);
    g.strokeCircle(0, -4, 6);
    g.fillRoundedRect(-8, -2, 16, 12, 3);
    return g;
  }

  private findContainerAt(x: number, y: number): string | null {
    for (const [id, layout] of this.layouts) {
      if (layout.rect.contains(x, y)) return id;
    }
    return null;
  }

  // ---------------------------------------------------------------------
  // Girdi
  // ---------------------------------------------------------------------

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    this.cancelTutorial();
    if (this.isAnimating) return;
    const id = this.findContainerAt(pointer.x, pointer.y);
    if (!id) return;
    const container = this.gameState.containers.find((c) => c.id === id)!;

    // activePointerId her kapta (boş olsa bile) set edilir: tap-select akışında
    // ikinci dokunuş (hedef) boş bir kaba yapılabilir. Sürükleme sadece dolu
    // kaynaklarda anlamlıdır (dragRunLength=0 ise moveRunVisual zaten no-op olur).
    this.activePointerId = id;
    this.dragRunLength = getTopRunLength(container);
    this.dragStartX = pointer.x;
    this.dragStartY = pointer.y;
    this.dragging = false;
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.isAnimating || !this.activePointerId) return;
    const dx = pointer.x - this.dragStartX;
    const dy = pointer.y - this.dragStartY;
    if (!this.dragging && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      this.dragging = true;
    }
    if (this.dragging) {
      this.moveRunVisual(this.activePointerId, dx, dy);
    }
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.isAnimating) return;
    const pressedId = this.activePointerId;
    const wasDragging = this.dragging;
    this.activePointerId = null;
    this.dragging = false;

    if (!pressedId) {
      // Boş alana dokunma: seçimi iptal eder.
      if (!this.findContainerAt(pointer.x, pointer.y) && this.selectedId) {
        this.selectedId = null;
        this.drawFrames();
        this.render();
      }
      return;
    }

    if (wasDragging) {
      const targetId = this.findContainerAt(pointer.x, pointer.y);
      this.selectedId = null;
      if (targetId && targetId !== pressedId) {
        this.attemptMove(pressedId, targetId);
      } else {
        this.render();
      }
      return;
    }

    // Gerçek sürükleme olmadı: bu bir "tap" (dokun-seç-taşı akışı).
    if (this.selectedId === null) {
      this.selectedId = pressedId;
      this.feedback('tap');
    } else if (this.selectedId === pressedId) {
      this.selectedId = null;
    } else {
      const sourceId = this.selectedId;
      this.selectedId = null;
      this.attemptMove(sourceId, pressedId);
      return;
    }
    this.drawFrames();
    this.render();
  }

  private attemptMove(sourceId: string, targetId: string): void {
    const outcome = tryMove(this.gameState, { sourceId, targetId });
    if (!outcome.ok) {
      this.feedback('invalid');
      this.flashInvalid(targetId);
      this.drawFrames();
      this.render();
      return;
    }

    const oldState = this.gameState;
    const newState = outcome.result.state;
    const { movedCount, movedType, completion } = outcome.result;

    this.undoStack.push(oldState);
    this.undoButton.setEnabled(true);
    this.moveCount++;
    this.isAnimating = true;

    // Uçuş başlamadan önce temiz bir taban (seçim kaldırılmış, konumlar kesin) çizilir.
    this.drawFrames();
    this.render();

    this.animateMove(sourceId, targetId, movedType, movedCount, () => {
      this.gameState = newState;
      this.isAnimating = false;
      this.drawFrames();
      this.render();
      this.playLandBounce(targetId, movedCount);
      this.feedback('land');

      if (completion) {
        this.comboCount++;
        this.flashCompletion(targetId);
        this.feedback('complete');
        if (this.comboCount >= JUICE.combo.minComboToShow) {
          this.showCombo(targetId, this.comboCount);
        }
      } else {
        this.comboCount = 0;
      }

      this.checkUnlocks(oldState, newState);
      this.checkStuckOrWin();
    });
  }

  private onUndo(): void {
    if (!this.undoStack.canUndo()) return;
    const previous = this.undoStack.undo()!;
    this.gameState = previous;
    this.moveCount = Math.max(0, this.moveCount - 1);
    this.undoCount++;
    this.selectedId = null;
    this.comboCount = 0;
    this.undoButton.setEnabled(this.undoStack.canUndo());
    this.feedback('tap');
    this.analytics.track({ name: 'booster_used', booster: 'undo' });
    this.refreshAll();
    this.checkStuckOrWin();
  }

  /** "Ekstra Kap" artık ödüllü reklam vaadiyle sunulur (mock); gerçek ekleme sadece izleme "başarılı" dönünce olur. */
  private onAddExtraContainer(): void {
    if (this.isAnimating) return;
    this.isAnimating = true;
    const placement: RewardedPlacement = 'extra-container';
    this.analytics.track({ name: 'ad_offered', placement });

    this.showMockAdOverlay(() => {
      void this.adService.showRewarded(placement).then((watched) => {
        this.isAnimating = false;
        if (!watched) return;

        this.analytics.track({ name: 'ad_watched', placement });
        this.analytics.track({ name: 'booster_used', booster: 'extra-container' });

        const capacity = this.gameState.containers[0]?.capacity ?? 4;
        this.undoStack.push(this.gameState);
        this.undoButton.setEnabled(true);
        this.gameState = addEmptyContainer(this.gameState, capacity);
        this.feedback('medium');
        this.refreshAll();
        this.checkStuckOrWin();
      });
    });
  }

  private showMockAdOverlay(onDone: () => void): void {
    const overlay = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.75)
      .setOrigin(0, 0)
      .setDepth(300);
    const text = this.add
      .text(this.scale.width / 2, this.scale.height / 2, t('mockAdOverlay', this.lang), {
        fontFamily: 'Fredoka, sans-serif',
        fontSize: '18px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(301);

    this.time.delayedCall(450, () => {
      overlay.destroy();
      text.destroy();
      onDone();
    });
  }

  private checkStuckOrWin(): void {
    if (isLevelComplete(this.gameState)) {
      this.wasStuck = false;
      this.hideStuckBanner();
      this.onLevelWon();
      return;
    }
    if (isStuck(this.gameState)) {
      if (!this.wasStuck) {
        this.analytics.track({ name: 'level_stuck', levelNumber: this.levelNumber ?? 0 });
      }
      this.wasStuck = true;
      this.showStuckBanner();
    } else {
      this.wasStuck = false;
      this.hideStuckBanner();
    }
  }

  private onLevelWon(): void {
    if (this.sessionMode !== 'progress' && this.sessionMode !== 'daily') {
      // debug/demo modunda kayıt yapılmaz, reklam/otomatik yönlendirme olmaz -- sadece bilgi metni.
      this.statusSubText.setText(t('levelCompleteNoStars', this.lang));
      return;
    }

    // Oda ekranına geçiş zamanlanırken ek bir hamle bu akışı bozmasın diye girdi kilitlenir.
    this.isAnimating = true;

    const data = this.saveService.load();
    const awarded = this.sessionMode === 'progress' ? PROGRESS_LEVEL_STARS : DAILY_PUZZLE_STARS;

    let saved: SaveData = { ...data, stars: data.stars + awarded };
    if (this.sessionMode === 'progress') {
      const nextLevel = (this.levelNumber ?? data.currentLevel) + 1;
      saved = { ...saved, currentLevel: Math.max(data.currentLevel, nextLevel) };
    }
    this.saveService.save(saved);

    this.analytics.track({
      name: 'level_win',
      levelNumber: this.levelNumber ?? 0,
      durationMs: Date.now() - this.levelStartTime,
      moveCount: this.moveCount,
      undoCount: this.undoCount,
    });

    const textKey = this.sessionMode === 'progress' ? 'levelCompleteWithStars' : 'dailyPuzzleCompleteWithStars';
    this.statusSubText.setText(t(textKey, this.lang, { stars: awarded }));

    this.offerDoubleStars(awarded, saved);
  }

  /** Kazanılan yıldızları ödüllü reklamla ikiye katlama teklifi; birkaç saniye içinde dokunulmazsa kendiliğinden geçer. */
  private offerDoubleStars(awarded: number, savedAfterBase: SaveData): void {
    const placement: RewardedPlacement = this.sessionMode === 'daily' ? 'double-daily-reward' : 'double-stars';
    const labelKey = this.sessionMode === 'daily' ? 'watchAdDoubleDailyReward' : 'watchAdDoubleStars';

    const btn = this.add
      .text(this.scale.width / 2, this.safeTop + 86, t(labelKey, this.lang), {
        fontFamily: 'Fredoka, sans-serif',
        fontSize: '15px',
        color: '#ffffff',
        backgroundColor: COLORS.turquoise,
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    let resolved = false;
    const finish = () => {
      if (resolved) return;
      resolved = true;
      btn.destroy();
      this.maybeShowInterstitialThenGoToRoom();
    };

    btn.on('pointerup', () => {
      if (resolved) return;
      resolved = true;
      btn.destroy();
      this.analytics.track({ name: 'ad_offered', placement });

      this.showMockAdOverlay(() => {
        void this.adService.showRewarded(placement).then((watched) => {
          if (watched) {
            this.analytics.track({ name: 'ad_watched', placement });
            const doubled: SaveData = { ...savedAfterBase, stars: savedAfterBase.stars + awarded };
            this.saveService.save(doubled);
            const textKey = this.sessionMode === 'daily' ? 'dailyPuzzleCompleteWithStars' : 'levelCompleteWithStars';
            this.statusSubText.setText(t(textKey, this.lang, { stars: awarded * 2 }));
          }
          this.time.delayedCall(500, () => this.maybeShowInterstitialThenGoToRoom());
        });
      });
    });

    this.time.delayedCall(DOUBLE_OFFER_WINDOW_MS, finish);
  }

  private maybeShowInterstitialThenGoToRoom(): void {
    const data = this.saveService.load();
    const shouldShow =
      this.sessionMode === 'progress' &&
      this.levelNumber !== null &&
      !data.removeAdsPurchased &&
      shouldShowInterstitial(this.levelNumber);

    if (!shouldShow) {
      this.scene.start('RoomScene');
      return;
    }

    this.analytics.track({ name: 'ad_offered', placement: 'interstitial' });
    this.showMockAdOverlay(() => {
      void this.adService.showInterstitial().then(() => {
        this.analytics.track({ name: 'ad_watched', placement: 'interstitial' });
        this.scene.start('RoomScene');
      });
    });
  }

  private showStuckBanner(): void {
    this.tweens.add({ targets: this.stuckBanner, alpha: 1, duration: 200 });
  }

  private hideStuckBanner(): void {
    this.tweens.add({ targets: this.stuckBanner, alpha: 0, duration: 200 });
  }

  /** oldState'te kilitli olup newState'te açılan kapları tespit edip küçük bir parıltı oynatır. */
  private checkUnlocks(oldState: GameState, newState: GameState): void {
    for (const c of newState.containers) {
      if (!c.lockedWhileNonEmpty) continue;
      const wasLocked = isContainerLocked(c, oldState);
      const isLocked = isContainerLocked(c, newState);
      if (wasLocked && !isLocked) {
        this.flashUnlock(c.id);
        this.feedback('medium');
      }
    }
  }

  private flashUnlock(containerId: string): void {
    const layout = this.layouts.get(containerId);
    if (!layout) return;
    const ring = this.add.circle(layout.centerX, layout.topY + layout.rect.height / 2, 14, hexToNum(COLORS.gold), 0.9);
    this.tweens.add({
      targets: ring,
      radius: 90,
      alpha: 0,
      duration: JUICE.unlock.duration,
      onComplete: () => ring.destroy(),
    });
  }

  private flashInvalid(containerId: string): void {
    const layout = this.layouts.get(containerId);
    if (!layout) return;
    const g = this.add.graphics();
    g.lineStyle(5, hexToNum(COLORS.danger), 1);
    g.strokeRoundedRect(layout.rect.x, layout.rect.y, layout.rect.width, layout.rect.height, RADIUS.lg);
    this.tweens.add({
      targets: g,
      alpha: 0,
      duration: JUICE.invalid.duration,
      onComplete: () => g.destroy(),
    });
  }

  private flashCompletion(containerId: string): void {
    const layout = this.layouts.get(containerId);
    if (!layout) return;
    const cx = layout.centerX;
    const cy = layout.topY + layout.rect.height / 2;

    const flash = this.add.graphics();
    flash.fillStyle(0xffffff, 0.65);
    flash.fillRoundedRect(layout.rect.x, layout.rect.y, layout.rect.width, layout.rect.height, RADIUS.lg);
    this.tweens.add({ targets: flash, alpha: 0, duration: 320, onComplete: () => flash.destroy() });

    const burst = this.add.circle(cx, cy, 10, hexToNum(COLORS.coral), 0.8);
    this.tweens.add({
      targets: burst,
      radius: 70,
      alpha: 0,
      duration: JUICE.completion.particleDuration,
      onComplete: () => burst.destroy(),
    });

    const particleColors = [COLORS.coral, COLORS.turquoise, COLORS.mustard, COLORS.pink];
    for (let i = 0; i < JUICE.completion.particleCount; i++) {
      const angle = (Math.PI * 2 * i) / JUICE.completion.particleCount + Math.random() * 0.4;
      const speed =
        JUICE.completion.particleSpeedMin +
        Math.random() * (JUICE.completion.particleSpeedMax - JUICE.completion.particleSpeedMin);
      const particle = this.add.circle(cx, cy, 4, hexToNum(particleColors[i % particleColors.length]), 1);
      this.tweens.add({
        targets: particle,
        x: cx + Math.cos(angle) * speed,
        y: cy + Math.sin(angle) * speed,
        alpha: 0,
        duration: JUICE.completion.particleDuration,
        ease: 'Cubic.easeOut',
        onComplete: () => particle.destroy(),
      });
    }

    this.flyStarsToCounter(cx, cy);
    this.cameras.main.shake(JUICE.completion.cameraShakeDuration, JUICE.completion.cameraShakeIntensity);
  }

  /** Tamamlanan kaptan küçük yıldızlar fırlayıp üstteki yıldız ikonuna doğru uçar (sadece görsel şenlik). */
  private flyStarsToCounter(fromX: number, fromY: number): void {
    for (let i = 0; i < JUICE.starFly.starCount; i++) {
      this.time.delayedCall(i * JUICE.starFly.staggerMs, () => {
        const star = this.add.graphics({ x: fromX, y: fromY });
        star.fillStyle(hexToNum(COLORS.gold), 1);
        const pts: { x: number; y: number }[] = [];
        for (let p = 0; p < 10; p++) {
          const angle = (Math.PI / 5) * p - Math.PI / 2;
          const radius = p % 2 === 0 ? 7 : 3;
          pts.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
        }
        star.fillPoints(pts, true);

        const progress = { t: 0 };
        this.tweens.add({
          targets: progress,
          t: 1,
          duration: JUICE.starFly.duration,
          ease: 'Cubic.easeIn',
          onUpdate: () => {
            const tt = progress.t;
            star.x = Phaser.Math.Linear(fromX, this.starAnchor.x, tt);
            star.y = Phaser.Math.Linear(fromY, this.starAnchor.y, tt) - JUICE.starFly.arcHeight * Math.sin(Math.PI * tt);
            star.setScale(1 - tt * 0.5);
          },
          onComplete: () => star.destroy(),
        });
      });
    }
  }

  private showCombo(containerId: string, combo: number): void {
    const layout = this.layouts.get(containerId);
    if (!layout) return;
    const text = this.add
      .text(layout.centerX, layout.topY - 10, t('comboLabel', this.lang, { n: combo }), {
        fontFamily: 'Fredoka, sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: COLORS.coral,
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: text,
      y: layout.topY - 10 - JUICE.combo.riseDistance,
      alpha: 0,
      duration: JUICE.combo.displayDuration,
      onComplete: () => text.destroy(),
    });
  }

  /** Kaynaktan hedefe tek bir temsili "yongayı" yay çizerek uçurur; iniş anında gerçek render devralır. */
  private animateMove(
    sourceId: string,
    targetId: string,
    movedType: string,
    movedCount: number,
    onComplete: () => void,
  ): void {
    const sourceLayout = this.layouts.get(sourceId);
    const targetLayout = this.layouts.get(targetId);
    if (!sourceLayout || !targetLayout) {
      onComplete();
      return;
    }

    const oldSource = this.gameState.containers.find((c) => c.id === sourceId)!;
    const oldTarget = this.gameState.containers.find((c) => c.id === targetId)!;

    const startX = sourceLayout.centerX;
    const startY =
      sourceLayout.topY + (oldSource.capacity - oldSource.items.length) * this.slotHeight + this.slotHeight / 2;

    const landingIndex = oldTarget.items.length + movedCount - 1;
    const endX = targetLayout.centerX;
    const endY =
      targetLayout.topY + (oldTarget.capacity - 1 - landingIndex) * this.slotHeight + this.slotHeight / 2;

    // Uçuşta çakışma olmaması için kaynaktaki (henüz gerçek state'ten silinmemiş) taşınan
    // itemlerin görsellerini geçici olarak gizle -- uçuş bitince zaten tam render() devralıyor.
    const minHiddenIndex = Math.max(0, oldSource.items.length - movedCount);
    const children = this.itemsLayer.list as Phaser.GameObjects.Container[];
    for (const child of children) {
      if (child.getData('containerId') !== sourceId) continue;
      const idx = child.getData('stackIndex') as number;
      if (idx >= minHiddenIndex) child.setVisible(false);
    }

    const chip = this.createItemVisual(movedType, startX, startY);
    if (movedCount > 1) {
      const badge = this.add
        .text(16, -14, `×${movedCount}`, {
          fontFamily: 'Fredoka, sans-serif',
          fontSize: '12px',
          fontStyle: 'bold',
          color: '#ffffff',
          backgroundColor: COLORS.ink,
          padding: { x: 4, y: 1 },
        })
        .setOrigin(0.5);
      chip.add(badge);
    }

    const progress = { t: 0 };
    this.tweens.add({
      targets: progress,
      t: 1,
      duration: JUICE.move.duration,
      ease: 'Quad.easeInOut',
      onUpdate: () => {
        const t = progress.t;
        const x = Phaser.Math.Linear(startX, endX, t);
        const y = Phaser.Math.Linear(startY, endY, t) - JUICE.move.arcHeight * Math.sin(Math.PI * t);
        chip.setPosition(x, y);
      },
      onComplete: () => {
        chip.destroy();
        onComplete();
      },
    });
  }

  /** Hedefte yeni yerleşen itemlerin squash & stretch sıçraması. */
  private playLandBounce(containerId: string, movedCount: number): void {
    const container = this.gameState.containers.find((c) => c.id === containerId);
    if (!container) return;
    const minIndex = Math.max(0, container.items.length - movedCount);

    const children = this.itemsLayer.list as Phaser.GameObjects.Container[];
    for (const child of children) {
      if (child.getData('containerId') !== containerId) continue;
      const idx = child.getData('stackIndex') as number;
      if (idx < minIndex) continue;
      child.setScale(JUICE.land.squashScaleX, JUICE.land.squashScaleY);
      this.tweens.add({
        targets: child,
        scaleX: 1,
        scaleY: 1,
        duration: JUICE.land.duration,
        ease: 'Back.easeOut',
      });
    }
  }

  /** Sürükleme sırasında kaynağın üst run'ını pointer ile birlikte öteler. */
  private moveRunVisual(containerId: string, dx: number, dy: number): void {
    const children = this.itemsLayer.list as Phaser.GameObjects.Container[];
    for (const child of children) {
      if (child.getData('containerId') === containerId && child.getData('inDragRun') === true) {
        child.setPosition(child.getData('baseX') + dx, child.getData('baseY') + dy);
      }
    }
  }

  private render(): void {
    this.itemsLayer.removeAll(true);

    const total = this.gameState.containers.reduce((sum, c) => sum + c.items.length, 0);

    for (const c of this.gameState.containers) {
      const layout = this.layouts.get(c.id)!;
      const runLength = this.selectedId === c.id ? getTopRunLength(c) : 0;
      const liftIndexThreshold = c.items.length - runLength;

      c.items.forEach((item, idx) => {
        const slotFromBottom = idx;
        const rowFromTop = c.capacity - 1 - slotFromBottom;
        const x = layout.centerX;
        const restY = layout.topY + rowFromTop * this.slotHeight + this.slotHeight / 2;

        const isLifted = this.selectedId === c.id && idx >= liftIndexThreshold;
        const y = isLifted ? restY - JUICE.select.liftDistance : restY;

        const visual = this.createItemVisual(item.type, x, restY);
        visual.setData('containerId', c.id);
        visual.setData('stackIndex', idx);
        visual.setData('inDragRun', idx >= c.items.length - this.dragRunLength && c.id === this.activePointerId);
        visual.setData('baseX', x);
        visual.setData('baseY', restY);
        this.itemsLayer.add(visual);

        if (isLifted) {
          this.tweens.add({ targets: visual, y, duration: JUICE.select.duration, ease: 'Sine.easeOut' });
        }

        // Boştaki hafif "nefes alma" pulsasyonu -- yalnızca en üstteki (görünür) eşyada, performans için.
        if (idx === c.items.length - 1) {
          this.tweens.add({
            targets: visual,
            scaleX: 1 + JUICE.idle.scaleAmount,
            scaleY: 1 + JUICE.idle.scaleAmount,
            duration: JUICE.idle.duration,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        }
      });
    }

    this.statusSubText.setText(
      `${t('moveLabel', this.lang)}: ${this.moveCount}   ${t('remainingItemsLabel', this.lang)}: ${total}`,
    );
  }

  private createItemVisual(type: string, x: number, y: number): Phaser.GameObjects.Container {
    const w = this.containerWidth - this.itemInsetX * 2;
    const h = this.slotHeight - this.itemInsetY * 2;
    const g = drawItemArt(this, type, w, h);
    return this.add.container(x, y, [g]);
  }

  // ---------------------------------------------------------------------
  // İlk seviye el animasyonlu öğretici
  // ---------------------------------------------------------------------

  private findTutorialMove(): { sourceId: string; targetId: string } | null {
    const containers = this.gameState.containers;
    for (const source of containers) {
      if (source.items.length === 0) continue;
      for (const target of containers) {
        if (target.id === source.id) continue;
        if (tryMove(this.gameState, { sourceId: source.id, targetId: target.id }).ok) {
          return { sourceId: source.id, targetId: target.id };
        }
      }
    }
    return null;
  }

  private startTutorialHand(): void {
    if (this.isAnimating) return;
    const move = this.findTutorialMove();
    if (!move) return;
    const sourceLayout = this.layouts.get(move.sourceId);
    const targetLayout = this.layouts.get(move.targetId);
    if (!sourceLayout || !targetLayout) return;

    this.tutorialActive = true;
    const sourcePoint = {
      x: sourceLayout.centerX,
      y: sourceLayout.topY + sourceLayout.rect.height - this.slotHeight / 2,
    };
    const targetPoint = {
      x: targetLayout.centerX,
      y: targetLayout.topY + targetLayout.rect.height - this.slotHeight / 2,
    };

    const hand = this.drawHandGlyph();
    hand.setPosition(sourcePoint.x, sourcePoint.y);
    hand.setAlpha(0);
    this.tutorialHand = hand;

    const runCycle = () => {
      if (!this.tutorialActive) return;
      hand.setPosition(sourcePoint.x, sourcePoint.y);
      hand.setScale(1);
      this.tweens.add({ targets: hand, alpha: 1, duration: 200 });
      const press1 = this.time.delayedCall(260, () => {
        if (!this.tutorialActive) return;
        this.tweens.add({ targets: hand, scaleX: 0.85, scaleY: 0.85, duration: JUICE.tutorialHand.pressDuration, yoyo: true });
      });
      const travel = this.time.delayedCall(560, () => {
        if (!this.tutorialActive) return;
        const progress = { t: 0 };
        this.tweens.add({
          targets: progress,
          t: 1,
          duration: JUICE.tutorialHand.travelDuration,
          ease: 'Sine.easeInOut',
          onUpdate: () => {
            const tt = progress.t;
            hand.x = Phaser.Math.Linear(sourcePoint.x, targetPoint.x, tt);
            hand.y = Phaser.Math.Linear(sourcePoint.y, targetPoint.y, tt) - 50 * Math.sin(Math.PI * tt);
          },
        });
      });
      const press2 = this.time.delayedCall(560 + JUICE.tutorialHand.travelDuration, () => {
        if (!this.tutorialActive) return;
        this.tweens.add({ targets: hand, scaleX: 0.85, scaleY: 0.85, duration: JUICE.tutorialHand.pressDuration, yoyo: true });
      });
      const fade = this.time.delayedCall(560 + JUICE.tutorialHand.travelDuration + JUICE.tutorialHand.holdDuration, () => {
        if (!this.tutorialActive) return;
        this.tweens.add({ targets: hand, alpha: 0, duration: 200 });
      });
      const loop = this.time.delayedCall(
        560 + JUICE.tutorialHand.travelDuration + JUICE.tutorialHand.holdDuration + 200 + JUICE.tutorialHand.cycleGapMs,
        runCycle,
      );
      this.tutorialTimers.push(press1, travel, press2, fade, loop);
    };

    runCycle();
  }

  private drawHandGlyph(): Phaser.GameObjects.Container {
    const g = this.add.graphics();
    const skin = hexToNum('#F2C49B');
    g.fillStyle(0x000000, 0.18);
    g.fillEllipse(2, 24, 26, 10);
    g.fillStyle(skin, 1);
    g.fillRoundedRect(-14, -4, 26, 26, 10);
    g.fillRoundedRect(-4, -28, 11, 28, 5);
    g.fillCircle(1.5, -28, 5.5);
    g.lineStyle(2, shade('#F2C49B', -0.25), 0.6);
    g.strokeRoundedRect(-14, -4, 26, 26, 10);
    return this.add.container(0, 0, [g]).setDepth(400);
  }

  private cancelTutorial(): void {
    if (!this.tutorialActive) return;
    this.tutorialActive = false;
    for (const timer of this.tutorialTimers) timer.remove(false);
    this.tutorialTimers = [];
    this.tutorialHand?.destroy();
    this.tutorialHand = undefined;
  }
}
