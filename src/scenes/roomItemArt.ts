import Phaser from 'phaser';
import { COLORS, HIGHLIGHT, SHADOW, hexToNum } from './theme';
import { strokeArc } from './itemVisuals';

/**
 * Oda eşyaları (mobilya) için 15 jenerik siluet -- 5 odanın 10'ar eşyası, etiket anahtar
 * kelimesiyle bu tiplerden birine eşlenir (bkz. iconKeyForLabel). Yenilenmemiş durumda SOLUK/GRİ
 * düz dolgu, yenilenince AYNI siluet canlı degrade+parlama+gölge ile çizilir -- önce/sonra farkı
 * tek bakışta anlaşılsın diye şekil hep aynı kalır, sadece renk/doku değişir.
 */
export type RoomIconKey =
  | 'armchair'
  | 'rug'
  | 'curtain'
  | 'wallAccent'
  | 'table'
  | 'lamp'
  | 'frame'
  | 'cabinet'
  | 'plant'
  | 'tvStand'
  | 'chair'
  | 'bed'
  | 'fridge'
  | 'faucet'
  | 'toybox';

const LABEL_TO_ICON: Record<string, RoomIconKey> = {
  Koltuk: 'armchair',
  Halı: 'rug',
  Perde: 'curtain',
  'Duvar Rengi': 'wallAccent',
  'Duvar Fayansı': 'wallAccent',
  'Duvar Çıkartması': 'wallAccent',
  Sehpa: 'table',
  Komodin: 'table',
  Masa: 'table',
  Tezgah: 'table',
  'Çalışma Masası': 'table',
  Lamba: 'lamp',
  Aydınlatma: 'lamp',
  'Resim Çerçevesi': 'frame',
  Resim: 'frame',
  Ayna: 'frame',
  Pano: 'frame',
  Kitaplık: 'cabinet',
  Raf: 'cabinet',
  'Oyuncak Dolabı': 'cabinet',
  Gardırop: 'cabinet',
  Dolap: 'cabinet',
  'Dosya Dolabı': 'cabinet',
  'Saksı Bitki': 'plant',
  'TV Ünitesi': 'tvStand',
  Sandalye: 'chair',
  Yatak: 'bed',
  Karyola: 'bed',
  Nevresim: 'rug',
  Buzdolabı: 'fridge',
  Musluk: 'faucet',
  'Oyuncak Kutusu': 'toybox',
};

export function iconKeyForLabel(label: string): RoomIconKey {
  return LABEL_TO_ICON[label] ?? 'cabinet';
}

/** Oda kompozisyonunda derinlik sırası: 0=arka duvar (küçük/uzak), 4=ön kat (büyük/yakın). */
export const ICON_DEPTH: Record<RoomIconKey, number> = {
  frame: 0,
  wallAccent: 0,
  lamp: 1,
  curtain: 1,
  tvStand: 2,
  plant: 2,
  faucet: 2,
  chair: 3,
  table: 3,
  cabinet: 3,
  fridge: 3,
  toybox: 3,
  rug: 4,
  bed: 4,
  armchair: 4,
};

type Drawer = (g: Phaser.GameObjects.Graphics, w: number, h: number, body: number, accentOn: boolean) => void;

function softShadow(g: Phaser.GameObjects.Graphics, w: number, h: number): void {
  g.fillStyle(SHADOW.color, SHADOW.alpha * 0.8);
  g.fillEllipse(0, h * 0.46, w * 0.7, h * 0.16);
}

function gloss(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, on: boolean): void {
  if (!on) return;
  g.fillStyle(HIGHLIGHT.color, HIGHLIGHT.alpha * 0.8);
  g.fillEllipse(x, y, w, h);
}

function bodyFill(g: Phaser.GameObjects.Graphics, body: number, accentOn: boolean): void {
  if (accentOn) {
    g.fillGradientStyle(shadeNum(body, 0.28), shadeNum(body, 0.28), shadeNum(body, -0.16), shadeNum(body, -0.16), 1, 1, 1, 1);
  } else {
    g.fillStyle(body, 1);
  }
}

function shadeNum(color: number, percent: number): number {
  const r = (color >> 16) & 0xff;
  const gC = (color >> 8) & 0xff;
  const b = color & 0xff;
  const adjust = (c: number) => (percent >= 0 ? c + (255 - c) * percent : c * (1 + percent));
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (clamp(adjust(r)) << 16) | (clamp(adjust(gC)) << 8) | clamp(adjust(b));
}

