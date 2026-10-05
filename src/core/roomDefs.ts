import type { RoomDef } from './room';

/** Her oda için 10 öğenin yenileme maliyeti (yıldız), hafif artan bir eğri -- bir odayı tamamen
 * yenilemek toplam 200 yıldız tutar (seviye başına 10 yıldızla ~20 seviyede bir oda biter). */
const COST_CURVE = [10, 10, 15, 15, 20, 20, 25, 25, 30, 30] as const;

function room(id: string, name: string, itemLabels: readonly string[]): RoomDef {
  return {
    id,
    name,
    items: itemLabels.map((label, i) => ({
      id: `${id}-${i}`,
      label,
      cost: COST_CURVE[i],
    })),
  };
}

export const ROOMS: readonly RoomDef[] = [
  room('oturma-odasi', 'Oturma Odası', [
    'Koltuk',
    'Halı',
    'Perde',
    'Duvar Rengi',
    'Sehpa',
    'Lamba',
    'Resim Çerçevesi',
    'Kitaplık',
    'Saksı Bitki',
    'TV Ünitesi',
  ]),
  room('mutfak', 'Mutfak', [
    'Dolap',
    'Tezgah',
    'Musluk',
    'Buzdolabı',
    'Masa',
    'Sandalye',
    'Raf',
    'Perde',
    'Duvar Fayansı',
    'Aydınlatma',
  ]),
  room('yatak-odasi', 'Yatak Odası', [
    'Yatak',
    'Nevresim',
    'Gardırop',
    'Komodin',
    'Perde',
    'Halı',
    'Lamba',
    'Ayna',
    'Duvar Rengi',
    'Resim',
  ]),
  room('cocuk-odasi', 'Çocuk Odası', [
    'Karyola',
    'Oyuncak Dolabı',
    'Halı',
    'Perde',
    'Duvar Çıkartması',
    'Çalışma Masası',
    'Sandalye',
    'Raf',
    'Lamba',
    'Oyuncak Kutusu',
  ]),
  room('calisma-odasi', 'Çalışma Odası', [
    'Masa',
    'Sandalye',
    'Kitaplık',
    'Lamba',
    'Halı',
    'Perde',
    'Duvar Rengi',
    'Pano',
    'Saksı Bitki',
    'Dosya Dolabı',
  ]),
];
