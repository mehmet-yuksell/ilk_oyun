import type Phaser from 'phaser';
import { strokeArc } from './itemVisuals';

/**
 * Kod ile çizilen ortak ikon seti (telifli ikon yok). Her çizim ~20x20 kutuya, merkez orijinli,
 * tek renk ve yuvarlak uçlu çizgilerle -- butonlarda (ui.ts) ve ayar satırlarında kullanılır.
 */
export type IconDrawer = (g: Phaser.GameObjects.Graphics, color: number) => void;

export const iconBack: IconDrawer = (g, c) => {
  g.lineStyle(3.4, c, 1);
  g.lineBetween(4, -8, -4, 0);
  g.lineBetween(-4, 0, 4, 8);
};

export const iconGear: IconDrawer = (g, c) => {
  g.fillStyle(c, 1);
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i;
    g.fillRoundedRect(Math.cos(a) * 8 - 2.6, Math.sin(a) * 8 - 2.6, 5.2, 5.2, 1.6);
  }
  g.fillCircle(0, 0, 7.4);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(0, 0, 3);
};

export const iconGrid: IconDrawer = (g, c) => {
  g.fillStyle(c, 1);
  for (let r = 0; r < 2; r++) for (let col = 0; col < 2; col++) g.fillRoundedRect(-9 + col * 10, -9 + r * 10, 8, 8, 2.2);
};

export const iconUndo: IconDrawer = (g, c) => {
  g.lineStyle(3, c, 1);
  strokeArc(g, 1, 1, 7, 200, 470, 14);
  g.fillStyle(c, 1);
  g.fillTriangle(-9, -6, -9, 2, -2, -3);
};

export const iconPlus: IconDrawer = (g, c) => {
  g.lineStyle(3.4, c, 1);
  g.lineBetween(-7, 0, 7, 0);
  g.lineBetween(0, -7, 0, 7);
};

export const iconGift: IconDrawer = (g, c) => {
  g.fillStyle(c, 1);
  g.fillRoundedRect(-8, -2, 16, 10, 2);
  g.fillRoundedRect(-9, -6, 18, 4, 1.5);
  g.fillStyle(0xffffff, 0.9);
  g.fillRect(-1.2, -6, 2.4, 14);
  g.lineStyle(2.2, c, 1);
  strokeArc(g, -3, -8, 3, 180, 360, 8);
  strokeArc(g, 3, -8, 3, 180, 360, 8);
};

export const iconCalendar: IconDrawer = (g, c) => {
  g.lineStyle(2.6, c, 1);
  g.strokeRoundedRect(-8, -6, 16, 14, 3);
  g.fillStyle(c, 1);
  g.fillRect(-8, -6, 16, 4);
  g.fillRect(-5, -9, 2.4, 5);
  g.fillRect(2.6, -9, 2.4, 5);
  g.fillCircle(-3, 3, 1.6);
  g.fillCircle(2, 3, 1.6);
};

export const iconMusic: IconDrawer = (g, c) => {
  g.fillStyle(c, 1);
  g.fillEllipse(-4, 6, 7, 5.4);
  g.fillEllipse(6, 4, 7, 5.4);
  g.lineStyle(2.4, c, 1);
  g.lineBetween(-1, 6, -1, -8);
  g.lineBetween(9, 4, 9, -10);
  g.lineStyle(3.4, c, 1);
  g.lineBetween(-1, -8, 9, -10);
};

export const iconSpeaker: IconDrawer = (g, c) => {
  g.fillStyle(c, 1);
  g.fillRect(-9, -3.5, 5, 7);
  g.fillTriangle(-5, -3.5, 1, -8, 1, 8);
  g.fillTriangle(-5, -3.5, -5, 3.5, 1, 8);
  g.lineStyle(2.2, c, 1);
  strokeArc(g, 2, 0, 4.5, -50, 50, 6);
  strokeArc(g, 2, 0, 8, -50, 50, 8);
};

export const iconVibrate: IconDrawer = (g, c) => {
  g.lineStyle(2.4, c, 1);
  g.strokeRoundedRect(-4.5, -8, 9, 16, 2.4);
  g.lineBetween(-8, -4, -8, 4);
  g.lineBetween(8, -4, 8, 4);
  g.lineBetween(-10.5, -2, -10.5, 2);
  g.lineBetween(10.5, -2, 10.5, 2);
};

export const iconGlobe: IconDrawer = (g, c) => {
  g.lineStyle(2.2, c, 1);
  g.strokeCircle(0, 0, 8.5);
  g.strokeEllipse(0, 0, 8, 17);
  g.lineBetween(-8.5, 0, 8.5, 0);
};

export const iconHome: IconDrawer = (g, c) => {
  g.fillStyle(c, 1);
  g.fillTriangle(-10, -1, 0, -10, 10, -1);
  g.fillRoundedRect(-7, -2, 14, 11, 2);
  g.fillStyle(0xffffff, 0.9);
  g.fillRoundedRect(-2, 3, 4, 6, 1);
};

export const iconLock: IconDrawer = (g, c) => {
  g.lineStyle(2.6, c, 1);
  strokeArc(g, 0, -3, 5, 180, 360, 10);
  g.lineBetween(-5, -3, -5, 0);
  g.lineBetween(5, -3, 5, 0);
  g.fillStyle(c, 1);
  g.fillRoundedRect(-7.5, -1, 15, 11, 3);
};

export const iconPlay: IconDrawer = (g, c) => {
  g.fillStyle(c, 1);
  g.fillTriangle(-5, -8, -5, 8, 8, 0);
};
