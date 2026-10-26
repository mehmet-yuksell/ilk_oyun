import Phaser from 'phaser';
import type { GameState } from '../core/types';
import { JUICE } from '../config/tuning';
import { COLORS, EASE, hexToNum, textStyle } from './theme';
import { bakeCentered } from './bake';
import { t } from '../i18n/translations';
import type { Language } from '../i18n/translations';
import type { Layout } from './gameTypes';
import { bakeStar, punchZoom, type ParticleFx } from './fx';
import { prefersReducedMotion } from './confetti';
import { viewOf } from './viewport';

/** GameAnimations'ın sahneden ihtiyaç duyduğu her şey (dar arayüz). `get*` fonksiyonları her
 * çağrıda canlı değeri okur -- GameScene'in o anki (sürekli değişen) durumunu yansıtır. */
export interface JuiceFxHost {
  readonly scene: Phaser.Scene;
  readonly particles: ParticleFx;
  getLayout: (containerId: string) => Layout | undefined;
  /** Kabın kalıcı görünüm kökü (çerçeve) -- nazik "hayır" sallanması için. */
  getContainerRoot: (containerId: string) => Phaser.GameObjects.Container | undefined;
  getItemsLayerChildren: () => Phaser.GameObjects.Container[];
  getGameState: () => GameState;
  getSlotHeight: () => number;
  getStarAnchor: () => { x: number; y: number };
  /** Uçan yıldızlar sayaca varınca (sayaç ikonunun "pop"u için). */
  onStarArrive?: () => void;
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

