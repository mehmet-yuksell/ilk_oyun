import Phaser from 'phaser';
import { isRoomComplete, restoreItem, restoredCount, type RoomDef } from '../core/room';
import { ROOMS } from '../core/roomDefs';
import { canClaimDailyReward, claimDailyReward, todayKey } from '../core/dailyReward';
import { LocalStorageSaveService, type SaveData, type SaveService } from '../services/SaveService';
import { type HapticService, createHapticService } from '../services/HapticService';
import { type SoundService, WebAudioSoundService } from '../services/SoundService';
import { audioEngine } from '../services/AudioEngine';
import { type AnalyticsService, ConsoleAnalyticsService } from '../services/AnalyticsService';
import { getDebugLevelParam } from './debugLevelParam';
import { colorForItemIndex } from './roomVisuals';
import { drawRoomIcon, iconKeyForLabel, ICON_DEPTH, type RoomIconKey } from './roomItemArt';
import { readSafeAreaInsets } from './safeArea';
import { enterScene, fadeToScene } from './sceneTransition';
import { COLORS, EASE, hexToNum, textStyle } from './theme';
import { BASE_HEIGHT, BASE_WIDTH, setupView, type View } from './viewport';
import { drawCozyBackground } from './background';
import { themeForLevel } from '../config/tuning';
import { ConfettiEmitter, prefersReducedMotion } from './confetti';
import { itemLabel, roomName, t } from '../i18n/translations';
import type { Language } from '../i18n/translations';
import { addPanelCard, addRibbon, createButton, createIconButton, createStarChip, type UIButton } from './ui';
import { iconCalendar, iconGear, iconGift, iconGrid } from './icons';
import { ParticleFx, bakeStar } from './fx';
import { openSettingsPanel } from './settingsPanel';

const DAILY_REWARD_BASE = 20;

interface Slot {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

// 3+3+2+2 = 10 yuva: üstte küçük/uzak (duvar) öğeler, altta büyük/yakın (zemin) öğeler --
// basit ama etkili bir derinlik hissi. Her odanın 10 öğesi, ICON_DEPTH ağırlığına göre
// sıralanıp bu yuvalara yerleştirilir (bkz. layoutItems), böylece "Koltuk" gibi büyük bir
// zemin eşyası hangi odada hangi index'te olursa olsun hep alt/büyük bir yuvaya düşer.
// Koordinatlar 540 genişlikte, SLOT_REGION dikey aralığında tasarlandı; ekrandaki gerçek oda
// alanına orantılı olarak eşlenir (bkz. mapSlot) -- uzun ekranlarda boşluk kalmasın diye.
const SLOTS: readonly Slot[] = [
  { x: 110, y: 258, scale: 0.55 },
  { x: 270, y: 248, scale: 0.55 },
  { x: 430, y: 258, scale: 0.55 },
  { x: 100, y: 388, scale: 0.75 },
  { x: 270, y: 378, scale: 0.75 },
  { x: 440, y: 388, scale: 0.75 },
  { x: 150, y: 525, scale: 0.95 },
  { x: 390, y: 525, scale: 0.95 },
  { x: 150, y: 680, scale: 1.15 },
  { x: 390, y: 680, scale: 1.15 },
];
const SLOT_REGION = { top: 200, bottom: 745 } as const;
const SLOT_BASE = 92;

interface PlacedItem {
  readonly id: string;
  readonly label: string;
  readonly cost: number;
  readonly icon: RoomIconKey;
  readonly slot: Slot;
  readonly colorIndex: number;
}

/**
 * Ana ekran ("oda"): üstte yıldız çipi + Seviyeler/Ayarlar ikonları, logo, oda kartı (ad, sayaç, ilerleme),
 * ortada yenilenen oda illüstrasyonu (yenilenmemiş eşyalar "boyanmamış" bej, fiyat rozetli), altta Günlük
 * Ödül / Günlük Bulmaca ve büyük, nabızlı OYNA butonu (içinde sıradaki seviye rozeti).
 */
export class RoomScene extends Phaser.Scene {
  private vp: View = { width: BASE_WIDTH, height: BASE_HEIGHT };
  private readonly saveService: SaveService = new LocalStorageSaveService(window.localStorage);
  private readonly hapticService: HapticService = createHapticService();
  private readonly soundService: SoundService = new WebAudioSoundService(audioEngine);
  private readonly analytics: AnalyticsService = new ConsoleAnalyticsService();

