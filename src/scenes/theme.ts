/**
 * Tek tasarım sistemi dosyası -- tüm sahneler renk/radius/gölge/boşluk değerlerini buradan alır.
 * Sabit kodlanmış hex/sayı renkleri sahne dosyalarında tekrar tekrar yazmak yerine hep buraya
 * referans verilir ki paleti tek yerden ayarlamak mümkün olsun.
 */

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

export const COLORS = {
  // Arkaplan: şeftali-bej -> açık turuncu dikey degrade (krem/düz bej DEĞİL).
  bgTop: '#FBDCC0',
  bgBottom: '#FFB980',

  ink: '#4A3326', // ana metin
  inkSoft: '#8A6A52', // ikincil metin
  cream: '#FFF8F0', // koyu zeminde metin

  surface: '#FFFFFF', // kart/panel zemini (alfa ile kullanılır)
  surfaceMuted: '#E4D6C5', // yenilenmemiş/pasif zemin

  // Doygun vurgu paleti (en az 6 -- mercan, turkuaz, hardal, mor, yeşil, pembe + ekstra).
  coral: '#FF6B52',
  turquoise: '#1FB8AC',
  mustard: '#F2A93B',
  purple: '#9568D8',
  green: '#4CAF6B',
  pink: '#F0609C',
  sky: '#4F8FDB',
  amber: '#E07C3E',

  gold: '#F5B942', // yıldız
  success: '#4CAF6B',
  danger: '#E05B4F',
} as const;

/** 10 eşya türü için sırayla kullanılan doygun aksan renkleri (itemVisuals.ts bu sırayı ITEM_TYPE_POOL ile eşler). */
export const ITEM_ACCENTS: readonly string[] = [
  COLORS.coral,
  COLORS.turquoise,
  COLORS.mustard,
  COLORS.purple,
  COLORS.green,
  COLORS.pink,
  COLORS.sky,
  COLORS.amber,
  '#C9556B', // kiremit-bordo
  '#5FA8A0', // deniz yeşili
];

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