function drawArmchair(g: Phaser.GameObjects.Graphics, w: number, h: number, body: number, on: boolean): void {
  softShadow(g, w, h);
  bodyFill(g, body, on);
  g.fillRoundedRect(-w * 0.4, -h * 0.12, w * 0.8, h * 0.5, 10);
  g.fillRoundedRect(-w * 0.42, -h * 0.45, w * 0.84, h * 0.42, 10);
  g.fillRoundedRect(-w * 0.48, -h * 0.2, w * 0.16, h * 0.45, 8);
  g.fillRoundedRect(w * 0.32, -h * 0.2, w * 0.16, h * 0.45, 8);
  gloss(g, -w * 0.12, -h * 0.3, w * 0.3, h * 0.16, on);
}

function drawRug(g: Phaser.GameObjects.Graphics, w: number, h: number, body: number, on: boolean): void {
  bodyFill(g, body, on);
  g.fillRoundedRect(-w * 0.46, -h * 0.26, w * 0.92, h * 0.52, 10);
  g.lineStyle(2, on ? 0xffffff : hexToNum(COLORS.inkSoft), on ? 0.5 : 0.25);
  g.strokeRoundedRect(-w * 0.36, -h * 0.17, w * 0.72, h * 0.34, 7);
}

function drawCurtain(g: Phaser.GameObjects.Graphics, w: number, h: number, body: number, on: boolean): void {
  g.fillStyle(on ? hexToNum(COLORS.inkSoft) : hexToNum(COLORS.surfaceMuted), 0.8);
  g.fillRect(-w * 0.44, -h * 0.5, w * 0.88, 4);
  bodyFill(g, body, on);
  g.fillRoundedRect(-w * 0.42, -h * 0.46, w * 0.34, h * 0.9, 6);
  g.fillRoundedRect(w * 0.08, -h * 0.46, w * 0.34, h * 0.9, 6);
  g.lineStyle(1.5, 0xffffff, on ? 0.35 : 0.2);
  for (const side of [-1, 1]) {
    g.lineBetween(side * w * 0.33, -h * 0.4, side * w * 0.33, h * 0.4);
  }
}

function drawWallAccent(g: Phaser.GameObjects.Graphics, w: number, h: number, body: number, on: boolean): void {
  softShadow(g, w, h);
  bodyFill(g, body, on);
  g.fillRoundedRect(-w * 0.4, -h * 0.4, w * 0.8, h * 0.8, 10);
  gloss(g, -w * 0.1, -h * 0.15, w * 0.3, h * 0.25, on);
}

function drawTable(g: Phaser.GameObjects.Graphics, w: number, h: number, body: number, on: boolean): void {
  softShadow(g, w, h);
  bodyFill(g, body, on);
  g.fillRoundedRect(-w * 0.44, -h * 0.4, w * 0.88, h * 0.22, 6);
  g.fillStyle(on ? shadeNum(body, -0.2) : hexToNum(COLORS.inkSoft), on ? 1 : 0.4);
  g.fillRect(-w * 0.36, -h * 0.18, w * 0.06, h * 0.56);
  g.fillRect(w * 0.3, -h * 0.18, w * 0.06, h * 0.56);
  gloss(g, -w * 0.1, -h * 0.34, w * 0.3, h * 0.08, on);
}

function drawLamp(g: Phaser.GameObjects.Graphics, w: number, h: number, body: number, on: boolean): void {
  softShadow(g, w, h);
  bodyFill(g, body, on);
  const shadeW = w * 0.7;
  const shadeH = h * 0.32;
  g.fillPoints(
    [
      { x: -shadeW * 0.3, y: -h * 0.42 },
      { x: shadeW * 0.3, y: -h * 0.42 },
      { x: shadeW / 2, y: -h * 0.42 + shadeH },
      { x: -shadeW / 2, y: -h * 0.42 + shadeH },
    ],
    true,
  );
  g.fillStyle(on ? hexToNum(COLORS.inkSoft) : hexToNum(COLORS.surfaceMuted), 1);
  g.fillRect(-2.5, -h * 0.42 + shadeH, 5, h * 0.5);
  g.fillEllipse(0, h * 0.14, w * 0.3, h * 0.08);
  gloss(g, 0, -h * 0.32, shadeW * 0.3, shadeH * 0.4, on);
}

