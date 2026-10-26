/**
 * Phaser.GameObjects.Graphics API'sinin bu projede kullanılan alt kümesini bir Canvas 2D bağlamına
 * çizen adaptör. Eşya/kap çizim fonksiyonları (itemVisuals.ts) hiç değişmeden hem bu adaptöre hem
 * de gerçek Graphics'e çizebilir; adaptör sayesinde çizimler BİR KEZ yüksek çözünürlüklü bir dokuya
 * "pişirilir" (bkz. bake.ts) -- Canvas 2D'nin gerçek (her şekle göre) degradeleri, bulanık gölgeleri ve
 * pürüzsüz kenarlarıyla, ve çalışma anında sıfır vektör çizim maliyetiyle.
 *
 * Farklar (bilerek): fillGradientStyle her şeklin KENDİ sınırlayıcı kutusuna göre üst->alt doğrusal
 * degrade uygular (Phaser'daki köşe-renk interpolasyonunun yumuşak eşdeğeri).
 */

type Point = { x: number; y: number };
type Radius = number | { tl: number; tr: number; bl: number; br: number };

function css(color: number, alpha: number): string {
  return `rgba(${(color >> 16) & 255},${(color >> 8) & 255},${color & 255},${alpha})`;
}

interface Gradient {
  readonly top: string;
  readonly bottom: string;
}

export class CanvasGraphics {
  readonly ctx: CanvasRenderingContext2D;
  private fill: string | Gradient = 'rgba(0,0,0,1)';
  private stroke = 'rgba(0,0,0,1)';
  private strokeWidth = 1;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
  }

  clear(): this {
    return this;
  }

  fillStyle(color: number, alpha = 1): this {
    this.fill = css(color, alpha);
    return this;
  }

  fillGradientStyle(tl: number, _tr: number, bl: number, _br: number, alphaTl = 1, _alphaTr = 1, alphaBl = alphaTl, _alphaBr = alphaBl): this {
    this.fill = { top: css(tl, alphaTl), bottom: css(bl, alphaBl) };
    return this;
  }

  lineStyle(width: number, color: number, alpha = 1): this {
    this.strokeWidth = width;
    this.stroke = css(color, alpha);
    return this;
  }

  private applyFill(minY: number, maxY: number): void {
    if (typeof this.fill === 'string') {
      this.ctx.fillStyle = this.fill;
      return;
    }
    const grad = this.ctx.createLinearGradient(0, minY, 0, maxY);
    grad.addColorStop(0, this.fill.top);
    grad.addColorStop(1, this.fill.bottom);
    this.ctx.fillStyle = grad;
  }

  private applyStroke(): void {
    this.ctx.strokeStyle = this.stroke;
    this.ctx.lineWidth = this.strokeWidth;
  }

  private roundedPath(x: number, y: number, w: number, h: number, r: Radius): void {
    const rad = typeof r === 'number' ? { tl: r, tr: r, bl: r, br: r } : r;
    const max = Math.min(w, h) / 2;
    const tl = Math.min(rad.tl, max);
    const tr = Math.min(rad.tr, max);
    const bl = Math.min(rad.bl, max);
    const br = Math.min(rad.br, max);
    const c = this.ctx;
    c.beginPath();
    c.moveTo(x + tl, y);
    c.lineTo(x + w - tr, y);
    c.arcTo(x + w, y, x + w, y + tr, tr);
    c.lineTo(x + w, y + h - br);
    c.arcTo(x + w, y + h, x + w - br, y + h, br);
    c.lineTo(x + bl, y + h);
    c.arcTo(x, y + h, x, y + h - bl, bl);
    c.lineTo(x, y + tl);
    c.arcTo(x, y, x + tl, y, tl);
    c.closePath();
  }

  fillRoundedRect(x: number, y: number, w: number, h: number, r: Radius = 20): this {
    this.roundedPath(x, y, w, h, r);
    this.applyFill(y, y + h);
    this.ctx.fill();
    return this;
  }

  strokeRoundedRect(x: number, y: number, w: number, h: number, r: Radius = 20): this {
    this.roundedPath(x, y, w, h, r);
    this.applyStroke();
    this.ctx.stroke();
    return this;
  }

  fillRect(x: number, y: number, w: number, h: number): this {
    this.applyFill(y, y + h);
    this.ctx.fillRect(x, y, w, h);
    return this;
  }

  private ellipsePath(x: number, y: number, w: number, h: number): void {
    this.ctx.beginPath();
    this.ctx.ellipse(x, y, Math.max(0.01, w / 2), Math.max(0.01, h / 2), 0, 0, Math.PI * 2);
  }

  fillEllipse(x: number, y: number, w: number, h: number): this {
    this.ellipsePath(x, y, w, h);
    this.applyFill(y - h / 2, y + h / 2);
    this.ctx.fill();
    return this;
  }

  strokeEllipse(x: number, y: number, w: number, h: number): this {
    this.ellipsePath(x, y, w, h);
    this.applyStroke();
    this.ctx.stroke();
    return this;
  }

  fillCircle(x: number, y: number, r: number): this {
    return this.fillEllipse(x, y, r * 2, r * 2);
  }

  strokeCircle(x: number, y: number, r: number): this {
    return this.strokeEllipse(x, y, r * 2, r * 2);
  }

  private polyPath(points: readonly Point[], close: boolean): void {
    const c = this.ctx;
    c.beginPath();
    points.forEach((p, i) => (i === 0 ? c.moveTo(p.x, p.y) : c.lineTo(p.x, p.y)));
    if (close) c.closePath();
  }

  fillPoints(points: readonly Point[], close = true): this {
    this.polyPath(points, close);
    const ys = points.map((p) => p.y);
    this.applyFill(Math.min(...ys), Math.max(...ys));
    this.ctx.fill();
    return this;
  }

  strokePoints(points: readonly Point[], close = false): this {
    this.polyPath(points, close);
    this.applyStroke();
    this.ctx.stroke();
    return this;
  }

  fillTriangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number): this {
    return this.fillPoints(
      [
        { x: x0, y: y0 },
        { x: x1, y: y1 },
        { x: x2, y: y2 },
      ],
      true,
    );
  }

  lineBetween(x1: number, y1: number, x2: number, y2: number): this {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    this.applyStroke();
    c.stroke();
    return this;
  }
}

