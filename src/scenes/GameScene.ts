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
import { MYSTERY_TYPE, createItemVisual, resetItemVisual } from './itemVisuals';
import { ContainerView } from './containerView';
import { JUICE, DIFFICULTY, themeForLevel } from '../config/tuning';
import { COLORS, EASE, hexToNum, textStyle } from './theme';
import { BASE_HEIGHT, BASE_WIDTH, setupView, toWorld, type View } from './viewport';
import { drawCozyBackground } from './background';
import { readSafeAreaInsets } from './safeArea';
import { enterScene, fadeToScene } from './sceneTransition';
import { getDebugLevelParam } from './debugLevelParam';
import { ConfettiEmitter, prefersReducedMotion } from './confetti';
import { type HapticService, createHapticService } from '../services/HapticService';
import { type SoundService, WebAudioSoundService } from '../services/SoundService';
import { audioEngine } from '../services/AudioEngine';
import { LocalStorageSaveService, recordLevelStars, type SaveData, type SaveService } from '../services/SaveService';
import { type AnalyticsService, ConsoleAnalyticsService } from '../services/AnalyticsService';
import { t } from '../i18n/translations';
import type { Language, TranslationKey } from '../i18n/translations';
import type { ActiveObstacles, Button, FeedbackKind, Layout, SessionMode } from './gameTypes';
import { createButton, createIconButton } from './ui';
import { iconBack, iconGear, iconPlus, iconUndo } from './icons';
import { openSettingsPanel, type SettingsPanelHandle } from './settingsPanel';
import { showAchievementToasts } from './progressUI';
import { addWallDecor } from './wallDecor';
import { addRibbon } from './ui';
import { themeIndexForLevel, THEME_CHANGE_EVERY_LEVELS } from './theme';
import type { TranslationKey as ChapterKey } from '../i18n/translations';
import { applyAchievements } from '../services/achievements';
import { GameJuiceFx } from './gameAnimations';
import { ParticleFx, bakeStar } from './fx';
import { GameInputController } from './gameInput';
import { TutorialController } from './gameTutorial';
import { showLevelCompletePanel, showLevelLostPanel } from './gamePanels';

const PROGRESS_LEVEL_STARS = 10;
const DAILY_PUZZLE_STARS = 15;
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
const BOTTOM_BUTTON_H = 58;
const BASE_ITEM_INSET_X = 12;
const BASE_ITEM_INSET_Y = 5;
const MIN_GRID_SCALE = 0.52;
const MAX_GRID_SCALE = 1.32;

export class GameScene extends Phaser.Scene {
  private vp: View = { width: BASE_WIDTH, height: BASE_HEIGHT };
  private readonly saveService: SaveService = new LocalStorageSaveService(window.localStorage);
  private readonly hapticService: HapticService = createHapticService();
  private readonly soundService: SoundService = new WebAudioSoundService(audioEngine);
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
  private particles!: ParticleFx;
  private hudStar: Phaser.GameObjects.Image | null = null;

  private layouts = new Map<string, Layout>();
  private containerViews = new Map<string, ContainerView>();
  private layoutSignature = '';
  private gridTopOffset = 0;
  private decor: Phaser.GameObjects.Container | null = null;
  private idleTimer: Phaser.Time.TimerEvent | null = null;
  private itemPool = new Map<string, Phaser.GameObjects.Container[]>();
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
  private moveChip!: HudChip;
  private itemsChip!: HudChip;
  private toastText!: Phaser.GameObjects.Text;
  private gridTop = 170;
  private settingsPanel: SettingsPanelHandle | null = null;
  private stuckBanner!: Phaser.GameObjects.Container;
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
    this.vp = setupView(this);
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
    this.containerViews = new Map();
    this.layoutSignature = '';
    this.decor = null;
    this.idleTimer = null;
    this.itemPool = new Map();
    this.selectedId = null;
    this.comboCount = 0;
    this.isAnimating = false;
    this.wasStuck = false;
    this.levelStartTime = Date.now();
    this.undoCount = 0;
    this.moveCount = 0;
    this.extraContainerUsesLeft = DIFFICULTY.extraContainerFreeUsesPerLevel;
    this.confetti = new ConfettiEmitter(this, 200);
    this.particles = new ParticleFx(this, 210);

