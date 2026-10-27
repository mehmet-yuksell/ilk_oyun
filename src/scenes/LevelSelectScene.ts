import Phaser from 'phaser';
import { COLORS, DEFAULT_THEME, EASE, ROOM_THEMES, THEME_CHANGE_EVERY_LEVELS, hexToNum, mix, shadeHex, textStyle } from './theme';
import { BASE_HEIGHT, BASE_WIDTH, setupView, toWorld, type View } from './viewport';
import { drawCozyBackground } from './background';
import { enterScene, fadeToScene } from './sceneTransition';
import { readSafeAreaInsets } from './safeArea';
import { bakeCentered } from './bake';
import { bakeStar } from './fx';
import { createIconButton, createStarChip } from './ui';
import { iconBack, iconLock, iconPlay } from './icons';
import { MAX_GENERATED_LEVEL } from './debugLevelParam';
import { t, type Language, type TranslationKey } from '../i18n/translations';
import { LocalStorageSaveService, collectedRatingStars, type SaveData } from '../services/SaveService';
import { audioEngine } from '../services/AudioEngine';
import { WebAudioSoundService } from '../services/SoundService';

/**
 * Seviye seçim ekranı: seviyeler 10'arlı "bölümler" (oda temalarıyla aynı -- bkz. theme.ts
 * themeForLevel) hâlinde, her bölüm kendi renk bandıyla. Kart durumları tek bakışta ayrılır:
 *   tamamlanmış -> krem kart + bölüm rengi kenar + en iyi 1-3 yıldız
 *   sıradaki    -> terrakota dolgu, nabız atan hale, ▶ işareti
 *   kilitli     -> soluk kart, kilit ikonu, silik numara
 * Dikey kaydırma (sürükle + atalet + sınırda yaylanma); açılışta sıradaki seviye ortalanır.
 */

const COLS = 5;
const TILE = 84;
const GAP = 12;
const SIDE = (BASE_WIDTH - (COLS * TILE + (COLS - 1) * GAP)) / 2;
const CHAPTER_HEADER = 74;
const CHAPTER_GAP = 22;

type TileState = 'done' | 'current' | 'locked';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function bakeTile(scene: Phaser.Scene, state: TileState, accent: string): string {
  return bakeCentered(scene, `lvl-tile-${state}-${accent}`, { width: TILE + 24, height: TILE + 28 }, (_g, ctx) => {
    const s = ctx.getTransform().a;
    const x = -TILE / 2;
    const y = -TILE / 2;
    const face = state === 'current' ? COLORS.terracotta : state === 'done' ? '#FFFFFF' : COLORS.surfaceMuted;
    const lip = state === 'current' ? shadeHex(COLORS.terracotta, -0.25) : state === 'done' ? mix(accent, '#FFFFFF', 0.25) : '#D6CBC0';
    ctx.save();
    ctx.shadowColor = state === 'locked' ? 'rgba(90,58,44,0.08)' : 'rgba(90,58,44,0.22)';
    ctx.shadowBlur = 8 * s;
    ctx.shadowOffsetY = 3 * s;
    roundRect(ctx, x, y + 4, TILE, TILE, 20);
    ctx.fillStyle = lip;
    ctx.fill();
    ctx.restore();
    const grad = ctx.createLinearGradient(0, y, 0, y + TILE);
    grad.addColorStop(0, mix(face, '#FFFFFF', 0.14));
    grad.addColorStop(1, face);
    roundRect(ctx, x, y, TILE, TILE, 20);
    ctx.fillStyle = grad;
    ctx.fill();
    if (state === 'done') {
      roundRect(ctx, x + 1.5, y + 1.5, TILE - 3, TILE - 3, 19);
      ctx.strokeStyle = mix(accent, '#FFFFFF', 0.35);
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, x + 2, y + 2, TILE - 4, TILE + 8, 18);
    ctx.save();
    roundRect(ctx, x, y, TILE, TILE, 20);
    ctx.clip();
    ctx.stroke();
    ctx.restore();
  });
}

export class LevelSelectScene extends Phaser.Scene {
  private vp: View = { width: BASE_WIDTH, height: BASE_HEIGHT };
  private saveData!: SaveData;
  private lang: Language = 'tr';
  private content!: Phaser.GameObjects.Container;
  private scrollY = 0;
  private minScroll = 0;
  private maxScroll = 0;
  private velocity = 0;
  private dragging = false;
  private dragStartY = 0;
  private dragStartScroll = 0;
  private dragDistance = 0;
  private lastMoveY = 0;
  private lastMoveTime = 0;
  private contentTop = 0;
  private readonly sfx = new WebAudioSoundService(audioEngine);

  constructor() {
    super('LevelSelectScene');
  }