  private saveData!: SaveData;
  private room!: RoomDef;
  private lang: Language = 'tr';
  private placedItems: PlacedItem[] = [];
  private safeTop = 20;
  private safeBottom = 20;
  private roomArea = { top: 0, bottom: 0 };

  private starChip!: ReturnType<typeof createStarChip>;
  private progressBarFill!: Phaser.GameObjects.Graphics;
  private progressBar = { x: 0, y: 0, w: 0 };
  private progressLabel!: Phaser.GameObjects.Text;
  private itemsLayer!: Phaser.GameObjects.Container;
  private modalLayer!: Phaser.GameObjects.Container;
  private dailyRewardButton!: UIButton;
  private confetti!: ConfettiEmitter;
  private particles!: ParticleFx;
  private modalOpen = false;

  constructor() {
    super('RoomScene');
  }

  create(): void {
    this.vp = setupView(this);
    const debugLevel = getDebugLevelParam();
    if (debugLevel !== null) {
      this.scene.start('GameScene');
      return;
    }
    enterScene(this);

    this.saveData = this.saveService.load();
    this.lang = this.saveData.language;
    this.modalOpen = false;
    if (this.saveData.currentRoomIndex >= ROOMS.length) {
      this.saveData = { ...this.saveData, currentRoomIndex: ROOMS.length - 1 };
    }
    this.room = ROOMS[this.saveData.currentRoomIndex];
    this.confetti = new ConfettiEmitter(this, 210);
    this.particles = new ParticleFx(this, 220);

    const insets = readSafeAreaInsets(this);
    this.safeTop = insets.top;
    this.safeBottom = insets.bottom;
    const { width: w, height: h } = this.vp;

    // --- dikey düzen (yukarıdan aşağı) ---
    const topBarY = this.safeTop + 26;
    const logoY = this.safeTop + 92;
    const cardY = this.safeTop + 172;
    const playY = h - this.safeBottom - 50;
    const secondaryY = playY - 82;
    this.roomArea = { top: cardY + 58, bottom: secondaryY - 46 };
    this.placedItems = this.layoutItems(this.room);

    // Zemin, alt iki sıra (büyük eşyalar) üstüne basacak şekilde
    const floorY = this.mapY(600);
    drawCozyBackground(this, themeForLevel(this.saveData.currentLevel), this.vp, { floorAt: Phaser.Math.Clamp(floorY / h, 0.45, 0.8), motes: 12 });

    // üst şerit
    this.starChip = createStarChip(this, insets.left + 46, topBarY, bakeStar(this, 22, true), this.saveData.stars);
    createIconButton(this, w - insets.right - 30, topBarY, iconGear, () => this.openSettings(), { onPress: () => this.click(), isBlocked: () => this.modalOpen });
    createIconButton(this, w - insets.right - 88, topBarY, iconGrid, () => fadeToScene(this, 'LevelSelectScene'), {
      onPress: () => this.click(),
      isBlocked: () => this.modalOpen,
    });

    this.drawLogo(w / 2, logoY);
    this.drawRoomCard(w / 2, cardY, Math.min(w - 40, 460));

    this.itemsLayer = this.add.container(0, 0);
    this.modalLayer = this.add.container(0, 0).setDepth(100);

    const btnW = Math.min(214, (w - 56) / 2);
    this.dailyRewardButton = createButton(this, {
      x: w / 2 - btnW / 2 - 6,
      y: secondaryY,
      width: btnW,
      height: 52,
      label: t('dailyRewardButton', this.lang),
      variant: 'honey',
      icon: iconGift,
      onPress: () => this.click(),
      isBlocked: () => this.modalOpen,
      onTap: () => this.onClaimDailyReward(),
    });
    createButton(this, {
      x: w / 2 + btnW / 2 + 6,
      y: secondaryY,
      width: btnW,
      height: 52,
      label: t('dailyPuzzleButton', this.lang),
      variant: 'sage',
      icon: iconCalendar,
      onPress: () => this.click(),
      isBlocked: () => this.modalOpen,
      onTap: () => fadeToScene(this, 'GameScene', { mode: 'daily' }),
    });

    this.createPlayButton(w / 2, playY);
    this.refresh();
    // Sahne örneği yeniden kullanılır; özel olay dinleyicisi kapanışta temizlenmeli (birikmesin).
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off('hardware-back'));
    this.events.on('hardware-back', (exit: () => void) => {
      if (this.modalOpen) this.closeModal();
      else exit();
    });
  }

