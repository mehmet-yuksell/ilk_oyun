import Phaser from 'phaser';
import type { GameState } from '../core/types';
import { tryMove } from '../core/gameLogic';
import { JUICE } from '../config/tuning';
import { hexToNum, shade } from './theme';
import type { Layout } from './gameTypes';

/** GameTutorial'ın sahneden ihtiyaç duyduğu her şey (dar arayüz -- gerçek GameScene bunu
 * doğal olarak sağlar, test/yeniden kullanım için ayrıca sahtelenebilir). */
export interface TutorialHost {
  readonly scene: Phaser.Scene;
  getGameState: () => GameState;
  getLayout: (containerId: string) => Layout | undefined;
  getSlotHeight: () => number;
  isAnimating: () => boolean;
}

/**
 * İlk seviyede (bir kere, bkz. GameScene.create()'teki seenHints kontrolü) kaynaktan hedefe giden
 * animasyonlu bir el gösterip geçerli bir hamleyi örnekler -- metin YOK, yalnızca görsel.
 * Oyuncu gerçek bir dokunuş yaptığı an (bkz. cancel()) animasyon kesilir.
 */
export class TutorialController {
  private active = false;
  private hand?: Phaser.GameObjects.Container;
  private timers: Phaser.Time.TimerEvent[] = [];

  private readonly host: TutorialHost;

  constructor(host: TutorialHost) {
    this.host = host;
  }

  get isActive(): boolean {
    return this.active;
  }

  /** Oynanabilir ilk hamleyi (herhangi bir dolu kaynaktan herhangi bir geçerli hedefe) bulur. */
  private findTutorialMove(): { sourceId: string; targetId: string } | null {
    const containers = this.host.getGameState().containers;
    for (const source of containers) {
      if (source.items.length === 0) continue;
      for (const target of containers) {
        if (target.id === source.id) continue;
        if (tryMove(this.host.getGameState(), { sourceId: source.id, targetId: target.id }).ok) {
          return { sourceId: source.id, targetId: target.id };
        }
      }
    }
    return null;
  }

  start(): void {
    if (this.host.isAnimating()) return;
    const move = this.findTutorialMove();
    if (!move) return;
    const sourceLayout = this.host.getLayout(move.sourceId);
    const targetLayout = this.host.getLayout(move.targetId);
    if (!sourceLayout || !targetLayout) return;

    const scene = this.host.scene;
    const slotHeight = this.host.getSlotHeight();
    this.active = true;
    const sourcePoint = {
      x: sourceLayout.centerX,
      y: sourceLayout.topY + sourceLayout.rect.height - slotHeight / 2,
    };
    const targetPoint = {
      x: targetLayout.centerX,
      y: targetLayout.topY + targetLayout.rect.height - slotHeight / 2,
    };

    const hand = this.drawHandGlyph();
    hand.setPosition(sourcePoint.x, sourcePoint.y);
    hand.setAlpha(0);
    this.hand = hand;

    const runCycle = () => {
      if (!this.active) return;
      hand.setPosition(sourcePoint.x, sourcePoint.y);
      hand.setScale(1);
      scene.tweens.add({ targets: hand, alpha: 1, duration: 200 });
      const press1 = scene.time.delayedCall(260, () => {
        if (!this.active) return;
        scene.tweens.add({ targets: hand, scaleX: 0.85, scaleY: 0.85, duration: JUICE.tutorialHand.pressDuration, yoyo: true });
      });
      const travel = scene.time.delayedCall(560, () => {
        if (!this.active) return;
        const progress = { t: 0 };
        scene.tweens.add({
          targets: progress,
          t: 1,
          duration: JUICE.tutorialHand.travelDuration,
          ease: 'Sine.easeInOut',
          onUpdate: () => {
            const tt = progress.t;
            hand.x = Phaser.Math.Linear(sourcePoint.x, targetPoint.x, tt);
            hand.y = Phaser.Math.Linear(sourcePoint.y, targetPoint.y, tt) - 50 * Math.sin(Math.PI * tt);
          },
        });
      });
      const press2 = scene.time.delayedCall(560 + JUICE.tutorialHand.travelDuration, () => {
        if (!this.active) return;
        scene.tweens.add({ targets: hand, scaleX: 0.85, scaleY: 0.85, duration: JUICE.tutorialHand.pressDuration, yoyo: true });
      });
      const fade = scene.time.delayedCall(560 + JUICE.tutorialHand.travelDuration + JUICE.tutorialHand.holdDuration, () => {
        if (!this.active) return;
        scene.tweens.add({ targets: hand, alpha: 0, duration: 200 });
      });
      const loop = scene.time.delayedCall(
        560 + JUICE.tutorialHand.travelDuration + JUICE.tutorialHand.holdDuration + 200 + JUICE.tutorialHand.cycleGapMs,
        runCycle,
      );
      this.timers.push(press1, travel, press2, fade, loop);
    };

    runCycle();
  }

  private drawHandGlyph(): Phaser.GameObjects.Container {
    const scene = this.host.scene;
    const g = scene.add.graphics();
    const skin = hexToNum('#F2C49B');
    g.fillStyle(0x000000, 0.18);
    g.fillEllipse(2, 24, 26, 10);
    g.fillStyle(skin, 1);
    g.fillRoundedRect(-14, -4, 26, 26, 10);
    g.fillRoundedRect(-4, -28, 11, 28, 5);
    g.fillCircle(1.5, -28, 5.5);
    g.lineStyle(2, shade('#F2C49B', -0.25), 0.6);
    g.strokeRoundedRect(-14, -4, 26, 26, 10);
    return scene.add.container(0, 0, [g]).setDepth(400);
  }

  cancel(): void {
    if (!this.active) return;
    this.active = false;
    for (const timer of this.timers) timer.remove(false);
    this.timers = [];
    this.hand?.destroy();
    this.hand = undefined;
  }
}
