import Phaser from 'phaser';
import type { GameState } from '../core/types';
import { JUICE } from '../config/tuning';
import { COLORS, RADIUS, hexToNum } from './theme';
import { starPoints } from './gameHud';
import { t } from '../i18n/translations';
import type { Language } from '../i18n/translations';
import type { Layout } from './gameTypes';

/** GameAnimations'ın sahneden ihtiyaç duyduğu her şey (dar arayüz). `get*` fonksiyonları her
 * çağrıda canlı değeri okur -- GameScene'in o anki (sürekli değişen) durumunu yansıtır. */
export interface JuiceFxHost {
  readonly scene: Phaser.Scene;
  getLayout: (containerId: string) => Layout | undefined;
  getItemsLayerChildren: () => Phaser.GameObjects.Container[];
  getGameState: () => GameState;
  getSlotHeight: () => number;
  getStarAnchor: () => { x: number; y: number };
  getLang: () => Language;
  spawnItemVisual: (type: string, x: number, y: number) => Phaser.GameObjects.Container;
}

/** Kap tamamlama/geçersiz hamle/kilit açma gibi "juice" (tatmin edici geri bildirim) efektleri +
 * hamle sırasındaki uçuş/sıçrama/sürükleme animasyonları + boşta göz kırpma. */
export class GameJuiceFx {
  private readonly host: JuiceFxHost;

  constructor(host: JuiceFxHost) {
    this.host = host;
  }

  flashUnlock(containerId: string): void {
    const layout = this.host.getLayout(containerId);
    if (!layout) return;
    const scene = this.host.scene;
    const ring = scene.add.circle(layout.centerX, layout.topY + layout.rect.height / 2, 14, hexToNum(COLORS.gold), 0.9);
    scene.tweens.add({
      targets: ring,
      radius: 90,
      alpha: 0,
      duration: JUICE.unlock.duration,
      onComplete: () => ring.destroy(),
    });
  }

  flashInvalid(containerId: string): void {
    const layout = this.host.getLayout(containerId);
    if (!layout) return;
    const scene = this.host.scene;
    const g = scene.add.graphics();
    g.lineStyle(5, hexToNum(COLORS.danger), 1);
    g.strokeRoundedRect(layout.rect.x, layout.rect.y, layout.rect.width, layout.rect.height, RADIUS.lg);
    scene.tweens.add({
      targets: g,
      alpha: 0,
      duration: JUICE.invalid.duration,
      onComplete: () => g.destroy(),
    });
  }

  flashCompletion(containerId: string): void {
    const layout = this.host.getLayout(containerId);
    if (!layout) return;
    const scene = this.host.scene;
    const cx = layout.centerX;
    const cy = layout.topY + layout.rect.height / 2;

    const flash = scene.add.graphics();
    flash.fillStyle(0xffffff, 0.65);
    flash.fillRoundedRect(layout.rect.x, layout.rect.y, layout.rect.width, layout.rect.height, RADIUS.lg);
    scene.tweens.add({ targets: flash, alpha: 0, duration: 320, onComplete: () => flash.destroy() });

    const burst = scene.add.circle(cx, cy, 10, hexToNum(COLORS.coral), 0.8);
    scene.tweens.add({
      targets: burst,
      radius: 70,
      alpha: 0,
      duration: JUICE.completion.particleDuration,
      onComplete: () => burst.destroy(),
    });

    const particleColors = [COLORS.coral, COLORS.turquoise, COLORS.mustard, COLORS.pink];
    for (let i = 0; i < JUICE.completion.particleCount; i++) {
      const angle = (Math.PI * 2 * i) / JUICE.completion.particleCount + Math.random() * 0.4;
      const speed =
        JUICE.completion.particleSpeedMin +
        Math.random() * (JUICE.completion.particleSpeedMax - JUICE.completion.particleSpeedMin);
      const particle = scene.add.circle(cx, cy, 4, hexToNum(particleColors[i % particleColors.length]), 1);
      scene.tweens.add({
        targets: particle,
        x: cx + Math.cos(angle) * speed,
        y: cy + Math.sin(angle) * speed,
        alpha: 0,
        duration: JUICE.completion.particleDuration,
        ease: 'Cubic.easeOut',
        onComplete: () => particle.destroy(),
      });
    }

    this.flyStarsToCounter(cx, cy);
    scene.cameras.main.shake(JUICE.completion.cameraShakeDuration, JUICE.completion.cameraShakeIntensity);
  }