  // ---------------------------------------------------------------------
  // Düzen
  // ---------------------------------------------------------------------

  private mapY(designY: number): number {
    const k = (this.roomArea.bottom - this.roomArea.top) / (SLOT_REGION.bottom - SLOT_REGION.top);
    return this.roomArea.top + (designY - SLOT_REGION.top) * k;
  }

  private slotScale(): number {
    const k = (this.roomArea.bottom - this.roomArea.top) / (SLOT_REGION.bottom - SLOT_REGION.top);
    return Phaser.Math.Clamp(k, 0.7, 1.15);
  }

  private mapSlot(slot: Slot): Slot {
    return { x: slot.x + (this.vp.width - BASE_WIDTH) / 2, y: this.mapY(slot.y), scale: slot.scale * this.slotScale() };
  }

  /** ICON_DEPTH ağırlığına göre sıralayıp 10 yuvaya dağıtır -- büyük/yakın eşyalar (koltuk, yatak, halı)
   * hep alt-büyük yuvalara, küçük/uzak eşyalar (çerçeve, lamba) hep üst-küçük yuvalara düşer. */
  private layoutItems(room: RoomDef): PlacedItem[] {
    const sorted = room.items
      .map((item, colorIndex) => ({ item, colorIndex, icon: iconKeyForLabel(item.label), originalIndex: colorIndex }))
      .sort((a, b) => ICON_DEPTH[a.icon] - ICON_DEPTH[b.icon] || a.originalIndex - b.originalIndex);
    return sorted.map((entry, i) => ({
      id: entry.item.id,
      label: entry.item.label,
      cost: entry.item.cost,
      icon: entry.icon,
      slot: this.mapSlot(SLOTS[i] ?? SLOTS[SLOTS.length - 1]),
      colorIndex: entry.colorIndex,
    }));
  }

  // ---------------------------------------------------------------------
  // Geri bildirim
  // ---------------------------------------------------------------------

  /** Haptic + ses geri bildirimini tek yerden, ayarlara saygılı biçimde tetikler. */
  private feedback(kind: 'tap' | 'success' | 'warning'): void {
    if (this.saveData.hapticEnabled) {
      if (kind === 'tap') this.hapticService.light();
      else if (kind === 'success') this.hapticService.success();
      else this.hapticService.warning();
    }
    if (this.saveData.soundEnabled) {
      if (kind === 'tap') this.soundService.tap();
      else if (kind === 'success') this.soundService.complete();
      else this.soundService.invalid();
    }
  }

  private click(): void {
    if (this.saveData.soundEnabled) this.soundService.button();
    if (this.saveData.hapticEnabled) this.hapticService.light();
  }

  // ---------------------------------------------------------------------
  // Üst bölüm: logo + oda kartı
  // ---------------------------------------------------------------------

