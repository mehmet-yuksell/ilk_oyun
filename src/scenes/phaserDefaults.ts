import Phaser from 'phaser';
import { EASE } from './theme';
import { currentRenderZoom } from './viewport';

/**
 * Phaser'ın iki varsayılanını oyun genelinde düzeltir (main.ts, Phaser.Game oluşturulmadan önce çağırır):
 *
 * 1. Keskin yazı: Phaser 3'te Text dokusu varsayılan olarak çözünürlük 1'de pişer; kamera zoom'u
 *    (bkz. viewport.ts) ile büyütülünce bulanıklaşır. `scene.add.text` artık stil `resolution`
 *    vermediyse o anki kamera zoom'unu kullanır.
 * 2. Linear yok: Phaser tween'lerinin varsayılan ease'i 'Power0' (doğrusal, mekanik his). `ease`
 *    belirtilmeyen her tween artık yumuşak bir çıkış eğrisi (EASE.soft) alır.
 */
export function installPhaserDefaults(): void {
  const factory = Phaser.GameObjects.GameObjectFactory.prototype as unknown as {
    text: (x: number, y: number, text: string | string[], style?: Phaser.Types.GameObjects.Text.TextStyle) => Phaser.GameObjects.Text;
  };
  const originalText = factory.text;
  factory.text = function (this: Phaser.GameObjects.GameObjectFactory, x, y, text, style) {
    const resolution = Math.min(3, Math.max(1, Math.ceil(currentRenderZoom() * 4) / 4));
    return originalText.call(this, x, y, text, { resolution, ...(style ?? {}) });
  };

  const tweens = Phaser.Tweens.TweenManager.prototype as unknown as {
    add: (config: Phaser.Types.Tweens.TweenBuilderConfig | Phaser.Types.Tweens.TweenChainBuilderConfig | Phaser.Tweens.Tween | Phaser.Tweens.TweenChain) => Phaser.Tweens.Tween;
  };
  const originalAdd = tweens.add;
  tweens.add = function (this: Phaser.Tweens.TweenManager, config) {
    if (config && typeof config === 'object' && !(config instanceof Phaser.Tweens.BaseTween) && !('ease' in config)) {
      return originalAdd.call(this, { ease: EASE.soft, ...config });
    }
    return originalAdd.call(this, config);
  };
}
