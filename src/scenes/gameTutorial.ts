import Phaser from 'phaser';
import type { GameState } from '../core/types';
import { tryMove } from '../core/gameLogic';
import { JUICE } from '../config/tuning';
import { COLORS, EASE, hexToNum, shadeHex } from './theme';
import { bakeCentered } from './bake';
import type { Layout } from './gameTypes';

/** Eski WebView'lerde ctx.roundRect yok -- arcTo ile eşdeğer yol. */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** GameTutorial'ın sahneden ihtiyaç duyduğu her şey (dar arayüz). */
export interface TutorialHost {
  readonly scene: Phaser.Scene;
  getGameState: () => GameState;
  getLayout: (containerId: string) => Layout | undefined;
  getSlotHeight: () => number;
  isAnimating: () => boolean;
  /** Kaynak/hedef kabı yumuşakça vurgular (ContainerView.setHint). */
  setHint: (containerId: string, on: boolean) => void;
}

/**
 * Metinsiz el öğreticisi (Faz 6 ile yenilendi): kaynak ve hedef kap nabız atarak parlar, el kaynağa
 * DOKUNUR (dokunma halkası), yay çizerek hedefe gider ve tekrar dokunur -- "buna dokun, sonra şuna"
 * akışını yazı olmadan anlatır. Oyuncu gerçek bir dokunuş yaptığı an (cancel) kesilir.
 * İlk seviyede bir kez otomatik; ilk seviyelerde oyuncu bir süre hareketsiz kalırsa ipucu olarak
 * yeniden çağrılır (bkz. GameScene.scheduleIdleHint).
 */
export class TutorialController {
  private active = false;
  private hand?: Phaser.GameObjects.Image;
  private timers: Phaser.Time.TimerEvent[] = [];
  private hinted: string[] = [];

  private readonly host: TutorialHost;

  constructor(host: TutorialHost) {
    this.host = host;
  }

  get isActive(): boolean {
    return this.active;
  }

  /** Oynanabilir ilk hamleyi bulur; dolu hedefi (aynı türün üstüne koyma) tercih eder -- kuralı
   * en açık gösteren hamle. */
  private findTutorialMove(): { sourceId: string; targetId: string } | null {
    const state = this.host.getGameState();
    let fallback: { sourceId: string; targetId: string } | null = null;
    for (const source of state.containers) {
      if (source.items.length === 0) continue;
      for (const target of state.containers) {
        if (target.id === source.id) continue;
        if (!tryMove(state, { sourceId: source.id, targetId: target.id }).ok) continue;
        if (target.items.length > 0) return { sourceId: source.id, targetId: target.id };
        fallback ??= { sourceId: source.id, targetId: target.id };
      }
    }
    return fallback;
  }

