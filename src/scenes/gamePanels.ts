import type Phaser from 'phaser';
import { JUICE } from '../config/tuning';
import { COLORS, EASE, hexToNum, textStyle } from './theme';
import { viewOf } from './viewport';
import { t } from '../i18n/translations';
import type { Language } from '../i18n/translations';
import type { ConfettiEmitter, prefersReducedMotion as PrefersReducedMotionFn } from './confetti';
import { addPanelCard, addRibbon, createButton } from './ui';
import { bakeStar, raysKey, type ParticleFx } from './fx';

/**
 * Seviye sonu panelleri. Ortak dil: sıcak erik karartma (tüm ekranı örter), yumuşak gölgeli krem kart,
 * üstte kurdele başlık, aşağıdan Back.Out ile yükselen giriş. Butonlar ui.ts (basılma hissi + 48px alan).
 */

export interface LevelCompletePanelParams {
  readonly rating: number;
  readonly awarded: number;
  readonly isDailyPuzzle: boolean;
  readonly lang: Language;
  readonly confetti: ConfettiEmitter;
  readonly particles: ParticleFx;
  readonly prefersReducedMotion: typeof PrefersReducedMotionFn;
  readonly moves: number;
  readonly durationMs: number;
  /** Her dolu yıldız yerine oturduğunda (ses/haptik için), 0..rating-1. */
  readonly onStar?: (index: number) => void;
  readonly onButtonPress?: () => void;
  readonly onNext: () => void;
}

function addOverlay(scene: Phaser.Scene, alpha: number): Phaser.GameObjects.Rectangle {
  const vp = viewOf(scene);
  // Mantıksal alanın dışına taşacak kadar büyük: aşırı en-boy oranında kenar payları da kararır.
  const overlay = scene.add
    .rectangle(vp.width / 2, vp.height / 2, vp.width * 3, vp.height * 3, hexToNum(COLORS.overlay), 0)
    .setDepth(300)
    .setInteractive(); // alttaki oyuna dokunuşları yutar
  scene.tweens.add({ targets: overlay, fillAlpha: alpha, duration: 260, ease: EASE.out });
  return overlay;
}

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function addStatChip(scene: Phaser.Scene, panel: Phaser.GameObjects.Container, x: number, y: number, label: string, value: string): void {
  const w = 112;
  const h = 50;
  const g = scene.add.graphics();
  g.fillStyle(hexToNum(COLORS.paper), 1);
  g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 16);
  g.lineStyle(1.5, hexToNum(COLORS.woodLight), 0.7);
  g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 16);
  panel.add(g);
  panel.add(scene.add.text(x, y - 10, label, textStyle('caption', { color: COLORS.inkSoft })).setOrigin(0.5));
  panel.add(scene.add.text(x, y + 10, value, textStyle('sectionTitle')).setOrigin(0.5));
}

/** Panel kartı + giriş animasyonu (aşağıdan yükselip yerine oturur). */
function enterPanel(scene: Phaser.Scene, panel: Phaser.GameObjects.Container, finalY: number): void {
  panel.setY(finalY + 60).setAlpha(0).setScale(0.92);
  scene.tweens.add({ targets: panel, y: finalY, alpha: 1, scale: 1, duration: 420, ease: EASE.back });
}

