import Phaser from 'phaser';
import { LocalStorageSaveService, type SaveData, type SaveService } from '../services/SaveService';
import { COLORS, TYPE_SCALE, hexToNum, shade } from './theme';
import { readSafeAreaInsets } from './safeArea';
import { syncBodyBackground } from './bodyBackground';
import { t } from '../i18n/translations';
import type { Language } from '../i18n/translations';

const ROW_X = 40;
const ROW_WIDTH = 460;
const FONT = 'Fredoka, sans-serif';

export class SettingsScene extends Phaser.Scene {
  private readonly saveService: SaveService = new LocalStorageSaveService(window.localStorage);

  private saveData!: SaveData;

  constructor() {
    super('SettingsScene');
  }

  create(): void {
    this.saveData = this.saveService.load();
    const lang: Language = this.saveData.language;
    const insets = readSafeAreaInsets(this.sys.game.canvas as HTMLCanvasElement);

    this.drawBackground();

    this.add
      .text(this.scale.width / 2, insets.top + 34, t('settingsTitle', lang), {
        fontFamily: FONT,
        fontSize: `${TYPE_SCALE.screenTitle}px`,
        fontStyle: '600',
        color: COLORS.ink,
      })
      .setOrigin(0.5);

    let y = insets.top + 90;
    y = this.addLanguageRow(y, lang);
    y = this.addToggleRow(y, t('soundLabel', lang), this.saveData.soundEnabled, (value) => {
      this.saveData = { ...this.saveData, soundEnabled: value };
      this.persistAndRefresh();
    });
    y = this.addToggleRow(y, t('hapticLabel', lang), this.saveData.hapticEnabled, (value) => {
      this.saveData = { ...this.saveData, hapticEnabled: value };
      this.persistAndRefresh();
    });
    this.createButton(this.scale.width / 2, this.scale.height - insets.bottom - 36, t('closeButton', lang), () => {
      this.scene.start('RoomScene');
    });
  }

  private persistAndRefresh(): void {
    this.saveService.save(this.saveData);
    this.scene.restart();
  }

  private drawBackground(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    syncBodyBackground(COLORS.bgTop, COLORS.bgBottom);
    const g = this.add.graphics();
    g.fillGradientStyle(hexToNum(COLORS.bgTop), hexToNum(COLORS.bgTop), shade(COLORS.bgBottom, 0.1), shade(COLORS.bgBottom, 0.1), 1, 1, 1, 1);
    g.fillRect(0, 0, w, h);
  }

  private addLanguageRow(y: number, lang: Language): number {
    this.add.text(ROW_X, y, t('languageLabel', lang), { fontFamily: FONT, fontSize: '16px', color: COLORS.ink });

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
    this.add.text(ROW_X, y, label, { fontFamily: FONT, fontSize: '16px', color: COLORS.ink });

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
        fontFamily: FONT,
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
      .text(x, y, label, { fontFamily: FONT, fontSize: '17px', fontStyle: '600', color: COLORS.cream })
      .setOrigin(0.5);

    const zone = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
    zone.on('pointerup', onTap);
  }
}
