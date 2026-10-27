/**
 * Nunito (SIL OFL 1.1, bkz. CREDITS.md) -- Google Fonts'un latin + latin-ext alt kümeleri, yerel
 * dosya olarak (çevrimdışı / Capacitor için CDN yok). CSS @font-face yerine FontFace API ile
 * yüklenir: unicode aralıkları burada tek kaynakta durur ve testte doğrudan denetlenir
 * (bkz. i18n/fontCoverage.test.ts -- eski Fredoka dosyası "ş"yi bozuk çiziyordu).
 */
export const FONT_NAME = 'Nunito';

export interface FontSubset {
  readonly file: string;
  readonly unicodeRange: string;
}

export const NUNITO_SUBSETS: readonly FontSubset[] = [
  {
    file: '/fonts/Nunito-latin-ext.woff2',
    unicodeRange:
      'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF',
  },
  {
    file: '/fonts/Nunito-latin.woff2',
    unicodeRange:
      'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
  },
];

/** "U+0100-02BA, U+0131" -> [[0x100,0x2ba],[0x131,0x131]] */
export function parseUnicodeRange(range: string): [number, number][] {
  const out: [number, number][] = [];
  for (const part of range.split(',')) {
    const m = part.trim().match(/^U\+([0-9A-F]+)(?:-([0-9A-F]+))?$/i);
    if (!m) continue;
    const start = parseInt(m[1], 16);
    out.push([start, m[2] ? parseInt(m[2], 16) : start]);
  }
  return out;
}

/**
 * Phaser.Game oluşturulmadan ÖNCE çağrılır: Phaser Text nesneleri oluşturuldukları anda o anki
 * fontla bir canvas dokusuna "pişer" -- font sonradan gelirse yedek fontla kalırlar. Her iki alt
 * küme de açıkça yüklenir (canvas çizimi unicode-range alt kümesini kendiliğinden tetiklemez).
 */
export async function loadFonts(): Promise<void> {
  if (typeof FontFace === 'undefined' || !document.fonts) return;
  await Promise.all(
    NUNITO_SUBSETS.map(async (subset) => {
      const face = new FontFace(FONT_NAME, `url(${subset.file}) format('woff2')`, {
        weight: '400 900',
        style: 'normal',
        display: 'block',
        unicodeRange: subset.unicodeRange,
      });
      document.fonts.add(face);
      await face.load();
    }),
  );
}
