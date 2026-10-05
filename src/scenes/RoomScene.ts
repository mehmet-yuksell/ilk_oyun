import Phaser from 'phaser';
import { isRoomComplete, restoreItem, restoredCount, type RoomDef } from '../core/room';
import { ROOMS } from '../core/roomDefs';
import { canClaimDailyReward, claimDailyReward, todayKey } from '../core/dailyReward';
import { LocalStorageSaveService, type SaveData, type SaveService } from '../services/SaveService';
import { type HapticService, WebVibrationHapticService } from '../services/HapticService';
import { type SoundService, WebAudioSoundService } from '../services/SoundService';
import { type AdService, MockAdService, type RewardedPlacement } from '../services/AdService';
import { type AnalyticsService, ConsoleAnalyticsService } from '../services/AnalyticsService';
import { getDebugLevelParam } from './debugLevelParam';
import { colorForItemIndex } from './roomVisuals';
import { drawRoomIcon, iconKeyForLabel, ICON_DEPTH, type RoomIconKey } from './roomItemArt';
import { readSafeAreaInsets } from './safeArea';
import { COLORS, hexToNum, shade } from './theme';
import { themeForLevel } from '../config/tuning';
import { ConfettiEmitter, prefersReducedMotion } from './confetti';
import { t } from '../i18n/translations';
import type { Language } from '../i18n/translations';

const DAILY_REWARD_BASE = 20;

interface Slot {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

// 3+3+2+2 = 10 yuva: üstte küçük/uzak (duvar) öğeler, altta büyük/yakın (zemin) öğeler --
// basit ama etkili bir derinlik hissi. Her odanın 10 öğesi, ICON_DEPTH ağırlığına göre
// sıralanıp bu sabit yuvalara yerleştirilir (bkz. layoutItems), böylece "Koltuk" gibi büyük bir
// zemin eşyası hangi odada hangi index'te olursa olsun hep alt/büyük bir yuvaya düşer.
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
const SLOT_BASE = 92;

interface PlacedItem {
  readonly id: string;
  readonly label: string;
  readonly cost: number;
  readonly icon: RoomIconKey;
  readonly slot: Slot;
  readonly colorIndex: number;
}

export class RoomScene extends Phaser.Scene {
  private readonly saveService: SaveService = new LocalStorageSaveService(window.localStorage);
  private readonly hapticService: HapticService = new WebVibrationHapticService();
  private readonly soundService: SoundService = new WebAudioSoundService();
  private readonly adService: AdService = new MockAdService();
  private readonly analytics: AnalyticsService = new ConsoleAnalyticsService();

  private saveData!: SaveData;
  private room!: RoomDef;
  private lang: Language = 'tr';
  private placedItems: PlacedItem[] = [];
  private safeTop = 20;
  private safeBottom = 20;

  private starText!: Phaser.GameObjects.Text;
  private progressBarFill!: Phaser.GameObjects.Graphics;
  private progressLabel!: Phaser.GameObjects.Text;
  private itemsLayer!: Phaser.GameObjects.Container;
  private modalLayer!: Phaser.GameObjects.Container;
  private dailyRewardButton!: { setEnabled: (v: boolean) => void; setLabel: (s: string) => void };
  private confetti!: ConfettiEmitter;

  constructor() {
    super('RoomScene');
  }

