import { describe, expect, it } from 'vitest';
import { t, translations } from './translations';
import type { TranslationKey } from './translations';

describe('translations', () => {
  it('her anahtarda hem tr hem en metni mevcuttur ve boş değildir', () => {
    for (const key of Object.keys(translations) as TranslationKey[]) {
      expect(translations[key].tr.length).toBeGreaterThan(0);
      expect(translations[key].en.length).toBeGreaterThan(0);
    }
  });
});

describe('t', () => {
  it('doğru dildeki metni döner', () => {
    expect(t('playButton', 'tr')).toBe('OYNA');
    expect(t('playButton', 'en')).toBe('PLAY');
  });

  it('{param} yer tutucularını değiştirir', () => {
    expect(t('levelCompleteWithStars', 'tr', { stars: 10 })).toBe('Seviye tamamlandı! +10 yıldız');
    expect(t('levelCompleteWithStars', 'en', { stars: 10 })).toBe('Level complete! +10 stars');
  });

  it('birden fazla param aynı anda değiştirilir', () => {
    expect(t('itemsRestoredLabel', 'tr', { restored: 3, total: 10 })).toBe('3/10 öğe yenilendi');
  });

  it('param verilmezse metin olduğu gibi döner', () => {
    expect(t('cancel', 'tr')).toBe('Vazgeç');
  });
});
