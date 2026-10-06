import type Phaser from 'phaser';
import { JUICE } from '../config/tuning';
import { COLORS, RADIUS, TYPE_SCALE, hexToNum, shade } from './theme';
import { starPoints } from './gameHud';
import { t } from '../i18n/translations';
import type { Language } from '../i18n/translations';
import type { ConfettiEmitter, prefersReducedMotion as PrefersReducedMotionFn } from './confetti';

export interface LevelCompletePanelParams {
  readonly rating: number;
  readonly awarded: number;
  readonly isDailyPuzzle: boolean;
  readonly lang: Language;
  readonly confetti: ConfettiEmitter;
  readonly prefersReducedMotion: typeof PrefersReducedMotionFn;
  readonly onNext: () => void;
}

/** Seviye bitiş paneli: 1-3 derecelendirme yıldızı sırayla belirir, kazanılan yıldız sayacı
 * sayar, büyük "Sonraki Seviye" butonu. */
export function showLevelCompletePanel(scene: Phaser.Scene, params: LevelCompletePanelParams): void {
  const { rating, awarded, isDailyPuzzle, lang, confetti, prefersReducedMotion, onNext } = params;
  const reduced = prefersReducedMotion();
  confetti.burst(scene.scale.width, scene.scale.height, reduced);

  const overlay = scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height, 0x241437, 0).setOrigin(0, 0).setDepth(300);
  scene.tweens.add({ targets: overlay, fillAlpha: 0.5, duration: 220 });

  const panelW = Math.min(scene.scale.width - 56, 340);
  const panelH = 380;
  const panel = scene.add.container(scene.scale.width / 2, scene.scale.height / 2).setDepth(301).setScale(0.85).setAlpha(0);

  const bg = scene.add.graphics();
  bg.fillStyle(hexToNum(COLORS.surface), 1);
  bg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, RADIUS.xl);
  bg.lineStyle(3, hexToNum(COLORS.coral), 0.5);
  bg.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, RADIUS.xl);
  panel.add(bg);

  const titleKey = isDailyPuzzle ? 'dailyPuzzleLabel' : 'levelCompleteNoStars';
  panel.add(
    scene.add
      .text(0, -panelH / 2 + 40, t(titleKey, lang), {
        fontFamily: 'Fredoka, sans-serif',
        fontSize: `${TYPE_SCALE.panelTitle}px`,
        fontStyle: '600',
        color: COLORS.ink,
      })
      .setOrigin(0.5),
  );

  const starY = -panelH / 2 + 110;
  const gap = 48;
  for (let i = 0; i < 3; i++) {
    const sx = (i - 1) * gap;
    const filled = i < rating;
    const starG = scene.add.graphics({ x: sx, y: starY });
    starG.fillStyle(filled ? hexToNum(COLORS.gold) : hexToNum(COLORS.surfaceMuted), 1);
    starG.fillPoints(starPoints(20), true);
    starG.setScale(0);
    panel.add(starG);
    scene.tweens.add({
      targets: starG,
      scale: 1,
      duration: JUICE.levelCompletePanel.starPopDuration,
      delay: 260 + i * JUICE.levelCompletePanel.starPopStaggerMs,
      ease: 'Back.easeOut',
    });
  }

  const counterY = starY + 62;
  const counterGlyph = scene.add.graphics({ x: -36, y: counterY });
  counterGlyph.fillStyle(hexToNum(COLORS.gold), 1);
  counterGlyph.fillPoints(starPoints(11), true);
  panel.add(counterGlyph);

  const counterProxy = { n: 0 };
  const counterText = scene.add
    .text(-16, counterY, '+0', { fontFamily: 'Fredoka, sans-serif', fontSize: '22px', fontStyle: '600', color: COLORS.ink })
    .setOrigin(0, 0.5);
  panel.add(counterText);
  scene.tweens.add({
    targets: counterProxy,
    n: awarded,
    duration: JUICE.levelCompletePanel.counterDurationMs,
    delay: 500,
    ease: 'Cubic.easeOut',
    onUpdate: () => counterText.setText(`+${Math.round(counterProxy.n)}`),
  });

  // Birincil: Sonraki Seviye.
  const btnY = panelH / 2 - 56;
  const btnW = panelW - 64;
  const btnH = 56;
  const btnBg = scene.add.graphics();
  btnBg.fillStyle(hexToNum(COLORS.coral), 1);
  btnBg.fillRoundedRect(-btnW / 2, btnY - btnH / 2, btnW, btnH, btnH / 2);
  btnBg.fillStyle(0xffffff, 0.18);
  btnBg.fillRoundedRect(-btnW / 2 + 8, btnY - btnH / 2 + 5, btnW - 16, btnH * 0.4, btnH * 0.3);
  panel.add(btnBg);
  panel.add(
    scene.add
      .text(0, btnY, t('nextLevelButton', lang), {
        fontFamily: 'Fredoka, sans-serif',
        fontSize: '19px',
        fontStyle: '600',
        color: COLORS.cream,
      })
      .setOrigin(0.5),
  );
  const btnZone = scene.add.zone(scene.scale.width / 2, scene.scale.height / 2 + btnY, btnW, btnH).setInteractive({ useHandCursor: true });
  btnZone.on('pointerup', () => {
    overlay.destroy();
    panel.destroy();
    btnZone.destroy();
    onNext();
  });

  scene.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: JUICE.levelCompletePanel.panelInDuration, ease: 'Back.easeOut' });
}

export interface LevelLostPanelParams {
  readonly moveLimit: number;
  readonly lang: Language;
  readonly onRetry: () => void;
  readonly onBackToRoom: () => void;
}

const MIN_TOUCH_TARGET = 48;

