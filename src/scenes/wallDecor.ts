import Phaser from 'phaser';
import { bakeCentered } from './bake';
import { COLORS, EASE, mix, shadeHex, type RoomTheme } from './theme';
import { prefersReducedMotion } from './confetti';

/**
 * Bölüm (oda teması) başına duvar dekoru (Faz 6 -- "seviye ilerledikçe dekor değişimi"):
 *   peach-morning   -> perdeli güneşli pencere + pervazda saksı
 *   sage-garden     -> iplerle sarkan saksı bitkiler
 *   lavender-dusk   -> ışık zinciri (ampuller hafifçe titreşir) + ay penceresi
 *   honey-afternoon -> çerçeveler + duvar saati
 *   misty-blue      -> yüzen raf + kitaplar + küçük vazo
 * Izgaranın ÜSTÜNDEKİ boş duvara konur; yer yoksa hiç çizilmez (oyun alanını kalabalıklaştırmaz).
 * Bir kez pişirilir; düşük kontrastlı tutulur ki eşyalarla yarışmasın.
 */

const W = 420;
const H = 150;

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function softShadow(ctx: CanvasRenderingContext2D, draw: () => void): void {
  const s = ctx.getTransform().a;
  ctx.save();
  ctx.shadowColor = 'rgba(90,58,44,0.18)';
  ctx.shadowBlur = 8 * s;
  ctx.shadowOffsetY = 4 * s;
  draw();
  ctx.restore();
}

