import Phaser from 'phaser';
import { ITEM_TYPE_POOL } from '../core/itemTypePool';
import type { ItemType } from '../core/types';
import { COLORS, HIGHLIGHT, ITEM_ACCENTS, SHADOW, hexToNum, shade } from './theme';

/**
 * Her eşya türü artık kendi SİLUETİNDEN tanınabilir (kitap/kupa/saksı bitkisi/kavanoz/ayıcık/
 * lamba/vazo/tabak/çerçeve/saat) -- tek renkli dikdörtgen/daire yok. Her çizim: 2-3 tonlu degrade
 * gövde + üstte parlama (highlight) + altta yumuşak gölge + birkaç küçük detay.
 */

const ACCENT_BY_TYPE: Record<string, string> = Object.fromEntries(
  ITEM_TYPE_POOL.map((type, i) => [type, ITEM_ACCENTS[i % ITEM_ACCENTS.length]]),
);

export function accentFor(type: ItemType): string {
  return ACCENT_BY_TYPE[type] ?? COLORS.inkSoft;
}

type Drawer = (g: Phaser.GameObjects.Graphics, w: number, h: number, accent: string) => void;

const INK = hexToNum(COLORS.ink);
const CREAM = hexToNum(COLORS.cream);

function shadowBase(g: Phaser.GameObjects.Graphics, w: number, h: number): void {
  g.fillStyle(SHADOW.color, SHADOW.alpha);
  g.fillEllipse(0, h * 0.4, w * 0.6, h * 0.26);
}

function gloss(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
  g.fillStyle(HIGHLIGHT.color, HIGHLIGHT.alpha);
  g.fillEllipse(x, y, w, h);
}

function gradientBody(g: Phaser.GameObjects.Graphics, accent: string): void {
  g.fillGradientStyle(shade(accent, 0.3), shade(accent, 0.3), shade(accent, -0.18), shade(accent, -0.18), 1, 1, 1, 1);
}

/**
 * g.arc()+strokePath() (Graphics'in path tabanlı yay çizimi) bu projede kullanılan Phaser
 * sürümünde WebGL'de bazen kutudan taşan, ekranı boydan boya kesen hatalı bir çizgi üretiyor
 * (muhtemelen path tessellation ile ilgili bir motor hatası). Bunun yerine yayı kendimiz küçük
 * düz segmentlere bölüp lineBetween ile çiziyoruz -- aynı görsel sonucu, path komutu olmadan verir.
 */
export function strokeArc(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
  segments = 10,
): void {
  const start = Phaser.Math.DegToRad(startDeg);
  const end = Phaser.Math.DegToRad(endDeg);
  let prevX = cx + Math.cos(start) * r;
  let prevY = cy + Math.sin(start) * r;
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const angle = start + (end - start) * t;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    g.lineBetween(prevX, prevY, x, y);
    prevX = x;
    prevY = y;
  }
}

function drawBook(g: Phaser.GameObjects.Graphics, w: number, h: number, accent: string): void {
  const s = h;
  shadowBase(g, w, h);
  const bw = s * 1.55;
  const bh = s * 0.8;
  gradientBody(g, accent);
  g.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 5);
  g.fillStyle(INK, 0.16);
  g.fillRect(-bw / 2 + bw * 0.18, -bh / 2, 3, bh);
  g.fillStyle(CREAM, 0.85);
  for (let i = 0; i < 3; i++) {
    g.fillRect(bw * 0.06, -bh * 0.3 + i * bh * 0.3, bw * 0.36, 2.4);
  }
  gloss(g, -bw * 0.16, -bh * 0.26, bw * 0.4, bh * 0.22);
}

function drawCup(g: Phaser.GameObjects.Graphics, w: number, h: number, accent: string): void {
  const s = h;
  shadowBase(g, w, h);
  const bw = s * 0.95;
  const bh = s * 0.72;
  const top = -bh / 2 + 2;
  gradientBody(g, accent);
  g.fillRoundedRect(-bw / 2, top, bw, bh, { tl: 3, tr: 3, bl: 10, br: 10 });
  // kulp
  g.lineStyle(Math.max(2, s * 0.1), hexToNum(accent), 1);
  strokeArc(g, bw / 2 - 1, top + bh / 2, bh * 0.32, -70, 70);
  // buhar
  g.lineStyle(2, hexToNum(COLORS.inkSoft), 0.5);
  g.lineBetween(-bw * 0.12, top - 3, -bw * 0.2, top - 10);
  g.lineBetween(-bw * 0.2, top - 10, -bw * 0.08, top - 16);
  g.lineBetween(bw * 0.12, top - 3, bw * 0.2, top - 10);
  g.lineBetween(bw * 0.2, top - 10, bw * 0.08, top - 16);
  gloss(g, -bw * 0.2, top + bh * 0.28, bw * 0.3, bh * 0.4);
}

