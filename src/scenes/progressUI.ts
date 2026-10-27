import type Phaser from 'phaser';
import { COLORS, EASE, hexToNum, textStyle } from './theme';
import { viewOf } from './viewport';
import { addPanelCard, addRibbon, createButton } from './ui';
import { iconTrophy } from './icons';
import { bakeStar } from './fx';
import { readSafeAreaInsets } from './safeArea';
import { t, type Language } from '../i18n/translations';
import { ACHIEVEMENTS, ACHIEVEMENT_BONUS_STARS, achievementProgress, type AchievementDef } from '../services/achievements';
import type { SaveData } from '../services/SaveService';
import { claimDailyReward, todayKey, type DailyRewardState } from '../core/dailyReward';

/**
 * İlerleme hissi arayüzü (Faz 6): başarım bildirimi, başarımlar paneli, günlük seri paneli.
 * Hepsi zorlamasız: bildirim kendiliğinden kaybolur, paneller tek dokunuşla kapanır.
 */

function achievementTitle(def: AchievementDef, lang: Language): string {
  return t(def.titleKey, lang);
}

function achievementDesc(def: AchievementDef, lang: Language): string {
  return t(def.descKey, lang, { n: def.target });
}

/** Açılan başarımları üstten kayarak gelen kartlarla sırayla gösterir (her biri ~2.4 sn). */
export function showAchievementToasts(scene: Phaser.Scene, defs: readonly AchievementDef[], lang: Language, onShow?: () => void): void {
  const vp = viewOf(scene);
  const top = readSafeAreaInsets(scene).top;
  defs.forEach((def, i) => {
    scene.time.delayedCall(i * 2600, () => {
      const w = Math.min(vp.width - 40, 400);
      const h = 72;
      const card = scene.add.container(vp.width / 2, top - 90).setDepth(600);
      const bg = scene.add.graphics();
      bg.fillStyle(hexToNum(COLORS.overlay), 0.94);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 24);
      bg.lineStyle(2, hexToNum(COLORS.gold), 0.9);
      bg.strokeRoundedRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2, 23);
      const badge = scene.add.graphics();
      badge.fillStyle(hexToNum(COLORS.gold), 1);
      badge.fillCircle(-w / 2 + 38, 0, 22);
      const trophy = scene.add.graphics({ x: -w / 2 + 38, y: 0 });
      iconTrophy(trophy, hexToNum(COLORS.cream));
      card.add([bg, badge, trophy]);
      card.add(scene.add.text(-w / 2 + 72, -13, t('achievementUnlocked', lang), textStyle('caption', { color: COLORS.goldLight })).setOrigin(0, 0.5));
      card.add(scene.add.text(-w / 2 + 72, 12, achievementTitle(def, lang), textStyle('sectionTitle', { color: COLORS.cream })).setOrigin(0, 0.5));
      card.add(scene.add.text(w / 2 - 20, 12, t('achBonus', lang, { n: ACHIEVEMENT_BONUS_STARS }), textStyle('caption', { color: COLORS.goldLight })).setOrigin(1, 0.5));
      onShow?.();
      scene.tweens.add({ targets: card, y: top + 50, duration: 420, ease: EASE.back });
      scene.tweens.add({ targets: trophy, angle: { from: -16, to: 16 }, duration: 160, yoyo: true, repeat: 3, ease: EASE.inOut, delay: 300 });
      scene.tweens.add({ targets: card, y: top - 90, duration: 300, delay: 2200, ease: EASE.in, onComplete: () => card.destroy() });
    });
  });
}

interface ModalShell {
  readonly panel: Phaser.GameObjects.Container;
  close(then?: () => void): void;
}