/** Hamle hakkı bitince: sakin tonlu bir panel ("Hamle Hakkın Bitti"), ardından dolgu birincil
 * "Tekrar Dene" (aynı seviyeyi yeniden başlatır) + çerçeveli ikincil "Odaya Dön" butonu. */
export function showLevelLostPanel(scene: Phaser.Scene, params: LevelLostPanelParams): void {
  const { moveLimit, lang, onRetry, onBackToRoom } = params;
  const overlay = scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height, 0x1a1020, 0).setOrigin(0, 0).setDepth(300);
  scene.tweens.add({ targets: overlay, fillAlpha: 0.6, duration: 220 });

  const panelW = Math.min(scene.scale.width - 56, 340);
  const panelH = 380;
  const panel = scene.add.container(scene.scale.width / 2, scene.scale.height / 2).setDepth(301).setScale(0.85).setAlpha(0);

  const bg = scene.add.graphics();
  bg.fillStyle(hexToNum(COLORS.surface), 1);
  bg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, RADIUS.xl);
  bg.lineStyle(3, hexToNum(COLORS.amber), 0.5);
  bg.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, RADIUS.xl);
  panel.add(bg);

  // Sakin tonlu başlık rozeti: panel genişliğinden DAR tutulur ve döndürülmez -- panelin
  // içine temiz oturur, köşelerden taşmaz (eski "kurdele" tasarımındaki taşma hatasının düzeltmesi).
  const bannerW = panelW - 48;
  const bannerH = 46;
  const bannerY = -panelH / 2 + 46;
  const bannerG = scene.add.graphics({ x: 0, y: bannerY });
  bannerG.fillGradientStyle(hexToNum(COLORS.amber), hexToNum(COLORS.amber), shade(COLORS.amber, -0.12), shade(COLORS.amber, -0.12), 1, 1, 1, 1);
  bannerG.fillRoundedRect(-bannerW / 2, -bannerH / 2, bannerW, bannerH, bannerH / 2);
  bannerG.fillStyle(0xffffff, 0.2);
  bannerG.fillRoundedRect(-bannerW / 2 + 6, -bannerH / 2 + 4, bannerW - 12, bannerH * 0.4, bannerH * 0.3);
  panel.add(bannerG);
  panel.add(
    scene.add
      .text(0, bannerY + 1, t('levelLostTitle', lang), {
        fontFamily: 'Fredoka, sans-serif',
        fontSize: `${TYPE_SCALE.sectionTitle}px`,
        fontStyle: '600',
        color: COLORS.ink,
      })
      .setOrigin(0.5),
  );

  panel.add(
    scene.add
      .text(0, bannerY + 70, t('levelLostBody', lang, { limit: moveLimit }), {
        fontFamily: 'Fredoka, sans-serif',
        fontSize: '14px',
        color: COLORS.inkSoft,
        align: 'center',
        lineSpacing: 4,
        wordWrap: { width: panelW - 64 },
      })
      .setOrigin(0.5),
  );

  // Birincil: Tekrar Dene (aynı seviyeyi yeniden başlatır).
  const btnW = panelW - 64;
  const primaryBtnH = 56;
  const primaryY = panelH / 2 - 108;
  const btnBg = scene.add.graphics();
  btnBg.fillStyle(hexToNum(COLORS.coral), 1);
  btnBg.fillRoundedRect(-btnW / 2, primaryY - primaryBtnH / 2, btnW, primaryBtnH, primaryBtnH / 2);
  btnBg.fillStyle(0xffffff, 0.18);
  btnBg.fillRoundedRect(-btnW / 2 + 8, primaryY - primaryBtnH / 2 + 5, btnW - 16, primaryBtnH * 0.4, primaryBtnH * 0.3);
  panel.add(btnBg);
  panel.add(
    scene.add
      .text(0, primaryY, t('retryButton', lang), {
        fontFamily: 'Fredoka, sans-serif',
        fontSize: '19px',
        fontStyle: '600',
        color: COLORS.cream,
      })
      .setOrigin(0.5),
  );
  const retryZone = scene.add
    .zone(scene.scale.width / 2, scene.scale.height / 2 + primaryY, btnW, primaryBtnH)
    .setInteractive({ useHandCursor: true });
  retryZone.on('pointerup', () => {
    overlay.destroy();
    panel.destroy();
    retryZone.destroy();
    onRetry();
  });

  // İkincil: Odaya Dön -- gerçek bir çerçeveli (outline) buton, düz yazı değil.
  const secondaryBtnH = 46;
  const secondaryY = panelH / 2 - 40;
  const secondaryBg = scene.add.graphics();
  secondaryBg.lineStyle(2, hexToNum(COLORS.inkSoft), 0.45);
  secondaryBg.strokeRoundedRect(-btnW / 2, secondaryY - secondaryBtnH / 2, btnW, secondaryBtnH, secondaryBtnH / 2);
  panel.add(secondaryBg);
  panel.add(
    scene.add
      .text(0, secondaryY, t('backToRoomButton', lang), {
        fontFamily: 'Fredoka, sans-serif',
        fontSize: '15px',
        color: COLORS.inkSoft,
        fontStyle: '600',
      })
      .setOrigin(0.5),
  );
  const backZone = scene.add
    .zone(scene.scale.width / 2, scene.scale.height / 2 + secondaryY, btnW, Math.max(MIN_TOUCH_TARGET, secondaryBtnH))
    .setInteractive({ useHandCursor: true });
  backZone.on('pointerup', () => {
    overlay.destroy();
    panel.destroy();
    backZone.destroy();
    onBackToRoom();
  });

  scene.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: JUICE.levelCompletePanel.panelInDuration, ease: 'Back.easeOut' });
}
