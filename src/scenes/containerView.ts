import Phaser from 'phaser';
import { bakeCentered } from './bake';
import type { CanvasGraphics } from './canvasGraphics';
import { accentFor, ITEM_FOOT, strokeArc } from './itemVisuals';
import { COLORS, EASE, hexToNum } from './theme';

/**
 * Kap = cam önlü ahşap vitrin dolabı: sıcak ahşap çerçeve, krem iç duvar, her yuva için bir raf
 * tahtası (eşyalar rafta durur -- eskiden her eşyanın altındaki gölge havada asılı kalıyordu),
 * cam parıltısı, zemine düşen yumuşak gölge. Tümü bir kez pişirilir (bkz. bake.ts); seçim halesi
 * ayrı bir pişmiş doku olarak arkada nabız atar.
 *
 * ContainerView kalıcıdır: seçim/kilit değişince yeniden oluşturulmaz, yalnızca durumu güncellenir
 * (eskiden her dokunuşta tüm çerçeveler yok edilip yeniden çiziliyordu).
 */

const FRAME_PAD = 22;

export interface FrameGeometry {
  readonly width: number;
  readonly height: number;
  readonly capacity: number;
  readonly slotHeight: number;
  /** Eşya kutusu yüksekliği (yuva - 2*içboşluk) -- raf tahtasının eşyanın "ayağına" denk gelmesi için. */
  readonly itemHeight: number;
}