  /** Tamamlanan kaptan küçük yıldızlar fırlayıp üstteki yıldız ikonuna doğru uçar (sadece görsel şenlik). */
  private flyStarsToCounter(fromX: number, fromY: number): void {
    const scene = this.host.scene;
    for (let i = 0; i < JUICE.starFly.starCount; i++) {
      scene.time.delayedCall(i * JUICE.starFly.staggerMs, () => {
        const star = scene.add.graphics({ x: fromX, y: fromY });
        star.fillStyle(hexToNum(COLORS.gold), 1);
        star.fillPoints(starPoints(7), true);

        const progress = { t: 0 };
        const anchor = this.host.getStarAnchor();
        scene.tweens.add({
          targets: progress,
          t: 1,
          duration: JUICE.starFly.duration,
          ease: 'Cubic.easeIn',
          onUpdate: () => {
            const tt = progress.t;
            star.x = Phaser.Math.Linear(fromX, anchor.x, tt);
            star.y = Phaser.Math.Linear(fromY, anchor.y, tt) - JUICE.starFly.arcHeight * Math.sin(Math.PI * tt);
            star.setScale(1 - tt * 0.5);
          },
          onComplete: () => star.destroy(),
        });
      });
    }
  }

  comboTextFor(combo: number): string {
    const lang = this.host.getLang();
    if (combo >= 4) return t('comboText4Plus', lang);
    if (combo === 3) return t('comboText3', lang);
    return t('comboText2', lang);
  }

