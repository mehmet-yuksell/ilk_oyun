import Phaser from 'phaser';
import { JUICE } from '../config/tuning';
import { ITEM_TYPE_POOL } from '../core/itemTypePool';
import type { ItemType } from '../core/types';
import { COLORS, HIGHLIGHT, ITEM_ACCENTS, SHADOW, hexToNum, shade } from './theme';

/**
 * Her eşya türü artık SEVİMLİ BİR KARAKTER: kendi siluetinden (kitap/kupa/saksı bitkisi/kavanoz/
 * ayıcık/lamba/vazo/tabak/çerçeve/saat) VE kendi yüzünden (büyük parlak gözler + ağız + yanak
 * lekesi) tanınabilir. Her çizim: 2-3 tonlu degrade gövde + üstte parlama + altta yumuşak gölge +
 * gövdenin koyu tonunda ince kontur + yüz. Düz tek renk şekil YASAK.
 */

const ACCENT_BY_TYPE: Record<string, string> = Object.fromEntries(
  ITEM_TYPE_POOL.map((type, i) => [type, ITEM_ACCENTS[i % ITEM_ACCENTS.length]]),
);

export function accentFor(type: ItemType): string {
  return ACCENT_BY_TYPE[type] ?? COLORS.inkSoft;
}

const INK = hexToNum(COLORS.ink);
const CREAM = hexToNum(COLORS.cream);
const BLUSH = hexToNum(COLORS.pink);

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

/** Her çizimin koyu aksan tonunda ince bir dış kontur bırakması için paylaşılan yardımcı. */
function contour(g: Phaser.GameObjects.Graphics, accent: string, width = 1.6): void {
  g.lineStyle(width, shade(accent, -0.35), 0.55);
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

// ---------------------------------------------------------------------
// Yüz: her karakterin gövdesi üzerine bindirilen ortak göz/ağız/yanak sistemi.
// ---------------------------------------------------------------------

export type EyeState = 'open' | 'closed';

export interface FaceSpec {
  readonly eyeY: number;
  readonly eyeGapX: number;
  readonly eyeR: number;
  readonly mouthY: number;
  readonly mouthR: number;
  readonly cheekY: number;
  readonly cheekGapX: number;
  readonly cheekR: number;
}

function drawFace(g: Phaser.GameObjects.Graphics, spec: FaceSpec, eyeState: EyeState, excited: boolean): void {
  g.clear();
  const eyeScale = excited ? JUICE.excited.eyeScale : 1;
  const r = spec.eyeR * eyeScale;

  g.fillStyle(BLUSH, 0.4);
  g.fillCircle(-spec.cheekGapX, spec.cheekY, spec.cheekR);
  g.fillCircle(spec.cheekGapX, spec.cheekY, spec.cheekR);

  for (const sign of [-1, 1] as const) {
    const ex = sign * spec.eyeGapX;
    if (eyeState === 'closed') {
      g.lineStyle(Math.max(1.6, r * 0.42), INK, 0.85);
      g.lineBetween(ex - r * 0.85, spec.eyeY, ex + r * 0.85, spec.eyeY);
    } else {
      g.fillStyle(0xffffff, 1);
      g.fillCircle(ex, spec.eyeY, r);
      g.fillStyle(INK, 0.92);
      g.fillCircle(ex + r * 0.1, spec.eyeY + r * 0.2, r * 0.56);
      g.fillStyle(0xffffff, 0.95);
      g.fillCircle(ex - r * 0.22, spec.eyeY - r * 0.24, r * 0.2);
    }
  }

  g.lineStyle(Math.max(1.4, spec.eyeR * 0.2), INK, 0.75);
  strokeArc(g, 0, spec.mouthY - spec.mouthR * 0.2, spec.mouthR, 25, 155, 8);
}

interface FaceController {
  setEyeState(state: EyeState): void;
  setExcited(excited: boolean): void;
}

function attachFace(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  spec: FaceSpec,
): FaceController {
  const faceG = scene.add.graphics();
  container.add(faceG);
  let eyeState: EyeState = 'open';
  let excited = false;
  drawFace(faceG, spec, eyeState, excited);
  return {
    setEyeState(state: EyeState) {
      if (eyeState === state) return;
      eyeState = state;
      drawFace(faceG, spec, eyeState, excited);
    },
    setExcited(value: boolean) {
      if (excited === value) return;
      excited = value;
      drawFace(faceG, spec, eyeState, excited);
    },
  };
}

type Drawer = (g: Phaser.GameObjects.Graphics, w: number, h: number, accent: string) => FaceSpec;

function drawBook(g: Phaser.GameObjects.Graphics, w: number, h: number, accent: string): FaceSpec {
  const s = h;
  shadowBase(g, w, h);
  const bw = s * 1.55;
  const bh = s * 0.8;
  gradientBody(g, accent);
  g.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 5);
  contour(g, accent);
  g.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 5);
  g.fillStyle(INK, 0.16);
  g.fillRect(-bw / 2 + bw * 0.18, -bh / 2, 3, bh);
  g.fillStyle(CREAM, 0.85);
  g.fillRect(bw * 0.06, bh * 0.28, bw * 0.36, 2.4);
  gloss(g, -bw * 0.16, -bh * 0.3, bw * 0.4, bh * 0.2);
  return { eyeY: -bh * 0.04, eyeGapX: bw * 0.15, eyeR: bh * 0.15, mouthY: bh * 0.26, mouthR: bw * 0.13, cheekY: bh * 0.1, cheekGapX: bw * 0.27, cheekR: bh * 0.1 };
}