function rgba(hex: string, a: number): string {
  const n = hexToNum(hex);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function paintFrame(ctx: CanvasRenderingContext2D, geo: FrameGeometry, locked: boolean): void {
  const { width: w, height: h } = geo;
  const x0 = -w / 2;
  const y0 = -h / 2;
  const radius = Math.min(20, w * 0.14);
  const t = Math.max(6, Math.min(10, w * 0.055)); // çerçeve kalınlığı
  const scale = ctx.getTransform().a;

  // 1) zemine düşen yumuşak gölge
  ctx.save();
  ctx.shadowColor = 'rgba(90,58,44,0.28)';
  ctx.shadowBlur = 16 * scale;
  ctx.shadowOffsetY = 7 * scale;
  roundRectPath(ctx, x0, y0, w, h, radius);
  ctx.fillStyle = COLORS.wood;
  ctx.fill();
  ctx.restore();

  // 2) ahşap çerçeve
  const wood = ctx.createLinearGradient(0, y0, 0, y0 + h);
  wood.addColorStop(0, locked ? '#CDBFC8' : COLORS.woodLight);
  wood.addColorStop(0.5, locked ? '#B9A9B5' : COLORS.wood);
  wood.addColorStop(1, locked ? '#9F8E9B' : COLORS.woodDark);
  roundRectPath(ctx, x0, y0, w, h, radius);
  ctx.fillStyle = wood;
  ctx.fill();
  // ahşap damarı: çok silik eğri çizgiler
  ctx.save();
  roundRectPath(ctx, x0, y0, w, h, radius);
  ctx.clip();
  ctx.strokeStyle = 'rgba(120,70,40,0.10)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    const yy = y0 + (h / 7) * i + 4;
    ctx.beginPath();
    ctx.moveTo(x0, yy);
    ctx.bezierCurveTo(x0 + w * 0.3, yy - 3, x0 + w * 0.6, yy + 3, x0 + w, yy - 1);
    ctx.stroke();
  }
  ctx.restore();
  // çerçeve üst kenar ışığı
  ctx.save();
  roundRectPath(ctx, x0 + 0.75, y0 + 0.75, w - 1.5, h - 1.5, radius);
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // 3) iç duvar (krem; kilitliyse soğuk lavanta-gri)
  const ix = x0 + t;
  const iy = y0 + t;
  const iw = w - t * 2;
  const ih = h - t * 2;
  const innerR = Math.max(6, radius - t * 0.6);
  const wall = ctx.createLinearGradient(0, iy, 0, iy + ih);
  wall.addColorStop(0, locked ? '#ECE5EC' : '#FFF7EC');
  wall.addColorStop(1, locked ? '#D9CED9' : '#F2E3D0');
  roundRectPath(ctx, ix, iy, iw, ih, innerR);
  ctx.fillStyle = wall;
  ctx.fill();

  ctx.save();
  roundRectPath(ctx, ix, iy, iw, ih, innerR);
  ctx.clip();
  // iç üst gölge + yan gölgeler: "içine bakılan bir dolap" derinliği
  const topShade = ctx.createLinearGradient(0, iy, 0, iy + 26);
  topShade.addColorStop(0, 'rgba(90,58,44,0.24)');
  topShade.addColorStop(1, 'rgba(90,58,44,0)');
  ctx.fillStyle = topShade;
  ctx.fillRect(ix, iy, iw, 26);
  for (const side of [0, 1]) {
    const sx = side === 0 ? ix : ix + iw - 12;
    const sideShade = ctx.createLinearGradient(sx, 0, sx + 12, 0);
    sideShade.addColorStop(side === 0 ? 0 : 1, 'rgba(90,58,44,0.12)');
    sideShade.addColorStop(side === 0 ? 1 : 0, 'rgba(90,58,44,0)');
    ctx.fillStyle = sideShade;
    ctx.fillRect(sx, iy, 12, ih);
  }

  // 4) raf tahtaları: her yuvanın altında, eşyanın ayağının hemen altında (en alttaki yuva çerçeveye oturur)
  const inset = (geo.slotHeight - geo.itemHeight) / 2;
  const footFromSlotTop = inset + geo.itemHeight / 2 + geo.itemHeight * ITEM_FOOT;
  const boardH = Math.max(4, geo.slotHeight * 0.09);
  for (let i = 0; i < geo.capacity - 1; i++) {
    const by = y0 + i * geo.slotHeight + footFromSlotTop + 1;
    // tahtanın altına düşen gölge
    const under = ctx.createLinearGradient(0, by + boardH, 0, by + boardH + 9);
    under.addColorStop(0, 'rgba(90,58,44,0.2)');
    under.addColorStop(1, 'rgba(90,58,44,0)');
    ctx.fillStyle = under;
    ctx.fillRect(ix, by + boardH, iw, 9);
    const board = ctx.createLinearGradient(0, by, 0, by + boardH);
    board.addColorStop(0, locked ? '#D8CBD4' : COLORS.woodLight);
    board.addColorStop(1, locked ? '#AE9DAA' : COLORS.wood);
    ctx.fillStyle = board;
    ctx.fillRect(ix, by, iw, boardH);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(ix, by, iw, 1);
  }

  // 5) cam: sol üstten çapraz yumuşak parıltı + sol kenarda ince ışık çizgisi
  const glass = ctx.createLinearGradient(ix, iy, ix + iw * 0.7, iy + ih * 0.55);
  glass.addColorStop(0, 'rgba(255,255,255,0.32)');
  glass.addColorStop(0.35, 'rgba(255,255,255,0.08)');
  glass.addColorStop(0.36, 'rgba(255,255,255,0)');
  ctx.fillStyle = glass;
  ctx.fillRect(ix, iy, iw, ih);
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillRect(ix + 4, iy + innerR, 2, ih - innerR * 2);
  ctx.restore();

  // iç kenar: çerçeve ile cam arasında ince koyu çizgi (oyuk hissi)
  roundRectPath(ctx, ix, iy, iw, ih, innerR);
  ctx.strokeStyle = rgba(COLORS.woodDark, 0.55);
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

function paintHalo(ctx: CanvasRenderingContext2D, geo: FrameGeometry): void {
  const { width: w, height: h } = geo;
  const radius = Math.min(20, w * 0.14) + 4;
  const scale = ctx.getTransform().a;
  ctx.save();
  ctx.shadowColor = 'rgba(255,196,80,0.95)';
  ctx.shadowBlur = 18 * scale;
  roundRectPath(ctx, -w / 2 - 4, -h / 2 - 4, w + 8, h + 8, radius);
  ctx.strokeStyle = 'rgba(255,214,120,0.95)';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
}

function frameKey(kind: string, geo: FrameGeometry): string {
  return `frame-${kind}-${Math.round(geo.width)}x${Math.round(geo.height)}-${geo.capacity}-${Math.round(geo.slotHeight)}-${Math.round(geo.itemHeight)}`;
}

function bakedSize(geo: FrameGeometry): { width: number; height: number } {
  return { width: geo.width + FRAME_PAD * 2, height: geo.height + FRAME_PAD * 2 };
}

/** Asma kilit rozeti (beyaz zemin üzerinde kavis + gövde + anahtar deliği). */
function drawLockBadge(g: CanvasGraphics): void {
  const ink = hexToNum(COLORS.ink);
  g.fillStyle(hexToNum(COLORS.surface), 0.97);
  g.fillCircle(0, 1, 15);
  g.lineStyle(2, hexToNum(COLORS.woodDark), 0.35);
  g.strokeCircle(0, 1, 15);
  g.lineStyle(3.2, ink, 0.85);
  strokeArc(g, 0, -1, 6.5, 180, 360, 12);
  g.fillStyle(ink, 0.85);
  g.fillRoundedRect(-9, -2, 18, 15, 4);
  g.fillStyle(hexToNum(COLORS.surface), 0.9);
  g.fillCircle(0, 4, 2.2);
}

/**
 * "Tek türlü kap" rozeti: türün aksan rengi + (renk körü dostu) o türün baş harfi değil, renkten
 * bağımsız bir işaret olarak türün KÜÇÜK SİLUETİ -- bkz. Faz 7. Şimdilik halka + iç nokta.
 */
function drawTypeBadge(g: CanvasGraphics, acceptedType: string): void {
  const color = hexToNum(accentFor(acceptedType));
  g.fillStyle(hexToNum(COLORS.surface), 0.97);
  g.fillCircle(0, 0, 13);
  g.lineStyle(3.4, color, 1);
  g.strokeCircle(0, 0, 11);
  g.fillStyle(color, 1);
  g.fillCircle(0, 0, 5);
}

export class ContainerView {
  readonly root: Phaser.GameObjects.Container;
  private readonly scene: Phaser.Scene;
  private readonly geo: FrameGeometry;
  private readonly frame: Phaser.GameObjects.Image;
  private readonly halo: Phaser.GameObjects.Image;
  private readonly normalKey: string;
  private readonly lockedKey: string;
  private lockBadge: Phaser.GameObjects.Image | null = null;
  private selected = false;
  private locked = false;
  private haloTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, geo: FrameGeometry, onlyAccepts?: string) {
    this.scene = scene;
    this.geo = geo;
    const size = bakedSize(geo);
    this.normalKey = bakeCentered(scene, frameKey('n', geo), size, (_g, ctx) => paintFrame(ctx, geo, false));
    this.lockedKey = bakeCentered(scene, frameKey('l', geo), size, (_g, ctx) => paintFrame(ctx, geo, true));
    const haloKey = bakeCentered(scene, frameKey('halo', geo), size, (_g, ctx) => paintHalo(ctx, geo));

    this.root = scene.add.container(x, y);
    this.halo = scene.add.image(0, 0, haloKey).setDisplaySize(size.width, size.height).setAlpha(0);
    this.frame = scene.add.image(0, 0, this.normalKey).setDisplaySize(size.width, size.height);
    this.root.add([this.halo, this.frame]);

    if (onlyAccepts) {
      const key = bakeCentered(scene, `badge-type-${onlyAccepts}`, { width: 32, height: 32 }, (g) => drawTypeBadge(g, onlyAccepts));
      this.root.add(scene.add.image(geo.width / 2 - 17, -geo.height / 2 + 17, key).setDisplaySize(32, 32));
    }
  }

  get width(): number {
    return this.geo.width;
  }

  /** Öğretici/ipucu vurgusu: seçimden daha yumuşak, yavaş nabız atan hale (seçiliyse dokunmaz). */
  setHint(on: boolean): void {
    if (this.selected) return;
    this.haloTween?.stop();
    this.haloTween = null;
    this.scene.tweens.killTweensOf(this.halo);
    if (on) {
      this.halo.setAlpha(0);
      this.haloTween = this.scene.tweens.add({ targets: this.halo, alpha: { from: 0.15, to: 0.75 }, duration: 650, yoyo: true, repeat: -1, ease: EASE.inOut });
    } else {
      this.scene.tweens.add({ targets: this.halo, alpha: 0, duration: 200, ease: EASE.out });
    }
  }

  setSelected(selected: boolean): void {
    if (this.selected === selected) return;
    this.selected = selected;
    this.haloTween?.stop();
    this.haloTween = null;
    if (selected) {
      this.halo.setAlpha(0);
      this.scene.tweens.add({ targets: this.halo, alpha: 1, duration: 140, ease: EASE.out });
      this.haloTween = this.scene.tweens.add({
        targets: this.halo,
        alpha: { from: 1, to: 0.55 },
        duration: 700,
        delay: 160,
        yoyo: true,
        repeat: -1,
        ease: EASE.inOut,
      });
    } else {
      this.scene.tweens.add({ targets: this.halo, alpha: 0, duration: 160, ease: EASE.out });
    }
  }

  setLocked(locked: boolean): void {
    if (this.locked === locked && (this.lockBadge !== null) === locked) return;
    this.locked = locked;
    this.frame.setTexture(locked ? this.lockedKey : this.normalKey);
    const size = bakedSize(this.geo);
    this.frame.setDisplaySize(size.width, size.height);
    if (locked && !this.lockBadge) {
      const key = bakeCentered(this.scene, 'badge-lock', { width: 34, height: 34 }, (g) => drawLockBadge(g));
      this.lockBadge = this.scene.add.image(-this.geo.width / 2 + 18, -this.geo.height / 2 + 18, key).setDisplaySize(34, 34);
      this.root.add(this.lockBadge);
    } else if (!locked && this.lockBadge) {
      const badge = this.lockBadge;
      this.lockBadge = null;
      this.scene.tweens.add({ targets: badge, scale: badge.scale * 1.5, alpha: 0, duration: 320, ease: EASE.out, onComplete: () => badge.destroy() });
    }
  }

  destroy(): void {
    this.haloTween?.stop();
    this.scene.tweens.killTweensOf([this.halo, this.frame, this.root]);
    this.root.destroy();
  }
}