function drawPlant(g: Phaser.GameObjects.Graphics, w: number, h: number, accent: string): void {
  const s = h;
  shadowBase(g, w, h);
  const potW = s * 0.85;
  const potH = s * 0.5;
  const potY = h * 0.18;
  gradientBody(g, accent);
  g.fillPoints(
    [
      { x: -potW / 2, y: potY },
      { x: potW / 2, y: potY },
      { x: potW * 0.38, y: potY + potH },
      { x: -potW * 0.38, y: potY + potH },
    ],
    true,
  );
  g.fillStyle(hexToNum(COLORS.green), 1);
  g.fillTriangle(0, potY - potH * 1.1, -s * 0.32, potY + 2, s * 0.06, potY + 2);
  g.fillTriangle(0, potY - potH * 1.3, s * 0.34, potY + 2, -s * 0.04, potY + 2);
  g.fillStyle(shade(COLORS.green, 0.22), 1);
  g.fillTriangle(0, potY - potH * 0.9, -s * 0.1, potY + 2, s * 0.1, potY + 2);
  gloss(g, -potW * 0.15, potY + potH * 0.3, potW * 0.3, potH * 0.3);
}

function drawJar(g: Phaser.GameObjects.Graphics, w: number, h: number, accent: string): void {
  const s = h;
  shadowBase(g, w, h);
  const bodyW = s * 0.82;
  const bodyH = s * 0.74;
  const bodyY = h * 0.08;
  gradientBody(g, accent);
  g.fillRoundedRect(-bodyW / 2, bodyY - bodyH / 2, bodyW, bodyH, 8);
  const neckW = bodyW * 0.56;
  g.fillRoundedRect(-neckW / 2, bodyY - bodyH / 2 - 7, neckW, 8, 2);
  g.fillStyle(CREAM, 0.95);
  g.fillRoundedRect(-neckW / 2 - 2, bodyY - bodyH / 2 - 12, neckW + 4, 6, 2);
  gloss(g, -bodyW * 0.18, bodyY - bodyH * 0.1, bodyW * 0.3, bodyH * 0.4);
}

function drawTeddyBear(g: Phaser.GameObjects.Graphics, w: number, h: number, accent: string): void {
  const s = h;
  shadowBase(g, w, h);
  const headR = s * 0.26;
  const headY = -s * 0.2;
  const bodyW = s * 0.68;
  const bodyH = s * 0.5;
  const bodyY = s * 0.18;
  gradientBody(g, accent);
  g.fillCircle(-headR * 0.95, headY - headR * 0.9, headR * 0.42);
  g.fillCircle(headR * 0.95, headY - headR * 0.9, headR * 0.42);
  g.fillEllipse(0, bodyY, bodyW, bodyH);
  g.fillCircle(0, headY, headR);
  g.fillStyle(INK, 0.85);
  g.fillCircle(-headR * 0.32, headY - headR * 0.05, 1.6);
  g.fillCircle(headR * 0.32, headY - headR * 0.05, 1.6);
  g.fillStyle(shade(accent, -0.2), 1);
  g.fillEllipse(0, headY + headR * 0.35, headR * 0.5, headR * 0.34);
  gloss(g, -bodyW * 0.14, bodyY - bodyH * 0.2, bodyW * 0.28, bodyH * 0.26);
}

function drawLamp(g: Phaser.GameObjects.Graphics, w: number, h: number, accent: string): void {
  const s = h;
  shadowBase(g, w, h);
  const shadeW = s * 1.1;
  const shadeH = s * 0.42;
  const shadeY = -s * 0.22;
  gradientBody(g, accent);
  g.fillPoints(
    [
      { x: -shadeW * 0.3, y: shadeY - shadeH / 2 },
      { x: shadeW * 0.3, y: shadeY - shadeH / 2 },
      { x: shadeW / 2, y: shadeY + shadeH / 2 },
      { x: -shadeW / 2, y: shadeY + shadeH / 2 },
    ],
    true,
  );
  g.fillStyle(hexToNum(COLORS.inkSoft), 0.9);
  g.fillRect(-2, shadeY + shadeH / 2, 4, s * 0.34);
  g.fillEllipse(0, shadeY + shadeH / 2 + s * 0.36, s * 0.46, s * 0.14);
  g.fillStyle(CREAM, 0.3);
  g.fillTriangle(0, shadeY - shadeH * 0.1, -shadeW * 0.22, shadeY + shadeH / 2 - 2, shadeW * 0.22, shadeY + shadeH / 2 - 2);
  gloss(g, -shadeW * 0.12, shadeY - shadeH * 0.12, shadeW * 0.3, shadeH * 0.3);
}

