import { describe, expect, it } from 'vitest';
import { translations } from './translations';
import { NUNITO_SUBSETS, parseUnicodeRange } from '../scenes/fonts';

/**
 * Nunito iki unicode-range alt kümesi (latin + latin-ext) olarak yükleniyor (bkz. scenes/fonts.ts).
 * Bir çeviri metnindeki karakter bu aralıkların DIŞINDA kalırsa tarayıcı onu yedek fontla çizer --
 * eski Fredoka dosyasındaki "ş" hatası gibi sessiz bir bozulma. Bu test her çeviri karakterinin
 * kapsandığını garanti eder.
 */
describe('font kapsamı', () => {
  const ranges = NUNITO_SUBSETS.flatMap((s) => parseUnicodeRange(s.unicodeRange));
  const covered = (ch: string) => {
    const cp = ch.codePointAt(0)!;
    return ranges.some(([a, b]) => cp >= a && cp <= b);
  };

  it('unicode aralıkları ayrıştırılır', () => {
    expect(parseUnicodeRange('U+0100-02BA, U+0131')).toEqual([
      [0x100, 0x2ba],
      [0x131, 0x131],
    ]);
    expect(ranges.length).toBeGreaterThan(5);
  });

  it('Türkçe özel harflerin tamamı kapsanır', () => {
    for (const ch of 'ğĞşŞıİöÖçÇüÜ') {
      expect(covered(ch), `${ch} (U+${ch.codePointAt(0)!.toString(16)})`).toBe(true);
    }
  });

  it('tüm çeviri metinlerindeki karakterler kapsanır', () => {
    const missing = new Set<string>();
    for (const entry of Object.values(translations)) {
      for (const text of Object.values(entry)) {
        for (const ch of text as string) {
          if (!covered(ch)) missing.add(ch);
        }
      }
    }
    expect([...missing]).toEqual([]);
  });
});