    this.fx = new GameJuiceFx({
      scene: this,
      particles: this.particles,
      getContainerRoot: (id) => this.containerViews.get(id)?.root,
      onStarArrive: () => this.popHudStar(),
      getLayout: (id) => this.layouts.get(id),
      getItemsLayerChildren: () => (this.itemsLayer.list as Phaser.GameObjects.Container[]).filter((c) => c.active),
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
      setHint: (id, on) => this.containerViews.get(id)?.setHint(on),
    });
    this.inputController = new GameInputController({
      isAnimating: () => this.isAnimating || this.settingsPanel !== null,
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

    const insets = readSafeAreaInsets(this);
    this.safeTop = insets.top;
    this.safeBottom = insets.bottom;

    this.analytics.track({ name: 'level_start', levelNumber: this.levelNumber ?? 0, mode: loaded.mode });

    enterScene(this);
    this.settingsPanel = null;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off('hardware-back'));
    this.events.on('hardware-back', () => this.onHardwareBack());
    this.drawBackground();

    const headerY = this.safeTop + 30;
    const blocked = () => this.isAnimating || this.settingsPanel !== null;

    if (this.sessionMode === 'progress' || this.sessionMode === 'daily') {
      createIconButton(this, insets.left + 30, headerY, iconBack, () => fadeToScene(this, 'RoomScene'), { isBlocked: blocked, onPress: () => this.feedback('button') });
    }
    createIconButton(this, this.vp.width - insets.right - 30, headerY, iconGear, () => this.openSettings(), { isBlocked: blocked, onPress: () => this.feedback('button') });

    // Seviye hapı (ortada) -- HUD yıldızı hapın sağ ucunda (uçan yıldızların hedefi).
    const labelText = this.add.text(0, headerY - 1, loaded.label, textStyle('sectionTitle')).setOrigin(0.5).setDepth(1);
    const maxPillW = this.vp.width - 2 * (Math.max(insets.left, insets.right) + 64);
    if (labelText.width + 72 > maxPillW) labelText.setFontSize(13); // debug modunda uzun etiketler
    const pillW = Math.min(maxPillW, Math.max(170, labelText.width + 72));
    labelText.setX(this.vp.width / 2 - 14);
    const pill = this.add.graphics();
    pill.fillStyle(0xffffff, 0.92);
    pill.fillRoundedRect(this.vp.width / 2 - pillW / 2, headerY - 22, pillW, 44, 22);
    pill.lineStyle(1.5, hexToNum(COLORS.woodLight), 0.9);
    pill.strokeRoundedRect(this.vp.width / 2 - pillW / 2, headerY - 22, pillW, 44, 22);
    this.starAnchor = { x: this.vp.width / 2 + pillW / 2 - 24, y: headerY };
    this.hudStar = this.add.image(this.starAnchor.x, this.starAnchor.y, bakeStar(this, 20, true)).setDisplaySize(26, 26).setDepth(1);

    // Sayaç çipleri: hamle (kalan hakkı gösteren ince çubukla) + kalan eşya.
    const chipY = headerY + 56;
    this.moveChip = new HudChip(this, this.vp.width / 2 - 82, chipY, 150, t('moveLabel', this.lang), this.moveLimit > 0);
    this.itemsChip = new HudChip(this, this.vp.width / 2 + 82, chipY, 150, t('remainingItemsLabel', this.lang), false);
    this.gridTop = chipY + 44;

    // "Takıldın" bandı: sert kırmızı zemin yerine sakin koyu erik bir hap (suçlamayan ton).
    const stuckLabel = this.add.text(0, 0, t('stuckBanner', this.lang), textStyle('caption', { color: COLORS.cream })).setOrigin(0.5);
    const stuckW = stuckLabel.width + 36;
    const stuckBg = this.add.graphics();
    stuckBg.fillStyle(hexToNum(COLORS.overlay), 0.88);
    stuckBg.fillRoundedRect(-stuckW / 2, -17, stuckW, 34, 17);
    this.stuckBanner = this.add.container(this.vp.width / 2, chipY + 46, [stuckBg, stuckLabel]).setAlpha(0).setDepth(5);
    this.toastText = this.add.text(this.vp.width / 2, chipY + 46, '', textStyle('body', { color: COLORS.inkSoft })).setOrigin(0.5).setDepth(5);

    this.framesLayer = this.add.container(0, 0);
    this.itemsLayer = this.add.container(0, 0);

    const buttonY = this.vp.height - this.safeBottom - BOTTOM_BUTTON_H / 2 - 8;
    const btnW = Math.min(200, (this.vp.width - 60) / 2);
    this.undoButton = createButton(this, {
      x: this.vp.width / 2 - btnW / 2 - 8,
      y: buttonY,
      width: btnW,
      height: BOTTOM_BUTTON_H,
      label: t('undoButton', this.lang),
      variant: 'secondary',
      icon: iconUndo,
      isBlocked: blocked,
      onPress: () => this.feedback('button'),
      onTap: () => this.onUndo(),
    });
    this.extraContainerButton = createButton(this, {
      x: this.vp.width / 2 + btnW / 2 + 8,
      y: buttonY,
      width: btnW,
      height: BOTTOM_BUTTON_H,
      label: this.extraContainerLabel(),
      variant: 'sage',
      icon: iconPlus,
      isBlocked: blocked,
      onPress: () => this.feedback('button'),
      onTap: () => this.onAddExtraContainer(),
    });
    this.extraContainerButton.setEnabled(this.extraContainerUsesLeft > 0);

    this.undoButton.setEnabled(false);
    this.refreshAll();
    this.checkStuckOrWin();

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.scheduleIdleHint();
      this.inputController.onPointerDown(toWorld(this, p));
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.inputController.onPointerMove(toWorld(this, p)));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.inputController.onPointerUp(toWorld(this, p)));

    if (this.sessionMode === 'progress' && this.levelNumber === 1 && !this.saveData.seenHints.includes(MOVE_TUTORIAL_HINT_KEY)) {
      this.saveData = { ...this.saveData, seenHints: [...this.saveData.seenHints, MOVE_TUTORIAL_HINT_KEY] };
      this.saveService.save(this.saveData);
      this.time.delayedCall(500, () => this.tutorial.start());
    }

    this.fx.scheduleBlink();
    this.scheduleIdleHint();
    this.maybeShowChapterBanner();
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
  private feedback(kind: FeedbackKind, index = 0): void {
    if (this.saveData.hapticEnabled) {
      if (kind === 'tap' || kind === 'land' || kind === 'star' || kind === 'button') this.hapticService.light();
      else if (kind === 'complete' || kind === 'win') this.hapticService.success();
      else if (kind === 'invalid') this.hapticService.warning();
      else this.hapticService.medium();
    }
    if (this.saveData.soundEnabled) {
      const sfx = this.soundService;
      const play: Record<FeedbackKind, () => void> = {
        tap: () => sfx.tap(),
        land: () => sfx.land(),
        medium: () => sfx.land(),
        complete: () => sfx.complete(),
        invalid: () => sfx.invalid(),
        star: () => sfx.star(index),
        win: () => sfx.win(),
        button: () => sfx.button(),
        unlock: () => sfx.unlock(),
      };
      play[kind]();
    }
  }

  // ---------------------------------------------------------------------
  // Görsel: arkaplan
  // ---------------------------------------------------------------------

  private drawBackground(): void {
    drawCozyBackground(this, themeForLevel(this.levelNumber ?? 1), this.vp, { floorAt: 0.6, motes: 12 });
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
    const buttonTop = this.vp.height - this.safeBottom - BOTTOM_BUTTON_H - 30;
    const availableHeight = Math.max(100, buttonTop - this.gridTop);
    const neededAtBase = rows * 4 * BASE_SLOT_HEIGHT + (rows - 1) * ROW_GAP;
    const heightScale = availableHeight / neededAtBase;

    const widestRow = Math.min(COLS, ids.length);
    const sideMargin = 20;
    const availableWidth = this.vp.width - 2 * sideMargin;
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
    const topOffset = this.gridTop + verticalSlack * 0.48;
    this.gridTopOffset = topOffset;

    ids.forEach((id, index) => {
      const container = this.gameState.containers.find((c) => c.id === id)!;
      const row = Math.floor(index / COLS);
      const col = index % COLS;
      const itemsInRow = Math.min(COLS, ids.length - row * COLS);
      const rowWidth = itemsInRow * this.containerWidth + (itemsInRow - 1) * colGap;
      const rowStartX = this.vp.width / 2 - rowWidth / 2;

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
    // Dizilim (kap kimlikleri + boyut) değişmediyse (ör. geri al) kalıcı görünümler ve havuz korunur.
    const signature = `${this.gameState.containers.map((c) => c.id).join(',')}|${this.containerWidth.toFixed(2)}|${this.slotHeight.toFixed(2)}`;
    if (signature !== this.layoutSignature) {
      this.layoutSignature = signature;
      this.destroyContainerViews();
      this.clearItemPool();
      this.placeDecor();
    }
    this.drawFrames();
    this.render();
  }

  private destroyContainerViews(): void {
    for (const view of this.containerViews.values()) view.destroy();
    this.containerViews.clear();
  }

  /** Kalıcı ContainerView'ları oluşturur (yoksa) ve seçim/kilit durumlarını eşitler -- her dokunuşta
   * yeniden çizim YOK (eskiden tüm çerçeveler her seçimde yok edilip yeniden çiziliyordu). */
  private drawFrames(): void {
    for (const c of this.gameState.containers) {
      const layout = this.layouts.get(c.id)!;
      let view = this.containerViews.get(c.id);
      if (!view) {
        view = new ContainerView(
          this,
          layout.centerX,
          layout.topY + layout.rect.height / 2,
          {
            width: layout.rect.width,
            height: layout.rect.height,
            capacity: c.capacity,
            slotHeight: this.slotHeight,
            itemHeight: this.slotHeight - this.itemInsetY * 2,
          },
          c.onlyAccepts,
        );
        this.framesLayer.add(view.root);
        this.containerViews.set(c.id, view);
      }
      view.setLocked(isContainerLocked(c, this.gameState));
      view.setSelected(this.selectedId === c.id);
    }
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
    this.time.delayedCall(this.isChapterStart() ? 2900 : 700, () => this.showHintBubble(t(unseen.titleKey, this.lang), t(unseen.bodyKey, this.lang)));
  }

  /** İlk görülen engel için ipucu kartı: krem kart + terrakota başlık, aşağıdan kayarak gelir, 3.6 sn sonra söner.
   * (Eski koyu kutu sahnenin geri kalanından kopuk duruyordu.) Izgaranın üstüne, HUD çiplerinin hemen altına konur. */
  private showHintBubble(title: string, body: string): void {
    const w = Math.min(this.vp.width - 40, 400);
    const h = 74;
    const y = this.gridTop + h / 2 + 2;
    const container = this.add.container(this.vp.width / 2, y + 16).setDepth(250).setAlpha(0);
    const bg = this.add.graphics();
    bg.fillStyle(hexToNum(COLORS.overlay), 0.12);
    bg.fillRoundedRect(-w / 2, -h / 2 + 4, w, h, 20);
    bg.fillStyle(0xffffff, 0.97);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 20);
    bg.lineStyle(2, hexToNum(COLORS.honey), 0.9);
    bg.strokeRoundedRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2, 19);
    container.add(bg);
    container.add(this.add.text(0, -16, title, textStyle('buttonSmall', { color: COLORS.terracotta })).setOrigin(0.5));
    container.add(this.add.text(0, 12, body, textStyle('caption', { color: COLORS.ink, align: 'center', wordWrap: { width: w - 36 } })).setOrigin(0.5));
    this.tweens.add({ targets: container, alpha: 1, y, duration: 320, ease: EASE.back });
    this.time.delayedCall(3600, () => {
      this.tweens.add({ targets: container, alpha: 0, y: y - 12, duration: 260, ease: EASE.in, onComplete: () => container.destroy() });
    });
  }

  // ---------------------------------------------------------------------
  // Hamle yürütme (girdi denetleyicisi tarafından çağrılır)
  // ---------------------------------------------------------------------

  private attemptMove(sourceId: string, targetId: string): void {
    const outcome = tryMove(this.gameState, { sourceId, targetId });
    if (!outcome.ok) {
      this.feedback('invalid');
      this.drawFrames();
      this.render();
      this.fx.gentleNo(targetId);
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
        const capacity = newState.containers.find((c) => c.id === targetId)?.capacity ?? 4;
        this.fx.celebrateCompletion(targetId, completion.type, capacity);
        this.feedback('complete');
        if (this.comboCount >= JUICE.combo.minComboToShow) {
          this.fx.showCombo(targetId, this.comboCount);
        }
      } else {
        this.comboCount = 0;
        this.fx.sparkleLanding(targetId);
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
      this.toastText.setText(t('levelCompleteNoStars', this.lang));
      return;
    }

    // Oda ekranına geçiş zamanlanırken ek bir hamle bu akışı bozmasın diye girdi kilitlenir.
    this.isAnimating = true;
    this.time.delayedCall(320, () => this.feedback('win'));

    const data = this.saveService.load();
    // Yıldız (performans) derecelendirmesi: undo kullanımı hamle sayısına eklenir (bkz. onUndo).
    const effectiveMoves = this.moveCount + this.undoCount;
    const rating = this.par <= 0 ? 3 : effectiveMoves <= this.par ? 3 : effectiveMoves <= this.par * 1.3 ? 2 : 1;
    // Seviye seçiminden TEKRAR oynanan (zaten geçilmiş) bir seviye yıldız vermez -- aynı seviyeyi
    // tekrarlayarak yıldız biriktirmeyi önler; yalnızca en iyi derecelendirme güncellenir (Faz 5).
    const isReplay = this.sessionMode === 'progress' && this.levelNumber !== null && this.levelNumber < data.currentLevel;
    const awarded = isReplay ? 0 : this.sessionMode === 'progress' ? PROGRESS_LEVEL_STARS : DAILY_PUZZLE_STARS;

    let saved: SaveData = { ...data, stars: data.stars + awarded };
    if (this.sessionMode === 'progress') {
      const nextLevel = (this.levelNumber ?? data.currentLevel) + 1;
      saved = { ...saved, currentLevel: Math.max(data.currentLevel, nextLevel) };
      if (this.levelNumber !== null) saved = recordLevelStars(saved, this.levelNumber, rating);
    }
    this.saveService.save(saved);
    this.saveData = saved;
    // Başarımlar (Faz 6): hedefe ulaşanlar açılır, küçük bonus eklenir; bildirim panel yıldızlarından sonra.
    const ach = applyAchievements(saved);
    if (ach.unlocked.length > 0) {
      saved = ach.data;
      this.saveService.save(saved);
      this.saveData = saved;
      this.time.delayedCall(2200, () => showAchievementToasts(this, ach.unlocked, this.lang, () => this.feedback('star', 2)));
    }

    this.analytics.track({
      name: 'level_win',
      levelNumber: this.levelNumber ?? 0,
      durationMs: Date.now() - this.levelStartTime,
      moveCount: this.moveCount,
      undoCount: this.undoCount,
    });

    const durationMs = Date.now() - this.levelStartTime;
    this.time.delayedCall(prefersReducedMotion() ? 200 : 700, () =>
      showLevelCompletePanel(this, {
        rating,
        awarded,
        isDailyPuzzle: this.sessionMode === 'daily',
        lang: this.lang,
        confetti: this.confetti,
        particles: this.particles,
        prefersReducedMotion,
        moves: effectiveMoves,
        durationMs,
        onStar: (i) => this.feedback('star', i),
        onButtonPress: () => this.feedback('button'),
        onNext: () => fadeToScene(this, 'RoomScene'),
      }),
    );
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
      onButtonPress: () => this.feedback('button'),
      onRetry: () => this.restartSameLevel(),
      onBackToRoom: () => fadeToScene(this, 'RoomScene'),
    });
  }

  private restartSameLevel(): void {
    if (this.sessionMode === 'progress' && this.levelNumber !== null) {
      fadeToScene(this, 'GameScene', { mode: 'progress', levelNumber: this.levelNumber });
    } else if (this.sessionMode === 'daily') {
      fadeToScene(this, 'GameScene', { mode: 'daily' });
    } else {
      this.scene.restart();
    }
  }

  private showStuckBanner(): void {
    if (this.stuckBanner.alpha > 0.5) return;
    this.stuckBanner.setScale(0.9);
    this.tweens.add({ targets: this.stuckBanner, alpha: 1, scale: 1, duration: 260, ease: EASE.back });
  }

  private hideStuckBanner(): void {
    if (this.stuckBanner.alpha === 0) return;
    this.tweens.add({ targets: this.stuckBanner, alpha: 0, duration: 200, ease: EASE.out });
  }

  private openSettings(): void {
    if (this.settingsPanel) return;
    this.inputController.reset();
    this.selectedId = null;
    this.drawFrames();
    this.render();
    this.settingsPanel = openSettingsPanel(this, {
      showLanguage: false,
      onPress: () => this.feedback('button'),
      onChange: (data) => {
        this.saveData = data;
      },
      onClose: () => {
        this.settingsPanel = null;
      },
    });
  }

  /** Duvar dekoru: ızgaranın üstündeki boş alana, bölüm temasına göre (yer yoksa çizilmez). */
  private placeDecor(): void {
    this.decor?.destroy();
    this.decor = null;
    const available = this.gridTopOffset - this.gridTop;
    const theme = themeForLevel(this.levelNumber ?? 1);
    this.decor = addWallDecor(this, theme, this.vp.width / 2, this.gridTop + available / 2 - 4, available);
  }

  /** İlk 3 seviyede oyuncu 8 sn hiçbir şeye dokunmazsa el ipucu nazikçe yeniden gösterilir. */
  private scheduleIdleHint(): void {
    this.idleTimer?.remove(false);
    this.idleTimer = null;
    if (this.sessionMode !== 'progress' || (this.levelNumber ?? 99) > 3) return;
    this.idleTimer = this.time.delayedCall(8000, () => {
      if (this.isAnimating || this.gameOver || this.settingsPanel || this.tutorial.isActive || this.selectedId) return;
      this.tutorial.start();
    });
  }

  /** Yeni bir bölümün (oda temasının) ilk seviyesinde kısa bir "Yeni bölüm" bandı. */
  private isChapterStart(): boolean {
    const n = this.levelNumber;
    return this.sessionMode === 'progress' && n !== null && n > 1 && (n - 1) % THEME_CHANGE_EVERY_LEVELS === 0;
  }

  private maybeShowChapterBanner(): void {
    const n = this.levelNumber;
    if (!this.isChapterStart() || n === null) return;
    const name = t(`chapter${themeIndexForLevel(n)}` as ChapterKey, this.lang);
    const banner = this.add.container(this.vp.width / 2, this.vp.height * 0.42).setDepth(350).setAlpha(0).setScale(0.8);
    addRibbon(this, banner, 0, Math.min(this.vp.width - 80, 340), themeForLevel(n).accent, name);
    const cap = this.add.text(0, -46, t('newChapter', this.lang), textStyle('caption', { color: COLORS.ink })).setOrigin(0.5);
    const capBg = this.add.graphics();
    capBg.fillStyle(0xffffff, 0.95);
    capBg.fillRoundedRect(-cap.width / 2 - 14, -60, cap.width + 28, 28, 14);
    banner.add([capBg, cap]);
    this.tweens.add({ targets: banner, alpha: 1, scale: 1, duration: 420, delay: 350, ease: EASE.back });
    this.tweens.add({ targets: banner, alpha: 0, y: banner.y - 30, duration: 360, delay: 2300, ease: EASE.in, onComplete: () => banner.destroy() });
    this.particles.sparkle(this.vp.width / 2, this.vp.height * 0.42, 10);
  }

  private onHardwareBack(): void {
    if (this.settingsPanel) {
      this.settingsPanel.close();
      return;
    }
    if (this.gameOver) return;
    fadeToScene(this, 'RoomScene');
  }

  /** Uçan yıldız HUD'daki yıldıza varınca küçük bir "pop". */
  private popHudStar(): void {
    const star = this.hudStar;
    if (!star) return;
    const base = star.getData('baseScale') ?? star.scale;
    star.setData('baseScale', base);
    this.tweens.killTweensOf(star);
    star.setScale(base * 1.35);
    this.tweens.add({ targets: star, scale: base, duration: 260, ease: EASE.back });
  }

  /** oldState'te kilitli olup newState'te açılan kapları tespit edip küçük bir parıltı oynatır. */
  private checkUnlocks(oldState: GameState, newState: GameState): void {
    for (const c of newState.containers) {
      if (!c.lockedWhileNonEmpty) continue;
      const wasLocked = isContainerLocked(c, oldState);
      const isLocked = isContainerLocked(c, newState);
      if (wasLocked && !isLocked) {
        this.fx.flashUnlock(c.id);
        this.feedback('unlock');
      }
    }
  }

  /**
   * Eşya görsellerini oyun durumuna göre yerleştirir. Görseller HAVUZDAN gelir (tür+boyut başına):
   * her durum değişikliğinde yok edip yeniden oluşturmak yerine (eski davranış) önceki karedekiler
   * geri bırakılıp yeniden kullanılır -- sıfır çöp üretimi, sıfır yeni doku.
   */
  private render(): void {
    this.releaseItemVisuals();

    const total = this.gameState.containers.reduce((sum, c) => sum + c.items.length, 0);
    const activePointerId = this.inputController.getActivePointerId();
    const dragRunLength = this.inputController.getDragRunLength();

    for (const c of this.gameState.containers) {
      const layout = this.layouts.get(c.id)!;
      const runLength = this.selectedId === c.id ? getTopRunLength(c) : 0;
      const liftIndexThreshold = c.items.length - runLength;

      c.items.forEach((item, idx) => {
        const isTopItem = idx === c.items.length - 1;
        const rowFromTop = c.capacity - 1 - idx;
        const x = layout.centerX;
        const restY = layout.topY + rowFromTop * this.slotHeight + this.slotHeight / 2;

        const displayType = this.mysteryActive && !isTopItem ? MYSTERY_TYPE : item.type;
        const visual = this.acquireItemVisual(displayType, x, restY);
        visual.setData('containerId', c.id);
        visual.setData('stackIndex', idx);
        visual.setData('isTop', isTopItem);
        visual.setData('inDragRun', idx >= c.items.length - dragRunLength && c.id === activePointerId);
        visual.setData('baseX', x);
        visual.setData('baseY', restY);

        const isLifted = this.selectedId === c.id && idx >= liftIndexThreshold;
        if (isLifted) {
          this.fx.liftItem(visual, idx - liftIndexThreshold);
        } else if (isTopItem) {
          this.fx.breathe(visual);
        }
      });
    }

    const effectiveMoves = this.moveCount + this.undoCount;
    if (this.moveLimit > 0) {
      this.moveChip.setValue(`${effectiveMoves}/${this.moveLimit}`, 1 - effectiveMoves / this.moveLimit);
    } else {
      this.moveChip.setValue(`${this.moveCount}`);
    }
    this.itemsChip.setValue(`${total}`);
    const movesLeft = this.moveLimit > 0 ? this.moveLimit - effectiveMoves : Infinity;
    this.moveChip.setWarn(movesLeft <= 3);
  }

  private itemSize(): { w: number; h: number } {
    return { w: this.containerWidth - this.itemInsetX * 2, h: this.slotHeight - this.itemInsetY * 2 };
  }

  /** Aktif görselleri havuza geri bırakır (yok etmeden): tween'leri durdurulur, poz sıfırlanır, gizlenir. */
  private releaseItemVisuals(): void {
    for (const child of this.itemsLayer.list as Phaser.GameObjects.Container[]) {
      if (!child.active) continue;
      this.tweens.killTweensOf(child);
      resetItemVisual(child);
      child.setActive(false).setVisible(false);
      child.setData('containerId', null);
      child.setData('isTop', false);
      child.setData('inDragRun', false);
      const key = child.getData('poolKey') as string;
      let bucket = this.itemPool.get(key);
      if (!bucket) {
        bucket = [];
        this.itemPool.set(key, bucket);
      }
      bucket.push(child);
    }
  }

  private acquireItemVisual(type: string, x: number, y: number): Phaser.GameObjects.Container {
    const { w, h } = this.itemSize();
    const key = `${type}|${Math.round(w)}|${Math.round(h)}`;
    const pooled = this.itemPool.get(key)?.pop();
    if (pooled) {
      pooled.setActive(true).setVisible(true).setPosition(x, y);
      // çizim sırası = durum sırası (alttaki eşya önce): yeniden kullanılan nesne en üste alınır
      this.itemsLayer.bringToTop(pooled);
      return pooled;
    }
    const visual = this.spawnItemVisual(type, x, y);
    visual.setData('poolKey', key);
    this.itemsLayer.add(visual);
    return visual;
  }

  /** Düzen değişince (farklı eşya boyutu) eski boyuttaki havuzlanmış/aktif görseller atılır. */
  private clearItemPool(): void {
    for (const child of this.itemsLayer.list as Phaser.GameObjects.Container[]) {
      // iç sprite/gölge tween'leri de (sonsuz "nefes" dahil) durdurulmalı -- yoksa yok edilmiş
      // nesneleri hedefleyen tween'ler birikir (Faz 2 sızıntı denetiminde bulundu).
      this.tweens.killTweensOf(child);
      resetItemVisual(child);
    }
    this.itemsLayer.removeAll(true);
    this.itemPool.clear();
  }

  /** Uçuş animasyonu gibi geçici kullanımlar için havuz dışı bir görsel (çağıran yok eder). */
  private spawnItemVisual(type: string, x: number, y: number): Phaser.GameObjects.Container {
    const { w, h } = this.itemSize();
    const { container } = createItemVisual(this, type, w, h);
    container.setPosition(x, y);
    return container;
  }
}

