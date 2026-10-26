/**
 * TEK TASARIM SİSTEMİ DOSYASI -- renk paleti, oda (arka plan) temaları, tipografi, köşe yuvarlaklığı,
 * boşluk, gölge ve hareket (easing/süre) tokenları burada. Sahnelerde ham hex/px/ease değeri
 * yazmak yerine buradan alınır (bkz. DEVLOG Faz 1). `src/config/tuning.ts` geriye dönük uyumluluk
 * için renk/tema sabitlerini buradan yeniden dışa aktarır.
 *
 * Dil: sıcak "cozy oda" -- krem/şeftali/adaçayı/lavanta gibi yumuşak zeminler, üzerinde yeterince
 * doygun (ama neon olmayan) eşya renkleri ve sıcak koyu erik-kahve metin.
 */
import type Phaser from 'phaser';

// ---------------------------------------------------------------------
// Renk yardımcıları
// ---------------------------------------------------------------------

/** '#RRGGBB' -> 0xRRGGBB (Phaser Graphics/Text farklı renk formatları bekler, tek kaynaktan üretilir). */
export function hexToNum(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

/** 0xRRGGBB -> '#rrggbb' */
export function numToHex(num: number): string {
  return `#${num.toString(16).padStart(6, '0')}`;
}

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, v));
}

/** Bir rengi percent kadar açar (>0) ya da koyulaştırır (<0) -- degrade dolgu için üst/alt ton üretir. */
export function shade(hex: string, percent: number): number {
  const num = hexToNum(hex);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const adjust = (channel: number) =>
    percent >= 0 ? Math.round(channel + (255 - channel) * percent) : Math.round(channel * (1 + percent));
  return (clamp255(adjust(r)) << 16) | (clamp255(adjust(g)) << 8) | clamp255(adjust(b));
}

/** shade()'in '#rrggbb' döndüren hâli (Text rengi / CSS degradesi için). */
export function shadeHex(hex: string, percent: number): string {
  return numToHex(shade(hex, percent));
}

/** İki rengi t (0..1) oranında karıştırır. */
export function mix(a: string, b: string, t: number): string {
  const x = hexToNum(a);
  const y = hexToNum(b);
  const ch = (n: number, s: number) => (n >> s) & 0xff;
  const lerp = (s: number) => Math.round(ch(x, s) + (ch(y, s) - ch(x, s)) * t);
  return numToHex((lerp(16) << 16) | (lerp(8) << 8) | lerp(0));
}

// ---------------------------------------------------------------------
// Palet
// ---------------------------------------------------------------------

/**
 * Çekirdek palet: 8 uyumlu "cozy" ton (krem, şeftali, terrakota, bal, adaçayı, lavanta, puslu mavi,
 * gül kurusu) + metin ve işlevsel renkler. Eşya renkleri (ITEM_ACCENTS) bunların biraz daha doygun
 * "boya" sürümleridir -- açık zeminde öne çıksınlar diye.
 */
export const PALETTE = {
  // zeminler
  cream: '#FFF9F0',
  paper: '#FBF1E3',
  peach: '#F6C7A9',
  terracotta: '#E07A5F',
  honey: '#F2C46D',
  sage: '#9CC5A1',
  lavender: '#BBA8DE',
  mist: '#9DBFDD',
  rose: '#E9A3B5',

  // ahşap (raflar, rozet kenarları)
  wood: '#D49A6A',
  woodDark: '#A86E45',
  woodLight: '#EBC39C',

  // metin -- sıcak, koyu erik-kahve (saf siyah/lacivert yerine)
  ink: '#4A3443',
  inkSoft: '#8A7282',
  inkFaint: '#C9B8BE',

  surface: '#FFFFFF',
  surfaceWarm: '#FFFBF6',
  surfaceMuted: '#EFE5DA',

  // işlevsel
  gold: '#F7B733',
  goldLight: '#FFE08A',
  success: '#5DB075',
  /** "nazik hayır" -- sert kırmızı değil, sıcak gül kurusu. */
  gentleNo: '#D9707F',

  // karartma (modal arkası) -- siyah değil, sıcak koyu erik
  overlay: '#3B2433',

  // öğretici eli (ten) ve oda illüstrasyonlarındaki ekran/cam tonları
  skin: '#F2C49B',
  screenDark: '#3A2B36',
  glassLight: '#FFF8F0',

  // Eşya "boya" renkleri (10 tür) -- bkz. ITEM_ACCENTS. Geriye dönük adlar korunur.
  coral: '#E8735E',
  turquoise: '#3FA99B',
  mustard: '#E9B23F',
  purple: '#8E72D0',
  green: '#5FB370',
  pink: '#E27A9E',
  sky: '#4F95D2',
  amber: '#EE9548',
  maroon: '#B5476A',
  navy: '#5566C2',

  /** Eski ad: "danger" artık sert kırmızı değil, gentleNo ile aynı yumuşak ton. */
  danger: '#D9707F',
} as const;

