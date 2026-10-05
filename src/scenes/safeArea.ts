/**
 * CSS env(safe-area-inset-*) değerlerini (gerçek cihaz pikseli, çentik/ekran kenarı için) oyunun
 * mantıksal 540x960 koordinat sistemine çevirir. Phaser.Scale.FIT, en-boy oranı uymadığında canvas'ı
 * pencereden küçük çizip ortalar (letterbox) -- bu yüzden çentik payı genelde zaten boş bar alanına
 * düşer. Burada canvas'ın gerçek ekran konumunu da hesaba katarak gereksiz fazla boşluk bırakmadan,
 * hiçbir interaktif öğenin kenara/çentiğe yapışmamasını garanti eden bir minimum (MIN_MARGIN) uygularız.
 */
const LOGICAL_WIDTH = 540;
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

export function readSafeAreaInsets(canvas: HTMLCanvasElement): SafeAreaInsets {
  const rect = canvas.getBoundingClientRect();
  const scale = rect.width > 0 ? LOGICAL_WIDTH / rect.width : 1;
  const winW = window.innerWidth;
  const winH = window.innerHeight;

  const topPx = Math.max(0, readInsetPx('--sat') - rect.top);
  const bottomPx = Math.max(0, readInsetPx('--sab') - (winH - rect.bottom));
  const leftPx = Math.max(0, readInsetPx('--sal') - rect.left);
  const rightPx = Math.max(0, readInsetPx('--sar') - (winW - rect.right));

  return {
    top: Math.max(MIN_MARGIN, topPx * scale),
    right: Math.max(MIN_MARGIN, rightPx * scale),
    bottom: Math.max(MIN_MARGIN, bottomPx * scale),
    left: Math.max(MIN_MARGIN, leftPx * scale),
  };
}
