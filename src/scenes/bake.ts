import type Phaser from 'phaser';
import { CanvasGraphics } from './canvasGraphics';
import { currentRenderZoom } from './viewport';

/**
 * "Pişirme" (bake): bir çizimi BİR KEZ, ekranın gerçek piksel yoğunluğunda bir canvas dokusuna
 * çizip TextureManager'a kaydeder. Çalışma anında yalnızca Image'lar kullanılır -- her hamlede
 * Graphics path'lerini yeniden tessellate etmek yerine (bkz. DEVLOG Faz 0 madde 25).
 *
 * Dokular sahneler arası paylaşılır (TextureManager global). Anahtar boyut + çözünürlük içerdiği
 * için farklı ızgara ölçekleri ayrı dokular üretir; sayıları sınırlıdır (tür x boyut x durum).
 */

export interface BakedSize {
  /** Mantıksal (sahne birimi) genişlik/yükseklik -- Image bu boyutta gösterilir. */
  readonly width: number;
  readonly height: number;
}

/** Pişirme çözünürlüğü: kamera zoom'u (en az 1, en fazla 3), 0.25'lik adımlara yuvarlanır (anahtar sayısı sınırlı kalsın). */
export function bakeResolution(): number {
  return Math.min(3, Math.max(1, Math.ceil(currentRenderZoom() * 4) / 4));
}

/**
 * `draw` mantıksal koordinatlarda, ORİJİN doku merkezinde olacak şekilde çizer (eşya çizimleri
 * zaten merkez-orijinli). Dönen değer: doku anahtarı (aynı anahtar varsa yeniden çizilmez).
 */
export function bakeCentered(
  scene: Phaser.Scene,
  key: string,
  size: BakedSize,
  draw: (g: CanvasGraphics, ctx: CanvasRenderingContext2D) => void,
): string {
  const z = bakeResolution();
  const fullKey = `${key}@${z}`;
  if (scene.textures.exists(fullKey)) return fullKey;
  const pw = Math.max(2, Math.ceil(size.width * z));
  const ph = Math.max(2, Math.ceil(size.height * z));
  const tex = scene.textures.createCanvas(fullKey, pw, ph);
  if (!tex) return fullKey;
  const ctx = tex.getContext();
  ctx.save();
  ctx.scale(pw / size.width, ph / size.height);
  ctx.translate(size.width / 2, size.height / 2);
  draw(new CanvasGraphics(ctx), ctx);
  ctx.restore();
  tex.refresh();
  return fullKey;
}

/** Pişmiş dokuyu mantıksal boyutunda gösteren Image (orijin merkez). */
export function addBakedImage(scene: Phaser.Scene, key: string, size: BakedSize, x = 0, y = 0): Phaser.GameObjects.Image {
  return scene.add.image(x, y, key).setDisplaySize(size.width, size.height);
}