function drawFrame(g: Phaser.GameObjects.Graphics, w: number, h: number, body: number, on: boolean): void {
  softShadow(g, w, h);
  bodyFill(g, body, on);
  g.fillRoundedRect(-w * 0.38, -h * 0.44, w * 0.76, h * 0.82, 5);
  g.fillStyle(on ? 0xfff8f0 : hexToNum(COLORS.surface), on ? 0.95 : 0.7);
  const iw = w * 0.56;
  const ih = h * 0.6;
  g.fillRoundedRect(-iw / 2, -ih / 2 - h * 0.02, iw, ih, 3);
  g.fillStyle(on ? hexToNum(COLORS.sky) : hexToNum(COLORS.surfaceMuted), on ? 0.8 : 0.9);
  g.fillCircle(iw * 0.18, -ih * 0.18 - h * 0.02, iw * 0.14);
  g.fillStyle(on ? body : hexToNum(COLORS.inkSoft), on ? 0.9 : 0.35);
  g.fillTriangle(-iw * 0.26, ih * 0.3 - h * 0.02, 0, -ih * 0.1 - h * 0.02, iw * 0.26, ih * 0.3 - h * 0.02);
}

function drawCabinet(g: Phaser.GameObjects.Graphics, w: number, h: number, body: number, on: boolean): void {
  softShadow(g, w, h);
  bodyFill(g, body, on);
  g.fillRoundedRect(-w * 0.4, -h * 0.48, w * 0.8, h * 0.96, 8);
  g.lineStyle(1.5, on ? 0xffffff : hexToNum(COLORS.inkSoft), on ? 0.4 : 0.2);
  g.lineBetween(-w * 0.4 + 4, -h * 0.1, w * 0.4 - 4, -h * 0.1);
  g.lineBetween(-w * 0.4 + 4, h * 0.22, w * 0.4 - 4, h * 0.22);
  g.fillStyle(on ? hexToNum(COLORS.ink) : hexToNum(COLORS.inkSoft), on ? 0.5 : 0.3);
  g.fillCircle(-w * 0.1, -h * 0.28, 2.2);
  g.fillCircle(-w * 0.1, h * 0.04, 2.2);
  gloss(g, -w * 0.12, -h * 0.36, w * 0.24, h * 0.12, on);
}

function drawPlant(g: Phaser.GameObjects.Graphics, w: number, h: number, body: number, on: boolean): void {
  softShadow(g, w, h);
  const potW = w * 0.5;
  const potH = h * 0.32;
  const potY = h * 0.3;
  bodyFill(g, body, on);
  g.fillPoints(
    [
      { x: -potW / 2, y: potY },
      { x: potW / 2, y: potY },
      { x: potW * 0.36, y: potY + potH },
      { x: -potW * 0.36, y: potY + potH },
    ],
    true,
  );
  const leaf = on ? hexToNum(COLORS.green) : hexToNum(COLORS.surfaceMuted);
  g.fillStyle(leaf, 1);
  g.fillTriangle(0, potY - h * 0.5, -w * 0.22, potY + 2, w * 0.03, potY + 2);
  g.fillTriangle(0, potY - h * 0.6, w * 0.24, potY + 2, -w * 0.02, potY + 2);
  g.fillStyle(on ? shadeNum(leaf, 0.2) : hexToNum(COLORS.surfaceMuted), 1);
  g.fillTriangle(0, potY - h * 0.4, -w * 0.08, potY + 2, w * 0.08, potY + 2);
}

function drawTvStand(g: Phaser.GameObjects.Graphics, w: number, h: number, body: number, on: boolean): void {
  softShadow(g, w, h);
  g.fillStyle(on ? hexToNum(COLORS.inkSoft) : hexToNum(COLORS.surfaceMuted), 1);
  g.fillRoundedRect(-w * 0.44, h * 0.14, w * 0.88, h * 0.18, 5);
  bodyFill(g, body, on);
  g.fillRoundedRect(-w * 0.4, -h * 0.38, w * 0.8, h * 0.5, 6);
  g.fillStyle(on ? 0x1b1b1b : hexToNum(COLORS.surface), on ? 0.85 : 0.5);
  g.fillRoundedRect(-w * 0.34, -h * 0.32, w * 0.68, h * 0.36, 3);
  gloss(g, -w * 0.08, -h * 0.22, w * 0.22, h * 0.1, on);
}

function drawChair(g: Phaser.GameObjects.Graphics, w: number, h: number, body: number, on: boolean): void {
  softShadow(g, w, h);
  bodyFill(g, body, on);
  g.fillRoundedRect(-w * 0.32, -h * 0.05, w * 0.64, h * 0.18, 5);
  g.fillRoundedRect(-w * 0.32, -h * 0.5, w * 0.1, h * 0.5, 4);
  g.fillRoundedRect(w * 0.22, -h * 0.5, w * 0.1, h * 0.5, 4);
  g.fillStyle(on ? shadeNum(body, -0.2) : hexToNum(COLORS.inkSoft), on ? 1 : 0.4);
  for (const side of [-1, 1]) {
    g.fillRect(side * w * 0.26, h * 0.12, w * 0.05, h * 0.36);
  }
}

