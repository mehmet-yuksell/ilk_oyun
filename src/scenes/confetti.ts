import Phaser from 'phaser';
import { CONFETTI, PALETTE, type ConfettiShape } from '../config/tuning';
import { hexToNum } from './theme';

interface PoolItem {
  readonly gfx: Phaser.GameObjects.Graphics;
  inUse: boolean;
}

/**
 * Havuzlanmış (object pool) konfeti sistemi: iki alt köşeden "top" + üstten yağmur, 4 şekil
 * (dikdörtgen/daire/yıldız/şerit), dönerek düşer. Seviye/oda tamamlanınca GameScene ve RoomScene
 * tarafından paylaşılır -- her patlamada yeni Graphics oluşturmak yerine aynı havuzu geri kullanır.
 */
export class ConfettiEmitter {
  private readonly scene: Phaser.Scene;
  private readonly pool: PoolItem[] = [];
  private readonly colors: readonly number[];
  private readonly depth: number;

  constructor(scene: Phaser.Scene, depth = 500) {
    this.scene = scene;
    this.depth = depth;
    this.colors = [
      PALETTE.coral,
      PALETTE.turquoise,
      PALETTE.mustard,
      PALETTE.purple,
      PALETTE.green,
      PALETTE.pink,
      PALETTE.sky,
      PALETTE.amber,
    ].map(hexToNum);
  }

  private acquire(): Phaser.GameObjects.Graphics {
    let item = this.pool.find((p) => !p.inUse);
    if (!item) {
      if (this.pool.length < CONFETTI.poolSize) {
        item = { gfx: this.scene.add.graphics().setDepth(this.depth), inUse: false };
        this.pool.push(item);
      } else {
        item = this.pool[Phaser.Math.Between(0, this.pool.length - 1)];
      }
    }
    item.inUse = true;
    item.gfx.setVisible(true).setActive(true).setAlpha(1);
    return item.gfx;
  }

  private release(gfx: Phaser.GameObjects.Graphics): void {
    gfx.setVisible(false).setActive(false);
    const item = this.pool.find((p) => p.gfx === gfx);
    if (item) item.inUse = false;
  }

  private drawShape(gfx: Phaser.GameObjects.Graphics, shape: ConfettiShape, color: number, size: number): void {
    gfx.clear();
    gfx.fillStyle(color, 1);
    if (shape === 'rect') {
      gfx.fillRect(-size / 2, -size * 0.3, size, size * 0.6);
    } else if (shape === 'circle') {
      gfx.fillCircle(0, 0, size * 0.42);
    } else if (shape === 'ribbon') {
      gfx.fillRect(-size * 0.16, -size * 0.5, size * 0.32, size);
    } else {
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i < 10; i++) {
        const angle = (Math.PI / 5) * i - Math.PI / 2;
        const r = i % 2 === 0 ? size * 0.5 : size * 0.22;
        pts.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
      }
      gfx.fillPoints(pts, true);
    }
  }

  private randomShape(): ConfettiShape {
    return CONFETTI.shapes[Phaser.Math.Between(0, CONFETTI.shapes.length - 1)];
  }

  private randomColor(): number {
    return this.colors[Phaser.Math.Between(0, this.colors.length - 1)];
  }

  private spawnCannonPiece(width: number, height: number, fromLeft: boolean): void {
    const gfx = this.acquire();
    const size = Phaser.Math.Between(8, 14);
    this.drawShape(gfx, this.randomShape(), this.randomColor(), size);

    const startX = fromLeft ? 0 : width;
    const dirX = fromLeft ? 1 : -1;
    gfx.setPosition(startX, height).setAngle(Phaser.Math.Between(0, 360));

    const targetX = startX + dirX * Phaser.Math.Between(width * 0.22, width * 0.55);
    const fallY = height + Phaser.Math.Between(20, 50);
    const arcHeight = Phaser.Math.Between(height * 0.3, height * 0.58);
    const duration = Phaser.Math.Between(CONFETTI.fallDurationMinMs, CONFETTI.fallDurationMaxMs);
    const spin = Phaser.Math.Between(CONFETTI.spinDegPerSecMin, CONFETTI.spinDegPerSecMax) * dirX;

    const progress = { t: 0 };
    this.scene.tweens.add({
      targets: progress,
      t: 1,
      duration,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        const tt = progress.t;
        gfx.x = Phaser.Math.Linear(startX, targetX, tt);
        gfx.y = Phaser.Math.Linear(height, fallY, tt) - arcHeight * Math.sin(Math.PI * tt);
        gfx.angle += (spin * 16) / 1000;
        if (tt > 0.82) gfx.alpha = 1 - (tt - 0.82) / 0.18;
      },
      onComplete: () => this.release(gfx),
    });
  }

  private spawnRainPiece(width: number, height: number): void {
    const gfx = this.acquire();
    const size = Phaser.Math.Between(7, 13);
    this.drawShape(gfx, this.randomShape(), this.randomColor(), size);

    const x = Phaser.Math.Between(10, Math.max(10, width - 10));
    gfx.setPosition(x, -20).setAngle(Phaser.Math.Between(0, 360));
    const duration = Phaser.Math.Between(CONFETTI.fallDurationMinMs, CONFETTI.fallDurationMaxMs + 400);
    const spin = Phaser.Math.Between(CONFETTI.spinDegPerSecMin, CONFETTI.spinDegPerSecMax) * (Math.random() < 0.5 ? 1 : -1);
    const drift = Phaser.Math.Between(-28, 28);
    const delay = Phaser.Math.Between(0, 320);

    this.scene.time.delayedCall(delay, () => {
      if (!gfx.active) return;
      const progress = { t: 0 };
      this.scene.tweens.add({
        targets: progress,
        t: 1,
        duration,
        ease: 'Sine.easeIn',
        onUpdate: () => {
          const tt = progress.t;
          gfx.y = Phaser.Math.Linear(-20, height + 20, tt);
          gfx.x = x + drift * Math.sin(tt * Math.PI * 2);
          gfx.angle += (spin * 16) / 1000;
        },
        onComplete: () => this.release(gfx),
      });
    });
  }

  /**
   * Seviye/oda tamamlanınca: iki alt köşeden konfeti topu + üstten yağmur.
   * `reduced` true ise (prefers-reduced-motion) parça sayısı azaltılır.
   */
  burst(width: number, height: number, reduced: boolean): void {
    const total = reduced ? CONFETTI.reducedMotionParticleCount : CONFETTI.defaultParticleCount;
    const cannonTotal = Math.round(total * CONFETTI.cannonShare);
    const rainTotal = Math.max(0, total - cannonTotal);

    for (let i = 0; i < cannonTotal; i++) {
      this.spawnCannonPiece(width, height, i % 2 === 0);
    }
    for (let i = 0; i < rainTotal; i++) {
      this.spawnRainPiece(width, height);
    }
  }

  destroy(): void {
    for (const item of this.pool) item.gfx.destroy();
    this.pool.length = 0;
  }
}

/** Tarayıcının `prefers-reduced-motion: reduce` tercihini okur (SSR/test ortamında güvenle false döner). */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