function drawCup(g: Phaser.GameObjects.Graphics, w: number, h: number, accent: string): FaceSpec {
  const s = h;
  shadowBase(g, w, h);
  const bw = s * 0.95;
  const bh = s * 0.72;
  const top = -bh / 2 + 2;
  gradientBody(g, accent);
  g.fillRoundedRect(-bw / 2, top, bw, bh, { tl: 3, tr: 3, bl: 10, br: 10 });
  contour(g, accent);
  g.strokeRoundedRect(-bw / 2, top, bw, bh, { tl: 3, tr: 3, bl: 10, br: 10 });
  // kulp
  g.lineStyle(Math.max(2, s * 0.1), hexToNum(accent), 1);
  strokeArc(g, bw / 2 - 1, top + bh / 2, bh * 0.32, -70, 70);
  // buhar
  g.lineStyle(2, hexToNum(COLORS.inkSoft), 0.5);
  g.lineBetween(-bw * 0.12, top - 3, -bw * 0.2, top - 10);
  g.lineBetween(-bw * 0.2, top - 10, -bw * 0.08, top - 16);
  g.lineBetween(bw * 0.12, top - 3, bw * 0.2, top - 10);
  g.lineBetween(bw * 0.2, top - 10, bw * 0.08, top - 16);
  gloss(g, -bw * 0.2, top + bh * 0.22, bw * 0.3, bh * 0.3);
  const faceCy = top + bh * 0.56;
  return { eyeY: faceCy - bh * 0.1, eyeGapX: bw * 0.2, eyeR: bh * 0.16, mouthY: faceCy + bh * 0.16, mouthR: bw * 0.16, cheekY: faceCy + bh * 0.02, cheekGapX: bw * 0.32, cheekR: bh * 0.1 };
}