export function showLevelCompletePanel(scene: Phaser.Scene, params: LevelCompletePanelParams): void {
  const { rating, awarded, isDailyPuzzle, lang, confetti, particles, prefersReducedMotion, onNext } = params;
  const vp = viewOf(scene);
  const reduced = prefersReducedMotion();
  confetti.burst(vp.width, vp.height, reduced);

  const overlay = addOverlay(scene, 0.45);

  const panelW = Math.min(vp.width - 48, 380);
  const panelH = 452;
  const cx = vp.width / 2;
  const cy = vp.height / 2 + 10;
  const panel = scene.add.container(cx, cy).setDepth(301);
  addPanelCard(scene, panel, panelW, panelH);

  const titleKey = isDailyPuzzle ? 'dailyPuzzleLabel' : rating >= 3 ? 'ratingTitle3' : rating === 2 ? 'ratingTitle2' : 'ratingTitle1';
  addRibbon(scene, panel, -panelH / 2 + 4, Math.min(panelW - 40, 280), COLORS.terracotta, t(titleKey, lang));

  // Yıldızlar: ortadaki daha büyük ve yukarıda (yay dizilimi); arkada yavaş dönen sıcak ışınlar.
  const starY = -panelH / 2 + 128;
  const rays = scene.add.image(0, starY, raysKey(scene)).setDisplaySize(300, 300).setAlpha(0);
  panel.add(rays);
  scene.tweens.add({ targets: rays, alpha: rating >= 3 ? 0.9 : 0.6, duration: 500, delay: 300, ease: EASE.out });
  if (!reduced) scene.tweens.add({ targets: rays, angle: 360, duration: 24000, repeat: -1, ease: EASE.inOut });

  const slots = [
    { x: -84, y: starY + 16, size: 64 },
    { x: 0, y: starY - 6, size: 84 },
    { x: 84, y: starY + 16, size: 64 },
  ];
  slots.forEach((slot, i) => {
    panel.add(scene.add.image(slot.x, slot.y, bakeStar(scene, slot.size, false)).setDisplaySize(slot.size * 1.3, slot.size * 1.3));
    if (i >= rating) return;
    const star = scene.add.image(slot.x, slot.y, bakeStar(scene, slot.size, true)).setDisplaySize(slot.size * 1.3, slot.size * 1.3);
    const finalScale = star.scale;
    star.setScale(0).setAngle(-40);
    panel.add(star);
    const delay = 480 + i * JUICE.levelCompletePanel.starPopStaggerMs * 2.6;
    scene.tweens.add({
      targets: star,
      scale: finalScale,
      angle: 0,
      duration: JUICE.levelCompletePanel.starPopDuration * 1.8,
      delay,
      ease: EASE.back,
      onStart: () =>
        scene.time.delayedCall(120, () => {
          particles.sparkle(cx + slot.x, panel.y + slot.y, 10);
          params.onStar?.(i);
        }),
    });
  });

  // Kazanılan yıldız sayacı: 0'dan sayar, bitince küçük bir "pop".
  const counterY = starY + 112;
  if (awarded > 0) {
    const counterStar = scene.add.image(-34, counterY, bakeStar(scene, 30, true)).setDisplaySize(39, 39);
    panel.add(counterStar);
    const counterText = scene.add.text(-12, counterY, '+0', textStyle('panelTitle')).setOrigin(0, 0.5);
    panel.add(counterText);
    panel.add(scene.add.text(0, counterY + 28, t('starsEarnedCaption', lang), textStyle('caption', { color: COLORS.inkSoft })).setOrigin(0.5));
    const counterProxy = { n: 0 };
    scene.tweens.add({
      targets: counterProxy,
      n: awarded,
      duration: JUICE.levelCompletePanel.counterDurationMs * 1.4,
      delay: 480 + rating * 300,
      ease: EASE.out,
      onUpdate: () => counterText.setText(`+${Math.round(counterProxy.n)}`),
      onComplete: () => {
        counterText.setText(`+${awarded}`);
        scene.tweens.add({ targets: [counterText, counterStar], scale: '*=1.18', duration: 140, yoyo: true, ease: EASE.out });
      },
    });
  } else {
    panel.add(scene.add.text(0, counterY + 6, t('replayNote', lang), textStyle('caption', { color: COLORS.inkSoft, align: 'center', wordWrap: { width: panelW - 80 } })).setOrigin(0.5));
  }

  // Önceki tasarımdaki boş alan yerine kısa bir özet: hamle + süre.
  const statsY = counterY + 82;
  addStatChip(scene, panel, -62, statsY, t('statsMoves', lang), `${params.moves}`);
  addStatChip(scene, panel, 62, statsY, t('statsTime', lang), formatDuration(params.durationMs));

  // Birincil: Sonraki Seviye -- belirince yumuşak nabız.
  const btnY = panelH / 2 - 50;
  const next = createButton(scene, {
    x: 0,
    y: btnY,
    width: panelW - 72,
    height: 60,
    label: t('nextLevelButton', lang),
    onPress: params.onButtonPress,
    onTap: () => {
      next.destroy();
      scene.tweens.add({
        targets: panel,
        alpha: 0,
        y: panel.y + 30,
        duration: 200,
        ease: EASE.in,
        onComplete: () => {
          panel.destroy();
          overlay.destroy();
          onNext();
        },
      });
    },
  });
  panel.add(next.root);
  next.root.setAlpha(0);
  scene.tweens.add({ targets: next.root, alpha: 1, duration: 240, delay: 900 + rating * 200, ease: EASE.out, onComplete: () => next.pulse() });

  enterPanel(scene, panel, cy);
}

export interface LevelLostPanelParams {
  readonly moveLimit: number;
  readonly lang: Language;
  readonly onButtonPress?: () => void;
  readonly onRetry: () => void;
  readonly onBackToRoom: () => void;
}

/** Hamle hakkı bitince: sakin, suçlamayan bir panel -- bal rengi kurdele, kısa metin, dolgu birincil
 * "Tekrar Dene" (nabızlı) + çerçeveli ikincil "Odaya Dön". */
export function showLevelLostPanel(scene: Phaser.Scene, params: LevelLostPanelParams): void {
  const { moveLimit, lang, onRetry, onBackToRoom } = params;
  const vp = viewOf(scene);
  const overlay = addOverlay(scene, 0.5);

  const panelW = Math.min(vp.width - 48, 380);
  const panelH = 340;
  const cy = vp.height / 2;
  const panel = scene.add.container(vp.width / 2, cy).setDepth(301);
  addPanelCard(scene, panel, panelW, panelH);
  addRibbon(scene, panel, -panelH / 2 + 4, Math.min(panelW - 40, 290), COLORS.honey, t('levelLostTitle', lang), COLORS.ink);

  panel.add(
    scene.add
      .text(0, -panelH / 2 + 104, t('levelLostBody', lang, { limit: moveLimit }), textStyle('body', { color: COLORS.inkSoft, align: 'center', lineSpacing: 6, wordWrap: { width: panelW - 72 } }))
      .setOrigin(0.5),
  );

  const close = (then: () => void) => {
    scene.tweens.add({
      targets: panel,
      alpha: 0,
      y: panel.y + 30,
      duration: 200,
      ease: EASE.in,
      onComplete: () => {
        panel.destroy();
        overlay.destroy();
        then();
      },
    });
  };

  const retry = createButton(scene, {
    x: 0,
    y: panelH / 2 - 118,
    width: panelW - 72,
    height: 60,
    label: t('retryButton', lang),
    onPress: params.onButtonPress,
    onTap: () => close(onRetry),
  });
  panel.add(retry.root);
  const back = createButton(scene, {
    x: 0,
    y: panelH / 2 - 46,
    width: panelW - 72,
    height: 50,
    label: t('backToRoomButton', lang),
    variant: 'secondary',
    onPress: params.onButtonPress,
    onTap: () => close(onBackToRoom),
  });
  panel.add(back.root);
  scene.time.delayedCall(700, () => retry.pulse());

  enterPanel(scene, panel, cy);
}
