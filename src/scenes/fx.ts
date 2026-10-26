import Phaser from 'phaser';
import { bakeCentered } from './bake';
import { COLORS, EASE, hexToNum } from './theme';
import { prefersReducedMotion } from './confetti';
import { fitCamera } from './viewport';

/**
 * Ortak efekt dokuları + parçacık yayıcıları. Dokular bir kez pişirilir; parçacıklar Phaser'ın
 * kendi ParticleEmitter'ı ile (dahili havuz -- her patlamada yeni nesne oluşmaz).
 */

export function starPath(ctx: CanvasRenderingContext2D, r: number, inner = 0.48, points = 5): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const angle = (Math.PI / points) * i - Math.PI / 2;
    const radius = i % 2 === 0 ? r : r * inner;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** Dolu (altın, degrade + iç ışık + koyu kenar) ya da boş (soluk oyuk) derecelendirme yıldızı. */
export function bakeStar(scene: Phaser.Scene, size: number, filled: boolean): string {
  return bakeCentered(scene, `star-${filled ? 'on' : 'off'}-${size}`, { width: size * 1.3, height: size * 1.3 }, (_g, ctx) => {
    const r = size / 2;
    const s = ctx.getTransform().a;
    ctx.lineJoin = 'round';
    if (filled) {
      ctx.save();
      ctx.shadowColor = 'rgba(200,120,20,0.45)';
      ctx.shadowBlur = 8 * s;
      ctx.shadowOffsetY = 3 * s;
      starPath(ctx, r);
      ctx.fillStyle = '#E99A1E';
      ctx.fill();
      ctx.restore();
      const grad = ctx.createLinearGradient(0, -r, 0, r);
      grad.addColorStop(0, '#FFE58A');
      grad.addColorStop(0.55, COLORS.gold);
      grad.addColorStop(1, '#EE9A1B');
      starPath(ctx, r * 0.93);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = '#D9861A';
      ctx.lineWidth = Math.max(1.5, r * 0.07);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.ellipse(-r * 0.2, -r * 0.3, r * 0.16, r * 0.26, -0.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      starPath(ctx, r * 0.93);
      ctx.fillStyle = 'rgba(201,184,190,0.35)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(138,114,130,0.35)';
      ctx.lineWidth = Math.max(1.5, r * 0.06);
      ctx.stroke();
    }
  });
}

/** 4 köşeli parıltı (ışıltı) -- parçacık dokusu. */
export function sparkleKey(scene: Phaser.Scene): string {
  return bakeCentered(scene, 'fx-sparkle', { width: 32, height: 32 }, (_g, ctx) => {
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 14);
    glow.addColorStop(0, 'rgba(255,255,255,0.9)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(-16, -16, 32, 32);
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.quadraticCurveTo(2, -2, 14, 0);
    ctx.quadraticCurveTo(2, 2, 0, 14);
    ctx.quadraticCurveTo(-2, 2, -14, 0);
    ctx.quadraticCurveTo(-2, -2, 0, -14);
    ctx.fill();
  });
}

/** Yumuşak yuvarlak nokta (konfeti benzeri renkli parçacıklar için, tint'lenir). */
export function dotKey(scene: Phaser.Scene): string {
  return bakeCentered(scene, 'fx-dot', { width: 16, height: 16 }, (_g, ctx) => {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Panel yıldızlarının arkasında yavaşça dönen sıcak güneş ışınları. */
export function raysKey(scene: Phaser.Scene): string {
  return bakeCentered(scene, 'fx-rays', { width: 300, height: 300 }, (_g, ctx) => {
    const rays = 14;
    for (let i = 0; i < rays; i++) {
      const a = (Math.PI * 2 * i) / rays;
      const grad = ctx.createRadialGradient(0, 0, 10, 0, 0, 150);
      grad.addColorStop(0, 'rgba(255,214,120,0.55)');
      grad.addColorStop(1, 'rgba(255,214,120,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 150, a - 0.09, a + 0.09);
      ctx.closePath();
      ctx.fill();
    }
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, 90);
    core.addColorStop(0, 'rgba(255,240,200,0.7)');
    core.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = core;
    ctx.fillRect(-150, -150, 300, 300);
  });
}

const CELEBRATION_TINTS = [COLORS.gold, COLORS.coral, COLORS.turquoise, COLORS.pink, COLORS.green, COLORS.sky].map(hexToNum);

/** Sahne başına iki yayıcı: beyaz-altın ışıltılar + renkli noktalar. create()'de bir kez kurulur. */
export class ParticleFx {
  private readonly sparkles: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly dots: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly reduced = prefersReducedMotion();

  constructor(scene: Phaser.Scene, depth = 200) {
    this.sparkles = scene.add.particles(0, 0, sparkleKey(scene), {
      emitting: false,
      lifespan: { min: 380, max: 720 },
      speed: { min: 50, max: 170 },
      scale: { start: 0.75, end: 0, ease: EASE.out },
      alpha: { start: 1, end: 0, ease: EASE.in },
      rotate: { min: 0, max: 180 },
      tint: [0xffffff, 0xfff1c4, hexToNum(COLORS.goldLight)],
      gravityY: 60,
    });
    this.sparkles.setDepth(depth);
    this.dots = scene.add.particles(0, 0, dotKey(scene), {
      emitting: false,
      lifespan: { min: 450, max: 850 },
      speed: { min: 80, max: 230 },
      scale: { start: 0.8, end: 0.1, ease: EASE.out },
      alpha: { start: 1, end: 0, ease: EASE.in },
      tint: CELEBRATION_TINTS,
      gravityY: 260,
    });
    this.dots.setDepth(depth);
  }

  sparkle(x: number, y: number, count = 6): void {
    this.sparkles.explode(this.reduced ? Math.ceil(count / 3) : count, x, y);
  }

  burst(x: number, y: number, count = 14): void {
    this.dots.explode(this.reduced ? Math.ceil(count / 3) : count, x, y);
    this.sparkles.explode(this.reduced ? 2 : Math.ceil(count / 2), x, y);
  }
}

/**
 * Çok hafif "yakınlaşma vuruşu" (zoom punch): kamera zoom'u temel değerinin (1+amount) katına çıkıp
 * geri döner, MANTIKSAL ekran merkezi sabit kalacak şekilde (viewport.ts kamerası sol-üst orijinli).
 * Sonunda kamera fitCamera ile tam temel hâline döndürülür (birikmiş kayma kalmaz).
 */
export function punchZoom(scene: Phaser.Scene, amount = 0.012, duration = 260): void {
  if (prefersReducedMotion()) return;
  const cam = scene.cameras.main;
  fitCamera(scene);
  const baseZoom = cam.zoom;
  const cx = cam.scrollX + cam.width / baseZoom / 2;
  const cy = cam.scrollY + cam.height / baseZoom / 2;
  const proxy = { f: 0 };
  scene.tweens.add({
    targets: proxy,
    f: 1,
    duration: duration / 2,
    yoyo: true,
    ease: EASE.inOut,
    onUpdate: () => {
      const z = baseZoom * (1 + amount * proxy.f);
      cam.setZoom(z);
      cam.setScroll(cx - cam.width / z / 2, cy - cam.height / z / 2);
    },
    onComplete: () => fitCamera(scene),
  });
}