function drawPlant(g: Phaser.GameObjects.Graphics, w: number, h: number, accent: string): FaceSpec {
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
  contour(g, accent);
  g.strokePoints(
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
  const faceCy = potY + potH * 0.42;
  return { eyeY: faceCy - potH * 0.08, eyeGapX: potW * 0.18, eyeR: potH * 0.22, mouthY: faceCy + potH * 0.24, mouthR: potW * 0.16, cheekY: faceCy + potH * 0.06, cheekGapX: potW * 0.3, cheekR: potH * 0.14 };
}

function drawJar(g: Phaser.GameObjects.Graphics, w: number, h: number, accent: string): FaceSpec {
  const s = h;
  shadowBase(g, w, h);
  const bodyW = s * 0.82;
  const bodyH = s * 0.74;
  const bodyY = h * 0.08;
  gradientBody(g, accent);
  g.fillRoundedRect(-bodyW / 2, bodyY - bodyH / 2, bodyW, bodyH, 8);
  contour(g, accent);
  g.strokeRoundedRect(-bodyW / 2, bodyY - bodyH / 2, bodyW, bodyH, 8);
  const neckW = bodyW * 0.56;
  g.fillRoundedRect(-neckW / 2, bodyY - bodyH / 2 - 7, neckW, 8, 2);
  g.fillStyle(CREAM, 0.95);
  g.fillRoundedRect(-neckW / 2 - 2, bodyY - bodyH / 2 - 12, neckW + 4, 6, 2);
  gloss(g, -bodyW * 0.18, bodyY - bodyH * 0.18, bodyW * 0.3, bodyH * 0.32);
  return { eyeY: bodyY - bodyH * 0.02, eyeGapX: bodyW * 0.2, eyeR: bodyH * 0.14, mouthY: bodyY + bodyH * 0.22, mouthR: bodyW * 0.16, cheekY: bodyY + bodyH * 0.08, cheekGapX: bodyW * 0.3, cheekR: bodyH * 0.1 };
}

function drawTeddyBear(g: Phaser.GameObjects.Graphics, w: number, h: number, accent: string): FaceSpec {
  const s = h;
  shadowBase(g, w, h);
  const headR = s * 0.28;
  const headY = -s * 0.2;
  const bodyW = s * 0.68;
  const bodyH = s * 0.5;
  const bodyY = s * 0.18;
  gradientBody(g, accent);
  g.fillCircle(-headR * 0.95, headY - headR * 0.9, headR * 0.42);
  g.fillCircle(headR * 0.95, headY - headR * 0.9, headR * 0.42);
  g.fillEllipse(0, bodyY, bodyW, bodyH);
  g.fillCircle(0, headY, headR);
  contour(g, accent, 1.4);
  g.strokeCircle(0, headY, headR);
  g.strokeEllipse(0, bodyY, bodyW, bodyH);
  g.fillStyle(shade(accent, -0.2), 1);
  g.fillEllipse(0, headY + headR * 0.4, headR * 0.5, headR * 0.34);
  gloss(g, -bodyW * 0.14, bodyY - bodyH * 0.2, bodyW * 0.28, bodyH * 0.26);
  return { eyeY: headY - headR * 0.08, eyeGapX: headR * 0.36, eyeR: headR * 0.22, mouthY: headY + headR * 0.22, mouthR: headR * 0.26, cheekY: headY + headR * 0.08, cheekGapX: headR * 0.52, cheekR: headR * 0.17 };
}

function drawLamp(g: Phaser.GameObjects.Graphics, w: number, h: number, accent: string): FaceSpec {
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
  contour(g, accent);
  g.strokePoints(
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
  gloss(g, -shadeW * 0.12, shadeY - shadeH * 0.1, shadeW * 0.3, shadeH * 0.26);
  return { eyeY: shadeY + shadeH * 0.04, eyeGapX: shadeW * 0.16, eyeR: shadeH * 0.26, mouthY: shadeY + shadeH * 0.38, mouthR: shadeW * 0.15, cheekY: shadeY + shadeH * 0.22, cheekGapX: shadeW * 0.26, cheekR: shadeH * 0.16 };
}

function drawVase(g: Phaser.GameObjects.Graphics, w: number, h: number, accent: string): FaceSpec {
  const s = h;
  shadowBase(g, w, h);
  gradientBody(g, accent);
  g.fillEllipse(0, -s * 0.22, s * 0.3, s * 0.28);
  g.fillEllipse(0, s * 0.06, s * 0.66, s * 0.56);
  g.fillEllipse(0, s * 0.36, s * 0.34, s * 0.16);
  contour(g, accent);
  g.strokeEllipse(0, s * 0.06, s * 0.66, s * 0.56);
  g.fillStyle(hexToNum(COLORS.green), 1);
  g.lineStyle(2, hexToNum(COLORS.green), 1);
  g.lineBetween(0, -s * 0.34, -s * 0.14, -s * 0.56);
  g.lineBetween(0, -s * 0.34, s * 0.12, -s * 0.6);
  gloss(g, -s * 0.16, -s * 0.02, s * 0.22, s * 0.34);
  return { eyeY: s * 0.0, eyeGapX: s * 0.15, eyeR: s * 0.1, mouthY: s * 0.2, mouthR: s * 0.12, cheekY: s * 0.1, cheekGapX: s * 0.24, cheekR: s * 0.08 };
}

function drawPlate(g: Phaser.GameObjects.Graphics, w: number, h: number, accent: string): FaceSpec {
  const s = h;
  shadowBase(g, w, h);
  gradientBody(g, accent);
  g.fillEllipse(0, 0, s * 1.3, s * 0.62);
  contour(g, accent);
  g.strokeEllipse(0, 0, s * 1.3, s * 0.62);
  g.fillStyle(CREAM, 0.9);
  g.fillEllipse(0, 0, s * 0.82, s * 0.38);
  g.fillStyle(hexToNum(accent), 0.35);
  g.fillEllipse(0, 0, s * 0.5, s * 0.22);
  gloss(g, -s * 0.28, -s * 0.12, s * 0.3, s * 0.12);
  return { eyeY: -s * 0.02, eyeGapX: s * 0.14, eyeR: s * 0.09, mouthY: s * 0.12, mouthR: s * 0.12, cheekY: s * 0.06, cheekGapX: s * 0.22, cheekR: s * 0.06 };
}

function drawFrame(g: Phaser.GameObjects.Graphics, w: number, h: number, accent: string): FaceSpec {
  const s = h;
  shadowBase(g, w, h);
  const fw = s * 1.1;
  const fh = s * 0.86;
  gradientBody(g, accent);
  g.fillRoundedRect(-fw / 2, -fh / 2, fw, fh, 4);
  contour(g, accent);
  g.strokeRoundedRect(-fw / 2, -fh / 2, fw, fh, 4);
  g.fillStyle(CREAM, 0.95);
  const iw = fw * 0.72;
  const ih = fh * 0.64;
  g.fillRoundedRect(-iw / 2, -ih / 2, iw, ih, 2);
  // çerçeve içindeki "portre": gülen bir güneş -- çerçevenin kendisi değil, içeriği karakterdir.
  g.fillStyle(hexToNum(COLORS.mustard), 0.9);
  g.fillCircle(0, ih * 0.02, iw * 0.22);
  gloss(g, -fw * 0.2, -fh * 0.3, fw * 0.3, fh * 0.2);
  return { eyeY: ih * 0.02 - iw * 0.06, eyeGapX: iw * 0.09, eyeR: iw * 0.055, mouthY: ih * 0.02 + iw * 0.08, mouthR: iw * 0.09, cheekY: ih * 0.02 + iw * 0.01, cheekGapX: iw * 0.15, cheekR: iw * 0.05 };
}

function drawClock(g: Phaser.GameObjects.Graphics, w: number, h: number, accent: string): FaceSpec {
  const s = h;
  shadowBase(g, w, h);
  const r = s * 0.46;
  gradientBody(g, accent);
  g.fillCircle(0, 0, r);
  contour(g, accent);
  g.strokeCircle(0, 0, r);
  g.fillStyle(CREAM, 0.92);
  g.fillCircle(0, 0, r * 0.74);
  g.fillStyle(INK, 0.5);
  for (const angle of [0, 90, 180, 270]) {
    const rad = Phaser.Math.DegToRad(angle);
    g.fillCircle(Math.cos(rad) * r * 0.64, Math.sin(rad) * r * 0.64, 1.3);
  }
  g.lineStyle(2, INK, 0.6);
  g.lineBetween(0, r * 0.1, 0, -r * 0.1 - r * 0.28);
  g.lineBetween(0, r * 0.1, r * 0.2, r * 0.1 + r * 0.06);
  gloss(g, -r * 0.3, -r * 0.3, r * 0.5, r * 0.4);
  return { eyeY: -r * 0.18, eyeGapX: r * 0.3, eyeR: r * 0.17, mouthY: r * 0.3, mouthR: r * 0.26, cheekY: r * 0.08, cheekGapX: r * 0.44, cheekR: r * 0.14 };
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

function drawFallback(g: Phaser.GameObjects.Graphics, w: number, h: number, accent: string): FaceSpec {
  shadowBase(g, w, h);
  gradientBody(g, accent);
  g.fillRoundedRect(-w * 0.35, -h * 0.35, w * 0.7, h * 0.7, 6);
  return { eyeY: -h * 0.06, eyeGapX: w * 0.14, eyeR: h * 0.12, mouthY: h * 0.12, mouthR: w * 0.14, cheekY: h * 0.04, cheekGapX: w * 0.22, cheekR: h * 0.08 };
}

export interface ItemVisual {
  readonly container: Phaser.GameObjects.Container;
  readonly face: FaceController;
}

/**
 * Verilen türün siluetini + yüzünü (w x h kutusuna ortalanmış) bir Container üzerine çizer.
 * Gövde statik bir Graphics'te, yüz ayrı (redrawable) bir Graphics'te -- göz kırpma/heyecan
 * durumları gövdeyi yeniden çizmeden, yalnızca yüz katmanını güncelleyerek ucuza uygulanabilir.
 */
export function createItemVisual(scene: Phaser.Scene, type: ItemType, w: number, h: number): ItemVisual {
  const container = scene.add.container(0, 0);
  const body = scene.add.graphics();
  container.add(body);
  const accent = accentFor(type);
  const drawer = DRAWERS[type] ?? drawFallback;
  const spec = drawer(body, w, h, accent);
  const face = attachFace(scene, container, spec);
  container.setData('setEyeState', face.setEyeState);
  container.setData('setExcited', face.setExcited);
  return { container, face };
}

/** Geriye dönük uyumluluk: yalnızca Container isteyen eski çağrı yerleri için. */
export function drawItemArt(scene: Phaser.Scene, type: ItemType, w: number, h: number): Phaser.GameObjects.Container {
  return createItemVisual(scene, type, w, h).container;
}