  create(): void {
    const debugLevel = getDebugLevelParam();
    if (debugLevel !== null) {
      this.scene.start('GameScene');
      return;
    }

    this.saveData = this.saveService.load();
    this.lang = this.saveData.language;
    if (this.saveData.currentRoomIndex >= ROOMS.length) {
      this.saveData = { ...this.saveData, currentRoomIndex: ROOMS.length - 1 };
    }
    this.room = ROOMS[this.saveData.currentRoomIndex];
    this.placedItems = this.layoutItems(this.room);
    this.confetti = new ConfettiEmitter(this, 210);

    const insets = readSafeAreaInsets(this.sys.game.canvas as HTMLCanvasElement);
    this.safeTop = insets.top;
    this.safeBottom = insets.bottom;

    this.drawBackground();

    this.add
      .text(this.scale.width / 2, this.safeTop + 30, this.room.name, {
        fontFamily: 'Fredoka, sans-serif',
        fontSize: '28px',
        fontStyle: '600',
        color: COLORS.ink,
      })
      .setOrigin(0.5);

    this.add
      .text(
        this.scale.width / 2,
        this.safeTop + 58,
        t('roomCounterLabel', this.lang, { current: this.saveData.currentRoomIndex + 1, total: ROOMS.length }),
        { fontFamily: 'Fredoka, sans-serif', fontSize: '12px', color: COLORS.inkSoft },
      )
      .setOrigin(0.5);

    this.starText = this.add
      .text(this.scale.width - insets.right - 44, this.safeTop + 14, '', {
        fontFamily: 'Fredoka, sans-serif',
        fontSize: '17px',
        fontStyle: '600',
        color: COLORS.ink,
      })
      .setOrigin(1, 0);
    this.drawStarGlyph(this.scale.width - insets.right - 18, this.safeTop + 22, 8);

    this.createSettingsButton(this.scale.width - insets.right - 18, this.safeTop + 54);

    this.dailyRewardButton = this.createSmallButton(
      this.scale.width / 2 - 95,
      this.safeTop + 96,
      170,
      36,
      t('dailyRewardButton', this.lang),
      () => this.onClaimDailyReward(),
    );
    this.createSmallButton(this.scale.width / 2 + 95, this.safeTop + 96, 170, 36, t('dailyPuzzleButton', this.lang), () => {
      this.scene.start('GameScene', { mode: 'daily' });
    });

    this.drawProgressBar(this.safeTop + 128);

    this.itemsLayer = this.add.container(0, 0);
    this.modalLayer = this.add.container(0, 0).setDepth(100);

    const playY = this.scale.height - this.safeBottom - 44;
    this.createPlayButton(this.scale.width / 2, playY, t('playButton', this.lang), () => {
      this.scene.start('GameScene', { mode: 'progress', levelNumber: this.saveData.currentLevel });
    });

    this.refresh();
  }

  /** ICON_DEPTH ağırlığına göre sıralayıp 10 sabit yuvaya (bkz. SLOTS) dağıtır -- büyük/yakın
   * eşyalar (koltuk, yatak, halı) hep alt-büyük yuvalara, küçük/uzak eşyalar (çerçeve, lamba)
   * hep üst-küçük yuvalara düşer; hangi odada hangi index'te olurlarsa olsunlar. */
  private layoutItems(room: RoomDef): PlacedItem[] {
    const withIcon = room.items.map((item, colorIndex) => ({
      item,
      colorIndex,
      icon: iconKeyForLabel(item.label),
    }));
    const sorted = withIcon
      .map((entry, originalIndex) => ({ ...entry, originalIndex }))
      .sort((a, b) => ICON_DEPTH[a.icon] - ICON_DEPTH[b.icon] || a.originalIndex - b.originalIndex);

    return sorted.map((entry, i) => ({
      id: entry.item.id,
      label: entry.item.label,
      cost: entry.item.cost,
      icon: entry.icon,
      slot: SLOTS[i] ?? SLOTS[SLOTS.length - 1],
      colorIndex: entry.colorIndex,
    }));
  }

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

  private refresh(): void {
    this.starText.setText(`${this.saveData.stars}`);
    const progress = this.saveData.rooms[this.saveData.currentRoomIndex];
    const restored = restoredCount(progress);
    this.progressLabel.setText(t('itemsRestoredLabel', this.lang, { restored, total: this.room.items.length }));
    this.updateProgressBar(restored / this.room.items.length);
    this.updateDailyRewardButton();
    this.drawRoom();
  }

  private updateDailyRewardButton(): void {
    const claimable = canClaimDailyReward(this.saveData.dailyReward, todayKey(new Date()));
    this.dailyRewardButton.setEnabled(claimable);
    this.dailyRewardButton.setLabel(claimable ? t('dailyRewardButton', this.lang) : t('dailyRewardClaimed', this.lang));
  }

  // ---------------------------------------------------------------------
  // Görsel: arkaplan, ilerleme çubuğu, ayarlar/yıldız ikonları
  // ---------------------------------------------------------------------

