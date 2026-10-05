import { describe, expect, it } from 'vitest';
import { levelConfigFor } from './difficultyCurve';

describe('levelConfigFor', () => {
  it('deterministiktir: aynı seviye numarası her zaman aynı config döner', () => {
    expect(levelConfigFor(42)).toEqual(levelConfigFor(42));
  });

  it('ilk seviye çok kolaydır: 2 tür ve en az 2 boş kap', () => {
    const config = levelConfigFor(1);
    expect(config.itemTypeCount).toBe(2);
    expect(config.emptyContainerCount).toBeGreaterThanOrEqual(2);
  });

  it('tür sayısı seviye ilerledikçe artar (azalmaz)', () => {
    expect(levelConfigFor(300).itemTypeCount).toBeGreaterThanOrEqual(levelConfigFor(40).itemTypeCount);
    expect(levelConfigFor(500).itemTypeCount).toBeGreaterThanOrEqual(levelConfigFor(300).itemTypeCount);
  });

  it('karıştırma derinliği genel eğilimde seviye ile birlikte artar', () => {
    expect(levelConfigFor(300).shuffleDepth).toBeGreaterThan(levelConfigFor(20).shuffleDepth);
  });

  it('her 10. seviye bir "nefes seviyesi"dir: komşularına göre daha fazla boş kap / daha sığ karıştırma', () => {
    const breather = levelConfigFor(100);
    const before = levelConfigFor(99);
    expect(breather.emptyContainerCount).toBeGreaterThanOrEqual(before.emptyContainerCount);
    expect(breather.shuffleDepth).toBeLessThan(before.shuffleDepth);
  });

  it('containerCount her zaman itemTypeCount + emptyContainerCount olur (üreticinin basit modeliyle tutarlı)', () => {
    for (const n of [1, 10, 55, 200, 500]) {
      const c = levelConfigFor(n);
      expect(c.containerCount).toBe(c.itemTypeCount + c.emptyContainerCount);
    }
  });
});