/** HUD sayaç çipi: küçük başlık + değer, isteğe bağlı kalan-hak çubuğu; uyarı durumunda gül kurusu + nabız. */
class HudChip {
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly value: Phaser.GameObjects.Text;
  private readonly meter: Phaser.GameObjects.Graphics | null;
  private readonly w: number;
  private warn = false;
  private pulse: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, label: string, withMeter: boolean) {
    this.scene = scene;
    this.w = w;
    this.root = scene.add.container(x, y).setDepth(2);
    this.bg = scene.add.graphics();
    const caption = scene.add.text(-w / 2 + 16, 0, label, textStyle('caption', { color: COLORS.inkSoft })).setOrigin(0, 0.5);
    this.value = scene.add.text(w / 2 - 16, -1, '', textStyle('hud')).setOrigin(1, 0.5);
    this.meter = withMeter ? scene.add.graphics() : null;
    this.root.add([this.bg, caption, this.value]);
    if (this.meter) this.root.add(this.meter);
    this.drawBg();
  }

  private drawBg(): void {
    const { w } = this;
    this.bg.clear();
    this.bg.fillStyle(hexToNum(this.warn ? '#FBE1E4' : '#FFFFFF'), 0.9);
    this.bg.fillRoundedRect(-w / 2, -19, w, 38, 19);
    this.bg.lineStyle(1.5, hexToNum(this.warn ? COLORS.gentleNo : COLORS.woodLight), 0.85);
    this.bg.strokeRoundedRect(-w / 2, -19, w, 38, 19);
  }

  setValue(text: string, fraction?: number): void {
    this.value.setText(text);
    if (this.meter && fraction !== undefined) {
      const f = Phaser.Math.Clamp(fraction, 0, 1);
      const mw = this.w - 40;
      this.meter.clear();
      this.meter.fillStyle(hexToNum(COLORS.surfaceMuted), 1);
      this.meter.fillRoundedRect(-mw / 2, 11, mw, 4, 2);
      this.meter.fillStyle(hexToNum(this.warn ? COLORS.gentleNo : '#7FB28A'), 1);
      if (f > 0) this.meter.fillRoundedRect(-mw / 2, 11, Math.max(4, mw * f), 4, 2);
    }
  }

  setWarn(warn: boolean): void {
    if (this.warn === warn) return;
    this.warn = warn;
    this.value.setColor(warn ? COLORS.gentleNo : COLORS.ink);
    this.drawBg();
    this.pulse?.stop();
    this.pulse = null;
    this.root.setScale(1);
    if (warn) this.pulse = this.scene.tweens.add({ targets: this.root, scale: 1.06, duration: 520, yoyo: true, repeat: -1, ease: EASE.inOut });
  }
}