  private handKey(): string {
    return bakeCentered(this.host.scene, 'tutorial-hand', { width: 64, height: 76 }, (_g, ctx) => {
      const s = ctx.getTransform().a;
      const skin = COLORS.skin;
      const edge = shadeHex(skin, -0.28);
      const finger = () => {
        roundRect(ctx, -6, -34, 13, 34, 6.5);
      };
      const palm = () => {
        roundRect(ctx, -17, -6, 34, 30, 12);
      };
      ctx.save();
      ctx.shadowColor = 'rgba(90,58,44,0.3)';
      ctx.shadowBlur = 6 * s;
      ctx.shadowOffsetY = 3 * s;
      ctx.fillStyle = skin;
      finger();
      ctx.fill();
      palm();
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1.6;
      finger();
      ctx.stroke();
      palm();
      ctx.stroke();
      // tırnak + parmak boğumları
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.ellipse(0.5, -28, 3.6, 4.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1.2;
      for (const x of [-9, -1, 7]) {
        ctx.beginPath();
        ctx.moveTo(x, -2);
        ctx.lineTo(x, 6);
        ctx.stroke();
      }
      // manşet
      ctx.fillStyle = COLORS.terracotta;
      roundRect(ctx, -18, 20, 36, 12, 5);
      ctx.fill();
    });
  }

  /** Parmak ucunda genişleyip sönen dokunma halkası. */
  private ripple(x: number, y: number): void {
    const scene = this.host.scene;
    const ring = scene.add.circle(x, y, 10).setStrokeStyle(3, hexToNum(COLORS.cream), 0.9).setDepth(399);
    scene.tweens.add({ targets: ring, radius: 34, alpha: 0, duration: 420, ease: EASE.out, onComplete: () => ring.destroy() });
  }

  start(): void {
    if (this.active || this.host.isAnimating()) return;
    const move = this.findTutorialMove();
    if (!move) return;
    const sourceLayout = this.host.getLayout(move.sourceId);
    const targetLayout = this.host.getLayout(move.targetId);
    if (!sourceLayout || !targetLayout) return;

    const scene = this.host.scene;
    this.active = true;
    this.hinted = [move.sourceId, move.targetId];
    this.host.setHint(move.sourceId, true);
    this.host.setHint(move.targetId, true);

    const point = (l: Layout) => ({ x: l.centerX, y: l.topY + l.rect.height * 0.55 });
    const from = point(sourceLayout);
    const to = point(targetLayout);
    // parmak ucu doku merkezinin ~32 px üstünde: el, ucu noktaya değecek şekilde konumlanır
    const TIP = 32;
    const hand = scene.add.image(from.x + 30, from.y + TIP + 40, this.handKey()).setDisplaySize(64, 76).setDepth(400).setAlpha(0);
    this.hand = hand;

    const tap = (at: { x: number; y: number }) => {
      if (!this.active) return;
      scene.tweens.add({ targets: hand, y: at.y + TIP + 6, duration: JUICE.tutorialHand.pressDuration * 0.6, yoyo: true, ease: EASE.inOut });
      scene.time.delayedCall(JUICE.tutorialHand.pressDuration * 0.6, () => {
        if (this.active) this.ripple(at.x, at.y);
      });
    };

    const runCycle = () => {
      if (!this.active) return;
      hand.setPosition(from.x + 30, from.y + TIP + 40).setAlpha(0).setAngle(-12);
      scene.tweens.add({ targets: hand, alpha: 1, x: from.x, y: from.y + TIP, angle: 0, duration: 380, ease: EASE.out });
      const t1 = scene.time.delayedCall(420, () => tap(from));
      const travel = scene.time.delayedCall(420 + 360, () => {
        if (!this.active) return;
        const progress = { t: 0 };
        scene.tweens.add({
          targets: progress,
          t: 1,
          duration: JUICE.tutorialHand.travelDuration + 120,
          ease: EASE.inOut,
          onUpdate: () => {
            const tt = progress.t;
            hand.x = Phaser.Math.Linear(from.x, to.x, tt);
            hand.y = Phaser.Math.Linear(from.y, to.y, tt) + TIP - 60 * Math.sin(Math.PI * tt);
          },
        });
      });
      const t2At = 420 + 360 + JUICE.tutorialHand.travelDuration + 140;
      const t2 = scene.time.delayedCall(t2At, () => tap(to));
      const fade = scene.time.delayedCall(t2At + 520, () => {
        if (this.active) scene.tweens.add({ targets: hand, alpha: 0, y: hand.y + 20, duration: 260, ease: EASE.in });
      });
      const loop = scene.time.delayedCall(t2At + 520 + 260 + JUICE.tutorialHand.cycleGapMs, runCycle);
      this.timers.push(t1, travel, t2, fade, loop);
    };

    runCycle();
  }

  cancel(): void {
    if (!this.active) return;
    this.active = false;
    for (const timer of this.timers) timer.remove(false);
    this.timers = [];
    for (const id of this.hinted) this.host.setHint(id, false);
    this.hinted = [];
    if (this.hand) {
      this.host.scene.tweens.killTweensOf(this.hand);
      this.hand.destroy();
    }
    this.hand = undefined;
  }
}
