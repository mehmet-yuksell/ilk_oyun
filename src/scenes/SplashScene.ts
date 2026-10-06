import Phaser from 'phaser';
import { COLORS, hexToNum, shade } from './theme';
import { t } from '../i18n/translations';
import { LocalStorageSaveService, type SaveService } from '../services/SaveService';
import { getDebugLevelParam } from './debugLevelParam';
import { fadeToScene } from './sceneTransition';

const HOLD_MS = 650;

/**
 * Açılışta kısa, sade bir logo/splash gösterir ("Cozy Sort" + küçük bir eşya simgesi), sonra
 * RoomScene'e yumuşak geçiş yapar. ?level=N debug modunda splash hiç gösterilmez -- doğrudan
 * GameScene'e geçilir (bkz. Faz 5 kararları: debug iş akışını yavaşlatmamak için).
 */
export class SplashScene extends Phaser.Scene {
  private readonly saveService: SaveService = new LocalStorageSaveService(window.localStorage);

  constructor() {
    super('SplashScene');
  }

  create(): void {
    if (getDebugLevelParam() !== null) {
      this.scene.start('GameScene');
      return;
    }

    const lang = this.saveService.load().language;
    const w = this.scale.width;
    const h = this.scale.height;

    const g = this.add.graphics();
    g.fillGradientStyle(hexToNum(COLORS.bgTop), hexToNum(COLORS.bgTop), shade(COLORS.bgBottom, -0.1), shade(COLORS.bgBottom, -0.1), 1, 1, 1, 1);
    g.fillRect(0, 0, w, h);
    document.body.style.background = `linear-gradient(180deg, ${COLORS.bgTop} 0%, ${COLORS.bgBottom} 100%)`;

    const mark = this.add.container(w / 2, h / 2 - 50).setScale(0.7).setAlpha(0);
    const box = this.add.graphics();
    box.fillStyle(hexToNum(COLORS.surface), 0.95);
    box.fillRoundedRect(-34, -34, 68, 68, 20);
    box.lineStyle(3, hexToNum(COLORS.coral), 0.8);
    box.strokeRoundedRect(-34, -34, 68, 68, 20);
    mark.add(box);
    const check = this.add.graphics();
    check.lineStyle(6, hexToNum(COLORS.coral), 1);
    check.lineBetween(-14, 2, -4, 14);
    check.lineBetween(-4, 14, 18, -12);
    mark.add(check);

    const title = this.add
      .text(w / 2, h / 2 + 40, t('appTitle', lang), {
        fontFamily: 'Fredoka, sans-serif',
        fontSize: '34px',
        fontStyle: '700',
        color: COLORS.ink,
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.tweens.add({ targets: mark, scale: 1, alpha: 1, duration: 360, ease: 'Back.easeOut' });
    this.tweens.add({ targets: title, alpha: 1, y: h / 2 + 34, duration: 360, delay: 120, ease: 'Cubic.easeOut' });

    this.time.delayedCall(HOLD_MS, () => fadeToScene(this, 'RoomScene', undefined, 260));
  }
}
