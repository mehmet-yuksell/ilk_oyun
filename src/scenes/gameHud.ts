import type Phaser from 'phaser';
import { strokeArc } from './itemVisuals';
import { COLORS, hexToNum } from './theme';
import type { Button } from './gameTypes';

const BUTTON_WIDTH = 160;
const BUTTON_HEIGHT = 52;
const MIN_TOUCH_TARGET = 48;

const INK = hexToNum(COLORS.ink);
const CREAM = hexToNum(COLORS.cream);

/** 10 köşeli (5 dış + 5 iç yarıçap) klasik bir yıldız şekli -- başka her yerde (paneller, uçan
 * yıldızlar) yeniden kullanılır. */
export function starPoints(r: number): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const radius = i % 2 === 0 ? r : r * 0.45;
    points.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  }
  return points;
}

export function drawStarGlyph(scene: Phaser.Scene, x: number, y: number, r: number): void {
  const g = scene.add.graphics({ x, y });
  g.fillStyle(hexToNum(COLORS.gold), 1);
  g.fillPoints(starPoints(r), true);
}

export function createBackButton(scene: Phaser.Scene, x: number, y: number, onTap: () => void): void {
  const r = 22;
  const g = scene.add.graphics();
  g.fillStyle(hexToNum(COLORS.surface), 0.85);
  g.fillCircle(x, y, r);
  g.lineStyle(2, hexToNum(COLORS.coral), 0.6);
  g.strokeCircle(x, y, r);
  g.lineStyle(3, INK, 0.75);
  g.lineBetween(x + 5, y - 7, x - 5, y);
  g.lineBetween(x - 5, y, x + 5, y + 7);

  const zone = scene.add.zone(x, y, MIN_TOUCH_TARGET, MIN_TOUCH_TARGET).setInteractive({ useHandCursor: true });
  zone.on('pointerup', onTap);
}

/** Alt barda "Geri Al" / "Ekstra Kap" gibi birincil hap butonu -- etkin/devre dışı ve etiket
 * değişebilir (bkz. Button arayüzü). `isAnimating`, tıklamanın animasyon sırasında yok
 * sayılması için canlı bir kapı (her çağrıda okunur, snapshot alınmaz). */
export function createButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  icon: 'undo' | 'plus',
  onTap: () => void,
  isAnimating: () => boolean,
): Button {
  const bg = scene.add.graphics();
  const draw = (enabled: boolean) => {
    bg.clear();
    // Not: büyük yarıçaplı (hap) bir fillRoundedRect'e fillGradientStyle uygulamak bu Phaser
    // sürümünde WebGL'de köşelerde görünür hatalı facet/çentik üretiyor -- bu yüzden hap
    // butonlarda düz dolgu + üstte ayrı bir "parlama" şerit kullanılır (gradient değil).
    bg.fillStyle(enabled ? hexToNum(COLORS.coral) : hexToNum(COLORS.surfaceMuted), 1);
    bg.fillRoundedRect(x - BUTTON_WIDTH / 2, y - BUTTON_HEIGHT / 2, BUTTON_WIDTH, BUTTON_HEIGHT, BUTTON_HEIGHT / 2);
    if (enabled) {
      bg.fillStyle(0xffffff, 0.18);
      bg.fillRoundedRect(
        x - BUTTON_WIDTH / 2 + 6,
        y - BUTTON_HEIGHT / 2 + 4,
        BUTTON_WIDTH - 12,
        BUTTON_HEIGHT * 0.42,
        BUTTON_HEIGHT * 0.3,
      );
    }
    const iconColor = enabled ? CREAM : hexToNum(COLORS.inkSoft);
    const ix = x - BUTTON_WIDTH / 2 + 26;
    bg.lineStyle(3, iconColor, 1);
    if (icon === 'undo') {
      strokeArc(bg, ix, y, 8, 160, 430);
      bg.fillStyle(iconColor, 1);
      bg.fillTriangle(ix - 10, y - 7, ix - 10, y + 1, ix - 3, y - 3);
    } else {
      bg.lineBetween(ix - 7, y, ix + 7, y);
      bg.lineBetween(ix, y - 7, ix, y + 7);
    }
  };
  draw(true);

  const text = scene.add
    .text(x + 10, y, label, { fontFamily: 'Fredoka, sans-serif', fontSize: '15px', fontStyle: '600', color: COLORS.cream })
    .setOrigin(0.5);

  const zone = scene.add.zone(x, y, BUTTON_WIDTH, BUTTON_HEIGHT).setInteractive({ useHandCursor: true });
  let enabled = true;
  zone.on('pointerup', () => {
    if (enabled && !isAnimating()) onTap();
  });

  return {
    setEnabled: (value: boolean) => {
      enabled = value;
      draw(value);
      text.setAlpha(value ? 1 : 0.6);
      text.setColor(value ? COLORS.cream : COLORS.inkSoft);
    },
    setLabel: (value: string) => {
      text.setText(value);
    },
  };
}

export { BUTTON_WIDTH, BUTTON_HEIGHT, MIN_TOUCH_TARGET };