function openShell(scene: Phaser.Scene, panelH: number, title: string, onClose?: () => void): ModalShell {
  const vp = viewOf(scene);
  const overlay = scene.add.rectangle(vp.width / 2, vp.height / 2, vp.width * 3, vp.height * 3, hexToNum(COLORS.overlay), 0).setDepth(400).setInteractive();
  scene.tweens.add({ targets: overlay, fillAlpha: 0.45, duration: 220, ease: EASE.out });
  const panelW = Math.min(vp.width - 40, 400);
  const cy = vp.height / 2;
  const panel = scene.add.container(vp.width / 2, cy).setDepth(401);
  addPanelCard(scene, panel, panelW, panelH);
  panel.add(scene.add.zone(0, 0, panelW, panelH).setInteractive());
  addRibbon(scene, panel, -panelH / 2 + 4, 260, COLORS.terracotta, title);
  panel.setY(cy + 50).setAlpha(0).setScale(0.94);
  scene.tweens.add({ targets: panel, y: cy, alpha: 1, scale: 1, duration: 360, ease: EASE.back });
  let closed = false;
  const close = (then?: () => void) => {
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
        onClose?.();
        then?.();
      },
    });
  };
  overlay.on('pointerup', () => close());
  return { panel, close };
}

export interface PanelHandle {
  close(): void;
}

/** Başarımlar listesi: açılmışlar altın kupa + "tamam", diğerleri ilerleme çubuğuyla. */
export function openAchievementsPanel(scene: Phaser.Scene, data: SaveData, lang: Language, opts: { onClose?: () => void; onPress?: () => void }): PanelHandle {
  const vp = viewOf(scene);
  const panelW = Math.min(vp.width - 40, 400);
  const maxH = vp.height - 120;
  const rowH = Math.min(58, (maxH - 140) / ACHIEVEMENTS.length);
  const panelH = 140 + rowH * ACHIEVEMENTS.length;
  const shell = openShell(scene, panelH, t('achievementsTitle', lang), opts.onClose);
  const left = -panelW / 2 + 26;
  const right = panelW / 2 - 26;
  let y = -panelH / 2 + 58 + rowH / 2;
  for (const def of ACHIEVEMENTS) {
    const { value, done } = achievementProgress(def, data);
    const g = scene.add.graphics();
    g.fillStyle(hexToNum(done ? COLORS.gold : COLORS.surfaceMuted), 1);
    g.fillCircle(left + 16, y, 16);
    const trophy = scene.add.graphics({ x: left + 16, y });
    iconTrophy(trophy, hexToNum(done ? COLORS.cream : COLORS.inkFaint));
    trophy.setScale(0.8);
    shell.panel.add([g, trophy]);
    shell.panel.add(scene.add.text(left + 42, y - 9, achievementTitle(def, lang), textStyle('buttonSmall', { color: done ? COLORS.ink : COLORS.inkSoft })).setOrigin(0, 0.5));
    shell.panel.add(scene.add.text(left + 42, y + 11, achievementDesc(def, lang), textStyle('caption', { color: COLORS.inkSoft })).setOrigin(0, 0.5));
    if (done) {
      shell.panel.add(scene.add.image(right - 12, y, bakeStar(scene, 18, true)).setDisplaySize(24, 24));
    } else {
      const bw = 70;
      const bar = scene.add.graphics();
      bar.fillStyle(hexToNum(COLORS.surfaceMuted), 1);
      bar.fillRoundedRect(right - bw, y - 4, bw, 8, 4);
      bar.fillStyle(hexToNum('#7FB28A'), 1);
      const f = value / def.target;
      if (f > 0) bar.fillRoundedRect(right - bw, y - 4, Math.max(8, bw * f), 8, 4);
      shell.panel.add(bar);
      shell.panel.add(scene.add.text(right - bw / 2, y + 14, `${value}/${def.target}`, textStyle('caption', { color: COLORS.inkSoft, fontSize: '11px' })).setOrigin(0.5));
    }
    y += rowH;
  }
  const done = createButton(scene, { x: 0, y: panelH / 2 - 44, width: panelW - 100, height: 50, label: t('doneButton', lang), onPress: opts.onPress, onTap: () => shell.close() });
  shell.panel.add(done.root);
  return { close: () => shell.close() };
}

