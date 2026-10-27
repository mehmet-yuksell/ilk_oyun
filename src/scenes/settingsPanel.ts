import type Phaser from 'phaser';
import { COLORS, EASE, hexToNum, textStyle } from './theme';
import { viewOf } from './viewport';
import { addPanelCard, addRibbon, createButton, createSegmented, createToggle } from './ui';
import { iconGlobe, iconMusic, iconSpeaker, iconVibrate, type IconDrawer } from './icons';
import { t, type Language } from '../i18n/translations';
import { LocalStorageSaveService, type SaveData } from '../services/SaveService';
import { music } from '../services/MusicService';
import { APP_VERSION } from '../config/version';

/**
 * Ayarlar paneli -- ayrı bir sahne değil, HER sahnenin üstünde açılan bir katman (oyun içinden
 * açıldığında seviye durumu kaybolmaz). Ses efektleri / müzik / titreşim anında uygulanır ve kaydedilir
 * (localStorage + Capacitor Preferences, bkz. SaveService). Dil değişimi ekranın yeniden çizilmesini
 * gerektirdiği için yalnızca seviye dışında gösterilir (showLanguage).
 */
export interface SettingsPanelOptions {
  readonly showLanguage: boolean;
  /** Her değişiklikten sonra güncel kayıtla çağrılır (sahne kendi saveData kopyasını tazeler). */
  readonly onChange?: (data: SaveData) => void;
  readonly onLanguageChange?: (lang: Language) => void;
  readonly onClose?: () => void;
  readonly onPress?: () => void;
}

export interface SettingsPanelHandle {
  close(): void;
}

export function openSettingsPanel(scene: Phaser.Scene, options: SettingsPanelOptions): SettingsPanelHandle {
  const saveService = new LocalStorageSaveService(window.localStorage);
  let data = saveService.load();
  const lang = data.language;
  const vp = viewOf(scene);

  const overlay = scene.add
    .rectangle(vp.width / 2, vp.height / 2, vp.width * 3, vp.height * 3, hexToNum(COLORS.overlay), 0)
    .setDepth(400)
    .setInteractive();
  scene.tweens.add({ targets: overlay, fillAlpha: 0.45, duration: 220, ease: EASE.out });

  const rowH = 64;
  const rows: { icon: IconDrawer; label: string; key: 'soundEnabled' | 'musicEnabled' | 'hapticEnabled' }[] = [
    { icon: iconSpeaker, label: t('soundLabel', lang), key: 'soundEnabled' },
    { icon: iconMusic, label: t('musicLabel', lang), key: 'musicEnabled' },
    { icon: iconVibrate, label: t('hapticLabel', lang), key: 'hapticEnabled' },
  ];
  const panelW = Math.min(vp.width - 40, 400);
  const panelH = 150 + rows.length * rowH + (options.showLanguage ? rowH + 12 : 0);
  const cy = vp.height / 2;
  const panel = scene.add.container(vp.width / 2, cy).setDepth(401);
  addPanelCard(scene, panel, panelW, panelH);
  // Kartın boş yerine dokunmak alttaki karartmaya (kapat) düşmesin diye kart alanı dokunuşu yutar.
  panel.add(scene.add.zone(0, 0, panelW, panelH).setInteractive());
  addRibbon(scene, panel, -panelH / 2 + 4, 220, COLORS.terracotta, t('settingsTitle', lang));

  const persist = (patch: Partial<SaveData>) => {
    data = { ...saveService.load(), ...patch };
    saveService.save(data);
    options.onChange?.(data);
  };

  const rowLeft = -panelW / 2 + 28;
  const rowRight = panelW / 2 - 28;
  let y = -panelH / 2 + 74;

  const addRow = (icon: IconDrawer, label: string) => {
    const badge = scene.add.graphics();
    badge.fillStyle(hexToNum(COLORS.paper), 1);
    badge.fillCircle(rowLeft + 18, y, 18);
    badge.lineStyle(1.5, hexToNum(COLORS.woodLight), 0.8);
    badge.strokeCircle(rowLeft + 18, y, 18);
    const ig = scene.add.graphics({ x: rowLeft + 18, y });
    icon(ig, hexToNum(COLORS.ink));
    ig.setScale(0.85);
    const text = scene.add.text(rowLeft + 48, y, label, textStyle('body', { fontStyle: '700' })).setOrigin(0, 0.5);
    panel.add([badge, ig, text]);
  };
  const addDivider = () => {
    const d = scene.add.graphics();
    d.lineStyle(1, hexToNum(COLORS.woodLight), 0.5);
    d.lineBetween(rowLeft, y + rowH / 2, rowRight, y + rowH / 2);
    panel.add(d);
  };

  rows.forEach((row, i) => {
    addRow(row.icon, row.label);
    const toggle = createToggle(scene, rowRight - 29, y, data[row.key], (value) => {
      options.onPress?.();
      persist({ [row.key]: value });
      if (row.key === 'musicEnabled') music.setEnabled(value);
    });
    panel.add(toggle.root);
    if (i < rows.length - 1 || options.showLanguage) addDivider();
    y += rowH;
  });

  if (options.showLanguage) {
    addRow(iconGlobe, t('languageLabel', lang));
    const seg = createSegmented(
      scene,
      rowRight - 61,
      y,
      [
        { label: 'TR', value: 'tr' },
        { label: 'EN', value: 'en' },
      ],
      lang,
      (value) => {
        options.onPress?.();
        persist({ language: value as Language });
        scene.time.delayedCall(260, () => {
          close();
          options.onLanguageChange?.(value as Language);
        });
      },
    );
    panel.add(seg);
    y += rowH + 12;
  }

  const done = createButton(scene, {
    x: 0,
    y: panelH / 2 - 54,
    width: panelW - 80,
    height: 56,
    label: t('doneButton', lang),
    onPress: options.onPress,
    onTap: () => close(),
  });
  panel.add(done.root);
  panel.add(scene.add.text(0, panelH / 2 + 22, t('versionLabel', lang, { v: APP_VERSION }), textStyle('caption', { color: COLORS.cream })).setOrigin(0.5).setAlpha(0.85));

  panel.setY(cy + 50).setAlpha(0).setScale(0.94);
  scene.tweens.add({ targets: panel, y: cy, alpha: 1, scale: 1, duration: 360, ease: EASE.back });

  let closed = false;
  function close(): void {
    if (closed) return;
    closed = true;
    scene.tweens.add({ targets: overlay, fillAlpha: 0, duration: 200, ease: EASE.out, onComplete: () => overlay.destroy() });
    scene.tweens.add({
      targets: panel,
      y: cy + 40,
      alpha: 0,
      duration: 200,
      ease: EASE.in,
      onComplete: () => {
        panel.destroy();
        options.onClose?.();
      },
    });
  }
  // karartmaya dokunmak da kapatır
  overlay.on('pointerup', () => close());

  return { close };
}
