import Phaser from 'phaser';
import { mulberry32 } from '../core/rng';
import { EASE, PALETTE, type RoomTheme } from './theme';
import type { View } from './viewport';
import { syncBodyBackground } from './bodyBackground';
import { prefersReducedMotion } from './confetti';

/**
 * "Cozy oda" arka planı: duvar degradesi + pencere ışığı (yumuşak radyal parlama) + çapraz güneş
 * huzmeleri + sert çizgisiz zemin geçişi + kenar vinyeti + ince kâğıt dokusu. Hepsi BİR KEZ bir
 * canvas dokusuna çizilir (tema+boyut başına önbelleklenir) -- çalışma anında tek bir Image, sıfır
 * çizim maliyeti. Üstünde yavaşça süzülen birkaç toz/ışık zerreciği (havuzsuz ama sabit sayıda,
 * sahne kapanınca tween'leriyle birlikte otomatik temizlenir).
 */

export interface BackgroundOptions {
  /** Zeminin başladığı yükseklik oranı (0..1). Verilmezse zemin çizilmez (düz duvar). */
  readonly floorAt?: number;
  /** Toz zerreciği sayısı (0 = yok). */
  readonly motes?: number;
  readonly depth?: number;
}

const MOTE_KEY = 'fx-mote';

function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function paintBackground(ctx: CanvasRenderingContext2D, w: number, h: number, theme: RoomTheme, floorAt: number | undefined): void {
  // 1) duvar
  const wall = ctx.createLinearGradient(0, 0, 0, h);
  wall.addColorStop(0, theme.bgTop);
  wall.addColorStop(1, theme.bgBottom);
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, w, h);

  // 2) pencere ışığı -- sağ üstten gelen geniş, yumuşak parlama
  const glow = ctx.createRadialGradient(w * 0.8, h * 0.08, 0, w * 0.8, h * 0.08, w * 1.05);
  glow.addColorStop(0, rgba(theme.glow, 0.8));
  glow.addColorStop(0.45, rgba(theme.glow, 0.25));
  glow.addColorStop(1, rgba(theme.glow, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // 3) çapraz güneş huzmeleri (çok düşük alfa)
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const beams = [
    { x: w * 0.6, width: w * 0.22, alpha: 0.035 },
    { x: w * 0.9, width: w * 0.12, alpha: 0.03 },
    { x: w * 1.1, width: w * 0.26, alpha: 0.025 },
  ];
  for (const b of beams) {
    const grad = ctx.createLinearGradient(b.x, 0, b.x - w * 0.55, h * 0.75);
    grad.addColorStop(0, `rgba(255,250,235,${b.alpha})`);
    grad.addColorStop(1, 'rgba(255,250,235,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(b.x, 0);
    ctx.lineTo(b.x + b.width, 0);
    ctx.lineTo(b.x + b.width - w * 0.6, h * 0.8);
    ctx.lineTo(b.x - w * 0.6, h * 0.8);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // 4) zemin -- sert çizgi yerine 60px'lik yumuşak geçiş + çok silik tahta çizgileri
  if (floorAt !== undefined) {
    const fy = h * floorAt;
    const floor = ctx.createLinearGradient(0, fy - 50, 0, h);
    floor.addColorStop(0, rgba(theme.floor, 0));
    floor.addColorStop(0.12, rgba(theme.floor, 0.85));
    floor.addColorStop(1, rgba(theme.floor, 1));
    ctx.fillStyle = floor;
    ctx.fillRect(0, fy - 50, w, h - fy + 50);

    // süpürgelik ışığı: duvarla zeminin birleştiği yerde tek, yumuşak bir parlak şerit
    const board = ctx.createLinearGradient(0, fy - 6, 0, fy + 10);
    board.addColorStop(0, 'rgba(255,255,255,0)');
    board.addColorStop(0.5, 'rgba(255,255,255,0.28)');
    board.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = board;
    ctx.fillRect(0, fy - 6, w, 16);

    ctx.strokeStyle = rgba(PALETTE.woodDark, 0.06);
    ctx.lineWidth = 1.5;
    const rows = 5;
    for (let i = 1; i <= rows; i++) {
      const t = i / (rows + 1);
      const y = fy + (h - fy) * t * t + 14; // perspektif: aşağı indikçe aralık büyür
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }

  // 5) vinyet -- kenarları sıcak kahveyle çok hafif koyulaştırır (odak ortada kalır)
  const vignette = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.35, w / 2, h * 0.45, Math.max(w, h) * 0.75);
  vignette.addColorStop(0, 'rgba(90,58,44,0)');
  vignette.addColorStop(1, 'rgba(90,58,44,0.12)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  // 6) kâğıt dokusu -- deterministik ince tane (her açılışta aynı, titreşmez)
  const rng = mulberry32(0xc0275);
  const grains = Math.round((w * h) / 90);
  for (let i = 0; i < grains; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const light = rng() > 0.5;
    ctx.fillStyle = light ? 'rgba(255,255,255,0.05)' : 'rgba(90,58,44,0.035)';
    ctx.fillRect(x, y, 1.2, 1.2);
  }
}

function ensureMoteTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(MOTE_KEY)) return;
  const size = 48;
  const tex = scene.textures.createCanvas(MOTE_KEY, size, size);
  if (!tex) return;
  const ctx = tex.getContext();
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  tex.refresh();
}

export function drawCozyBackground(scene: Phaser.Scene, theme: RoomTheme, view: View, options: BackgroundOptions = {}): Phaser.GameObjects.Image {
  const { width: w, height: h } = view;
  const floorKey = options.floorAt === undefined ? 'nofloor' : options.floorAt.toFixed(3);
  const tw = Math.ceil(w);
  const th = Math.ceil(h);
  const key = `bg-${theme.id}-${tw}x${th}-${floorKey}`;
  if (!scene.textures.exists(key)) {
    const tex = scene.textures.createCanvas(key, tw, th);
    if (tex) {
      paintBackground(tex.getContext(), tw, th, theme, options.floorAt);
      tex.refresh();
    }
  }
  syncBodyBackground(theme.bgTop, theme.bgBottom);
  const depth = options.depth ?? -100;
  // 2px taşma payı: kamera ortalaması kesirli olduğunda kenarda alt-piksel boşluk kalmasın.
  const image = scene.add.image(-2, -2, key).setOrigin(0, 0).setDisplaySize(w + 4, h + 4).setDepth(depth);

  const moteCount = prefersReducedMotion() ? 0 : options.motes ?? 0;
  if (moteCount > 0) {
    ensureMoteTexture(scene);
    const tint = parseInt(theme.mote.replace('#', ''), 16);
    for (let i = 0; i < moteCount; i++) {
      const x = Phaser.Math.Between(0, w);
      const y = Phaser.Math.Between(Math.round(h * 0.05), Math.round(h * 0.9));
      const scale = Phaser.Math.FloatBetween(0.12, 0.42);
      const mote = scene.add.image(x, y, MOTE_KEY).setScale(scale).setAlpha(0).setTint(tint).setDepth(depth + 1);
      const peak = Phaser.Math.FloatBetween(0.25, 0.6);
      scene.tweens.add({ targets: mote, alpha: peak, duration: Phaser.Math.Between(1200, 2400), delay: i * 140, ease: EASE.inOut });
      scene.tweens.add({
        targets: mote,
        y: y - Phaser.Math.Between(40, 110),
        x: x + Phaser.Math.Between(-30, 30),
        duration: Phaser.Math.Between(6000, 11000),
        yoyo: true,
        repeat: -1,
        ease: EASE.inOut,
      });
      scene.tweens.add({
        targets: mote,
        alpha: { from: peak, to: peak * 0.35 },
        duration: Phaser.Math.Between(1800, 3600),
        delay: 2400,
        yoyo: true,
        repeat: -1,
        ease: EASE.inOut,
      });
    }
  }
  return image;
}