  private drawBackground(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const wallBottom = h * 0.68;
    const theme = themeForLevel(this.saveData.currentLevel);

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
    g.fillStyle(0xffffff, 0.22);
    g.fillRect(0, wallBottom - 2, w, 3);

    // Pencere: başlık/ilerleme çubuğu ile en üst eşya sırası (SLOTS[0..2]) arasındaki dar banda
    // sığacak geniş-alçak bir "vasistas" formu -- bu sayede ne üst bilgi çubuğuna ne de
    // eşyalara binmiyor.
    const winW = w * 0.42;
    const winH = 34;
    const winX = w / 2 - winW / 2;
    const winY = this.safeTop + 166;
    g.fillStyle(0xffffff, 0.25);
    g.fillEllipse(winX + winW / 2, winY + winH / 2, winW * 1.5, winH * 2.2);
    g.fillStyle(hexToNum(COLORS.sky), 0.25);
    g.fillRoundedRect(winX, winY, winW, winH, 8);
    g.lineStyle(3, 0xfff8f0, 0.55);
    g.strokeRoundedRect(winX, winY, winW, winH, 8);
    g.lineBetween(winX + winW / 3, winY, winX + winW / 3, winY + winH);
    g.lineBetween(winX + (winW * 2) / 3, winY, winX + (winW * 2) / 3, winY + winH);

    g.fillStyle(hexToNum(COLORS.ink), 0.04);
    for (let i = 0; i < 4; i++) {
      g.fillRect(0, wallBottom + 20 + i * ((h - wallBottom - 30) / 4), w, 1.5);
    }
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

  private createSettingsButton(x: number, y: number): void {
    const r = 16;
    const g = this.add.graphics();
    g.fillStyle(hexToNum(COLORS.surface), 0.85);
    g.fillCircle(x, y, r);
    g.lineStyle(2, hexToNum(COLORS.coral), 0.5);
    g.strokeCircle(x, y, r);
    // Dişli ikonu: halka + 6 küçük diş.
    g.fillStyle(hexToNum(COLORS.ink), 0.7);
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      const tx = x + Math.cos(angle) * 8;
      const ty = y + Math.sin(angle) * 8;
      g.fillCircle(tx, ty, 2.6);
    }
    g.fillStyle(hexToNum(COLORS.surface), 1);
    g.fillCircle(x, y, 5);
    g.lineStyle(2, hexToNum(COLORS.ink), 0.7);
    g.strokeCircle(x, y, 5);

    const zone = this.add.zone(x, y, Math.max(48, r * 2 + 12), Math.max(48, r * 2 + 12)).setInteractive({ useHandCursor: true });
    zone.on('pointerup', () => this.scene.start('SettingsScene'));
  }

  private drawProgressBar(y: number): void {
    const barW = this.scale.width - 80;
    const barX = this.scale.width / 2 - barW / 2;
    const bg = this.add.graphics();
    bg.fillStyle(hexToNum(COLORS.surface), 0.6);
    bg.fillRoundedRect(barX, y, barW, 10, 5);
    this.progressBarFill = this.add.graphics();
    this.progressBarFill.setData('x', barX);
    this.progressBarFill.setData('y', y);
    this.progressBarFill.setData('w', barW);

    this.progressLabel = this.add
      .text(this.scale.width / 2, y + 20, '', { fontFamily: 'Fredoka, sans-serif', fontSize: '12px', color: COLORS.inkSoft })
      .setOrigin(0.5);
  }