/** 10 eşya türü için sırayla kullanılan aksan renkleri (itemVisuals.ts bu sırayı ITEM_TYPE_POOL ile eşler). */
export const ITEM_ACCENTS: readonly string[] = [
  PALETTE.coral,
  PALETTE.turquoise,
  PALETTE.mustard,
  PALETTE.purple,
  PALETTE.green,
  PALETTE.pink,
  PALETTE.sky,
  PALETTE.amber,
  PALETTE.maroon,
  PALETTE.navy,
];

// ---------------------------------------------------------------------
// Oda / arka plan temaları (seviye ilerledikçe döner -- bkz. themeForLevel)
// ---------------------------------------------------------------------

export interface RoomTheme {
  readonly id: string;
  /** Duvarın üst / alt degrade durakları. */
  readonly bgTop: string;
  readonly bgBottom: string;
  /** Pencere ışığı (yumuşak radyal parlama) rengi. */
  readonly glow: string;
  /** Zemin (alt bant) rengi -- duvarla sert çizgi yerine yumuşak geçişle birleşir. */
  readonly floor: string;
  /** Uçuşan toz/ışık parçacıklarının rengi. */
  readonly mote: string;
  /** Temanın vurgu rengi (ilerleme çubukları, seçim halkası ikincil tonu). */
  readonly accent: string;
}

export const ROOM_THEMES: readonly RoomTheme[] = [
  { id: 'peach-morning', bgTop: '#FDEBDC', bgBottom: '#F7D3BD', glow: '#FFF6E0', floor: '#EDBFA2', mote: '#FFFFFF', accent: '#E07A5F' },
  { id: 'sage-garden', bgTop: '#EEF4E6', bgBottom: '#D3E5CB', glow: '#FBFFF0', floor: '#BFD7B5', mote: '#FFFFFF', accent: '#6FA77A' },
  { id: 'lavender-dusk', bgTop: '#F2ECF9', bgBottom: '#DCD0F0', glow: '#FFF4FB', floor: '#C9BAE6', mote: '#FFF3FA', accent: '#8E72D0' },
  { id: 'honey-afternoon', bgTop: '#FDF3DC', bgBottom: '#F5DDAE', glow: '#FFF8E2', floor: '#E9C88E', mote: '#FFFBEA', accent: '#D99A2B' },
  { id: 'misty-blue', bgTop: '#E9F1F8', bgBottom: '#CADCEC', glow: '#F7FBFF', floor: '#B4CBE2', mote: '#FFFFFF', accent: '#4F95D2' },
] as const;

/** Tema her THEME_CHANGE_EVERY_LEVELS seviyede bir döner (seviye 1-10 -> tema 0, 11-20 -> tema 1, ...). */
export const THEME_CHANGE_EVERY_LEVELS = 10;

export function themeIndexForLevel(levelNumber: number): number {
  const n = Math.max(1, Math.floor(levelNumber));
  return Math.floor((n - 1) / THEME_CHANGE_EVERY_LEVELS) % ROOM_THEMES.length;
}

export function themeForLevel(levelNumber: number): RoomTheme {
  return ROOM_THEMES[themeIndexForLevel(levelNumber)];
}

/** Oda ekranındaki restore edilebilir mobilyaların renkleri -- eşya paletinden ayrı, "dekor"
 * hissi veren biraz daha topraksı tonlar (bkz. roomVisuals.ts). */
export const ROOM_ITEM_COLORS: readonly string[] = [
  '#E2825F', '#4FA89C', '#E3B04F', '#6BAF7C', '#D9779D',
  '#5E93C8', '#D98E4A', '#8E76C6', '#D7A06A', '#4E9C93',
];

/** Tema almayan sahneler (ayarlar, splash) için varsayılan. */
export const DEFAULT_THEME = ROOM_THEMES[0];

/** Eski kodla uyumluluk: COLORS.x adları hâlâ kullanılıyor. */
export const COLORS = {
  ...PALETTE,
  bgTop: DEFAULT_THEME.bgTop,
  bgBottom: DEFAULT_THEME.bgBottom,
} as const;

// ---------------------------------------------------------------------
// Tipografi
// ---------------------------------------------------------------------

/** Nunito (OFL, bkz. CREDITS.md) -- yuvarlak hatlı, Türkçe karakterleri (ğ ş ı İ ö ç ü) eksiksiz. */
export const FONT_FAMILY = 'Nunito, "Trebuchet MS", sans-serif';

