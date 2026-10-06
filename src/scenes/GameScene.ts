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
import { levelConfigFor, moveLimitFor } from '../core/difficultyCurve';
import { dailyPuzzleConfig } from '../core/dailyPuzzle';
import { todayKey } from '../core/dailyReward';
import { generateVerifiedLevel } from '../core/levelGenerator';
import { computePar } from '../core/solver';
import { accentFor, createItemVisual, strokeArc } from './itemVisuals';
import { JUICE, DIFFICULTY, themeForLevel } from '../config/tuning';
import { COLORS, RADIUS, SHADOW, TYPE_SCALE, hexToNum, shade } from './theme';
import { readSafeAreaInsets } from './safeArea';
import { syncBodyBackground } from './bodyBackground';
import { fadeToScene } from './sceneTransition';
import { getDebugLevelParam } from './debugLevelParam';
import { ConfettiEmitter, prefersReducedMotion } from './confetti';
import { type HapticService, WebVibrationHapticService } from '../services/HapticService';
import { type SoundService, WebAudioSoundService } from '../services/SoundService';
import { LocalStorageSaveService, type SaveData, type SaveService } from '../services/SaveService';
import { type AnalyticsService, ConsoleAnalyticsService } from '../services/AnalyticsService';
import { t } from '../i18n/translations';
import type { Language, TranslationKey } from '../i18n/translations';
import type { ActiveObstacles, Button, FeedbackKind, Layout, SessionMode } from './gameTypes';
import { BUTTON_HEIGHT, BUTTON_WIDTH, createBackButton, createButton, drawStarGlyph } from './gameHud';
import { GameJuiceFx } from './gameAnimations';
import { GameInputController } from './gameInput';
import { TutorialController } from './gameTutorial';
import { showLevelCompletePanel, showLevelLostPanel } from './gamePanels';

const PROGRESS_LEVEL_STARS = 10;
const DAILY_PUZZLE_STARS = 15;
const MYSTERY_TYPE = '__mystery__';
/** saveData.seenHints'teki engel ipucu anahtarlarıyla (mystery/lock/typeLock) aynı mekanizmayı
 * paylaşan, ilk-hamle el animasyonu için "bir kere gösterildi" bayrağı. */
const MOVE_TUTORIAL_HINT_KEY = 'moveTutorial';

export interface GameSceneData {
  readonly mode?: 'progress' | 'daily';
  readonly levelNumber?: number;
}

interface LoadedLevel {
  readonly state: GameState;
  readonly mode: SessionMode;
  readonly label: string;
  readonly obstacles: ActiveObstacles;
  readonly par: number;
  readonly parExact: boolean;
  /** 0 = limitsiz (demo/debug). progress/daily'de her zaman >0 -- bkz. moveLimitFor. */
  readonly moveLimit: number;
}

// "Taban" (en fazla 2 satır / 6 kap olan erken seviyeler için) boyutlar. Daha fazla kap
// gerektiren ileri seviyelerde computeLayouts() bunları satır sayısına göre küçültüp
// this.containerWidth/this.slotHeight üzerinden kullanır -- aksi halde kap ızgarası alt
// butonların arkasına taşıp ekrandan kesilirdi (bkz. 12 kaplı seviyelerde gözlenen taşma).
// MAX_GRID_SCALE: az sayıda kap olan (erken) seviyelerde ızgara 1x'te kilitlenip altında boş
// alan bırakmasın diye -- ekrana sığdığı sürece 1'in ÜZERİNE de büyüyebilir (bkz. "boşluk < %25").
const BASE_CONTAINER_WIDTH = 150;
const BASE_SLOT_HEIGHT = 54;
const COLS = 3;
const COL_GAP = 16;
const ROW_GAP = 22;
const TOP_MARGIN = 170;
const BASE_ITEM_INSET_X = 12;
const BASE_ITEM_INSET_Y = 5;
const MIN_GRID_SCALE = 0.52;
const MAX_GRID_SCALE = 1.32;

const INK = hexToNum(COLORS.ink);

export class GameScene extends Phaser.Scene {
  private readonly saveService: SaveService = new LocalStorageSaveService(window.localStorage);
  private readonly hapticService: HapticService = new WebVibrationHapticService();
  private readonly soundService: SoundService = new WebAudioSoundService();
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
  private confetti!: ConfettiEmitter;

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

  private mysteryActive = false;
  private par = 0;
  private moveLimit = 0;
  private gameOver = false;
  private extraContainerUsesLeft = 0;

  private framesLayer!: Phaser.GameObjects.Container;
  private itemsLayer!: Phaser.GameObjects.Container;
  private statusSubText!: Phaser.GameObjects.Text;
  private stuckBanner!: Phaser.GameObjects.Text;
  private undoButton!: Button;
  private extraContainerButton!: Button;