function drawVase(g: Phaser.GameObjects.Graphics, w: number, h: number, accent: string): void {
  const s = h;
  shadowBase(g, w, h);
  gradientBody(g, accent);
  g.fillEllipse(0, -s * 0.22, s * 0.3, s * 0.28);
  g.fillEllipse(0, s * 0.06, s * 0.66, s * 0.56);
  g.fillEllipse(0, s * 0.36, s * 0.34, s * 0.16);
  g.fillStyle(hexToNum(COLORS.green), 1);
  g.lineStyle(2, hexToNum(COLORS.green), 1);
  g.lineBetween(0, -s * 0.34, -s * 0.14, -s * 0.56);
  g.lineBetween(0, -s * 0.34, s * 0.12, -s * 0.6);
  gloss(g, -s * 0.16, -s * 0.02, s * 0.22, s * 0.34);
}

function drawPlate(g: Phaser.GameObjects.Graphics, w: number, h: number, accent: string): void {
  const s = h;
  shadowBase(g, w, h);
  gradientBody(g, accent);
  g.fillEllipse(0, 0, s * 1.3, s * 0.62);
  g.fillStyle(CREAM, 0.9);
  g.fillEllipse(0, 0, s * 0.82, s * 0.38);
  g.fillStyle(hexToNum(accent), 0.35);
  g.fillEllipse(0, 0, s * 0.5, s * 0.22);
  gloss(g, -s * 0.28, -s * 0.12, s * 0.3, s * 0.12);
}

function drawFrame(g: Phaser.GameObjects.Graphics, w: number, h: number, accent: string): void {
  const s = h;
  shadowBase(g, w, h);
  const fw = s * 1.1;
  const fh = s * 0.86;
  gradientBody(g, accent);
  g.fillRoundedRect(-fw / 2, -fh / 2, fw, fh, 4);
  g.fillStyle(CREAM, 0.95);
  const iw = fw * 0.72;
  const ih = fh * 0.64;
  g.fillRoundedRect(-iw / 2, -ih / 2, iw, ih, 2);
  g.fillStyle(hexToNum(COLORS.sky), 0.8);
  g.fillCircle(iw * 0.22, -ih * 0.22, iw * 0.1);
  g.fillStyle(hexToNum(accent), 0.9);
  g.fillTriangle(-iw * 0.3, ih * 0.26, 0, -ih * 0.1, iw * 0.3, ih * 0.26);
  gloss(g, -fw * 0.2, -fh * 0.3, fw * 0.3, fh * 0.2);
}

function drawClock(g: Phaser.GameObjects.Graphics, w: number, h: number, accent: string): void {
  const s = h;
  shadowBase(g, w, h);
  const r = s * 0.46;
  gradientBody(g, accent);
  g.fillCircle(0, 0, r);
  g.fillStyle(CREAM, 0.92);
  g.fillCircle(0, 0, r * 0.74);
  g.fillStyle(INK, 0.6);
  for (const angle of [0, 90, 180, 270]) {
    const rad = Phaser.Math.DegToRad(angle);
    g.fillCircle(Math.cos(rad) * r * 0.58, Math.sin(rad) * r * 0.58, 1.4);
  }
  g.lineStyle(2, INK, 0.75);
  g.lineBetween(0, 0, 0, -r * 0.42);
  g.lineBetween(0, 0, r * 0.3, r * 0.1);
  gloss(g, -r * 0.3, -r * 0.3, r * 0.6, r * 0.5);
}

const DRAWERS: Record<string, Drawer> = {
  book: drawBook,
  cup: drawCup,
  plant: drawPlant,
  jar: drawJar,
  teddybear: drawTeddyBear,
  lamp: drawLamp,
  vase: drawVase,
  plate: drawPlate,
  frame: drawFrame,
  clock: drawClock,
};

function drawFallback(g: Phaser.GameObjects.Graphics, w: number, h: number, accent: string): void {
  shadowBase(g, w, h);
  gradientBody(g, accent);
  g.fillRoundedRect(-w * 0.35, -h * 0.35, w * 0.7, h * 0.7, 6);
}

/** Verilen türün siluetini (w x h kutusuna ortalanmış) tek bir Graphics üzerine çizer. */
export function drawItemArt(scene: Phaser.Scene, type: ItemType, w: number, h: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  const accent = accentFor(type);
  const drawer = DRAWERS[type] ?? drawFallback;
  drawer(g, w, h, accent);
  return g;
}