  private drawLogo(x: number, y: number): void {
    const cozy = this.add.text(0, 0, 'Cozy', textStyle('display'));
    const sort = this.add.text(0, 0, ' Sort', textStyle('display', { color: COLORS.terracotta }));
    const total = cozy.width + sort.width;
    cozy.setOrigin(0, 0.5).setPosition(-total / 2, 0);
    sort.setOrigin(0, 0.5).setPosition(-total / 2 + cozy.width, 0);
    const swash = this.add.graphics();
    swash.lineStyle(4, hexToNum(COLORS.honey), 0.9);
    // "Sort" altında sıcak bal rengi kıvrım
    const sx = -total / 2 + cozy.width + 14;
    const sw = sort.width - 18;
    const points: Phaser.Math.Vector2[] = [];
    for (let i = 0; i <= 12; i++) {
      const tt = i / 12;
      points.push(new Phaser.Math.Vector2(sx + sw * tt, 26 + Math.sin(tt * Math.PI) * 5));
    }
    for (let i = 1; i < points.length; i++) swash.lineBetween(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
    const logo = this.add.container(x, y, [swash, cozy, sort]);
    if (!prefersReducedMotion()) this.tweens.add({ targets: logo, y: y - 3, duration: 2200, yoyo: true, repeat: -1, ease: EASE.inOut });
  }

  private drawRoomCard(x: number, y: number, w: number): void {
    const h = 92;
    const card = this.add.container(x, y);
    const bg = this.add.graphics();
    bg.fillStyle(0xffffff, 0.86);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 22);
    bg.lineStyle(1.5, hexToNum(COLORS.woodLight), 0.8);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 22);
    card.add(bg);
    card.add(this.add.text(-w / 2 + 22, -h / 2 + 26, roomName(this.room.id, this.room.name, this.lang), textStyle('sectionTitle')).setOrigin(0, 0.5));
    card.add(
      this.add
        .text(w / 2 - 22, -h / 2 + 26, t('roomCounterLabel', this.lang, { current: this.saveData.currentRoomIndex + 1, total: ROOMS.length }), textStyle('caption', { color: COLORS.inkSoft }))
        .setOrigin(1, 0.5),
    );
    const barW = w - 44;
    const barY = 6;
    const track = this.add.graphics();
    track.fillStyle(hexToNum(COLORS.surfaceMuted), 1);
    track.fillRoundedRect(-barW / 2, barY, barW, 16, 8);
    card.add(track);
    this.progressBarFill = this.add.graphics();
    card.add(this.progressBarFill);
    this.progressBar = { x: -barW / 2, y: barY, w: barW };
    this.progressLabel = this.add.text(0, h / 2 - 16, '', textStyle('caption', { color: COLORS.inkSoft })).setOrigin(0.5);
    card.add(this.progressLabel);
  }

  private updateProgressBar(fraction: number, animate: boolean): void {
    const draw = (f: number) => {
      const g = this.progressBarFill;
      const { x, y, w } = this.progressBar;
      g.clear();
      const fillW = Math.max(16, w * Phaser.Math.Clamp(f, 0, 1));
      g.fillGradientStyle(hexToNum(COLORS.honey), hexToNum(COLORS.terracotta), hexToNum(COLORS.honey), hexToNum(COLORS.terracotta), 1, 1, 1, 1);
      g.fillRect(x + 8, y, Math.max(0, fillW - 16), 16);
      g.fillStyle(hexToNum(COLORS.honey), 1);
      g.fillCircle(x + 8, y + 8, 8);
      g.fillStyle(hexToNum(COLORS.terracotta), 1);
      g.fillCircle(x + fillW - 8, y + 8, 8);
      g.fillStyle(0xffffff, 0.35);
      g.fillRect(x + 8, y + 3, Math.max(0, fillW - 16), 3);
    };
    if (!animate) {
      draw(fraction);
      this.progressBarFill.setData('f', fraction);
      return;
    }
    const proxy = { f: (this.progressBarFill.getData('f') as number) ?? 0 };
    this.tweens.add({
      targets: proxy,
      f: fraction,
      duration: 600,
      ease: EASE.out,
      onUpdate: () => draw(proxy.f),
      onComplete: () => this.progressBarFill.setData('f', fraction),
    });
  }

  private refresh(animateProgress = false): void {
    this.starChip.setValue(this.saveData.stars);
    const progress = this.saveData.rooms[this.saveData.currentRoomIndex];
    const restored = restoredCount(progress);
    this.progressLabel.setText(t('itemsRestoredLabel', this.lang, { restored, total: this.room.items.length }));
    this.updateProgressBar(restored / this.room.items.length, animateProgress);
    this.updateDailyRewardButton();
    this.drawRoom();
  }

  private updateDailyRewardButton(): void {
    const claimable = canClaimDailyReward(this.saveData.dailyReward, todayKey(new Date()));
    this.dailyRewardButton.setEnabled(claimable);
    this.dailyRewardButton.setLabel(claimable ? t('dailyRewardButton', this.lang) : t('dailyRewardClaimed', this.lang));
  }

  // ---------------------------------------------------------------------
  // Oda illüstrasyonu: eşyalar kendi yuvalarında, önce/sonra kontrastı
  // ---------------------------------------------------------------------

  private drawRoom(): void {
    this.itemsLayer.removeAll(true);
    const progress = this.saveData.rooms[this.saveData.currentRoomIndex];

    for (const placed of this.placedItems) {
      const state = progress.items[placed.id];
      const restored = state?.restored ?? false;
      const size = SLOT_BASE * placed.slot.scale;
      const accent = colorForItemIndex(placed.colorIndex);
      const card = this.add.container(placed.slot.x, placed.slot.y);

      if (restored) card.add(this.add.circle(0, size * 0.1, size * 0.62, accent, 0.12));
      card.add(drawRoomIcon(this, placed.icon, size, size, accent, restored));
      card.setData('itemId', placed.id);

      if (!restored) {
        const affordable = this.saveData.stars >= placed.cost;
        const badge = this.add.container(size * 0.42, -size * 0.46);
        const bg = this.add.graphics();
        bg.fillStyle(affordable ? 0xffffff : hexToNum(COLORS.surfaceMuted), 0.97);
        bg.fillRoundedRect(-26, -13, 52, 26, 13);
        bg.lineStyle(1.5, hexToNum(affordable ? COLORS.gold : COLORS.inkFaint), 0.9);
        bg.strokeRoundedRect(-26, -13, 52, 26, 13);
        badge.add(bg);
        badge.add(this.add.image(-12, 0, bakeStar(this, 14, true)).setDisplaySize(18, 18).setAlpha(affordable ? 1 : 0.55));
        badge.add(this.add.text(3, 0, `${placed.cost}`, textStyle('badge', { color: affordable ? COLORS.ink : COLORS.inkSoft })).setOrigin(0, 0.5));
        card.add(badge);
        // Alınabilir eşyalar hafifçe "çağırır" (rozet nabzı) -- oyuncuya ne yapacağını metinsiz anlatır.
        if (affordable && !prefersReducedMotion()) {
          this.tweens.add({ targets: badge, scale: 1.12, duration: 700, yoyo: true, repeat: -1, ease: EASE.inOut, delay: Phaser.Math.Between(0, 600) });
        }
      }

      const zoneSize = Math.max(48, size * 1.1);
      const zone = this.add.zone(0, 0, zoneSize, zoneSize);
      card.add(zone);
      if (!restored) {
        zone.setInteractive({ useHandCursor: true });
        zone.on('pointerup', () => this.onTapItem(placed));
      }
      this.itemsLayer.add(card);
    }
  }

  private findCard(itemId: string): Phaser.GameObjects.Container | undefined {
    return (this.itemsLayer.list as Phaser.GameObjects.Container[]).find((c) => c.getData('itemId') === itemId);
  }

  private onTapItem(placed: PlacedItem): void {
    if (this.modalOpen) return;
    if (this.saveData.stars < placed.cost) {
      this.feedback('warning');
      const card = this.findCard(placed.id);
      if (card) {
        const baseX = card.x;
        const proxy = { t: 0 };
        this.tweens.add({
          targets: proxy,
          t: 1,
          duration: 320,
          ease: EASE.out,
          onUpdate: () => card.setX(baseX + Math.sin(proxy.t * Math.PI * 5) * 6 * (1 - proxy.t)),
          onComplete: () => card.setX(baseX),
        });
      }
      this.tweens.add({ targets: this.starChip.root, scale: 1.12, duration: 120, yoyo: true, ease: EASE.out });
      return;
    }
    this.feedback('tap');
    this.openStyleModal(placed);
  }

  // ---------------------------------------------------------------------
  // Modallar
  // ---------------------------------------------------------------------

  private openModalShell(panelH: number, title: string, ribbonColor: string): Phaser.GameObjects.Container {
    this.modalOpen = true;
    this.modalLayer.removeAll(true);
    const { width: w, height: h } = this.vp;
    const overlay = this.add.rectangle(w / 2, h / 2, w * 3, h * 3, hexToNum(COLORS.overlay), 0).setInteractive();
    this.tweens.add({ targets: overlay, fillAlpha: 0.45, duration: 220, ease: EASE.out });
    this.modalLayer.add(overlay);
    const panelW = Math.min(w - 48, 380);
    const panel = this.add.container(w / 2, h / 2);
    addPanelCard(this, panel, panelW, panelH);
    panel.add(this.add.zone(0, 0, panelW, panelH).setInteractive());
    addRibbon(this, panel, -panelH / 2 + 4, Math.min(panelW - 40, 300), ribbonColor, title, ribbonColor === COLORS.honey ? COLORS.ink : COLORS.cream);
    this.modalLayer.add(panel);
    panel.setY(h / 2 + 50).setAlpha(0).setScale(0.94);
    this.tweens.add({ targets: panel, y: h / 2, alpha: 1, scale: 1, duration: 360, ease: EASE.back });
    overlay.on('pointerup', () => this.closeModal());
    return panel;
  }

  private closeModal(then?: () => void): void {
    if (!this.modalOpen) return;
    this.modalOpen = false;
    const layer = this.modalLayer;
    this.tweens.add({
      targets: layer,
      alpha: 0,
      duration: 180,
      ease: EASE.out,
      onComplete: () => {
        layer.removeAll(true);
        layer.setAlpha(1);
        then?.();
      },
    });
  }

  private openSettings(): void {
    this.modalOpen = true;
    openSettingsPanel(this, {
      showLanguage: true,
      onPress: () => this.click(),
      onChange: (data) => {
        this.saveData = data;
      },
      onLanguageChange: () => fadeToScene(this, 'RoomScene'),
      onClose: () => {
        this.modalOpen = false;
      },
    });
  }

  private openStyleModal(placed: PlacedItem): void {
    const panelH = 330;
    const label = itemLabel(placed.label, this.lang);
    const panel = this.openModalShell(panelH, label, COLORS.honey);
    panel.add(this.add.text(0, -panelH / 2 + 66, t('chooseStyleTitle', this.lang, { item: label }), textStyle('body', { color: COLORS.inkSoft })).setOrigin(0.5));

    const accent = colorForItemIndex(placed.colorIndex);
    this.addStyleOption(panel, -78, -6, placed.icon, accent, 0, t('styleA', this.lang), placed);
    this.addStyleOption(panel, 78, -6, placed.icon, hexToNum(COLORS.turquoise), 1, t('styleB', this.lang), placed);

    const cancel = createButton(this, {
      x: 0,
      y: panelH / 2 - 44,
      width: 200,
      height: 48,
      label: t('cancel', this.lang),
      variant: 'ghost',
      onPress: () => this.click(),
      onTap: () => this.closeModal(),
    });
    panel.add(cancel.root);
  }

  private addStyleOption(panel: Phaser.GameObjects.Container, x: number, y: number, icon: RoomIconKey, color: number, styleIndex: 0 | 1, label: string, placed: PlacedItem): void {
    const option = this.add.container(x, y);
    const bg = this.add.graphics();
    bg.fillStyle(hexToNum(COLORS.paper), 1);
    bg.fillRoundedRect(-62, -66, 124, 150, 20);
    bg.lineStyle(2.5, color, 0.7);
    bg.strokeRoundedRect(-62, -66, 124, 150, 20);
    option.add(bg);
    const art = drawRoomIcon(this, icon, 74, 74, color, true);
    art.setY(-12);
    option.add(art);
    option.add(this.add.text(0, 44, label, textStyle('buttonSmall')).setOrigin(0.5));
    option.add(this.add.image(-16, 66, bakeStar(this, 14, true)).setDisplaySize(18, 18));
    option.add(this.add.text(-4, 66, `${placed.cost}`, textStyle('caption')).setOrigin(0, 0.5));
    const zone = this.add.zone(0, 8, 124, 150).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => this.tweens.add({ targets: option, scale: 0.95, duration: 70, ease: EASE.out }));
    zone.on('pointerout', () => this.tweens.add({ targets: option, scale: 1, duration: 200, ease: EASE.back }));
    zone.on('pointerup', () => {
      this.tweens.add({ targets: option, scale: 1, duration: 200, ease: EASE.back });
      this.closeModal(() => this.confirmRestore(placed, styleIndex));
    });
    option.add(zone);
    panel.add(option);
  }

  private confirmRestore(placed: PlacedItem, styleIndex: 0 | 1): void {
    const progress = this.saveData.rooms[this.saveData.currentRoomIndex];
    const outcome = restoreItem(this.room, progress, placed.id, styleIndex, this.saveData.stars);
    if (!outcome.ok) {
      this.feedback('warning');
      return;
    }

    const rooms = this.saveData.rooms.slice();
    rooms[this.saveData.currentRoomIndex] = outcome.progress;
    this.saveData = { ...this.saveData, stars: outcome.starsRemaining, rooms };
    this.saveService.save(this.saveData);
    this.feedback('success');
    this.analytics.track({ name: 'room_item_restored', roomId: this.room.id, itemId: placed.id, styleIndex });
    this.refresh(true);
    this.playRestoreFx(placed);

    if (isRoomComplete(outcome.progress)) {
      this.time.delayedCall(700, () => this.onRoomComplete());
    }
  }

  /** Yenileme: "boyanmamış" eşya küçükten büyüyerek renkleriyle belirir + ışık parlaması + ışıltı/renk patlaması. */
  private playRestoreFx(placed: PlacedItem): void {
    const { x, y } = placed.slot;
    const card = this.findCard(placed.id);
    if (card) {
      card.setScale(0.55);
      this.tweens.add({ targets: card, scale: 1, duration: 480, ease: EASE.back });
    }
    const flash = this.add.circle(x, y, SLOT_BASE * placed.slot.scale * 0.5, 0xffffff, 0.75).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: flash, scale: 1.6, alpha: 0, duration: 380, ease: EASE.out, onComplete: () => flash.destroy() });
    this.particles.burst(x, y, 16);
    this.particles.sparkle(x, y - 20, 8);
  }

  /** Oda tamamlama: güçlü ama sade bir kutlama paneli (sonuç panelleriyle aynı kart dili). */
  private onRoomComplete(): void {
    const isLastRoom = this.saveData.currentRoomIndex >= ROOMS.length - 1;
    const name = roomName(this.room.id, this.room.name, this.lang);
    const title = isLastRoom ? t('allRoomsCompleteNote', this.lang) : t('roomCompleteTitle', this.lang, { room: name });
    this.confetti.burst(this.vp.width, this.vp.height, prefersReducedMotion());
    if (this.saveData.soundEnabled) this.soundService.win();

    const panelH = 330;
    const panel = this.openModalShell(panelH, name, COLORS.terracotta);
    const star = this.add.image(0, -panelH / 2 + 110, bakeStar(this, 80, true)).setDisplaySize(104, 104);
    const finalScale = star.scale;
    star.setScale(0);
    panel.add(star);
    this.tweens.add({ targets: star, scale: finalScale, angle: { from: -30, to: 0 }, duration: 520, delay: 200, ease: EASE.back });
    panel.add(
      this.add.text(0, -panelH / 2 + 190, title, textStyle('sectionTitle', { align: 'center', wordWrap: { width: 300 } })).setOrigin(0.5),
    );
    panel.add(this.add.text(0, -panelH / 2 + 226, t('roomCompleteSubtitle', this.lang), textStyle('body', { color: COLORS.inkSoft })).setOrigin(0.5));
    const cont = createButton(this, {
      x: 0,
      y: panelH / 2 - 48,
      width: 280,
      height: 58,
      label: t('continueButton', this.lang),
      onPress: () => this.click(),
      onTap: () => {
        const nextIndex = this.saveData.currentRoomIndex + 1;
        if (nextIndex < ROOMS.length) {
          this.saveData = { ...this.saveData, currentRoomIndex: nextIndex };
          this.saveService.save(this.saveData);
        }
        fadeToScene(this, 'RoomScene');
      },
    });
    panel.add(cont.root);
    cont.pulse();
  }

  private onClaimDailyReward(): void {
    const today = todayKey(new Date());
    const result = claimDailyReward(this.saveData.dailyReward, today, DAILY_REWARD_BASE);
    if (!result.claimed) return;

    const before = this.saveData.stars;
    this.saveData = { ...this.saveData, stars: this.saveData.stars + result.starsAwarded, dailyReward: result.state };
    this.saveService.save(this.saveData);
    this.feedback('success');
    this.flyRewardStars(before, this.saveData.stars);
    this.updateDailyRewardButton();
    this.drawRoom();
  }

  /** Günlük ödül: butondan yıldız çipine yay çizen yıldızlar + çip sayacı artarak sayar. */
  private flyRewardStars(from: number, to: number): void {
    const start = this.dailyRewardButton.root;
    const target = this.starChip.star.getWorldTransformMatrix();
    const tx = target.tx / this.cameras.main.zoom + this.cameras.main.scrollX;
    const ty = target.ty / this.cameras.main.zoom + this.cameras.main.scrollY;
    const key = bakeStar(this, 22, true);
    const count = 6;
    for (let i = 0; i < count; i++) {
      const star = this.add.image(start.x, start.y, key).setDisplaySize(28, 28).setDepth(150);
      const base = star.scale;
      const progress = { t: 0 };
      const spread = (i - (count - 1) / 2) * 30;
      this.tweens.add({
        targets: progress,
        t: 1,
        duration: 620,
        delay: i * 60,
        ease: EASE.inOut,
        onUpdate: () => {
          const tt = progress.t;
          const bow = Math.sin(Math.PI * tt);
          star.setPosition(Phaser.Math.Linear(start.x, tx, tt) + spread * bow, Phaser.Math.Linear(start.y, ty, tt) - 120 * bow);
          star.setScale(base * (1 + 0.3 * bow)).setAngle(tt * 200);
        },
        onComplete: () => {
          star.destroy();
          this.particles.sparkle(tx, ty, 2);
          this.tweens.add({ targets: this.starChip.root, scale: 1.1, duration: 90, yoyo: true, ease: EASE.out });
        },
      });
    }
    const proxy = { n: from };
    this.tweens.add({ targets: proxy, n: to, duration: 700, delay: 600, ease: EASE.out, onUpdate: () => this.starChip.setValue(Math.round(proxy.n)) });
  }

  private createPlayButton(x: number, y: number): void {
    const w = Math.min(320, this.vp.width - 80);
    const play = createButton(this, {
      x,
      y,
      width: w,
      height: 74,
      label: t('playButton', this.lang),
      textRole: 'display',
      onPress: () => this.click(),
      isBlocked: () => this.modalOpen,
      onTap: () => fadeToScene(this, 'GameScene', { mode: 'progress', levelNumber: this.saveData.currentLevel }),
    });
    // sıradaki seviye rozeti (butonun sağında, altın daire)
    const badge = this.add.container(w / 2 - 40, -2);
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.95);
    g.fillCircle(0, 0, 21);
    g.lineStyle(2, hexToNum(COLORS.gold), 1);
    g.strokeCircle(0, 0, 21);
    badge.add(g);
    badge.add(this.add.text(0, 0, `${this.saveData.currentLevel}`, textStyle(this.saveData.currentLevel >= 100 ? 'badge' : 'sectionTitle', { color: COLORS.terracotta })).setOrigin(0.5));
    (play.root.list[1] as Phaser.GameObjects.Container).add(badge);
    play.pulse();
  }
}
