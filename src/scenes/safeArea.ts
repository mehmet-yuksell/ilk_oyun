import type Phaser from 'phaser';
import { renderScale, viewOf } from './viewport';

/**
 * CSS env(safe-area-inset-*) değerlerini (çentik, alt navigasyon çubuğu -- CSS pikseli) sahnenin
 * mantıksal koordinat sistemine çevirir. Canvas artık ekranı kenardan kenara kapladığı için
 * (bkz. viewport.ts) çentik payı doğrudan uygulanır; aşırı en-boy oranında kamera içeriği
 * ortalayıp kenarda boş pay bıraktıysa (letterbox) o pay çentikten düşülür. Hiçbir etkileşimli
 * öğe kenara yapışmasın diye her kenarda en az MIN_MARGIN bırakılır.
 */
const MIN_MARGIN = 20;

export interface SafeAreaInsets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

function readInsetPx(varName: string): number {
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  const px = parseFloat(value);
  return Number.isFinite(px) ? px : 0;
}

export function readSafeAreaInsets(scene: Phaser.Scene): SafeAreaInsets {
  const view = viewOf(scene);
  const zoom = scene.cameras.main.zoom || 1;
  const k = renderScale();
  // Mantıksal alanın canvas içindeki fiziksel kenar boşlukları (letterbox payı).
  const padX = Math.max(0, (scene.scale.width - view.width * zoom) / 2);
  const padY = Math.max(0, (scene.scale.height - view.height * zoom) / 2);
  const toLogical = (cssPx: number, pad: number) => Math.max(0, cssPx * k - pad) / zoom;

  return {
    top: Math.max(MIN_MARGIN, toLogical(readInsetPx('--sat'), padY)),
    right: Math.max(MIN_MARGIN, toLogical(readInsetPx('--sar'), padX)),
    bottom: Math.max(MIN_MARGIN, toLogical(readInsetPx('--sab'), padY)),
    left: Math.max(MIN_MARGIN, toLogical(readInsetPx('--sal'), padX)),
  };
}
