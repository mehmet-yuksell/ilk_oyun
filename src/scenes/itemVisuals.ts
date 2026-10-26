import Phaser from 'phaser';
import { JUICE } from '../config/tuning';
import { ITEM_TYPE_POOL } from '../core/itemTypePool';
import type { ItemType } from '../core/types';
import { COLORS, FONT_FAMILY, HIGHLIGHT, ITEM_ACCENTS, hexToNum, shade } from './theme';
import type { GraphicsLike } from './canvasGraphics';
import { bakeCentered } from './bake';

/**
 * Her eşya türü kendi siluetinden (kitap/kupa/saksı bitkisi/kavanoz/ayıcık/lamba/vazo/tabak/
 * çerçeve/saat) VE sade bir yüzünden (küçük nokta gözler + ince gülümseme, yanak allığı yok --
 * bkz. Faz 4 kararları: eski yüz çok "çocuksu/yapay" okunuyordu) tanınabilir. Her çizim aynı
 * dili paylaşır: 2-3 tonlu degrade gövde + üstte parlama + altta yumuşak gölge + gövdenin koyu
 * tonunda ince kontur (tüm türlerde aynı kalınlık). Düz tek renk şekil YASAK.
 *
 * Faz 2: çizimler artık Canvas 2D'ye BİR KEZ pişiriliyor (bkz. bake.ts / canvasGraphics.ts) ve
 * pişirme hattı her türe aynı "ışık" geçişini uygular: üstten yumuşak aydınlık, alttan sıcak gölge,
 * sol-üstte seramik/cam parıltısı, arkada gerçek bulanık temas gölgesi. Çalışma anında bir eşya =
 * 2 Image (gövde + yüz); göz kırpma yalnızca yüz dokusunu değiştirir.
 */

const ACCENT_BY_TYPE: Record<string, string> = Object.fromEntries(
  ITEM_TYPE_POOL.map((type, i) => [type, ITEM_ACCENTS[i % ITEM_ACCENTS.length]]),
);

export function accentFor(type: ItemType): string {
  return ACCENT_BY_TYPE[type] ?? COLORS.inkSoft;
}

const INK = hexToNum(COLORS.ink);
const CREAM = hexToNum(COLORS.cream);

function gloss(g: GraphicsLike, x: number, y: number, w: number, h: number): void {
  g.fillStyle(HIGHLIGHT.color, HIGHLIGHT.alpha);
  g.fillEllipse(x, y, w, h);
}

/** Not: üst tonu fazla AÇMAK (ör. +0.3) gövdeyi beyaza yakınlaştırıp "soluk" bir pastel hissi verir
 * -- bu yüzden üst ton hafifçe açılır, alt ton ise derinlik için belirgin koyultulur. */
function gradientBody(g: GraphicsLike, accent: string): void {
  g.fillGradientStyle(shade(accent, 0.14), shade(accent, 0.14), shade(accent, -0.3), shade(accent, -0.3), 1, 1, 1, 1);
}

/** Her çizimin koyu aksan tonunda ince bir dış kontur bırakması için paylaşılan yardımcı. */
function contour(g: GraphicsLike, accent: string, width = 1.6): void {
  g.lineStyle(width, shade(accent, -0.35), 0.55);
}

/**
 * g.arc()+strokePath() (Graphics'in path tabanlı yay çizimi) bu projede kullanılan Phaser
 * sürümünde WebGL'de bazen kutudan taşan, ekranı boydan boya kesen hatalı bir çizgi üretiyor
 * (muhtemelen path tessellation ile ilgili bir motor hatası). Bunun yerine yayı kendimiz küçük
 * düz segmentlere bölüp lineBetween ile çiziyoruz -- aynı görsel sonucu, path komutu olmadan verir.
 */