  create(): void {
    this.vp = setupView(this);
    enterScene(this);
    this.saveData = new LocalStorageSaveService(window.localStorage).load();
    this.lang = this.saveData.language;
    this.velocity = 0;
    this.dragging = false;
    const insets = readSafeAreaInsets(this);
    const { width: w, height: h } = this.vp;
    drawCozyBackground(this, DEFAULT_THEME, this.vp, { motes: 6 });

    // --- kaydırılan içerik ---
    const headerH = insets.top + 92;
    this.contentTop = headerH + 8;
    this.content = this.add.container(0, 0);
    const current = Math.min(MAX_GENERATED_LEVEL, this.saveData.currentLevel);
    const lastChapter = Math.min(Math.ceil(MAX_GENERATED_LEVEL / THEME_CHANGE_EVERY_LEVELS), Math.ceil(current / THEME_CHANGE_EVERY_LEVELS) + 1);
    let y = 0;
    let currentTileY = 0;
    const xOffset = (w - BASE_WIDTH) / 2;
    for (let chapter = 0; chapter < lastChapter; chapter++) {
      const theme = ROOM_THEMES[chapter % ROOM_THEMES.length];
      const from = chapter * THEME_CHANGE_EVERY_LEVELS + 1;
      const to = Math.min(MAX_GENERATED_LEVEL, from + THEME_CHANGE_EVERY_LEVELS - 1);
      this.addChapterHeader(xOffset + SIDE, y, BASE_WIDTH - SIDE * 2, chapter, from, to, theme.accent, theme.bgBottom);
      y += CHAPTER_HEADER;
      for (let level = from; level <= to; level++) {
        const i = level - from;
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        const tx = xOffset + SIDE + col * (TILE + GAP) + TILE / 2;
        const ty = y + row * (TILE + GAP + 14) + TILE / 2;
        const state: TileState = level < current ? 'done' : level === current ? 'current' : 'locked';
        if (state === 'current') currentTileY = ty;
        this.addTile(tx, ty, level, state, theme.accent);
      }
      y += Math.ceil((to - from + 1) / COLS) * (TILE + GAP + 14) + CHAPTER_GAP;
    }
    const contentHeight = y;
    const viewport = h - this.contentTop - insets.bottom - 12;
    this.maxScroll = 0;
    this.minScroll = Math.min(0, viewport - contentHeight);
    this.scrollY = Phaser.Math.Clamp(viewport / 2 - currentTileY, this.minScroll, this.maxScroll);
    this.content.setY(this.contentTop + this.scrollY);

    // --- sabit başlık (içeriğin üstünde, opak zeminli) ---
    const header = this.add.graphics().setDepth(50);
    header.fillGradientStyle(hexToNum(DEFAULT_THEME.bgTop), hexToNum(DEFAULT_THEME.bgTop), hexToNum(DEFAULT_THEME.bgTop), hexToNum(DEFAULT_THEME.bgTop), 1, 1, 0.97, 0.97);
    header.fillRect(-w, -h, w * 3, h + headerH);
    header.fillGradientStyle(hexToNum(COLORS.woodDark), hexToNum(COLORS.woodDark), hexToNum(COLORS.woodDark), hexToNum(COLORS.woodDark), 0.12, 0.12, 0, 0);
    header.fillRect(-w, headerH, w * 3, 12);
    const headerY = insets.top + 40;
    createIconButton(this, insets.left + 30, headerY, iconBack, () => this.goBack(), { onPress: () => this.click() }).root.setDepth(51);
    this.add.text(w / 2, headerY, t('levelSelectTitle', this.lang), textStyle('screenTitle')).setOrigin(0.5).setDepth(51);
    const total = collectedRatingStars(this.saveData);
    createStarChip(this, w - insets.right - 92, headerY, bakeStar(this, 22, true), total).root.setDepth(51);

    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    // Sahne örneği yeniden kullanılır; özel olay dinleyicisi kapanışta temizlenmeli (birikmesin).
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off('hardware-back'));
    this.events.on('hardware-back', () => this.goBack());
  }

  private click(): void {
    if (this.saveData.soundEnabled) this.sfx.button();
  }

  private goBack(): void {
    fadeToScene(this, 'RoomScene');
  }

  private addChapterHeader(x: number, y: number, width: number, chapter: number, from: number, to: number, accent: string, band: string): void {
    const g = this.add.graphics();
    g.fillStyle(hexToNum(band), 0.9);
    g.fillRoundedRect(x, y + 10, width, 50, 18);
    g.fillStyle(hexToNum(accent), 1);
    g.fillRoundedRect(x, y + 10, 8, 50, { tl: 18, bl: 18, tr: 0, br: 0 });
    this.content.add(g);
    this.content.add(this.add.text(x + 24, y + 35, t(`chapter${chapter % ROOM_THEMES.length}` as TranslationKey, this.lang), textStyle('sectionTitle')).setOrigin(0, 0.5));
    this.content.add(
      this.add.text(x + width - 18, y + 35, t('chapterRange', this.lang, { from, to }), textStyle('caption', { color: COLORS.inkSoft })).setOrigin(1, 0.5),
    );
  }

  private addTile(x: number, y: number, level: number, state: TileState, accent: string): void {
    const tile = this.add.container(x, y);
    if (state === 'current') {
      const halo = this.add.circle(0, 2, TILE * 0.62, hexToNum(COLORS.goldLight), 0.5);
      tile.add(halo);
      this.tweens.add({ targets: halo, scale: { from: 0.9, to: 1.08 }, alpha: { from: 0.55, to: 0.15 }, duration: 1000, yoyo: true, repeat: -1, ease: EASE.inOut });
    }
    tile.add(this.add.image(0, 0, bakeTile(this, state, accent)).setDisplaySize(TILE + 24, TILE + 28));
    const numberColor = state === 'current' ? COLORS.cream : state === 'done' ? COLORS.ink : COLORS.inkFaint;
    const numberY = state === 'done' ? -10 : state === 'current' ? -8 : -14;
    tile.add(this.add.text(0, numberY, `${level}`, textStyle('panelTitle', { color: numberColor })).setOrigin(0.5));
    if (state === 'done') {
      const rating = this.saveData.levelStars[String(level)] ?? 0;
      for (let i = 0; i < 3; i++) {
        tile.add(this.add.image(-20 + i * 20, 22, bakeStar(this, 16, i < rating)).setDisplaySize(21, 21));
      }
    } else if (state === 'current') {
      const g = this.add.graphics({ x: 0, y: 22 });
      iconPlay(g, hexToNum(COLORS.cream));
      g.setScale(0.75);
      tile.add(g);
    } else {
      const g = this.add.graphics({ x: 0, y: 18 });
      iconLock(g, hexToNum(COLORS.inkFaint));
      g.setScale(0.8);
      tile.add(g);
    }
    tile.setData('level', level);
    tile.setData('state', state);
    this.content.add(tile);
  }

  // --- kaydırma + dokunma ---

  private onDown(pointer: Phaser.Input.Pointer): void {
    const p = toWorld(this, pointer);
    if (p.y < this.contentTop - 8) return;
    this.dragging = true;
    this.velocity = 0;
    this.dragStartY = p.y;
    this.dragStartScroll = this.scrollY;
    this.dragDistance = 0;
    this.lastMoveY = p.y;
    this.lastMoveTime = this.time.now;
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (!this.dragging) return;
    const p = toWorld(this, pointer);
    const dy = p.y - this.dragStartY;
    this.dragDistance = Math.max(this.dragDistance, Math.abs(dy));
    let next = this.dragStartScroll + dy;
    // sınır dışında yarı dirençle "lastik" his
    if (next > this.maxScroll) next = this.maxScroll + (next - this.maxScroll) * 0.4;
    if (next < this.minScroll) next = this.minScroll + (next - this.minScroll) * 0.4;
    this.scrollY = next;
    const dt = Math.max(1, this.time.now - this.lastMoveTime);
    this.velocity = ((p.y - this.lastMoveY) / dt) * 16;
    this.lastMoveY = p.y;
    this.lastMoveTime = this.time.now;
    this.content.setY(this.contentTop + this.scrollY);
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    if (!this.dragging) return;
    this.dragging = false;
    if (this.dragDistance < 10) {
      this.velocity = 0;
      this.tapAt(toWorld(this, pointer));
    }
  }

  private tapAt(p: { x: number; y: number }): void {
    const localY = p.y - this.content.y;
    for (const obj of this.content.list) {
      const tile = obj as Phaser.GameObjects.Container;
      const level = tile.getData?.('level') as number | undefined;
      if (!level) continue;
      if (Math.abs(p.x - tile.x) > TILE / 2 + 4 || Math.abs(localY - tile.y) > TILE / 2 + 4) continue;
      const state = tile.getData('state') as TileState;
      if (state === 'locked') {
        this.tweens.add({ targets: tile, angle: { from: -6, to: 0 }, duration: 320, ease: EASE.elastic });
        if (this.saveData.soundEnabled) this.sfx.invalid();
        return;
      }
      this.click();
      this.tweens.add({ targets: tile, scale: 0.92, duration: 80, yoyo: true, ease: EASE.out });
      fadeToScene(this, 'GameScene', { mode: 'progress', levelNumber: level });
      return;
    }
  }

  update(_time: number, delta: number): void {
    if (this.dragging) return;
    const k = delta / 16.67;
    if (Math.abs(this.velocity) > 0.05) {
      this.scrollY += this.velocity * k;
      this.velocity *= Math.pow(0.94, k);
    } else {
      this.velocity = 0;
    }
    // sınıra yumuşak geri dönüş
    if (this.scrollY > this.maxScroll) {
      this.scrollY += (this.maxScroll - this.scrollY) * 0.2 * k;
      this.velocity *= 0.5;
    } else if (this.scrollY < this.minScroll) {
      this.scrollY += (this.minScroll - this.scrollY) * 0.2 * k;
      this.velocity *= 0.5;
    }
    this.content.setY(this.contentTop + this.scrollY);
  }
}