function drawBed(g: Phaser.GameObjects.Graphics, w: number, h: number, body: number, on: boolean): void {
  softShadow(g, w, h);
  g.fillStyle(on ? hexToNum(COLORS.inkSoft) : hexToNum(COLORS.surfaceMuted), 1);
  g.fillRoundedRect(-w * 0.44, -h * 0.46, w * 0.1, h * 0.5, 4);
  bodyFill(g, body, on);
  g.fillRoundedRect(-w * 0.42, -h * 0.1, w * 0.84, h * 0.36, 8);
  g.fillStyle(on ? 0xffffff : hexToNum(COLORS.surface), on ? 0.95 : 0.7);
  g.fillRoundedRect(-w * 0.36, -h * 0.26, w * 0.3, h * 0.2, 6);
  gloss(g, w * 0.05, -h * 0.02, w * 0.3, h * 0.12, on);
}

function drawFridge(g: Phaser.GameObjects.Graphics, w: number, h: number, body: number, on: boolean): void {
  softShadow(g, w, h);
  bodyFill(g, body, on);
  g.fillRoundedRect(-w * 0.34, -h * 0.48, w * 0.68, h * 0.96, 8);
  g.lineStyle(1.5, on ? 0xffffff : hexToNum(COLORS.inkSoft), on ? 0.4 : 0.2);
  g.lineBetween(-w * 0.34 + 3, -h * 0.1, w * 0.34 - 3, -h * 0.1);
  g.fillStyle(on ? hexToNum(COLORS.ink) : hexToNum(COLORS.inkSoft), on ? 0.5 : 0.3);
  g.fillRoundedRect(w * 0.2, -h * 0.4, 3, h * 0.2, 1.5);
  g.fillRoundedRect(w * 0.2, -h * 0.02, 3, h * 0.2, 1.5);
  gloss(g, -w * 0.08, -h * 0.3, w * 0.18, h * 0.14, on);
}

function drawFaucet(g: Phaser.GameObjects.Graphics, w: number, h: number, body: number, on: boolean): void {
  softShadow(g, w, h);
  g.fillStyle(on ? hexToNum(COLORS.inkSoft) : hexToNum(COLORS.surfaceMuted), 1);
  g.fillRoundedRect(-w * 0.3, h * 0.14, w * 0.6, h * 0.12, 4);
  g.lineStyle(Math.max(3, w * 0.07), on ? body : hexToNum(COLORS.surfaceMuted), 1);
  g.lineBetween(0, h * 0.14, 0, -h * 0.1);
  strokeArc(g, w * 0.14, -h * 0.1, w * 0.14, 180, 280);
  gloss(g, -w * 0.02, -h * 0.02, w * 0.12, h * 0.14, on);
}

function drawToybox(g: Phaser.GameObjects.Graphics, w: number, h: number, body: number, on: boolean): void {
  softShadow(g, w, h);
  bodyFill(g, body, on);
  g.fillRoundedRect(-w * 0.4, -h * 0.1, w * 0.8, h * 0.5, 8);
  g.fillStyle(on ? shadeNum(body, 0.15) : hexToNum(COLORS.surfaceMuted), 1);
  g.fillRoundedRect(-w * 0.42, -h * 0.28, w * 0.84, h * 0.2, 6);
  const ballColor = on ? hexToNum(COLORS.turquoise) : hexToNum(COLORS.surfaceMuted);
  g.fillStyle(ballColor, 1);
  g.fillCircle(w * 0.16, -h * 0.34, w * 0.1);
  gloss(g, -w * 0.1, -h * 0.02, w * 0.26, h * 0.14, on);
}

const DRAWERS: Record<RoomIconKey, Drawer> = {
  armchair: drawArmchair,
  rug: drawRug,
  curtain: drawCurtain,
  wallAccent: drawWallAccent,
  table: drawTable,
  lamp: drawLamp,
  frame: drawFrame,
  cabinet: drawCabinet,
  plant: drawPlant,
  tvStand: drawTvStand,
  chair: drawChair,
  bed: drawBed,
  fridge: drawFridge,
  faucet: drawFaucet,
  toybox: drawToybox,
};

/** vivid=false: soluk/gri "eski" hâli. vivid=true: accentColor ile canlı degrade "yeni" hâli. */
export function drawRoomIcon(
  scene: Phaser.Scene,
  key: RoomIconKey,
  w: number,
  h: number,
  accentColor: number,
  vivid: boolean,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  const body = vivid ? accentColor : hexToNum(COLORS.surfaceMuted);
  DRAWERS[key](g, w, h, body, vivid);
  return g;
}