export function strokeArc(
  g: GraphicsLike,
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
// Yüz: her karakterin gövdesi üzerine bindirilen ortak, sade göz/ağız sistemi.
// ---------------------------------------------------------------------

export type EyeState = 'open' | 'closed';

export interface FaceSpec {
  readonly eyeY: number;
  readonly eyeGapX: number;
  readonly eyeR: number;
  readonly mouthY: number;
  readonly mouthR: number;
}

/**
 * Sadeleştirilmiş yüz: yanak allığı YOK (en "çocuksu" okunan öğeydi), gözler tek tonlu dolgu +
 * tek küçük parıltı noktasıyla temiz bir nokta-göz hissi verir, ağız ince ve küçük bir gülümseme
 * -- "tutarlı gölge/parlama/temiz şekil" diline uysun diye gövdedeki gloss() ile aynı beyaz tonu
 * paylaşır (bkz. Faz 4 kararları: gözlem -- eski yüz çok "sevimli/yapay" okunuyordu).
 */
function drawFace(g: GraphicsLike, spec: FaceSpec, eyeState: EyeState, excited: boolean): void {
  const eyeScale = excited ? JUICE.excited.eyeScale : 1;
  const r = spec.eyeR * eyeScale * 0.82;

  for (const sign of [-1, 1] as const) {
    const ex = sign * spec.eyeGapX;
    if (eyeState === 'closed') {
      g.lineStyle(Math.max(1.5, r * 0.4), INK, 0.8);
      g.lineBetween(ex - r * 0.8, spec.eyeY, ex + r * 0.8, spec.eyeY);
    } else {
      g.fillStyle(INK, 0.82);
      g.fillCircle(ex, spec.eyeY, r);
      g.fillStyle(0xffffff, 0.8);
      g.fillCircle(ex - r * 0.22, spec.eyeY - r * 0.24, r * 0.26);
    }
  }

  g.lineStyle(Math.max(1.2, spec.eyeR * 0.16), INK, 0.6);
  strokeArc(g, 0, spec.mouthY - spec.mouthR * 0.15, spec.mouthR * 0.75, 35, 145, 6);
}

interface FaceController {
  setEyeState(state: EyeState): void;
  setExcited(excited: boolean): void;
}

type Drawer = (g: GraphicsLike, w: number, h: number, accent: string) => FaceSpec;

function drawBook(g: GraphicsLike, _w: number, h: number, accent: string): FaceSpec {
  const s = h;
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
  return { eyeY: -bh * 0.04, eyeGapX: bw * 0.15, eyeR: bh * 0.15, mouthY: bh * 0.26, mouthR: bw * 0.13 };
}

function drawCup(g: GraphicsLike, _w: number, h: number, accent: string): FaceSpec {
  const s = h;
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
  return { eyeY: faceCy - bh * 0.1, eyeGapX: bw * 0.2, eyeR: bh * 0.16, mouthY: faceCy + bh * 0.16, mouthR: bw * 0.16 };
}

function drawPlant(g: GraphicsLike, _w: number, h: number, accent: string): FaceSpec {
  const s = h;
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
  return { eyeY: faceCy - potH * 0.08, eyeGapX: potW * 0.18, eyeR: potH * 0.22, mouthY: faceCy + potH * 0.24, mouthR: potW * 0.16 };
}

function drawJar(g: GraphicsLike, _w: number, h: number, accent: string): FaceSpec {
  const s = h;
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
  return { eyeY: bodyY - bodyH * 0.02, eyeGapX: bodyW * 0.2, eyeR: bodyH * 0.14, mouthY: bodyY + bodyH * 0.22, mouthR: bodyW * 0.16 };
}

function drawTeddyBear(g: GraphicsLike, _w: number, h: number, accent: string): FaceSpec {
  const s = h;
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
  contour(g, accent);
  g.strokeCircle(0, headY, headR);
  g.strokeEllipse(0, bodyY, bodyW, bodyH);
  g.fillStyle(shade(accent, -0.2), 1);
  g.fillEllipse(0, headY + headR * 0.4, headR * 0.5, headR * 0.34);
  gloss(g, -bodyW * 0.14, bodyY - bodyH * 0.2, bodyW * 0.28, bodyH * 0.26);
  return { eyeY: headY - headR * 0.08, eyeGapX: headR * 0.36, eyeR: headR * 0.22, mouthY: headY + headR * 0.22, mouthR: headR * 0.26 };
}

function drawLamp(g: GraphicsLike, _w: number, h: number, accent: string): FaceSpec {
  const s = h;
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
  return { eyeY: shadeY + shadeH * 0.04, eyeGapX: shadeW * 0.16, eyeR: shadeH * 0.26, mouthY: shadeY + shadeH * 0.38, mouthR: shadeW * 0.15 };
}

function drawVase(g: GraphicsLike, _w: number, h: number, accent: string): FaceSpec {
  const s = h;
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
  return { eyeY: s * 0.0, eyeGapX: s * 0.15, eyeR: s * 0.1, mouthY: s * 0.2, mouthR: s * 0.12 };
}

function drawPlate(g: GraphicsLike, _w: number, h: number, accent: string): FaceSpec {
  const s = h;
  gradientBody(g, accent);
  g.fillEllipse(0, 0, s * 1.3, s * 0.62);
  contour(g, accent);
  g.strokeEllipse(0, 0, s * 1.3, s * 0.62);
  g.fillStyle(CREAM, 0.9);
  g.fillEllipse(0, 0, s * 0.82, s * 0.38);
  g.fillStyle(hexToNum(accent), 0.35);
  g.fillEllipse(0, 0, s * 0.5, s * 0.22);
  gloss(g, -s * 0.28, -s * 0.12, s * 0.3, s * 0.12);
  return { eyeY: -s * 0.02, eyeGapX: s * 0.14, eyeR: s * 0.09, mouthY: s * 0.12, mouthR: s * 0.12 };
}

function drawFrame(g: GraphicsLike, _w: number, h: number, accent: string): FaceSpec {
  const s = h;
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
  return { eyeY: ih * 0.02 - iw * 0.06, eyeGapX: iw * 0.09, eyeR: iw * 0.055, mouthY: ih * 0.02 + iw * 0.08, mouthR: iw * 0.09 };
}

function drawClock(g: GraphicsLike, _w: number, h: number, accent: string): FaceSpec {
  const s = h;
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
  return { eyeY: -r * 0.18, eyeGapX: r * 0.3, eyeR: r * 0.17, mouthY: r * 0.3, mouthR: r * 0.26 };
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

function drawFallback(g: GraphicsLike, w: number, h: number, accent: string): FaceSpec {
  gradientBody(g, accent);
  g.fillRoundedRect(-w * 0.35, -h * 0.35, w * 0.7, h * 0.7, 6);
  return { eyeY: -h * 0.06, eyeGapX: w * 0.14, eyeR: h * 0.12, mouthY: h * 0.12, mouthR: w * 0.14 };
}

/** "Gizemli eşya" engeli: kabın en üstünde olmayan eşyalar yüzü kapalı bir "?" kart olarak çizilir. */
export const MYSTERY_TYPE = '__mystery__';

function drawMystery(g: GraphicsLike, w: number, h: number): void {
  const bodyW = Math.min(w * 0.64, h * 1.25);
  const bodyH = h * 0.72;
  g.fillGradientStyle(shade(COLORS.lavender, 0.35), shade(COLORS.lavender, 0.35), shade(COLORS.lavender, -0.12), shade(COLORS.lavender, -0.12), 1, 1, 1, 1);
  g.fillRoundedRect(-bodyW / 2, -bodyH / 2, bodyW, bodyH, 10);
  g.lineStyle(1.6, shade(COLORS.lavender, -0.35), 0.55);
  g.strokeRoundedRect(-bodyW / 2, -bodyH / 2, bodyW, bodyH, 10);
  // noktalı iç çerçeve: "örtülü/kapalı" hissi
  g.fillStyle(0xffffff, 0.75);
  const inset = 7;
  for (let i = 0; i < 5; i++) {
    const tt = i / 4;
    const ex = -bodyW / 2 + inset + tt * (bodyW - inset * 2);
    g.fillCircle(ex, -bodyH / 2 + inset, 1.4);
    g.fillCircle(ex, bodyH / 2 - inset, 1.4);
  }
}

/** Pişirme alanı: bazı siluetler (vazo dalları, buhar) yuvanın biraz dışına taşar -- kırpılmasın diye pay. */
const BAKE_PAD_X = 1.2;
const BAKE_PAD_Y = 1.5;

function bakeKey(kind: string, type: string, w: number, h: number): string {
  return `item-${kind}-${type}-${Math.round(w)}x${Math.round(h)}`;
}

/** Bulanık temas gölgesi: "ekran dışında çiz, gölgesini içeri kaydır" hilesi (shadowBlur her tarayıcıda çalışır). */
function contactShadow(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.save();
  const far = 10000;
  const scale = ctx.getTransform().a;
  ctx.shadowColor = 'rgba(90,58,44,0.45)';
  ctx.shadowBlur = Math.max(3, h * 0.12) * scale;
  ctx.shadowOffsetX = far * scale;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(-far, 0, w * 0.27, h * 0.085, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Tüm türlere ortak ışık: yalnızca çizilmiş piksellere (source-atop) üst aydınlık + alt sıcak gölge + sol-üst parıltı. */
function lightPass(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  const vertical = ctx.createLinearGradient(0, -h * 0.6, 0, h * 0.6);
  vertical.addColorStop(0, 'rgba(255,255,255,0.22)');
  vertical.addColorStop(0.45, 'rgba(255,255,255,0)');
  vertical.addColorStop(1, 'rgba(70,40,30,0.2)');
  ctx.fillStyle = vertical;
  ctx.fillRect(-w, -h, w * 2, h * 2);
  const sheen = ctx.createRadialGradient(-w * 0.16, -h * 0.28, 0, -w * 0.16, -h * 0.28, h * 0.55);
  sheen.addColorStop(0, 'rgba(255,255,255,0.28)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(-w, -h, w * 2, h * 2);
  ctx.restore();
}

interface BakedItem {
  readonly body: string;
  readonly face: Record<'open' | 'closed' | 'excited', string> | null;
  readonly shadow: string;
  readonly width: number;
  readonly height: number;
  readonly shadowSize: { readonly width: number; readonly height: number };
}

/** Hiçbir şey çizmeyen GraphicsLike -- yalnızca bir çizimin döndürdüğü FaceSpec'i (sayılar) almak için. */
const NULL_GRAPHICS: GraphicsLike = new Proxy({} as GraphicsLike, {
  get: () => () => NULL_GRAPHICS,
});

/** Eşyanın "ayak" noktası (temas gölgesi + ezilme/esneme ekseni) -- yuva merkezinden aşağı, h oranı. */
export const ITEM_FOOT = 0.4;

/** Bir türün gövde + 3 yüz durumunu + temas gölgesini (gerekirse) pişirir; pişmişse yalnızca anahtarları döndürür. */
export function bakeItem(scene: Phaser.Scene, type: ItemType, w: number, h: number): BakedItem {
  const size = { width: w * BAKE_PAD_X, height: h * BAKE_PAD_Y };
  const shadowSize = { width: w * 0.8, height: h * 0.45 };
  const shadow = bakeCentered(scene, bakeKey('shadow', 'any', w, h), shadowSize, (_g, ctx) => contactShadow(ctx, w, h));
  const accent = accentFor(type);
  const drawer = DRAWERS[type] ?? drawFallback;

  if (type === MYSTERY_TYPE) {
    const body = bakeCentered(scene, bakeKey('body', type, w, h), size, (g, ctx) => {
      drawMystery(g, w, h);
      lightPass(ctx, w, h);
      ctx.save();
      ctx.font = `900 ${Math.round(h * 0.46)}px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = COLORS.ink;
      ctx.fillText('?', 0, h * 0.03);
      ctx.restore();
    });
    return { body, face: null, shadow, shadowSize, ...size };
  }

  const body = bakeCentered(scene, bakeKey('body', type, w, h), size, (g, ctx) => {
    drawer(g, w, h, accent);
    lightPass(ctx, w, h);
  });
  // Yüz geometrisi yalnızca sayılardan oluşur -- çizimi boş bir hedefe "kuru" çalıştırarak alınır.
  const spec = drawer(NULL_GRAPHICS, w, h, accent);
  const face = {
    open: bakeCentered(scene, bakeKey('face-open', type, w, h), size, (g) => drawFace(g, spec, 'open', false)),
    closed: bakeCentered(scene, bakeKey('face-closed', type, w, h), size, (g) => drawFace(g, spec, 'closed', false)),
    excited: bakeCentered(scene, bakeKey('face-excited', type, w, h), size, (g) => drawFace(g, spec, 'open', true)),
  };
  return { body, face, shadow, shadowSize, ...size };
}

export interface ItemVisual {
  readonly container: Phaser.GameObjects.Container;
  readonly face: FaceController;
}

/**
 * Eşya görseli yapısı (dışarıdan bakınca tek Container, orijin = yuva merkezi):
 *   container
 *     ├─ shadow  (Image, rafta "ayak" noktasında -- eşya kalkınca küçülür/solar, inince yayılır)
 *     └─ sprite  (Container, ORİJİNİ AYAK noktasında -- ezilme/esneme tabana göre olur)
 *          ├─ body (Image)
 *          └─ face (Image, 3 pişmiş durum)
 * `container.getData('sprite')` ve `getData('shadow')` animasyonlar için dışa açıktır.
 */
export function createItemVisual(scene: Phaser.Scene, type: ItemType, w: number, h: number): ItemVisual {
  const baked = bakeItem(scene, type, w, h);
  const foot = h * ITEM_FOOT;
  const container = scene.add.container(0, 0);
  const shadow = scene.add.image(0, foot, baked.shadow).setDisplaySize(baked.shadowSize.width, baked.shadowSize.height);
  const sprite = scene.add.container(0, foot);
  const body = scene.add.image(0, -foot, baked.body).setDisplaySize(baked.width, baked.height);
  sprite.add(body);
  let faceImage: Phaser.GameObjects.Image | null = null;
  if (baked.face) {
    faceImage = scene.add.image(0, -foot, baked.face.open).setDisplaySize(baked.width, baked.height);
    sprite.add(faceImage);
  }
  container.add([shadow, sprite]);

  let eyeState: EyeState = 'open';
  let excited = false;
  const sync = () => {
    if (!faceImage || !baked.face) return;
    faceImage.setTexture(eyeState === 'closed' ? baked.face.closed : excited ? baked.face.excited : baked.face.open);
    faceImage.setDisplaySize(baked.width, baked.height);
  };
  const face: FaceController = {
    setEyeState(state: EyeState) {
      if (eyeState === state) return;
      eyeState = state;
      sync();
    },
    setExcited(value: boolean) {
      if (excited === value) return;
      excited = value;
      sync();
    },
  };
  container.setData('itemType', type);
  container.setData('sprite', sprite);
  container.setData('shadow', shadow);
  container.setData('foot', foot);
  container.setData('shadowScaleX', shadow.scaleX);
  container.setData('shadowScaleY', shadow.scaleY);
  container.setData('setEyeState', face.setEyeState);
  container.setData('setExcited', face.setExcited);
  return { container, face };
}

/** Bir eşya görselini dinlenme pozuna döndürür (havuzdan yeniden kullanılırken / animasyon iptalinde). */
export function resetItemVisual(container: Phaser.GameObjects.Container): void {
  const sprite = container.getData('sprite') as Phaser.GameObjects.Container | undefined;
  const shadow = container.getData('shadow') as Phaser.GameObjects.Image | undefined;
  const scene = container.scene;
  container.setScale(1).setAlpha(1).setAngle(0);
  if (sprite) {
    scene.tweens.killTweensOf(sprite);
    sprite.setPosition(0, container.getData('foot') as number).setScale(1).setAngle(0);
  }
  if (shadow) {
    scene.tweens.killTweensOf(shadow);
    shadow.setScale(container.getData('shadowScaleX') as number, container.getData('shadowScaleY') as number).setAlpha(1);
  }
  (container.getData('setExcited') as ((v: boolean) => void) | undefined)?.(false);
  (container.getData('setEyeState') as ((s: EyeState) => void) | undefined)?.('open');
}

/** Geriye dönük uyumluluk: yalnızca Container isteyen eski çağrı yerleri için. */
export function drawItemArt(scene: Phaser.Scene, type: ItemType, w: number, h: number): Phaser.GameObjects.Container {
  return createItemVisual(scene, type, w, h).container;
}
