import Phaser from 'phaser';
import { COLORS, EASE, hexToNum } from './theme';
import { fitCamera } from './viewport';

/**
 * Sahne geçişleri (bkz. DEVLOG Faz 5): hiçbir ekran aniden belirmez/kaybolmaz.
 *  - Çıkış: sıcak KREM renge fade (eskiden siyaha -- cozy bir oyunda sert) + içerik hafifçe yukarı kayar.
 *  - Giriş: kremden açılır + içerik aşağıdan yerine oturur (Cubic.Out).
 * Her sahne create()'inde `enterScene(this)` çağırır; geçişler `fadeToScene` ile başlatılır. Geçiş
 * sürerken ikinci bir geçiş isteği (hızlı çift dokunuş) yok sayılır.
 */

const CREAM = hexToNum(COLORS.cream);
const R = (CREAM >> 16) & 255;
const G = (CREAM >> 8) & 255;
const B = CREAM & 255;
const SLIDE = 22;

const transitioning = new WeakSet<Phaser.Scene>();

export function isTransitioning(scene: Phaser.Scene): boolean {
  return transitioning.has(scene);
}

export function fadeToScene(scene: Phaser.Scene, key: string, data?: object, duration = 240): void {
  if (transitioning.has(scene)) return;
  transitioning.add(scene);
  const cam = scene.cameras.main;
  scene.tweens.add({ targets: cam, scrollY: cam.scrollY + SLIDE * 0.5, duration, ease: EASE.in });
  cam.fadeOut(duration, R, G, B);
  cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
    transitioning.delete(scene);
    scene.scene.start(key, data);
  });
}

/** Sahne girişi: kremden açılma + içerik aşağıdan yerine oturur. create() içinde setupView'dan sonra çağrılır. */
export function enterScene(scene: Phaser.Scene, duration = 320): void {
  transitioning.delete(scene);
  const cam = scene.cameras.main;
  fitCamera(scene);
  const baseY = cam.scrollY;
  cam.scrollY = baseY - SLIDE;
  scene.tweens.add({ targets: cam, scrollY: baseY, duration: duration + 80, ease: EASE.out });
  cam.fadeIn(duration, R, G, B);
}