  private updateProgressBar(fraction: number): void {
    const g = this.progressBarFill;
    const x = g.getData('x') as number;
    const y = g.getData('y') as number;
    const w = g.getData('w') as number;
    g.clear();
    g.fillGradientStyle(hexToNum(COLORS.coral), hexToNum(COLORS.mustard), hexToNum(COLORS.coral), hexToNum(COLORS.mustard), 1, 1, 1, 1);
    g.fillRoundedRect(x, y, Math.max(10, w * Phaser.Math.Clamp(fraction, 0, 1)), 10, 5);
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

      if (restored) {
        const halo = this.add.circle(0, size * 0.1, size * 0.62, accent, 0.12);
        card.add(halo);
      }

      const icon = drawRoomIcon(this, placed.icon, size, size, accent, restored);
      card.add(icon);

      if (!restored) {
        const badge = this.add.container(size * 0.42, -size * 0.46);
        const bg = this.add.graphics();
        bg.fillStyle(hexToNum(COLORS.surface), 0.95);
        bg.fillRoundedRect(-22, -11, 44, 22, 11);
        bg.lineStyle(1.5, hexToNum(COLORS.gold), 0.8);
        bg.strokeRoundedRect(-22, -11, 44, 22, 11);
        badge.add(bg);
        const starGlyph = this.add.graphics();
        starGlyph.fillStyle(hexToNum(COLORS.gold), 1);
        const pts: { x: number; y: number }[] = [];
        for (let p = 0; p < 10; p++) {
          const angle = (Math.PI / 5) * p - Math.PI / 2;
          const radius = p % 2 === 0 ? 5 : 2.2;
          pts.push({ x: -10 + Math.cos(angle) * radius, y: Math.sin(angle) * radius });
        }
        starGlyph.fillPoints(pts, true);
        badge.add(starGlyph);
        badge.add(
          this.add
            .text(4, 0, `${placed.cost}`, { fontFamily: 'Fredoka, sans-serif', fontSize: '13px', fontStyle: '600', color: COLORS.ink })
            .setOrigin(0, 0.5),
        );
        card.add(badge);
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

  private onTapItem(placed: PlacedItem): void {
    if (this.saveData.stars < placed.cost) {
      this.feedback('warning');
      this.shakeSlot(placed);
      return;
    }
    this.feedback('tap');
    this.openStyleModal(placed);
  }

  private shakeSlot(placed: PlacedItem): void {
    const card = this.itemsLayer.list.find(
      (c) => (c as Phaser.GameObjects.Container).x === placed.slot.x && (c as Phaser.GameObjects.Container).y === placed.slot.y,
    );
    if (!card) return;
    this.tweens.add({ targets: card, x: { from: placed.slot.x - 6, to: placed.slot.x }, duration: 60, yoyo: true, repeat: 3 });
  }

  private openStyleModal(placed: PlacedItem): void {
    this.modalLayer.removeAll(true);

    const overlay = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x2b2320, 0.55).setOrigin(0, 0);
    overlay.setInteractive();
    this.modalLayer.add(overlay);

    const panelW = 320;
    const panelH = 240;
    const panelX = this.scale.width / 2 - panelW / 2;
    const panelY = this.scale.height / 2 - panelH / 2;

    const panel = this.add.graphics();
    panel.fillStyle(hexToNum(COLORS.bgTop), 1);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 20);
    panel.lineStyle(2, hexToNum(COLORS.coral), 0.4);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 20);
    this.modalLayer.add(panel);

    this.modalLayer.add(
      this.add
        .text(this.scale.width / 2, panelY + 32, t('chooseStyleTitle', this.lang, { item: placed.label }), {
          fontFamily: 'Fredoka, sans-serif',
          fontSize: '16px',
          fontStyle: '600',
          color: COLORS.ink,
        })
        .setOrigin(0.5),
    );

    const accent = colorForItemIndex(placed.colorIndex);
    this.addStyleOption(panelX + panelW / 2 - 72, panelY + 128, placed.icon, accent, 0, t('styleA', this.lang), placed);
    this.addStyleOption(panelX + panelW / 2 + 72, panelY + 128, placed.icon, accent, 1, t('styleB', this.lang), placed);

    const cancelY = panelY + panelH - 26;
    const cancel = this.add
      .text(this.scale.width / 2, cancelY, t('cancel', this.lang), {
        fontFamily: 'Fredoka, sans-serif',
        fontSize: '13px',
        color: COLORS.inkSoft,
      })
      .setOrigin(0.5);
    this.modalLayer.add(cancel);
    const cancelZone = this.add.zone(this.scale.width / 2, cancelY, 120, 48).setInteractive({ useHandCursor: true });
    cancelZone.on('pointerup', () => this.modalLayer.removeAll(true));
    this.modalLayer.add(cancelZone);
  }