  private moveCount = 0;

  // Girdi (dokun/sürükle), animasyon/juice-fx ve öğretici -- ayrı modüllere taşındı (bkz.
  // gameInput.ts / gameAnimations.ts / gameTutorial.ts). GameScene bunları "host" arayüzleriyle
  // besler; her biri create()'de taze bir örnekle kurulur (önceki oturumdan durum sızmasın diye).
  private inputController!: GameInputController;
  private fx!: GameJuiceFx;
  private tutorial!: TutorialController;

  constructor() {
    super('GameScene');
  }

  create(data: GameSceneData): void {
    this.saveData = this.saveService.load();
    this.lang = this.saveData.language;

    const loaded = this.loadLevel(data);

    this.gameState = loaded.state;
    this.sessionMode = loaded.mode;
    // Not: debug modunda (?level=N) RoomScene veriyi GameSceneData olarak iletmez -- bu yüzden
    // levelNumber burada URL parametresinden de okunur (tema rotasyonu, ekstra-kap ücretsizlik
    // eşiği gibi her yerde "hangi seviyedeyiz" bilgisine ihtiyaç duyan kodun tutarlı çalışması için).
    this.levelNumber = data.levelNumber ?? getDebugLevelParam() ?? null;
    this.mysteryActive = loaded.obstacles.mystery;
    this.par = loaded.par;
    this.moveLimit = loaded.moveLimit;
    this.gameOver = false;
    this.undoStack = new UndoStack<GameState>();
    this.layouts = new Map();
    this.selectedId = null;
    this.comboCount = 0;
    this.isAnimating = false;
    this.wasStuck = false;
    this.levelStartTime = Date.now();
    this.undoCount = 0;
    this.moveCount = 0;
    this.extraContainerUsesLeft = DIFFICULTY.extraContainerFreeUsesPerLevel;
    this.confetti = new ConfettiEmitter(this, 200);

    this.fx = new GameJuiceFx({
      scene: this,
      getLayout: (id) => this.layouts.get(id),
      getItemsLayerChildren: () => this.itemsLayer.list as Phaser.GameObjects.Container[],
      getGameState: () => this.gameState,
      getSlotHeight: () => this.slotHeight,
      getStarAnchor: () => this.starAnchor,
      getLang: () => this.lang,
      spawnItemVisual: (type, x, y) => this.spawnItemVisual(type, x, y),
    });
    this.tutorial = new TutorialController({
      scene: this,
      getGameState: () => this.gameState,
      getLayout: (id) => this.layouts.get(id),
      getSlotHeight: () => this.slotHeight,
      isAnimating: () => this.isAnimating,
    });
    this.inputController = new GameInputController({
      isAnimating: () => this.isAnimating,
      findContainerAt: (x, y) => this.findContainerAt(x, y),
      getTopRunLengthFor: (id) => {
        const container = this.gameState.containers.find((c) => c.id === id);
        return container ? getTopRunLength(container) : 0;
      },
      getSelectedId: () => this.selectedId,
      setSelectedId: (id) => {
        this.selectedId = id;
      },
      moveRunVisual: (id, dx, dy) => this.fx.moveRunVisual(id, dx, dy),
      drawFrames: () => this.drawFrames(),
      render: () => this.render(),
      attemptMove: (sourceId, targetId) => this.attemptMove(sourceId, targetId),
      feedbackTap: () => this.feedback('tap'),
      cancelTutorial: () => this.tutorial.cancel(),
    });

    const insets = readSafeAreaInsets(this.sys.game.canvas as HTMLCanvasElement);
    this.safeTop = insets.top;
    this.safeBottom = insets.bottom;

    this.analytics.track({ name: 'level_start', levelNumber: this.levelNumber ?? 0, mode: loaded.mode });

    this.cameras.main.fadeIn(220);
    this.drawBackground();

    const headerY = this.safeTop + 26;

    if (this.sessionMode === 'progress' || this.sessionMode === 'daily') {
      createBackButton(this, insets.left + 30, headerY, () => {
        if (!this.isAnimating) fadeToScene(this, 'RoomScene');
      });
    }

    const labelText = this.add
      .text(0, headerY, loaded.label, {
        fontFamily: 'Fredoka, sans-serif',
        fontSize: `${TYPE_SCALE.sectionTitle}px`,
        fontStyle: '600',
        color: COLORS.ink,
        stroke: '#ffffff',
        strokeThickness: 3,
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
    pill.fillStyle(hexToNum(COLORS.surface), 0.88);
    pill.fillRoundedRect(this.scale.width / 2 - pillW / 2, headerY - 20, pillW, 40, 20);
    pill.lineStyle(2, hexToNum(COLORS.coral), 0.55);
    pill.strokeRoundedRect(this.scale.width / 2 - pillW / 2, headerY - 20, pillW, 40, 20);
    pill.setDepth(0);

    this.starAnchor = { x: this.scale.width / 2 + pillW / 2 - 24, y: headerY };
    drawStarGlyph(this, this.starAnchor.x, this.starAnchor.y, 9);

    this.statusSubText = this.add
      .text(this.scale.width / 2, headerY + 32, '', {
        fontFamily: 'Fredoka, sans-serif',
        fontSize: `${TYPE_SCALE.hudCounter}px`,
        fontStyle: '600',
        color: COLORS.inkSoft,
        stroke: '#ffffff',
        strokeThickness: 2,
      })
      .setOrigin(0.5);

    this.stuckBanner = this.add
      .text(this.scale.width / 2, headerY + 56, t('stuckBanner', this.lang), {
        fontFamily: 'Fredoka, sans-serif',
        fontSize: `${TYPE_SCALE.body}px`,
        color: COLORS.cream,
        backgroundColor: COLORS.danger,
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.framesLayer = this.add.container(0, 0);
    this.itemsLayer = this.add.container(0, 0);

    const buttonY = this.scale.height - this.safeBottom - BUTTON_HEIGHT / 2 - 6;
    this.undoButton = createButton(
      this,
      this.scale.width / 2 - (BUTTON_WIDTH + 20) / 2,
      buttonY,
      t('undoButton', this.lang),
      'undo',
      () => this.onUndo(),
      () => this.isAnimating,
    );
    this.extraContainerButton = createButton(
      this,
      this.scale.width / 2 + (BUTTON_WIDTH + 20) / 2,
      buttonY,
      this.extraContainerLabel(),
      'plus',
      () => this.onAddExtraContainer(),
      () => this.isAnimating,
    );
    this.extraContainerButton.setEnabled(this.extraContainerUsesLeft > 0);

    this.undoButton.setEnabled(false);
    this.refreshAll();
    this.checkStuckOrWin();

    this.input.on('pointerdown', this.inputController.onPointerDown, this.inputController);
    this.input.on('pointermove', this.inputController.onPointerMove, this.inputController);
    this.input.on('pointerup', this.inputController.onPointerUp, this.inputController);

    if (this.sessionMode === 'progress' && this.levelNumber === 1 && !this.saveData.seenHints.includes(MOVE_TUTORIAL_HINT_KEY)) {
      this.saveData = { ...this.saveData, seenHints: [...this.saveData.seenHints, MOVE_TUTORIAL_HINT_KEY] };
      this.saveService.save(this.saveData);
      this.time.delayedCall(500, () => this.tutorial.start());
    }

    this.fx.scheduleBlink();
    this.maybeShowObstacleHints(loaded.obstacles);
  }

  private loadLevel(data: GameSceneData): LoadedLevel {
    const noObstacles: ActiveObstacles = { mystery: false, lock: false, typeLock: false };
    const debugLevel = getDebugLevelParam();
    if (debugLevel !== null) {
      const result = generateVerifiedLevel(levelConfigFor(debugLevel));
      const lockNote = result.hasLock ? t('lockedContainerNote', this.lang) : '';
      const { par, exact } = computePar(result.initialState, result.verifiedMoveCount, DIFFICULTY.livePaSolverMaxStates);
      const moveLimit = moveLimitFor(debugLevel, result.verifiedMoveCount);
      const parNote = ` par=${par}${exact ? '' : '~'} limit=${moveLimit}`;
      return {
        state: result.initialState,
        mode: 'debug',
        label: `${t('generatedLevelLabel', this.lang, { n: debugLevel })}${lockNote}${parNote}`,
        obstacles: { mystery: result.mysteryActive, lock: result.hasLock, typeLock: result.hasTypeLock },
        par,
        parExact: exact,
        moveLimit,
      };
    }

    if (data.mode === 'daily') {
      const result = generateVerifiedLevel(dailyPuzzleConfig(todayKey(new Date())));
      const { par, exact } = computePar(result.initialState, result.verifiedMoveCount, DIFFICULTY.livePaSolverMaxStates);
      return {
        state: result.initialState,
        mode: 'daily',
        label: t('dailyPuzzleLabel', this.lang),
        obstacles: { mystery: result.mysteryActive, lock: result.hasLock, typeLock: result.hasTypeLock },
        par,
        parExact: exact,
        moveLimit: moveLimitFor(15, result.verifiedMoveCount),
      };
    }

    if (data.mode === 'progress' && data.levelNumber) {
      const result = generateVerifiedLevel(levelConfigFor(data.levelNumber));
      const lockNote = result.hasLock ? t('lockedContainerNote', this.lang) : '';
      const { par, exact } = computePar(result.initialState, result.verifiedMoveCount, DIFFICULTY.livePaSolverMaxStates);
      return {
        state: result.initialState,
        mode: 'progress',
        label: `${t('levelLabel', this.lang, { n: data.levelNumber })}${lockNote}`,
        obstacles: { mystery: result.mysteryActive, lock: result.hasLock, typeLock: result.hasTypeLock },
        par,
        parExact: exact,
        moveLimit: moveLimitFor(data.levelNumber, result.verifiedMoveCount),
      };
    }

    return {
      state: createDemoLevel(),
      mode: 'demo',
      label: t('demoLevelLabel', this.lang),
      obstacles: noObstacles,
      par: 0,
      parExact: true,
      moveLimit: 0,
    };
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
  // Görsel: arkaplan
  // ---------------------------------------------------------------------

  private drawBackground(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const wallBottom = h * 0.58;
    const theme = themeForLevel(this.levelNumber ?? 1);
    syncBodyBackground(theme.bgTop, theme.bgBottom);

    const g = this.add.graphics();
    g.fillGradientStyle(hexToNum(theme.bgTop), hexToNum(theme.bgTop), shade(theme.bgTop, -0.08), shade(theme.bgTop, -0.08), 1, 1, 1, 1);
    g.fillRect(0, 0, w, wallBottom);

    g.fillGradientStyle(
      hexToNum(theme.bgBottom),
      hexToNum(theme.bgBottom),
      shade(theme.bgBottom, -0.2),
      shade(theme.bgBottom, -0.2),
      1,
      1,
      1,
      1,
    );
    g.fillRect(0, wallBottom, w, h - wallBottom);

    g.fillStyle(0xffffff, 0.25);
    g.fillRect(0, wallBottom - 2, w, 3);

    g.fillStyle(0xffffff, 0.08);
    for (let i = 0; i < 5; i++) {
      const ly = wallBottom + 18 + i * ((h - wallBottom - 24) / 5);
      g.fillRect(0, ly, w, 1.5);
    }

    g.fillStyle(0xffffff, 0.1);
    g.fillCircle(w * 0.86, h * 0.14, 110);
    g.fillStyle(0x000000, 0.05);
    g.fillCircle(w * 0.08, h * 0.46, 130);

    // Kapların altındaki boş zemini bir "halı" illüstrasyonuyla doldurur -- az sayıda kap olan
    // (erken) seviyelerde ekranın alt yarısı çıplak/boş hissettirmesin diye belirgin (yüksek alfa,
    // çok katmanlı) bir desen kullanılır.
    const rugY = h * 0.79;
    const rugW = w * 0.82;
    const rugH = h * 0.2;
    g.fillStyle(0xffffff, 0.22);
    g.fillEllipse(w / 2, rugY, rugW, rugH);
    g.fillStyle(0xffffff, 0.16);
    g.fillEllipse(w / 2, rugY, rugW * 0.74, rugH * 0.7);
    g.lineStyle(3, 0xffffff, 0.3);
    g.strokeEllipse(w / 2, rugY, rugW * 0.9, rugH * 0.86);
    g.lineStyle(2, 0xffffff, 0.24);
    g.strokeEllipse(w / 2, rugY, rugW * 0.5, rugH * 0.46);
  }

  // ---------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------

  private computeLayouts(): void {
    this.layouts.clear();
    const ids = this.gameState.containers.map((c) => c.id);

    // Kap sayısı artıp 2'den fazla satır gerektiğinde (ileri seviyeler) ızgarayı buton
    // satırının üstünde kalacak şekilde küçültür -- aksi halde alt satırlar butonların
    // arkasında kesilirdi. Az sayıda kap olan (erken) seviyelerde ise 1'in ÜZERİNE büyütüp
    // ekranın alt yarısını boş bırakmaz (bkz. MAX_GRID_SCALE) -- ama en GENİŞ satır (en fazla
    // COLS kap) her zaman ekran genişliğine (kenar boşluklarıyla) sığmalı, aksi halde kaplar
    // ekranın yanlarından taşar.
    const rows = Math.max(1, Math.ceil(ids.length / COLS));
    const buttonTop = this.scale.height - this.safeBottom - BUTTON_HEIGHT - 26;
    const availableHeight = Math.max(100, buttonTop - TOP_MARGIN);
    const neededAtBase = rows * 4 * BASE_SLOT_HEIGHT + (rows - 1) * ROW_GAP;
    const heightScale = availableHeight / neededAtBase;

    const widestRow = Math.min(COLS, ids.length);
    const sideMargin = 20;
    const availableWidth = this.scale.width - 2 * sideMargin;
    const neededWidthAtBase = widestRow * BASE_CONTAINER_WIDTH + (widestRow - 1) * COL_GAP;
    const widthScale = availableWidth / neededWidthAtBase;

    const scale = Math.max(MIN_GRID_SCALE, Math.min(MAX_GRID_SCALE, heightScale, widthScale));

    this.slotHeight = BASE_SLOT_HEIGHT * scale;
    this.containerWidth = BASE_CONTAINER_WIDTH * scale;
    this.itemInsetX = BASE_ITEM_INSET_X * scale;
    this.itemInsetY = BASE_ITEM_INSET_Y * scale;
    const colGap = COL_GAP * scale;
    const rowGap = ROW_GAP * scale;

    const totalGridHeight = rows * 4 * this.slotHeight + (rows - 1) * rowGap;
    const verticalSlack = Math.max(0, availableHeight - totalGridHeight);
    // Az sayıda satır olan (erken) seviyelerde dikey boşluk ızgarayı ORTALAMAK için kullanılır --
    // aksi halde kaplar üstte kalıp altta "boş" hissi veren büyük bir alan bırakırdı (bkz. "boşluk < %25").
    const topOffset = TOP_MARGIN + verticalSlack * 0.48;

    ids.forEach((id, index) => {
      const container = this.gameState.containers.find((c) => c.id === id)!;
      const row = Math.floor(index / COLS);
      const col = index % COLS;
      const itemsInRow = Math.min(COLS, ids.length - row * COLS);
      const rowWidth = itemsInRow * this.containerWidth + (itemsInRow - 1) * colGap;
      const rowStartX = this.scale.width / 2 - rowWidth / 2;

      const boxHeight = container.capacity * this.slotHeight;
      const x = rowStartX + col * (this.containerWidth + colGap);
      const y = topOffset + row * (4 * this.slotHeight + rowGap);

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
        locked ? 0.75 : 0.9,
        locked ? 0.75 : 0.9,
        locked ? 0.75 : 0.9,
        locked ? 0.75 : 0.9,
      );
      g.fillRoundedRect(rx, ry, rw, rh, RADIUS.lg);

      // kapasite bölme çizgileri (boş gözler hafifçe belli olsun)
      g.lineStyle(1, hexToNum(COLORS.inkSoft), 0.14);
      for (let i = 1; i < c.capacity; i++) {
        const ly = ry + i * this.slotHeight;
        g.lineBetween(rx + 8, ly, rx + rw - 8, ly);
      }

      // dış çerçeve (ahşap/raf kenarı hissi)
      g.lineStyle(
        isSelected ? 4 : 3,
        isSelected ? hexToNum(COLORS.coral) : locked ? hexToNum(COLORS.inkSoft) : shade(COLORS.amber, -0.1),
        isSelected ? 1 : locked ? 0.55 : 0.75,
      );
      g.strokeRoundedRect(rx, ry, rw, rh, RADIUS.lg);

      // iç gölge: camın en üstte hafifçe koyulaşması -- "içine bakılan bir kap" hissi.
      g.fillStyle(SHADOW.color, 0.1);
      g.fillRoundedRect(rx, ry, rw, Math.min(16, rh * 0.18), { tl: RADIUS.lg, tr: RADIUS.lg, bl: 0, br: 0 });
      // cam rim parıltısı: üst kenarın hemen içinde ince bir parlak çizgi.
      g.lineStyle(2, 0xffffff, 0.5);
      g.lineBetween(rx + RADIUS.lg * 0.6, ry + 2, rx + rw - RADIUS.lg * 0.6, ry + 2);

      this.framesLayer.add(g);

      if (locked) {
        // Üst-sol köşe: üst item her zaman kap merkezinde durduğu için köşe rozetleri hiçbir
        // zaman eşyanın altında kalmaz (bkz. Faz 4 kararları -- eski merkez konum eşyanın
        // arkasında neredeyse tamamen gizleniyordu).
        this.framesLayer.add(this.createLockGlyph(rx + 18, ry + 18));
      }
      if (c.onlyAccepts) {
        this.framesLayer.add(this.createTypeLockGlyph(rx + rw - 18, ry + 18, c.onlyAccepts));
      }
    }
  }

  /** Büyük, anlaşılır bir asma kilit rozeti: kavis (shackle) + gövde + anahtar deliği, her zaman
   * okunur kalması için beyaz bir rozet zemini üzerinde (bkz. Faz 4 kararları -- eskisi çok küçük
   * ve zemin olmadan düşük kontrastlıydı). */
  private createLockGlyph(x: number, y: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics({ x, y });
    g.fillStyle(hexToNum(COLORS.surface), 0.95);
    g.fillCircle(0, 1, 15);
    g.lineStyle(2, hexToNum(COLORS.inkSoft), 0.3);
    g.strokeCircle(0, 1, 15);

    g.lineStyle(3.2, INK, 0.85);
    strokeArc(g, 0, -1, 6.5, 180, 360, 10);
    g.fillStyle(INK, 0.85);
    g.fillRoundedRect(-9, -2, 18, 15, 4);
    g.fillStyle(hexToNum(COLORS.surface), 0.9);
    g.fillCircle(0, 4, 2.2);
    return g;
  }

  /** "Tek türlü kap" engelinin renkli halka göstergesi -- o türün aksan rengiyle boyanır, lock
   * rozetiyle aynı ölçekte (bkz. Faz 4 kararları: daha belirgin olsun diye büyütüldü). */
  private createTypeLockGlyph(x: number, y: number, acceptedType: string): Phaser.GameObjects.Graphics {
    const g = this.add.graphics({ x, y });
    const color = hexToNum(accentFor(acceptedType));
    g.fillStyle(hexToNum(COLORS.surface), 0.95);
    g.fillCircle(0, 0, 11);
    g.lineStyle(3.2, color, 1);
    g.strokeCircle(0, 0, 11);
    g.fillStyle(color, 1);
    g.fillCircle(0, 0, 5);
    return g;
  }

  private findContainerAt(x: number, y: number): string | null {
    for (const [id, layout] of this.layouts) {
      if (layout.rect.contains(x, y)) return id;
    }
    return null;
  }

  // ---------------------------------------------------------------------
  // İlk görülen engel türleri için kısa ipucu balonu
  // ---------------------------------------------------------------------

  private maybeShowObstacleHints(obstacles: ActiveObstacles): void {
    const candidates: { key: string; flag: boolean; titleKey: TranslationKey; bodyKey: TranslationKey }[] = [
      { key: 'mystery', flag: obstacles.mystery, titleKey: 'hintMysteryTitle', bodyKey: 'hintMysteryBody' },
      { key: 'lock', flag: obstacles.lock, titleKey: 'hintLockTitle', bodyKey: 'hintLockBody' },
      { key: 'typeLock', flag: obstacles.typeLock, titleKey: 'hintTypeLockTitle', bodyKey: 'hintTypeLockBody' },
    ];
    const unseen = candidates.find((c) => c.flag && !this.saveData.seenHints.includes(c.key));
    if (!unseen) return;

    this.saveData = { ...this.saveData, seenHints: [...this.saveData.seenHints, unseen.key] };
    this.saveService.save(this.saveData);
    this.time.delayedCall(700, () => this.showHintBubble(t(unseen.titleKey, this.lang), t(unseen.bodyKey, this.lang)));
  }

  private showHintBubble(title: string, body: string): void {
    const w = Math.min(this.scale.width - 40, 380);
    const y = this.safeTop + 158;
    const container = this.add.container(this.scale.width / 2, y).setDepth(250).setAlpha(0);

    const bg = this.add.graphics();
    bg.fillStyle(hexToNum(COLORS.ink), 0.92);
    bg.fillRoundedRect(-w / 2, -32, w, 64, 16);
    container.add(bg);
    container.add(
      this.add
        .text(0, -14, title, { fontFamily: 'Fredoka, sans-serif', fontSize: '14px', fontStyle: '600', color: COLORS.cream })
        .setOrigin(0.5),
    );
    container.add(
      this.add
        .text(0, 10, body, {
          fontFamily: 'Fredoka, sans-serif',
          fontSize: `${TYPE_SCALE.caption}px`,
          color: COLORS.cream,
          align: 'center',
          wordWrap: { width: w - 32 },
        })
        .setOrigin(0.5),
    );

    this.tweens.add({ targets: container, alpha: 1, duration: 220 });
    this.time.delayedCall(3200, () => {
      this.tweens.add({ targets: container, alpha: 0, duration: 260, onComplete: () => container.destroy() });
    });
  }

  // ---------------------------------------------------------------------
  // Hamle yürütme (girdi denetleyicisi tarafından çağrılır)
  // ---------------------------------------------------------------------

  private attemptMove(sourceId: string, targetId: string): void {
    const outcome = tryMove(this.gameState, { sourceId, targetId });
    if (!outcome.ok) {
      this.feedback('invalid');
      this.fx.flashInvalid(targetId);
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

    this.fx.animateMove(sourceId, targetId, movedType, movedCount, () => {
      this.gameState = newState;
      this.isAnimating = false;
      this.drawFrames();
      this.render();
      this.fx.playLandBounce(targetId, movedCount);
      this.feedback('land');

      if (completion) {
        this.comboCount++;
        this.fx.flashCompletion(targetId);
        this.feedback('complete');
        if (this.comboCount >= JUICE.combo.minComboToShow) {
          this.fx.showCombo(targetId, this.comboCount);
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
    // Not: moveCount burada AZALTILMAZ -- geri alınan hamle görsel olarak iptal olsa da, yıldız
    // puanlaması için "hamle sayısına eklenir" (bkz. onLevelWon: effectiveMoves = moveCount + undoCount).
    this.undoCount++;
    this.selectedId = null;
    this.comboCount = 0;
    this.undoButton.setEnabled(this.undoStack.canUndo());
    this.feedback('tap');
    this.analytics.track({ name: 'booster_used', booster: 'undo' });
    this.refreshAll();
    this.checkStuckOrWin();
  }

  /** "Ekstra Kap" seviye başına DIFFICULTY.extraContainerFreeUsesPerLevel kadar ücretsiz hak
   * verir (reklam/satın alma yok); kalan hak sayısı butonun üzerinde gösterilir. */
  private onAddExtraContainer(): void {
    if (this.isAnimating || this.extraContainerUsesLeft <= 0) return;
    this.grantExtraContainer();
  }

  private extraContainerLabel(): string {
    return t('extraContainerButton', this.lang, { remaining: this.extraContainerUsesLeft });
  }

  private grantExtraContainer(): void {
    this.extraContainerUsesLeft--;
    this.extraContainerButton.setLabel(this.extraContainerLabel());
    this.extraContainerButton.setEnabled(this.extraContainerUsesLeft > 0);
    this.analytics.track({ name: 'booster_used', booster: 'extra-container' });

    const capacity = this.gameState.containers[0]?.capacity ?? 4;
    this.undoStack.push(this.gameState);
    this.undoButton.setEnabled(true);
    this.gameState = addEmptyContainer(this.gameState, capacity);
    this.feedback('medium');
    this.refreshAll();
    this.checkStuckOrWin();
  }

  /** moveLimit>0 olan modlarda (progress/daily/debug), undo da dahil edilerek (bkz. onUndo) hamle
   * bütçesi tükendi mi kontrol eder. demo modunda moveLimit=0 olduğu için hiç tetiklenmez. */
  private isOutOfMoves(): boolean {
    if (this.moveLimit <= 0 || this.gameOver) return false;
    return this.moveCount + this.undoCount >= this.moveLimit;
  }

  private checkStuckOrWin(): void {
    if (isLevelComplete(this.gameState)) {
      this.wasStuck = false;
      this.hideStuckBanner();
      this.onLevelWon();
      return;
    }
    if (this.isOutOfMoves()) {
      this.wasStuck = false;
      this.hideStuckBanner();
      this.onLevelLost();
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
    this.feedback('complete');

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

    // Yıldız (performans) derecelendirmesi: undo kullanımı hamle sayısına eklenir (bkz. onUndo).
    const effectiveMoves = this.moveCount + this.undoCount;
    const rating = this.par <= 0 ? 3 : effectiveMoves <= this.par ? 3 : effectiveMoves <= this.par * 1.3 ? 2 : 1;

    showLevelCompletePanel(this, {
      rating,
      awarded,
      isDailyPuzzle: this.sessionMode === 'daily',
      lang: this.lang,
      confetti: this.confetti,
      prefersReducedMotion,
      onNext: () => fadeToScene(this, 'RoomScene'),
    });
  }

  private onLevelLost(): void {
    this.gameOver = true;
    this.isAnimating = true;
    this.feedback('invalid');
    this.analytics.track({
      name: 'level_lost',
      levelNumber: this.levelNumber ?? 0,
      moveCount: this.moveCount,
      undoCount: this.undoCount,
      moveLimit: this.moveLimit,
    });
    showLevelLostPanel(this, {
      moveLimit: this.moveLimit,
      lang: this.lang,
      onRetry: () => this.restartSameLevel(),
      onBackToRoom: () => fadeToScene(this, 'RoomScene'),
    });
  }

  private restartSameLevel(): void {
    if (this.sessionMode === 'progress' && this.levelNumber !== null) {
      this.scene.start('GameScene', { mode: 'progress', levelNumber: this.levelNumber });
    } else if (this.sessionMode === 'daily') {
      this.scene.start('GameScene', { mode: 'daily' });
    } else {
      this.scene.restart();
    }
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
        this.fx.flashUnlock(c.id);
        this.feedback('medium');
      }
    }
  }

  private render(): void {
    this.itemsLayer.removeAll(true);

    const total = this.gameState.containers.reduce((sum, c) => sum + c.items.length, 0);
    const activePointerId = this.inputController.getActivePointerId();
    const dragRunLength = this.inputController.getDragRunLength();

    for (const c of this.gameState.containers) {
      const layout = this.layouts.get(c.id)!;
      const runLength = this.selectedId === c.id ? getTopRunLength(c) : 0;
      const liftIndexThreshold = c.items.length - runLength;

      c.items.forEach((item, idx) => {
        const isTopItem = idx === c.items.length - 1;
        const slotFromBottom = idx;
        const rowFromTop = c.capacity - 1 - slotFromBottom;
        const x = layout.centerX;
        const restY = layout.topY + rowFromTop * this.slotHeight + this.slotHeight / 2;

        const isLifted = this.selectedId === c.id && idx >= liftIndexThreshold;
        const y = isLifted ? restY - JUICE.select.liftDistance : restY;

        const displayType = this.mysteryActive && !isTopItem ? MYSTERY_TYPE : item.type;
        const visual = this.spawnItemVisual(displayType, x, restY);
        visual.setData('containerId', c.id);
        visual.setData('stackIndex', idx);
        visual.setData('isTop', isTopItem);
        visual.setData('inDragRun', idx >= c.items.length - dragRunLength && c.id === activePointerId);
        visual.setData('baseX', x);
        visual.setData('baseY', restY);
        this.itemsLayer.add(visual);

        if (isLifted) {
          (visual.getData('setExcited') as ((v: boolean) => void) | undefined)?.(true);
          this.tweens.add({ targets: visual, y, duration: JUICE.select.duration, ease: 'Sine.easeOut' });
        }

        // Boştaki hafif "nefes alma" pulsasyonu -- yalnızca en üstteki (görünür) eşyada, performans
        // için. Her karakter farklı FAZ ve sürede nefes alsın diye rastgele gecikme + süre verilir.
        if (isTopItem) {
          const duration = Phaser.Math.Between(JUICE.idle.durationMin, JUICE.idle.durationMax);
          const delay = Phaser.Math.Between(0, 500);
          this.tweens.add({
            targets: visual,
            scaleX: 1 + JUICE.idle.scaleAmount,
            scaleY: 1 + JUICE.idle.scaleAmount,
            duration,
            delay,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        }
      });
    }

    const effectiveMoves = this.moveCount + this.undoCount;
    const moveText =
      this.moveLimit > 0
        ? `${t('moveLabel', this.lang)}: ${effectiveMoves}/${this.moveLimit}`
        : `${t('moveLabel', this.lang)}: ${this.moveCount}`;
    this.statusSubText.setText(`${moveText}   ${t('remainingItemsLabel', this.lang)}: ${total}`);
    const movesLeft = this.moveLimit > 0 ? this.moveLimit - effectiveMoves : Infinity;
    this.statusSubText.setColor(movesLeft <= 3 ? COLORS.danger : COLORS.inkSoft);
  }

  private spawnItemVisual(type: string, x: number, y: number): Phaser.GameObjects.Container {
    const w = this.containerWidth - this.itemInsetX * 2;
    const h = this.slotHeight - this.itemInsetY * 2;
    if (type === MYSTERY_TYPE) {
      return this.createMysteryVisual(x, y, w, h);
    }
    const { container } = createItemVisual(this, type, w, h);
    container.setPosition(x, y);
    return container;
  }

  /** "Gizemli eşya" engeli: kabın en üstünde olmayan eşyalar yüzü kapalı bir "?" olarak çizilir.
   * Zarif/hafif bir "örtülü" his için AÇIK bir degrade + ince noktalı çerçeve kullanılır -- eski
   * koyu/ağır gövde yerine (bkz. Faz 4 kararları). */
  private createMysteryVisual(x: number, y: number, w: number, h: number): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(SHADOW.color, SHADOW.alpha);
    g.fillEllipse(0, h * 0.4, w * 0.6, h * 0.26);
    const bodyW = w * 0.64;
    const bodyH = h * 0.64;
    g.fillGradientStyle(
      shade(COLORS.inkSoft, 0.62),
      shade(COLORS.inkSoft, 0.62),
      shade(COLORS.inkSoft, 0.28),
      shade(COLORS.inkSoft, 0.28),
      1,
      1,
      1,
      1,
    );
    g.fillRoundedRect(-bodyW / 2, -bodyH / 2, bodyW, bodyH, 10);
    // noktalı çerçeve: "örtülü/kapalı" hissini ağırlaştırmadan veren ince bir detay.
    g.fillStyle(hexToNum(COLORS.surface), 0.8);
    const dotR = 1.4;
    const inset = 7;
    const dotsPerSide = 5;
    for (let i = 0; i < dotsPerSide; i++) {
      const tt = i / (dotsPerSide - 1);
      const ex = -bodyW / 2 + inset + tt * (bodyW - inset * 2);
      g.fillCircle(ex, -bodyH / 2 + inset, dotR);
      g.fillCircle(ex, bodyH / 2 - inset, dotR);
    }
    g.fillStyle(0xffffff, 0.35);
    g.fillEllipse(-bodyW * 0.18, -bodyH * 0.26, bodyW * 0.3, bodyH * 0.2);
    container.add(g);
    container.add(
      this.add
        .text(0, 0, '?', { fontFamily: 'Fredoka, sans-serif', fontSize: `${Math.round(bodyH * 0.6)}px`, fontStyle: '700', color: COLORS.ink })
        .setOrigin(0.5),
    );
    return container;
  }
}