/** Günlük seri paneli: 7 günlük şerit (bugün vurgulu), ödülü al ya da yarının ödülünü göster. */
export function openDailyPanel(
  scene: Phaser.Scene,
  state: DailyRewardState,
  base: number,
  lang: Language,
  opts: { onClaim: () => void; onClose?: () => void; onPress?: () => void },
): PanelHandle {
  const vp = viewOf(scene);
  const panelW = Math.min(vp.width - 40, 400);
  const panelH = 340;
  const shell = openShell(scene, panelH, t('dailyStreakTitle', lang), opts.onClose);
  const today = todayKey(new Date());
  // Saf önizleme: bugün alınırsa (ya da alındıysa yarın) seri kaçıncı gün, kaç yıldız?
  const preview = claimDailyReward(state, today, base);
  const claimable = preview.claimed;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const next = claimable ? preview : claimDailyReward(state, todayKey(tomorrow), base);
  const currentDay = claimable ? preview.state.streak : state.streak;
  const weekStart = Math.floor((Math.max(1, currentDay) - 1) / 7) * 7;

  const cardW = (panelW - 52 - 6 * 6) / 7;
  for (let i = 0; i < 7; i++) {
    const day = weekStart + i + 1;
    const x = -panelW / 2 + 26 + cardW / 2 + i * (cardW + 6);
    const y = -panelH / 2 + 110;
    const isToday = day === currentDay;
    const past = day < currentDay || (day === currentDay && !claimable);
    const g = scene.add.graphics();
    g.fillStyle(hexToNum(isToday && claimable ? COLORS.terracotta : past ? COLORS.honey : COLORS.surfaceMuted), past || isToday ? 1 : 0.8);
    g.fillRoundedRect(x - cardW / 2, y - 36, cardW, 72, 12);
    shell.panel.add(g);
    const textColor = isToday && claimable ? COLORS.cream : COLORS.ink;
    shell.panel.add(scene.add.text(x, y - 22, `${day}`, textStyle('buttonSmall', { color: textColor })).setOrigin(0.5));
    shell.panel.add(scene.add.image(x, y + 2, bakeStar(scene, 16, past || isToday)).setDisplaySize(21, 21));
    shell.panel.add(scene.add.text(x, y + 22, `+${base + (day - 1) * 5}`, textStyle('caption', { color: textColor, fontSize: '11px' })).setOrigin(0.5));
    if (isToday && claimable) scene.tweens.add({ targets: g, alpha: 0.75, duration: 600, yoyo: true, repeat: -1, ease: EASE.inOut });
  }
  shell.panel.add(
    scene.add
      .text(0, -panelH / 2 + 182, t('dailyStreakNote', lang), textStyle('caption', { color: COLORS.inkSoft, align: 'center', wordWrap: { width: panelW - 70 } }))
      .setOrigin(0.5),
  );
  if (claimable) {
    const btn = createButton(scene, {
      x: 0,
      y: panelH / 2 - 52,
      width: panelW - 90,
      height: 58,
      label: `${t('dailyClaimButton', lang)}  +${preview.starsAwarded}`,
      variant: 'honey',
      onPress: opts.onPress,
      onTap: () => shell.close(() => opts.onClaim()),
    });
    shell.panel.add(btn.root);
    btn.pulse();
  } else {
    shell.panel.add(scene.add.text(0, panelH / 2 - 92, t('dailyComeBack', lang, { n: next.starsAwarded }), textStyle('body', { color: COLORS.ink })).setOrigin(0.5));
    const btn = createButton(scene, { x: 0, y: panelH / 2 - 44, width: panelW - 100, height: 50, label: t('doneButton', lang), variant: 'secondary', onPress: opts.onPress, onTap: () => shell.close() });
    shell.panel.add(btn.root);
  }
  return { close: () => shell.close() };
}