/**
 * Tipografi ölçeği -- her metin bir ROL seçer; boyut + ağırlık rolden gelir (rastgele px yok).
 *   display      44/900  -- logo / büyük başlık
 *   screenTitle  30/900  -- ekran başlığı ("Oturma Odası", "Ayarlar")
 *   panelTitle   26/900  -- panel başlığı ("Seviye tamamlandı!")
 *   sectionTitle 20/800  -- ikincil başlık, seviye hapı
 *   button       21/800  -- birincil buton
 *   buttonSmall  16/800  -- ikincil buton
 *   hud          17/800  -- HUD sayaçları
 *   body         16/600  -- gövde metni
 *   caption      13/700  -- açıklama, küçük etiket
 *   badge        14/800  -- rozet içi sayı
 */
export const TYPE_SCALE = {
  display: 44,
  screenTitle: 30,
  panelTitle: 26,
  sectionTitle: 20,
  button: 21,
  buttonSmall: 16,
  hud: 17,
  hudCounter: 17,
  body: 16,
  caption: 13,
  badge: 14,
} as const;

export type TextRole = 'display' | 'screenTitle' | 'panelTitle' | 'sectionTitle' | 'button' | 'buttonSmall' | 'hud' | 'body' | 'caption' | 'badge';

const ROLE_WEIGHT: Record<TextRole, string> = {
  display: '900',
  screenTitle: '900',
  panelTitle: '900',
  sectionTitle: '800',
  button: '800',
  buttonSmall: '800',
  hud: '800',
  body: '600',
  caption: '700',
  badge: '800',
};

/** Bir rol için Phaser metin stili üretir; overrides ile renk/hizalama/kaydırma eklenebilir. */
export function textStyle(role: TextRole, overrides: Phaser.Types.GameObjects.Text.TextStyle = {}): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT_FAMILY,
    fontSize: `${TYPE_SCALE[role]}px`,
    fontStyle: ROLE_WEIGHT[role],
    color: PALETTE.ink,
    ...overrides,
  };
}

// ---------------------------------------------------------------------
// Şekil / boşluk / gölge
// ---------------------------------------------------------------------

export const RADIUS = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
} as const;

/**
 * "Hap" (pill) şekli için kullanılacak radius: CSS'in aksine Phaser'ın fillRoundedRect'i
 * radius'u otomatik min(width,height)/2'ye KIRPMIYOR -- elemanın yüksekliğinden çok büyük
 * bir radius (ör. 999) verilirse köşe yay hesaplaması bozulup ekranı kesen dev, hatalı
 * üçgen/çizgi artefaktları üretiyor. Bu yüzden her zaman elemanın kendi yüksekliğinin yarısı.
 */
export function pillRadius(height: number): number {
  return height / 2;
}

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/** Gölge rengi sıcak koyu kahve (siyah değil) -- cozy dilde gri/siyah gölge "kirli" durur. */
export const SHADOW = {
  color: 0x5a3a2c,
  alpha: 0.18,
  offsetY: 5,
  /** Katmanlı yumuşak gölge: [offsetY, genişleme, alfa] -- drawSoftShadow kullanır. */
  soft: [
    [2, 0, 0.1],
    [6, 3, 0.07],
    [12, 7, 0.05],
  ] as readonly (readonly [number, number, number])[],
} as const;

export const HIGHLIGHT = {
  color: 0xffffff,
  alpha: 0.45,
} as const;

/** Phaser Graphics ile katmanlı yumuşak gölge -- tek sert gölge yerine 3 kademeli, kenarı eriyen. */
export function drawSoftShadow(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, radius: number, strength = 1): void {
  for (const [dy, grow, alpha] of SHADOW.soft) {
    g.fillStyle(SHADOW.color, alpha * strength);
    g.fillRoundedRect(x - grow, y + dy - grow * 0.4, w + grow * 2, h + grow * 0.8, Math.min(radius + grow, (h + grow * 0.8) / 2));
  }
}

// ---------------------------------------------------------------------
// Hareket (easing + süre) -- linear hiçbir yerde kullanılmaz
// ---------------------------------------------------------------------

export const EASE = {
  out: 'Cubic.easeOut',
  in: 'Cubic.easeIn',
  inOut: 'Sine.easeInOut',
  back: 'Back.easeOut',
  backIn: 'Back.easeIn',
  soft: 'Quad.easeOut',
  elastic: 'Elastic.easeOut',
} as const;

export const DURATION = {
  fast: 120,
  base: 220,
  slow: 380,
  scene: 260,
} as const;
