import Phaser from 'phaser';
import { COLORS, DEFAULT_THEME, EASE, hexToNum, textStyle } from './theme';
import { BASE_HEIGHT, BASE_WIDTH, setupView, type View } from './viewport';
import { drawCozyBackground } from './background';
import { getDebugLevelParam } from './debugLevelParam';
import { enterScene, fadeToScene } from './sceneTransition';
import { createItemVisual } from './itemVisuals';
import { prefersReducedMotion } from './confetti';

const HOLD_MS = 1250;

/**
 * Açılış: iki tonlu "Cozy Sort" logosu + altında küçük bir ahşap raf; oyunun kendi eşyalarından üçü
 * (fincan, saksı, kitap) sırayla rafa zıplayıp oturur -- oyunun ne olduğunu tek bakışta anlatan, metinsiz
 * bir "mini sıralama". Sonra ana ekrana yumuşak geçiş. ?level=N debug modunda splash atlanır.
 */
export class SplashScene extends Phaser.Scene {
  private vp: View = { width: BASE_WIDTH, height: BASE_HEIGHT };

  constructor() {
    super('SplashScene');
  }

  create(): void {
    this.vp = setupView(this);
    if (getDebugLevelParam() !== null) {
      this.scene.start('GameScene');
      return;
    }
    enterScene(this, 260);
    const { width: w, height: h } = this.vp;
    drawCozyBackground(this, DEFAULT_THEME, this.vp, { motes: 10 });
    const reduced = prefersReducedMotion();

    // logo
    const cozy = this.add.text(0, 0, 'Cozy', textStyle('display', { fontSize: '56px' }));
    const sort = this.add.text(0, 0, ' Sort', textStyle('display', { fontSize: '56px', color: COLORS.terracotta }));
    const total = cozy.width + sort.width;
    cozy.setOrigin(0, 0.5).setX(-total / 2);
    sort.setOrigin(0, 0.5).setX(-total / 2 + cozy.width);
    const logo = this.add.container(w / 2, h / 2 - 70, [cozy, sort]).setAlpha(0).setScale(0.9);
    this.tweens.add({ targets: logo, alpha: 1, scale: 1, duration: 420, ease: EASE.back });

    // mini raf + zıplayan eşyalar
    const shelfY = h / 2 + 46;
    const shelf = this.add.graphics();
    shelf.fillStyle(hexToNum(COLORS.woodDark), 0.25);
    shelf.fillRoundedRect(w / 2 - 138, shelfY + 8, 276, 10, 5);
    shelf.fillStyle(hexToNum(COLORS.wood), 1);
    shelf.fillRoundedRect(w / 2 - 140, shelfY, 280, 12, 6);
    shelf.fillStyle(0xffffff, 0.35);
    shelf.fillRect(w / 2 - 132, shelfY + 2, 264, 2);
    shelf.setAlpha(0);
    this.tweens.add({ targets: shelf, alpha: 1, duration: 300, delay: 160, ease: EASE.out });

    const types = ['cup', 'plant', 'book'];
    types.forEach((type, i) => {
      const { container } = createItemVisual(this, type, 70, 44);
      const x = w / 2 + (i - 1) * 88;
      const restY = shelfY - 44 * 0.4 - 1;
      container.setPosition(x, restY - (reduced ? 0 : 90)).setAlpha(0);
      this.tweens.add({ targets: container, alpha: 1, duration: 160, delay: 300 + i * 140, ease: EASE.out });
      this.tweens.add({
        targets: container,
        y: restY,
        duration: 420,
        delay: 300 + i * 140,
        ease: 'Bounce.easeOut',
        onComplete: () => (container.getData('setExcited') as (v: boolean) => void)?.(true),
      });
    });

    this.time.delayedCall(HOLD_MS, () => fadeToScene(this, 'RoomScene', undefined, 320));
  }
}