  private addStyleOption(
    x: number,
    y: number,
    icon: RoomIconKey,
    accent: number,
    styleIndex: 0 | 1,
    label: string,
    placed: PlacedItem,
  ): void {
    const bg = this.add.graphics();
    bg.fillStyle(hexToNum(COLORS.surface), 0.9);
    bg.fillRoundedRect(x - 44, y - 44, 88, 88, 14);
    bg.lineStyle(2, styleIndex === 0 ? accent : hexToNum(COLORS.turquoise), 0.6);
    bg.strokeRoundedRect(x - 44, y - 44, 88, 88, 14);
    this.modalLayer.add(bg);

    const swatchColor = styleIndex === 0 ? accent : hexToNum(COLORS.turquoise);
    const iconArt = drawRoomIcon(this, icon, 56, 56, swatchColor, true);
    iconArt.setPosition(x, y - 4);
    this.modalLayer.add(iconArt);

    const text = this.add
      .text(x, y + 56, label, { fontFamily: 'Fredoka, sans-serif', fontSize: '12px', color: COLORS.ink })
      .setOrigin(0.5);
    this.modalLayer.add(text);

    const zone = this.add.zone(x, y, 90, 110).setInteractive({ useHandCursor: true });
    zone.on('pointerup', () => this.confirmRestore(placed, styleIndex));
    this.modalLayer.add(zone);
  }

  private confirmRestore(placed: PlacedItem, styleIndex: 0 | 1): void {
    const progress = this.saveData.rooms[this.saveData.currentRoomIndex];
    const outcome = restoreItem(this.room, progress, placed.id, styleIndex, this.saveData.stars);
    this.modalLayer.removeAll(true);
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
    this.playRestoreFx(placed);
    this.refresh();

    if (isRoomComplete(outcome.progress)) {
      this.time.delayedCall(400, () => this.onRoomComplete());
    }
  }