  /** Kilit açılınca: kabın ortasından altın ışıltı halkası + sıcak bir parlama. */
  flashUnlock(containerId: string): void {
    const layout = this.host.getLayout(containerId);
    if (!layout) return;
    const cx = layout.centerX;
    const cy = layout.topY + layout.rect.height / 2;
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI * 2 * i) / 10;
      this.host.particles.sparkle(cx + Math.cos(a) * layout.rect.width * 0.35, cy + Math.sin(a) * layout.rect.height * 0.3, 1);
    }
    this.host.particles.sparkle(cx, layout.topY + 18, 8);
    const root = this.host.getContainerRoot(containerId);
    if (root) this.host.scene.tweens.add({ targets: root, scale: { from: 1.05, to: 1 }, duration: JUICE.unlock.duration, ease: EASE.back });
  }

  /**
   * Geçersiz hamlede nazik "hayır": sert kırmızı flaş YOK. Hedef kap (çerçeve + içindeki eşyalar)
   * sönümlenen kısa bir yatay sallanma yapar -- "kafa sallama" hissi.
   */
  gentleNo(containerId: string): void {
    const scene = this.host.scene;
    const targets: Phaser.GameObjects.GameObject[] = [];
    const root = this.host.getContainerRoot(containerId);
    if (root) targets.push(root);
    for (const child of this.host.getItemsLayerChildren()) {
      if (child.getData('containerId') === containerId) targets.push(child);
    }
    if (targets.length === 0) return;
    const bases = targets.map((o) => (o as unknown as { x: number }).x);
    const proxy = { t: 0 };
    scene.tweens.add({
      targets: proxy,
      t: 1,
      duration: JUICE.invalid.duration,
      ease: EASE.out,
      onUpdate: () => {
        // sönümlenen sinüs: 2.5 salınım, genlik 7px -> 0
        const offset = Math.sin(proxy.t * Math.PI * 5) * 7 * (1 - proxy.t);
        targets.forEach((o, i) => ((o as unknown as { x: number }).x = bases[i] + offset));
      },
      onComplete: () => targets.forEach((o, i) => ((o as unknown as { x: number }).x = bases[i])),
    });
  }

  /** Geçerli her hamlede: hedefin en üstündeki eşyanın ayağında küçük bir ışıltı patlaması. */
  sparkleLanding(containerId: string): void {
    for (const child of this.host.getItemsLayerChildren()) {
      if (child.getData('containerId') !== containerId || child.getData('isTop') !== true) continue;
      this.host.particles.sparkle(child.x, child.y + (child.getData('foot') as number) - 4, 5);
    }
  }

  /**
   * Grup tamamlanınca: (oyun durumunda kap zaten boşaltıldı) 4 eşya bir an geri belirir, sevinçle
   * zıplar, sonra ışıltıya dönüşüp kaybolur; renkli parçacık patlaması + altın yıldızlar sayaca uçar
   * + çok hafif zoom vuruşu ve mini titreşim.
   */
  celebrateCompletion(containerId: string, type: string, capacity: number): void {
    const layout = this.host.getLayout(containerId);
    if (!layout) return;
    const scene = this.host.scene;
    const slotHeight = this.host.getSlotHeight();
    const cx = layout.centerX;
    const cy = layout.topY + layout.rect.height / 2;

    for (let i = 0; i < capacity; i++) {
      const y = layout.topY + (capacity - 1 - i) * slotHeight + slotHeight / 2;
      const ghost = this.host.spawnItemVisual(type, cx, y).setDepth(160);
      (ghost.getData('setExcited') as (v: boolean) => void)(true);
      const sprite = ghost.getData('sprite') as Phaser.GameObjects.Container;
      const delay = i * 45;
      scene.tweens.add({
        targets: sprite,
        y: sprite.y - 14,
        duration: 170,
        delay,
        yoyo: true,
        ease: EASE.out,
        onComplete: () => {
          this.host.particles.sparkle(cx, y, 5);
          scene.tweens.add({
            targets: ghost,
            scale: 0,
            alpha: 0,
            duration: 160,
            ease: EASE.backIn,
            onComplete: () => ghost.destroy(),
          });
        },
      });
    }

    scene.time.delayedCall(280, () => {
      this.host.particles.burst(cx, cy, 18);
      this.flyStarsToCounter(cx, cy);
    });
    const root = this.host.getContainerRoot(containerId);
    if (root) scene.tweens.add({ targets: root, scale: { from: 1.04, to: 1 }, duration: 380, delay: 260, ease: EASE.back });
    punchZoom(scene, 0.012, 280);
    if (!prefersReducedMotion()) scene.cameras.main.shake(JUICE.completion.cameraShakeDuration, JUICE.completion.cameraShakeIntensity * 0.6);
  }

  /** Tamamlanan kaptan küçük altın yıldızlar yay çizerek üstteki yıldız sayacına uçar. */
  private flyStarsToCounter(fromX: number, fromY: number): void {
    const scene = this.host.scene;
    const key = bakeStar(scene, 22, true);
    for (let i = 0; i < JUICE.starFly.starCount; i++) {
      scene.time.delayedCall(i * JUICE.starFly.staggerMs, () => {
        const star = scene.add.image(fromX, fromY, key).setDisplaySize(28, 28).setDepth(220);
        const base = star.scale;
        const spread = (i - (JUICE.starFly.starCount - 1) / 2) * 36;
        const progress = { t: 0 };
        const anchor = this.host.getStarAnchor();
        scene.tweens.add({
          targets: progress,
          t: 1,
          duration: JUICE.starFly.duration,
          ease: EASE.inOut,
          onUpdate: () => {
            const tt = progress.t;
            const bow = Math.sin(Math.PI * tt);
            star.x = Phaser.Math.Linear(fromX, anchor.x, tt) + spread * bow;
            star.y = Phaser.Math.Linear(fromY, anchor.y, tt) - JUICE.starFly.arcHeight * bow;
            star.setScale(base * (1 + 0.35 * bow - 0.35 * tt));
            star.setAngle(tt * 220);
          },
          onComplete: () => {
            star.destroy();
            this.host.particles.sparkle(anchor.x, anchor.y, 2);
            this.host.onStarArrive?.();
          },
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

  /** Art arda tamamlamalarda: kabın üstünde Back.Out ile beliren, yükselip sönen sıcak bir hap. */
  showCombo(containerId: string, combo: number): void {
    const layout = this.host.getLayout(containerId);
    if (!layout) return;
    const scene = this.host.scene;
    const lang = this.host.getLang();
    const label = scene.add.text(0, 0, `${t('comboLabel', lang, { n: combo })} ${this.comboTextFor(combo)}`, textStyle('buttonSmall', { color: COLORS.cream })).setOrigin(0.5);
    const w = label.width + 32;
    const h = 38;
    const bg = scene.add.graphics();
    bg.fillStyle(hexToNum(COLORS.terracotta), 1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    bg.lineStyle(2, 0xffffff, 0.6);
    bg.strokeRoundedRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4, h / 2 - 2);
    const y0 = layout.topY - 14;
    // ekran kenarından taşmasın: kenar kaplarda hap içeri kaydırılır
    const vw = viewOf(scene).width;
    const px = Phaser.Math.Clamp(layout.centerX, w / 2 + 12, vw - w / 2 - 12);
    const pill = scene.add.container(px, y0, [bg, label]).setDepth(230).setScale(0.4).setAlpha(0);
    scene.tweens.add({ targets: pill, scale: 1, alpha: 1, duration: 240, ease: EASE.back });
    scene.tweens.add({
      targets: pill,
      y: y0 - JUICE.combo.riseDistance,
      alpha: 0,
      duration: 420,
      delay: JUICE.combo.displayDuration - 200,
      ease: EASE.in,
      onComplete: () => pill.destroy(),
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
