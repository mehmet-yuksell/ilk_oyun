import Phaser from 'phaser';
import type { GameState } from '../core/types';
import { JUICE } from '../config/tuning';
import { COLORS, EASE, FONT_FAMILY, RADIUS, hexToNum } from './theme';
import { bakeCentered } from './bake';
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
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        fontStyle: '800',
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

  /** Seçilen run'daki bir eşya: Back.Out ile kalkar, sonra hafifçe süzülüp sallanır; rafta kalan
   * gölgesi küçülüp solar (eşyanın havada olduğunu gösterir), yüzü "heyecanlı" olur. */
  liftItem(visual: Phaser.GameObjects.Container, indexInRun: number): void {
    const scene = this.host.scene;
    const sprite = visual.getData('sprite') as Phaser.GameObjects.Container | undefined;
    const shadow = visual.getData('shadow') as Phaser.GameObjects.Image | undefined;
    const foot = visual.getData('foot') as number;
    if (!sprite) return;
    (visual.getData('setExcited') as ((v: boolean) => void) | undefined)?.(true);
    const lifted = foot - JUICE.select.liftDistance;
    const delay = indexInRun * 35;
    scene.tweens.add({
      targets: sprite,
      y: lifted,
      duration: JUICE.select.duration,
      delay,
      ease: EASE.back,
      onComplete: () => {
        scene.tweens.add({ targets: sprite, y: lifted - 3, duration: 820, yoyo: true, repeat: -1, ease: EASE.inOut });
        scene.tweens.add({ targets: sprite, angle: { from: -2, to: 2 }, duration: 1100, yoyo: true, repeat: -1, ease: EASE.inOut });
      },
    });
    if (shadow) {
      const sx = visual.getData('shadowScaleX') as number;
      const sy = visual.getData('shadowScaleY') as number;
      scene.tweens.add({ targets: shadow, scaleX: sx * 0.72, scaleY: sy * 0.72, alpha: 0.55, duration: JUICE.select.duration, delay, ease: EASE.out });
    }
  }

  /** Boştaki en üst eşyanın "nefes alması": ayak noktasından hafifçe uzayıp kısalır (her biri farklı fazda). */
  breathe(visual: Phaser.GameObjects.Container): void {
    const sprite = visual.getData('sprite') as Phaser.GameObjects.Container | undefined;
    if (!sprite) return;
    this.host.scene.tweens.add({
      targets: sprite,
      scaleY: 1 + JUICE.idle.scaleAmount,
      scaleX: 1 - JUICE.idle.scaleAmount * 0.4,
      duration: Phaser.Math.Between(JUICE.idle.durationMin, JUICE.idle.durationMax),
      delay: Phaser.Math.Between(0, 500),
      yoyo: true,
      repeat: -1,
      ease: EASE.inOut,
    });
  }

  /**
   * Taşınan run'daki HER eşya ayrı ayrı, kısa aralıklarla yay çizerek uçar (eskiden tek bir "×N"
   * yongası uçuyordu). Uçuşta hıza göre esneme + yöne doğru hafif eğilme, varışta tabandan ezilme;
   * son eşya inince gerçek render devralır ve playLandBounce ezilmeyi Back.Out ile toparlar.
   */
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
    const splitIndex = Math.max(0, oldSource.items.length - movedCount);

    // Kaynaktaki taşınan görseller gizlenir (uçan kopyalar devralır); kalkmış pozlarından başlanır.
    const startOffset = new Map<number, number>();
    for (const child of this.host.getItemsLayerChildren()) {
      if (child.getData('containerId') !== sourceId) continue;
      const idx = child.getData('stackIndex') as number;
      if (idx < splitIndex) continue;
      const sprite = child.getData('sprite') as Phaser.GameObjects.Container | undefined;
      const foot = child.getData('foot') as number;
      startOffset.set(idx, sprite ? sprite.y - foot : 0);
      child.setVisible(false);
    }

    const slotCenter = (topY: number, capacity: number, index: number) => topY + (capacity - 1 - index) * slotHeight + slotHeight / 2;
    let remaining = movedCount;
    for (let k = 0; k < movedCount; k++) {
      const fromIndex = splitIndex + k;
      const toIndex = oldTarget.items.length + k;
      const sx = sourceLayout.centerX;
      const sy = slotCenter(sourceLayout.topY, oldSource.capacity, fromIndex) + (startOffset.get(fromIndex) ?? 0);
      const ex = targetLayout.centerX;
      const ey = slotCenter(targetLayout.topY, oldTarget.capacity, toIndex);
      const dx = ex - sx;
      const arc = JUICE.move.arcHeight + Math.min(60, Math.abs(dx) * 0.12) + Math.max(0, sy - ey) * 0.15;

      const chip = this.host.spawnItemVisual(movedType, sx, sy).setDepth(150);
      const sprite = chip.getData('sprite') as Phaser.GameObjects.Container;
      const shadow = chip.getData('shadow') as Phaser.GameObjects.Image;
      shadow.setAlpha(0);
      (chip.getData('setExcited') as (v: boolean) => void)(true);

      const progress = { t: 0 };
      scene.tweens.add({
        targets: progress,
        t: 1,
        duration: JUICE.move.duration,
        delay: k * JUICE.move.staggerMs,
        ease: EASE.inOut,
        onUpdate: () => {
          const tt = progress.t;
          const lift = Math.sin(Math.PI * tt);
          chip.setPosition(Phaser.Math.Linear(sx, ex, tt), Phaser.Math.Linear(sy, ey, tt) - arc * lift);
          sprite.setScale(1 - 0.07 * lift, 1 + JUICE.move.stretch * lift);
          sprite.setAngle(Math.sign(dx) * 9 * lift);
        },
        onComplete: () => {
          sprite.setAngle(0);
          scene.tweens.add({
            targets: sprite,
            scaleX: JUICE.land.squashScaleX,
            scaleY: JUICE.land.squashScaleY,
            duration: 60,
            ease: EASE.out,
            onComplete: () => {
              chip.destroy();
              remaining--;
              if (remaining === 0) onComplete();
            },
          });
        },
      });
    }
  }

  /** Hedefte yeni yerleşen eşyalar: ezik pozdan Back.Out ile toparlanır ("pop"), gölgesi bir an yayılır,
   * en üsttekinin ayağından yumuşak bir halka dalgası çıkar. Alttan üste kısa domino gecikmesi. */
  playLandBounce(containerId: string, movedCount: number): void {
    const gameState = this.host.getGameState();
    const container = gameState.containers.find((c) => c.id === containerId);
    if (!container) return;
    const minIndex = Math.max(0, container.items.length - movedCount);

    const scene = this.host.scene;
    for (const child of this.host.getItemsLayerChildren()) {
      if (child.getData('containerId') !== containerId) continue;
      const idx = child.getData('stackIndex') as number;
      if (idx < minIndex) continue;
      const sprite = child.getData('sprite') as Phaser.GameObjects.Container | undefined;
      const shadow = child.getData('shadow') as Phaser.GameObjects.Image | undefined;
      const order = idx - minIndex;
      if (sprite) {
        scene.tweens.killTweensOf(sprite);
        sprite.setScale(JUICE.land.squashScaleX, JUICE.land.squashScaleY);
        scene.tweens.add({ targets: sprite, scaleX: 1, scaleY: 1, duration: JUICE.land.duration, delay: order * 25, ease: EASE.back });
      }
      if (shadow) {
        const sx = child.getData('shadowScaleX') as number;
        const sy = child.getData('shadowScaleY') as number;
        shadow.setScale(sx * 1.35, sy * 1.15);
        scene.tweens.add({ targets: shadow, scaleX: sx, scaleY: sy, duration: JUICE.land.duration + 60, delay: order * 25, ease: EASE.out });
      }
      if (idx === container.items.length - 1) this.popRing(child.x, child.y + (child.getData('foot') as number));
    }
  }

  /** İniş noktasında genişleyip sönen ince beyaz halka. */
  private popRing(x: number, y: number): void {
    const scene = this.host.scene;
    const key = bakeCentered(scene, 'fx-ring', { width: 64, height: 64 }, (g) => {
      g.lineStyle(3, 0xffffff, 1);
      g.strokeEllipse(0, 0, 58, 58);
    });
    const ring = scene.add.image(x, y, key).setDisplaySize(30, 12).setAlpha(0.8).setDepth(140);
    scene.tweens.add({
      targets: ring,
      displayWidth: 96,
      displayHeight: 30,
      alpha: 0,
      duration: 340,
      ease: EASE.out,
      onComplete: () => ring.destroy(),
    });
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
