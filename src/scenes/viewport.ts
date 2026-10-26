import Phaser from 'phaser';

/**
 * Keskin + kenardan kenara render temeli (bkz. DEVLOG Faz 1).
 *
 * Eskiden oyun sabit 540x960 canvas'a çizilip Scale.FIT ile büyütülüyordu: uzun telefonlarda üst/alt
 * letterbox bantları kalıyor, yüksek DPI ekranlarda her şey ~2x büyütüldüğü için bulanıklaşıyordu.
 *
 * Şimdi:
 *  - Canvas'ın GERÇEK piksel boyutu = pencere CSS boyutu x renderScale (DPR, en fazla 2 -- 3x
 *    ekranlarda framebuffer'ı gereksiz büyütüp orta seviye cihazda FPS düşürmemek için).
 *  - Her sahne "mantıksal" bir koordinat sisteminde çalışır: kısa kenar 540 sabit, uzun kenar ekranın
 *    en-boy oranına göre uzar (EXPAND). Kamera zoom'u mantıksal -> fiziksel dönüşümü yapar; böylece
 *    sahne kodu hâlâ "540 genişlik" varsayımıyla yazılır ama vektörler/yazılar tam çözünürlükte çizilir.
 *  - Aşırı oranlar (21:9'dan uzun ya da 4:5'ten geniş -- ör. masaüstü yatay pencere) sınırlanır,
 *    artan alan sahnenin kendi arka plan rengiyle dolar (bkz. fitCamera).
 */

export const BASE_WIDTH = 540;
export const BASE_HEIGHT = 960;
const MAX_RENDER_SCALE = 2;
/** En uzun desteklenen oran (genişlik/yükseklik) ~ 9:21 */
const MIN_ASPECT = 9 / 21;
/** En geniş desteklenen oran ~ 4:5 (dikey tablet) */
const MAX_ASPECT = 4 / 5;

export interface View {
  readonly width: number;
  readonly height: number;
}

export function renderScale(): number {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  return Math.min(MAX_RENDER_SCALE, Math.max(1, dpr));
}

/** Canvas'ın fiziksel piksel boyutu (pencere CSS boyutu x renderScale). */
export function physicalSize(): View {
  const k = renderScale();
  return {
    width: Math.max(1, Math.round(window.innerWidth * k)),
    height: Math.max(1, Math.round(window.innerHeight * k)),
  };
}

/** Fiziksel boyuttan mantıksal sahne boyutunu türetir (kısa kenar 540/960 tabanı korunur). Uzun
 * kenar YUVARLANMAZ: yuvarlama, zoom'u iki eksende farklı kılıp kenarda alt-piksel bir şerit bırakıyordu. */
export function logicalSizeFor(physWidth: number, physHeight: number): View {
  const aspect = Phaser.Math.Clamp(physWidth / physHeight, MIN_ASPECT, MAX_ASPECT);
  if (aspect <= BASE_WIDTH / BASE_HEIGHT) {
    return { width: BASE_WIDTH, height: BASE_WIDTH / aspect };
  }
  return { width: BASE_HEIGHT * aspect, height: BASE_HEIGHT };
}

const views = new WeakMap<Phaser.Scene, View>();
let currentZoom = 1;

/** Son kurulan sahnenin kamera zoom'u -- yeni Text'lerin doku çözünürlüğü buna göre seçilir. */
export function currentRenderZoom(): number {
  return currentZoom;
}

/** Her sahnenin create()'inin İLK satırında çağrılır: mantıksal boyutu seçip kamerayı ayarlar. */
export function setupView(scene: Phaser.Scene): View {
  const view = logicalSizeFor(scene.scale.width, scene.scale.height);
  views.set(scene, view);
  fitCamera(scene, view);
  return view;
}

export function viewOf(scene: Phaser.Scene): View {
  return views.get(scene) ?? { width: BASE_WIDTH, height: BASE_HEIGHT };
}

/** Mantıksal alanı canvas'a sığdırıp ortalar (pencere yeniden boyutlanınca da çağrılır). */
export function fitCamera(scene: Phaser.Scene, view: View = viewOf(scene)): void {
  const cam = scene.cameras.main;
  const pw = scene.scale.width;
  const ph = scene.scale.height;
  const zoom = Math.min(pw / view.width, ph / view.height);
  cam.setViewport(0, 0, pw, ph);
  cam.setOrigin(0, 0);
  cam.setZoom(zoom);
  cam.setScroll(-(pw / zoom - view.width) / 2, -(ph / zoom - view.height) / 2);
  currentZoom = zoom;
}

/** Ekran (canvas) pikselinden mantıksal sahne koordinatına. */
export function toWorld(scene: Phaser.Scene, pointer: Phaser.Input.Pointer): { x: number; y: number } {
  const p = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
  return { x: p.x, y: p.y };
}

/** Pencere boyutu değişince canvas'ı yeniden boyutlandırır, aktif sahnelerin kamerasını yeniden sığdırır
 * (sahneyi YENİDEN BAŞLATMAZ -- oyun durumu kaybolmasın diye; yeni oran bir sonraki sahnede devreye girer). */
export function installResizeHandler(game: Phaser.Game): void {
  let pending = 0;
  const apply = () => {
    pending = 0;
    const { width, height } = physicalSize();
    if (width === game.scale.width && height === game.scale.height) return;
    game.scale.resize(width, height);
    for (const scene of game.scene.getScenes(true)) fitCamera(scene);
  };
  const schedule = () => {
    if (pending) cancelAnimationFrame(pending);
    pending = requestAnimationFrame(apply);
  };
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
}
