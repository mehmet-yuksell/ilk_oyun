import type Phaser from 'phaser';

/** Bir kabın ekran üzerindeki dikdörtgeni + türetilmiş yardımcı noktalar (bkz. GameScene.computeLayouts). */
export interface Layout {
  readonly rect: Phaser.Geom.Rectangle;
  readonly centerX: number;
  readonly topY: number;
}

/** Alt/Ekstra Kap gibi etkinleştirilebilir/devre dışı bırakılabilir, etiketi değişebilir butonlar
 * için ortak arayüz (bkz. gameHud.ts). */
export interface Button {
  readonly setEnabled: (enabled: boolean) => void;
  readonly setLabel: (label: string) => void;
}

export interface ActiveObstacles {
  readonly mystery: boolean;
  readonly lock: boolean;
  readonly typeLock: boolean;
}

export type SessionMode = 'progress' | 'daily' | 'debug' | 'demo';
export type FeedbackKind = 'tap' | 'land' | 'complete' | 'invalid' | 'medium';