/**
 * Çizim fonksiyonlarının hem CanvasGraphics hem Phaser.Graphics kabul etmesi için ortak yapısal tip
 * (dönüş değerleri kullanılmadığı için unknown -- iki sınıf da zincirleme için kendini döndürür).
 */
export interface GraphicsLike {
  clear(): unknown;
  fillStyle(color: number, alpha?: number): unknown;
  fillGradientStyle(tl: number, tr: number, bl: number, br: number, alphaTl?: number, alphaTr?: number, alphaBl?: number, alphaBr?: number): unknown;
  lineStyle(width: number, color: number, alpha?: number): unknown;
  fillRoundedRect(x: number, y: number, w: number, h: number, r?: Radius): unknown;
  strokeRoundedRect(x: number, y: number, w: number, h: number, r?: Radius): unknown;
  fillRect(x: number, y: number, w: number, h: number): unknown;
  fillEllipse(x: number, y: number, w: number, h: number): unknown;
  strokeEllipse(x: number, y: number, w: number, h: number): unknown;
  fillCircle(x: number, y: number, r: number): unknown;
  strokeCircle(x: number, y: number, r: number): unknown;
  fillPoints(points: Point[], close?: boolean): unknown;
  strokePoints(points: Point[], close?: boolean): unknown;
  fillTriangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number): unknown;
  lineBetween(x1: number, y1: number, x2: number, y2: number): unknown;
}
