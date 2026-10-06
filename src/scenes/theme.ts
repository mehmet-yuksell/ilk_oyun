/**
 * Tek tasarım sistemi dosyası -- tüm sahneler renk/radius/gölge/boşluk değerlerini buradan alır.
 * Gerçek renk DEĞERLERİ `src/config/tuning.ts`te toplanır (tek ayar dosyası); bu dosya onları
 * Phaser'ın beklediği sayısal forma çevirip radius/spacing/gölge gibi uygulama tokenlarıyla birlikte sunar.
 */
import { ITEM_ACCENTS as TUNING_ITEM_ACCENTS, PALETTE, ROOM_THEMES } from '../config/tuning';

const ROOM_THEMES_DEFAULT = ROOM_THEMES[0];

/** '#RRGGBB' -> 0xRRGGBB (Phaser Graphics/Text farklı renk formatları bekler, tek kaynaktan üretilir). */
export function hexToNum(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

/** Bir rengi percent kadar açar (>0) ya da koyulaştırır (<0) -- degrade dolgu için üst/alt ton üretir. */
export function shade(hex: string, percent: number): number {
  const num = hexToNum(hex);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const adjust = (channel: number) =>
    percent >= 0
      ? Math.round(channel + (255 - channel) * percent)
      : Math.round(channel * (1 + percent));
  return (clamp255(adjust(r)) << 16) | (clamp255(adjust(g)) << 8) | clamp255(adjust(b));
}

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, v));
}

export const FONT_FAMILY = 'Fredoka, "Trebuchet MS", sans-serif';

/**
 * Tutarlı tipografi ölçeği (px) -- yeni metin eklerken en yakın basamağı seç (bkz. Faz 4 kararları).
 * Her sahnedeki text() çağrıları bu basamaklardan birine denk gelir; ayrı bir sabit olarak
 * dışa aktarılmaz (her satırda import etmeye değecek kadar sık değişmiyor) ama tasarım kararı
 * burada belgelenir ki yeni eklenen metinler rastgele bir boyuta kaymasın:
 *   28 -- ekran başlığı (ör. "Oturma Odası", "Ayarlar")
 *   22 -- panel/diyalog başlığı (ör. "Seviye tamamlandı!")
 *   17-19 -- ikincil başlık/rozet (ör. "Seviye N" hap etiketi, sonuç paneli rozeti)
 *   14-15 -- HUD sayaçları (hamle, kalan eşya, oda sayacı, yıldız) -- her zaman fontStyle 600
 *   12-13 -- gövde/açıklama metni, ikincil buton etiketleri
 */
export const TYPE_SCALE = {
  screenTitle: 28,
  panelTitle: 22,
  sectionTitle: 18,
  hudCounter: 15,
  body: 13,
  caption: 12,
} as const;

export const COLORS = {
  // Arkaplan varsayılanı: gerçek oyun/oda sahneleri ROOM_THEMES'i (tuning.ts) seviyeye göre
  // döndürerek kullanır; bu ikisi yalnızca tema almayan sahneler (ör. Ayarlar) için varsayılandır.
  bgTop: ROOM_THEMES_DEFAULT.bgTop,
  bgBottom: ROOM_THEMES_DEFAULT.bgBottom,

  ink: PALETTE.ink,
  inkSoft: PALETTE.inkSoft,
  cream: PALETTE.cream,

  surface: PALETTE.surface,
  surfaceMuted: PALETTE.surfaceMuted,

  // Doygun vurgu paleti (en az 10 -- mercan, turkuaz, hardal, mor, yeşil, pembe, gök mavisi,
  // turuncu, bordo, lacivert-mavi). Gerçek değerler tuning.ts'te (tek ayar dosyası).
  coral: PALETTE.coral,
  turquoise: PALETTE.turquoise,
  mustard: PALETTE.mustard,
  purple: PALETTE.purple,
  green: PALETTE.green,
  pink: PALETTE.pink,
  sky: PALETTE.sky,
  amber: PALETTE.amber,
  maroon: PALETTE.maroon,
  navy: PALETTE.navy,

  gold: PALETTE.gold, // yıldız
  success: PALETTE.success,
  danger: PALETTE.danger,
} as const;

/** 10 eşya türü için sırayla kullanılan doygun aksan renkleri (itemVisuals.ts bu sırayı ITEM_TYPE_POOL ile eşler). */
export const ITEM_ACCENTS: readonly string[] = TUNING_ITEM_ACCENTS;

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
 * üçgen/çizgi artefaktları üretiyor. Bu yüzden sabit bir "sonsuz" değer yerine her zaman
 * elemanın kendi yüksekliğinin yarısı kullanılmalı.
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
} as const;

export const SHADOW = {
  color: 0x3a2317,
  alpha: 0.22,
  offsetY: 5,
} as const;

export const HIGHLIGHT = {
  color: 0xffffff,
  alpha: 0.4,
} as const;