  showCombo(containerId: string, combo: number): void {
    const layout = this.host.getLayout(containerId);
    if (!layout) return;
    const scene = this.host.scene;
    const lang = this.host.getLang();
    const text = scene.add
      .text(layout.centerX, layout.topY - 10, `${t('comboLabel', lang, { n: combo })} ${this.comboTextFor(combo)}`, {
        fontFamily: 'Fredoka, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: COLORS.coral,
        stroke: '#ffffff',
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    scene.tweens.add({
      targets: text,
      y: layout.topY - 10 - JUICE.combo.riseDistance,
      alpha: 0,
      duration: JUICE.combo.displayDuration,
      onComplete: () => text.destroy(),
    });
  }

  /** Kaynaktan hedefe tek bir temsili "yongayı" yay çizerek uçurur; iniş anında gerçek render devralır. */
  animateMove(sourceId: string, targetId: string, movedType: string, movedCount: number, onComplete: () => void): void {
    const sourceLayout = this.host.getLayout(sourceId);
    const targetLayout = this.host.getLayout(targetId);
    if (!sourceLayout || !targetLayout) {
      onComplete();
      return;
    }

    const scene = this.host.scene;
    const slotHeight = this.host.getSlotHeight();
    const gameState = this.host.getGameState();
    const oldSource = gameState.containers.find((c) => c.id === sourceId)!;
    const oldTarget = gameState.containers.find((c) => c.id === targetId)!;

    const startX = sourceLayout.centerX;
    const startY = sourceLayout.topY + (oldSource.capacity - oldSource.items.length) * slotHeight + slotHeight / 2;

    const landingIndex = oldTarget.items.length + movedCount - 1;
    const endX = targetLayout.centerX;
    const endY = targetLayout.topY + (oldTarget.capacity - 1 - landingIndex) * slotHeight + slotHeight / 2;

    // Uçuşta çakışma olmaması için kaynaktaki (henüz gerçek state'ten silinmemiş) taşınan
    // itemlerin görsellerini geçici olarak gizle -- uçuş bitince zaten tam render() devralıyor.
    const minHiddenIndex = Math.max(0, oldSource.items.length - movedCount);
    const children = this.host.getItemsLayerChildren();
    for (const child of children) {
      if (child.getData('containerId') !== sourceId) continue;
      const idx = child.getData('stackIndex') as number;
      if (idx >= minHiddenIndex) child.setVisible(false);
    }

    const chip = this.host.spawnItemVisual(movedType, startX, startY);
    if (movedCount > 1) {
      const badge = scene.add
        .text(16, -14, `×${movedCount}`, {
          fontFamily: 'Fredoka, sans-serif',
          fontSize: '12px',
          fontStyle: 'bold',
          color: '#ffffff',
          backgroundColor: COLORS.ink,
          padding: { x: 4, y: 1 },
        })
        .setOrigin(0.5);
      chip.add(badge);
    }

    const progress = { t: 0 };
    scene.tweens.add({
      targets: progress,
      t: 1,
      duration: JUICE.move.duration,
      ease: 'Quad.easeInOut',
      onUpdate: () => {
        const tt = progress.t;
        const x = Phaser.Math.Linear(startX, endX, tt);
        const y = Phaser.Math.Linear(startY, endY, tt) - JUICE.move.arcHeight * Math.sin(Math.PI * tt);
        chip.setPosition(x, y);
      },
      onComplete: () => {
        chip.destroy();
        onComplete();
      },
    });
  }

  /** Hedefte yeni yerleşen itemlerin squash & stretch sıçraması. */
  playLandBounce(containerId: string, movedCount: number): void {
    const gameState = this.host.getGameState();
    const container = gameState.containers.find((c) => c.id === containerId);
    if (!container) return;
    const minIndex = Math.max(0, container.items.length - movedCount);

    const scene = this.host.scene;
    const children = this.host.getItemsLayerChildren();
    for (const child of children) {
      if (child.getData('containerId') !== containerId) continue;
      const idx = child.getData('stackIndex') as number;
      if (idx < minIndex) continue;
      child.setScale(JUICE.land.squashScaleX, JUICE.land.squashScaleY);
      scene.tweens.add({
        targets: child,
        scaleX: 1,
        scaleY: 1,
        duration: JUICE.land.duration,
        ease: 'Back.easeOut',
      });
    }
  }

  /** Sürükleme sırasında kaynağın üst run'ını pointer ile birlikte öteler. */
  moveRunVisual(containerId: string, dx: number, dy: number): void {
    const children = this.host.getItemsLayerChildren();
    for (const child of children) {
      if (child.getData('containerId') === containerId && child.getData('inDragRun') === true) {
        child.setPosition(child.getData('baseX') + dx, child.getData('baseY') + dy);
      }
    }
  }

  scheduleBlink(): void {
    const scene = this.host.scene;
    const delay = Phaser.Math.Between(JUICE.blink.everyMsMin, JUICE.blink.everyMsMax);
    scene.time.delayedCall(delay, () => {
      this.blinkRandomTopItem();
      this.scheduleBlink();
    });
  }

  private blinkRandomTopItem(): void {
    const children = this.host.getItemsLayerChildren();
    const topVisibles = children.filter((c) => c.visible && c.getData('isTop') === true && c.getData('setEyeState'));
    if (topVisibles.length === 0) return;
    const target = Phaser.Utils.Array.GetRandom(topVisibles) as Phaser.GameObjects.Container;
    const setEyeState = target.getData('setEyeState') as ((s: 'open' | 'closed') => void) | undefined;
    if (!setEyeState) return;
    setEyeState('closed');
    this.host.scene.time.delayedCall(JUICE.blink.closeDuration + JUICE.blink.holdDuration, () => setEyeState('open'));
  }
}