function pot(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.lineTo(x + w / 2, y);
  ctx.lineTo(x + w * 0.38, y + w * 0.8);
  ctx.lineTo(x - w * 0.38, y + w * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shadeHex(color, -0.15);
  ctx.fillRect(x - w / 2 - 2, y - 3, w + 4, 6);
}

function leaves(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, count: number, down = false): void {
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const a = (down ? Math.PI / 2 : -Math.PI / 2) + (i - (count - 1) / 2) * 0.45;
    ctx.save();
    ctx.translate(x + Math.cos(a) * size * 0.3, y + Math.sin(a) * size * 0.3);
    ctx.rotate(a + Math.PI / 2);
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.18, size * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function paintWindow(ctx: CanvasRenderingContext2D, theme: RoomTheme): void {
  const ww = 170;
  const wh = 112;
  const x = -ww / 2;
  const y = -H / 2 + 10;
  softShadow(ctx, () => {
    rr(ctx, x - 8, y - 8, ww + 16, wh + 16, 14);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
  });
  const sky = ctx.createLinearGradient(0, y, 0, y + wh);
  sky.addColorStop(0, '#BFE0F2');
  sky.addColorStop(1, '#FBE3C8');
  rr(ctx, x, y, ww, wh, 8);
  ctx.fillStyle = sky;
  ctx.fill();
  // güneş + bulut
  ctx.fillStyle = 'rgba(255,214,120,0.9)';
  ctx.beginPath();
  ctx.arc(x + ww * 0.7, y + wh * 0.38, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  for (const [cx, cy, r] of [[x + 40, y + 40, 12], [x + 56, y + 36, 15], [x + 72, y + 42, 11]]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // kasa
  ctx.strokeStyle = COLORS.woodLight;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(0, y + wh);
  ctx.moveTo(x, y + wh / 2);
  ctx.lineTo(x + ww, y + wh / 2);
  ctx.stroke();
  // perdeler
  for (const side of [-1, 1]) {
    const cx = side * (ww / 2 + 6);
    const grad = ctx.createLinearGradient(cx - 24, 0, cx + 24, 0);
    grad.addColorStop(0, mix(theme.accent, '#FFFFFF', 0.45));
    grad.addColorStop(0.5, mix(theme.accent, '#FFFFFF', 0.25));
    grad.addColorStop(1, mix(theme.accent, '#FFFFFF', 0.45));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx - 26 * side * -1, y - 14);
    ctx.quadraticCurveTo(cx + side * 30, y + wh * 0.5, cx + side * 6, y + wh + 18);
    ctx.lineTo(cx + side * 34, y + wh + 18);
    ctx.lineTo(cx + side * 34, y - 14);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = COLORS.woodDark;
  ctx.fillRect(x - 40, y - 18, ww + 80, 5);
  // pervaz + saksı
  ctx.fillStyle = COLORS.wood;
  ctx.fillRect(x - 14, y + wh + 8, ww + 28, 7);
  pot(ctx, x + 30, y + wh - 8, 22, '#E5A27A');
  leaves(ctx, x + 30, y + wh - 10, 34, '#79B07F', 4);
}

function paintHangingPlants(ctx: CanvasRenderingContext2D): void {
  const xs = [-130, 0, 130];
  const lengths = [44, 22, 50];
  const colors = ['#E5A27A', '#D9C2A6', '#C98E6E'];
  xs.forEach((x, i) => {
    const y = -H / 2 + lengths[i];
    ctx.strokeStyle = 'rgba(138,114,130,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, -H / 2);
    ctx.lineTo(x - 14, y);
    ctx.moveTo(x, -H / 2);
    ctx.lineTo(x + 14, y);
    ctx.stroke();
    softShadow(ctx, () => pot(ctx, x, y, 34, colors[i]));
    leaves(ctx, x, y - 2, 40, '#6FA77A', 5);
    // sarkan sarmaşık
    ctx.strokeStyle = '#7DB487';
    ctx.lineWidth = 2;
    for (const dx of [-10, 8]) {
      ctx.beginPath();
      ctx.moveTo(x + dx, y + 20);
      ctx.quadraticCurveTo(x + dx * 2.2, y + 48, x + dx * 1.2, y + 70 - i * 6);
      ctx.stroke();
      for (let k = 1; k <= 3; k++) {
        ctx.fillStyle = '#8CC096';
        ctx.beginPath();
        ctx.ellipse(x + dx * (1 + k * 0.35), y + 24 + k * 14, 4, 6.5, dx > 0 ? 0.6 : -0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
}

/** Işık zinciri ampul konumları (ışıltı animasyonu için dışa da verilir). */
function bulbPositions(): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const x = -W / 2 + 20 + t * (W - 40);
    const y = -H / 2 + 18 + Math.sin(t * Math.PI) * 40;
    pts.push({ x, y });
  }
  return pts;
}

function paintStringLights(ctx: CanvasRenderingContext2D, theme: RoomTheme): void {
  // ay penceresi
  softShadow(ctx, () => {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(0, 18, 42, 0, Math.PI * 2);
    ctx.fill();
  });
  const sky = ctx.createLinearGradient(0, -24, 0, 60);
  sky.addColorStop(0, '#6E6AA8');
  sky.addColorStop(1, '#C3A8D8');
  ctx.fillStyle = sky;
  ctx.beginPath();
  ctx.arc(0, 18, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFF4D6';
  ctx.beginPath();
  ctx.arc(10, 8, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#9A8AC4';
  ctx.beginPath();
  ctx.arc(16, 4, 10, 0, Math.PI * 2);
  ctx.fill();
  // tel + ampuller
  const pts = bulbPositions();
  ctx.strokeStyle = 'rgba(90,70,90,0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
  const bulbColors = ['#FFD36B', '#FFB38A', '#FFF0B3', mix(theme.accent, '#FFFFFF', 0.5)];
  pts.forEach((p, i) => {
    const c = bulbColors[i % bulbColors.length];
    const glow = ctx.createRadialGradient(p.x, p.y + 8, 0, p.x, p.y + 8, 18);
    glow.addColorStop(0, 'rgba(255,230,160,0.55)');
    glow.addColorStop(1, 'rgba(255,230,160,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(p.x - 18, p.y - 10, 36, 36);
    ctx.fillStyle = 'rgba(90,70,90,0.6)';
    ctx.fillRect(p.x - 2.5, p.y, 5, 4);
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 9, 4.5, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

function paintFrames(ctx: CanvasRenderingContext2D, theme: RoomTheme): void {
  const frames = [
    { x: -140, y: 0, w: 74, h: 92, art: '#B9D7C1' },
    { x: 0, y: -14, w: 96, h: 70, art: '#F2C9A8' },
    { x: 132, y: 6, w: 60, h: 60, art: mix(theme.accent, '#FFFFFF', 0.55) },
  ];
  for (const f of frames) {
    softShadow(ctx, () => {
      rr(ctx, f.x - f.w / 2, f.y - f.h / 2, f.w, f.h, 6);
      ctx.fillStyle = COLORS.wood;
      ctx.fill();
    });
    rr(ctx, f.x - f.w / 2 + 6, f.y - f.h / 2 + 6, f.w - 12, f.h - 12, 3);
    ctx.fillStyle = '#FFF8EE';
    ctx.fill();
    // basit manzara: tepe + güneş
    ctx.fillStyle = f.art;
    ctx.beginPath();
    ctx.ellipse(f.x - 4, f.y + f.h / 2 - 12, f.w * 0.42, f.h * 0.22, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = 'rgba(247,183,51,0.7)';
    ctx.beginPath();
    ctx.arc(f.x + f.w * 0.18, f.y - f.h * 0.14, Math.min(f.w, f.h) * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  // saat (ortadaki çerçevenin üstünde değil, sağ üstte)
  const cx = 64;
  const cy = -46;
  softShadow(ctx, () => {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.strokeStyle = COLORS.woodDark;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 20, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx, cy - 12);
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + 8, cy + 4);
  ctx.stroke();
}

function paintShelf(ctx: CanvasRenderingContext2D, theme: RoomTheme): void {
  const y = 34;
  softShadow(ctx, () => {
    ctx.fillStyle = COLORS.wood;
    ctx.fillRect(-170, y, 340, 10);
  });
  ctx.fillStyle = COLORS.woodDark;
  ctx.fillRect(-150, y + 10, 8, 12);
  ctx.fillRect(142, y + 10, 8, 12);
  const books = [
    { w: 16, h: 58, c: '#8FB3D9' },
    { w: 13, h: 50, c: '#E2A88A' },
    { w: 18, h: 62, c: mix(theme.accent, '#FFFFFF', 0.25) },
    { w: 12, h: 46, c: '#B9A6D9' },
    { w: 15, h: 54, c: '#9CC5A1' },
  ];
  let x = -150;
  for (const b of books) {
    rr(ctx, x, y - b.h, b.w, b.h, 2.5);
    ctx.fillStyle = b.c;
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillRect(x + 3, y - b.h + 8, b.w - 6, 2);
    x += b.w + 2;
  }
  // eğik kitap
  ctx.save();
  ctx.translate(x + 18, y);
  ctx.rotate(-0.35);
  rr(ctx, 0, -48, 14, 48, 2.5);
  ctx.fillStyle = '#E9C47A';
  ctx.fill();
  ctx.restore();
  // vazo + dal
  ctx.fillStyle = '#E8E1F0';
  ctx.beginPath();
  ctx.ellipse(110, y - 18, 16, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#6FA77A';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(110, y - 34);
  ctx.quadraticCurveTo(100, y - 70, 88, y - 82);
  ctx.moveTo(110, y - 34);
  ctx.quadraticCurveTo(122, y - 64, 134, y - 76);
  ctx.stroke();
  leaves(ctx, 90, y - 78, 22, '#8CC096', 3);
  leaves(ctx, 132, y - 72, 22, '#8CC096', 3);
}

/** Izgaranın üstündeki boş duvara tema dekoru yerleştirir. availableH < MIN ise hiçbir şey çizmez. */
export function addWallDecor(scene: Phaser.Scene, theme: RoomTheme, centerX: number, centerY: number, availableH: number): Phaser.GameObjects.Container | null {
  if (availableH < 84) return null;
  const scale = Phaser.Math.Clamp((availableH - 10) / H, 0.5, 1.15);
  const key = bakeCentered(scene, `decor-${theme.id}`, { width: W, height: H }, (_g, ctx) => {
    if (theme.id === 'peach-morning') paintWindow(ctx, theme);
    else if (theme.id === 'sage-garden') paintHangingPlants(ctx);
    else if (theme.id === 'lavender-dusk') paintStringLights(ctx, theme);
    else if (theme.id === 'honey-afternoon') paintFrames(ctx, theme);
    else paintShelf(ctx, theme);
  });
  const root = scene.add.container(centerX, centerY).setDepth(-50).setScale(scale).setAlpha(0);
  root.add(scene.add.image(0, 0, key).setDisplaySize(W, H));
  scene.tweens.add({ targets: root, alpha: 0.92, duration: 600, ease: EASE.out });

  if (theme.id === 'lavender-dusk' && !prefersReducedMotion()) {
    // ampuller tek tek, farklı fazlarda hafifçe parlar
    for (const p of bulbPositions()) {
      const glow = scene.add.circle(p.x, p.y + 9, 9, 0xfff0b3, 0.0);
      root.add(glow);
      scene.tweens.add({ targets: glow, fillAlpha: 0.55, duration: Phaser.Math.Between(700, 1300), delay: Phaser.Math.Between(0, 900), yoyo: true, repeat: -1, ease: EASE.inOut });
    }
  }
  return root;
}
