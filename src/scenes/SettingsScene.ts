import Phaser from 'phaser';
import { LocalStorageSaveService, type SaveData, type SaveService } from '../services/SaveService';
import { COLORS, DEFAULT_THEME, FONT_FAMILY, RADIUS, TYPE_SCALE, hexToNum } from './theme';
import { BASE_HEIGHT, BASE_WIDTH, setupView, type View } from './viewport';
import { drawCozyBackground } from './background';
import { readSafeAreaInsets } from './safeArea';
import { t } from '../i18n/translations';
import { music } from '../services/MusicService';
import type { Language } from '../i18n/translations';

const ROW_X = 40;
const ROW_WIDTH = 460;

export class SettingsScene extends Phaser.Scene {
  private vp: View = { width: BASE_WIDTH, height: BASE_HEIGHT };
  private readonly saveService: SaveService = new LocalStorageSaveService(window.localStorage);

  private saveData!: SaveData;

  constructor() {
    super('SettingsScene');
  }

  create(): void {
    this.vp = setupView(this);
    this.saveData = this.saveService.load();
    const lang: Language = this.saveData.language;
    const insets = readSafeAreaInsets(this);

    this.drawBackground();

    this.add
      .text(this.vp.width / 2, insets.top + 34, t('settingsTitle', lang), {
        fontFamily: FONT_FAMILY,
        fontSize: `${TYPE_SCALE.screenTitle}px`,
        fontStyle: '800',
        color: COLORS.ink,
      })
      .setOrigin(0.5);

    // Satırları saran beyaz, yuvarlak köşeli bir kart -- önceki sürümde satırlar çıplak
    // degradenin üzerinde yüzüyordu ve altında büyük, "bitmemiş" hissi veren boş bir alan
    // kalıyordu (bkz. Faz 8 kararları). Kart hem görsel yapı katıyor hem de "Kapat" butonunu
    // ekranın en altına sabitlemek yerine içeriğin hemen altına taşımayı mümkün kılıyor.
    const rowsTop = insets.top + 90;
    const cardX = this.vp.width / 2 - (ROW_WIDTH + 40) / 2;
    const cardY = rowsTop - 30;
    const cardW = ROW_WIDTH + 40;
    const cardH = 226;
    const card = this.add.graphics();
    card.fillStyle(hexToNum(COLORS.surface), 0.92);
    card.fillRoundedRect(cardX, cardY, cardW, cardH, RADIUS.lg);
    card.lineStyle(2, hexToNum(COLORS.coral), 0.35);
    card.strokeRoundedRect(cardX, cardY, cardW, cardH, RADIUS.lg);

    let y = rowsTop;
    y = this.addLanguageRow(y, lang);
    y = this.addToggleRow(y, t('soundLabel', lang), this.saveData.soundEnabled, (value) => {
      this.saveData = { ...this.saveData, soundEnabled: value };
      this.persistAndRefresh();
    });
    y = this.addToggleRow(y, t('musicLabel', lang), this.saveData.musicEnabled, (value) => {
      this.saveData = { ...this.saveData, musicEnabled: value };
      music.setEnabled(value);
      this.persistAndRefresh();
    });
    this.addToggleRow(y, t('hapticLabel', lang), this.saveData.hapticEnabled, (value) => {
      this.saveData = { ...this.saveData, hapticEnabled: value };
      this.persistAndRefresh();
    });

    this.createButton(this.vp.width / 2, cardY + cardH + 56, t('closeButton', lang), () => {
      this.scene.start('RoomScene');
    });
  }

  private persistAndRefresh(): void {
    this.saveService.save(this.saveData);
    this.scene.restart();
  }

  private drawBackground(): void {
    drawCozyBackground(this, DEFAULT_THEME, this.vp, { motes: 8 });
  }

  private addLanguageRow(y: number, lang: Language): number {
    this.add.text(ROW_X, y, t('languageLabel', lang), { fontFamily: FONT_FAMILY, fontSize: '16px', color: COLORS.ink });

    const trX = ROW_X + ROW_WIDTH - 150;
    const enX = ROW_X + ROW_WIDTH - 70;
    this.addPill(trX, y + 10, 'TR', lang === 'tr', () => this.setLanguage('tr'));
    this.addPill(enX, y + 10, 'EN', lang === 'en', () => this.setLanguage('en'));

    return y + 54;
  }

  private setLanguage(language: Language): void {
    this.saveData = { ...this.saveData, language };
    this.persistAndRefresh();
  }

  private addToggleRow(y: number, label: string, value: boolean, onChange: (value: boolean) => void): number {
    const lang = this.saveData.language;
    this.add.text(ROW_X, y, label, { fontFamily: FONT_FAMILY, fontSize: '16px', color: COLORS.ink });

    const onX = ROW_X + ROW_WIDTH - 150;
    const offX = ROW_X + ROW_WIDTH - 70;
    this.addPill(onX, y + 10, t('onLabel', lang), value, () => onChange(true));
    this.addPill(offX, y + 10, t('offLabel', lang), !value, () => onChange(false));

    return y + 54;
  }

  private addPill(x: number, y: number, label: string, active: boolean, onTap: () => void): void {
    const w = 64;
    const h = 32;
    const bg = this.add.graphics();
    bg.fillStyle(active ? hexToNum(COLORS.coral) : hexToNum(COLORS.surfaceMuted), 1);
    bg.fillRoundedRect(x - w / 2, y - h / 2, w, h, 8);

    this.add
      .text(x, y, label, {
        fontFamily: FONT_FAMILY,
        fontSize: '13px',
        color: active ? COLORS.cream : COLORS.inkSoft,
      })
      .setOrigin(0.5);

    const zone = this.add.zone(x, y, w, Math.max(48, h)).setInteractive({ useHandCursor: true });
    zone.on('pointerup', onTap);
  }

  private createButton(x: number, y: number, label: string, onTap: () => void): void {
    const w = 180;
    const h = 52;
    const bg = this.add.graphics();
    bg.fillStyle(hexToNum(COLORS.coral), 1);
    bg.fillRoundedRect(x - w / 2, y - h / 2, w, h, 14);

    this.add
      .text(x, y, label, { fontFamily: FONT_FAMILY, fontSize: '17px', fontStyle: '800', color: COLORS.cream })
      .setOrigin(0.5);

    const zone = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
    zone.on('pointerup', onTap);
  }
}