  /** Yenileme anında kısa bir parıltı + parçacık patlaması (squash&stretch yeni ikonun ilk render'ında). */
  private playRestoreFx(placed: PlacedItem): void {
    const { x, y } = placed.slot;
    const burst = this.add.circle(x, y, 8, hexToNum(COLORS.gold), 0.85);
    this.tweens.add({ targets: burst, radius: 60, alpha: 0, duration: 420, onComplete: () => burst.destroy() });
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const p = this.add.circle(x, y, 3.5, colorForItemIndex(placed.colorIndex), 1);
      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * 55,
        y: y + Math.sin(angle) * 55,
        alpha: 0,
        duration: 420,
        ease: 'Cubic.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  private onRoomComplete(): void {
    const isLastRoom = this.saveData.currentRoomIndex >= ROOMS.length - 1;
    const message = isLastRoom ? t('allRoomsCompleteNote', this.lang) : t('roomCompleteTitle', this.lang, { room: this.room.name });

    this.cameras.main.zoomTo(1.08, 350, 'Sine.easeOut');
    this.spawnConfetti();

    const overlay = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0xf2c14e, 0).setOrigin(0, 0).setDepth(200);
    const text = this.add
      .text(this.scale.width / 2, this.scale.height / 2, message, {
        fontFamily: 'Fredoka, sans-serif',
        fontSize: '26px',
        fontStyle: '600',
        color: COLORS.ink,
        align: 'center',
        wordWrap: { width: this.scale.width - 80 },
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(201);

    this.tweens.add({ targets: overlay, alpha: 0.4, duration: 200, yoyo: true });
    this.tweens.add({
      targets: text,
      alpha: 1,
      duration: 300,
      onComplete: () => {
        this.time.delayedCall(1400, () => {
          this.cameras.main.zoomTo(1, 300);
          const nextIndex = this.saveData.currentRoomIndex + 1;
          if (nextIndex < ROOMS.length) {
            this.saveData = { ...this.saveData, currentRoomIndex: nextIndex };
            this.saveService.save(this.saveData);
          }
          this.time.delayedCall(300, () => this.scene.restart());
        });
      },
    });
  }

  private spawnConfetti(): void {
    this.confetti.burst(this.scale.width, this.scale.height, prefersReducedMotion());
  }

  private onClaimDailyReward(): void {
    const today = todayKey(new Date());
    const result = claimDailyReward(this.saveData.dailyReward, today, DAILY_REWARD_BASE);
    if (!result.claimed) return;

    this.saveData = { ...this.saveData, stars: this.saveData.stars + result.starsAwarded, dailyReward: result.state };
    this.saveService.save(this.saveData);
    this.feedback('success');
    this.showFloatingReward(`+${result.starsAwarded}`);
    this.refresh();
    this.offerDoubleDailyReward(result.starsAwarded);
  }

  /** Günlük ödülü ödüllü reklamla ikiye katlama teklifi; birkaç saniye içinde dokunulmazsa kendiliğinden kapanır. */
  private offerDoubleDailyReward(awarded: number): void {
    const placement: RewardedPlacement = 'double-daily-reward';
    const btnY = this.safeTop + 150;
    const btn = this.add
      .text(this.scale.width / 2, btnY, t('watchAdDoubleDailyReward', this.lang), {
        fontFamily: 'Fredoka, sans-serif',
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: COLORS.turquoise,
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5)
      .setDepth(50);
    const btnZone = this.add
      .zone(this.scale.width / 2, btnY, Math.max(48, btn.width), 48)
      .setDepth(50)
      .setInteractive({ useHandCursor: true });

    let resolved = false;
    const dismiss = () => {
      if (resolved) return;
      resolved = true;
      btn.destroy();
      btnZone.destroy();
    };

    btnZone.on('pointerup', () => {
      if (resolved) return;
      resolved = true;
      btn.destroy();
      btnZone.destroy();
      this.analytics.track({ name: 'ad_offered', placement });
      this.showMockAdOverlay(() => {
        void this.adService.showRewarded(placement).then((watched) => {
          if (!watched) return;
          this.analytics.track({ name: 'ad_watched', placement });
          this.saveData = { ...this.saveData, stars: this.saveData.stars + awarded };
          this.saveService.save(this.saveData);
          this.showFloatingReward(`+${awarded}`);
          this.refresh();
        });
      });
    });

    this.time.delayedCall(2500, dismiss);
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

  private showFloatingReward(label: string): void {
    const text = this.add
      .text(this.scale.width / 2, this.safeTop + 112, label, {
        fontFamily: 'Fredoka, sans-serif',
        fontSize: '16px',
        fontStyle: '600',
        color: COLORS.coral,
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: text, y: text.y - 36, alpha: 0, duration: 800, onComplete: () => text.destroy() });
  }

  private createSmallButton(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    onTap: () => void,
  ): { setEnabled: (v: boolean) => void; setLabel: (s: string) => void } {
    const bg = this.add.graphics();
    const text = this.add
      .text(x, y, label, { fontFamily: 'Fredoka, sans-serif', fontSize: '13px', fontStyle: '600', color: COLORS.cream })
      .setOrigin(0.5);
    let enabled = true;

    const draw = () => {
      bg.clear();
      bg.fillStyle(enabled ? hexToNum(COLORS.coral) : hexToNum(COLORS.surfaceMuted), 1);
      bg.fillRoundedRect(x - w / 2, y - h / 2, w, h, h / 2);
    };
    draw();

    const zone = this.add.zone(x, y, w, Math.max(48, h)).setInteractive({ useHandCursor: true });
    zone.on('pointerup', () => {
      if (enabled) onTap();
    });

    return {
      setEnabled: (value: boolean) => {
        enabled = value;
        draw();
        text.setAlpha(value ? 1 : 0.6);
        text.setColor(value ? COLORS.cream : COLORS.inkSoft);
      },
      setLabel: (s: string) => text.setText(s),
    };
  }

  private createPlayButton(x: number, y: number, label: string, onTap: () => void): void {
    const w = 220;
    const h = 60;
    // Not: büyük yarıçaplı hap şekillerde native gradient fill WebGL'de köşelerde hatalı facet
    // üretiyor -- düz dolgu + ayrı bir üst parlama şeridiyle aynı "canlı" his, hatasız veriliyor.
    const bg = this.add.graphics();
    bg.fillStyle(hexToNum(COLORS.coral), 1);
    bg.fillRoundedRect(x - w / 2, y - h / 2, w, h, h / 2);
    bg.fillStyle(0xffffff, 0.18);
    bg.fillRoundedRect(x - w / 2 + 8, y - h / 2 + 5, w - 16, h * 0.42, h * 0.3);

    this.add
      .text(x, y, label, { fontFamily: 'Fredoka, sans-serif', fontSize: '22px', fontStyle: '600', color: COLORS.cream })
      .setOrigin(0.5);

    const zone = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
    zone.on('pointerup', onTap);
  }
}
