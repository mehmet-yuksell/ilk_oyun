import { describe, expect, it } from 'vitest';
import { levelConfigFor, moveLimitFor } from './difficultyCurve';
import { DIFFICULTY } from '../config/tuning';

describe('levelConfigFor', () => {
  it('deterministiktir: aynı seviye numarası her zaman aynı config döner', () => {
    expect(levelConfigFor(42)).toEqual(levelConfigFor(42));
  });

  it('ilk seviye kolaydır: 3 tür ve en az 2 boş kap (ORTA zorluk güncellemesi -- bkz. DIFFICULTY.ranges)', () => {
    const config = levelConfigFor(1);
    expect(config.itemTypeCount).toBe(3);
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

describe('moveLimitFor', () => {
  it('limit her zaman sertifika uzunluğundan büyüktür (seviye hiçbir zaman imkansız olmaz)', () => {
    for (const level of [1, 15, 16, 40, 41, 100]) {
      expect(moveLimitFor(level, 10)).toBeGreaterThan(10);
    }
  });

  it('ilk newPlayerWideBonusUntilLevel seviyede geniş (yeni oyuncu) pay kullanılır', () => {
    const cert = 20;
    for (const level of [1, 10, DIFFICULTY.newPlayerWideBonusUntilLevel]) {
      expect(moveLimitFor(level, cert)).toBe(cert + DIFFICULTY.newPlayerWideBonus);
    }
  });

  it('newPlayerTaperEndLevel ve sonrasında taban (sıkı) pay kullanılır', () => {
    const cert = 20;
    for (const level of [DIFFICULTY.newPlayerTaperEndLevel, DIFFICULTY.newPlayerTaperEndLevel + 50]) {
      expect(moveLimitFor(level, cert)).toBe(cert + DIFFICULTY.moveLimitBonus);
    }
  });

  it('iki aralık arasında pay geniş paydan taban paya doğru kademeli (monoton azalan) daralır', () => {
    const cert = 20;
    const bonuses: number[] = [];
    for (let level = DIFFICULTY.newPlayerWideBonusUntilLevel; level <= DIFFICULTY.newPlayerTaperEndLevel; level++) {
      bonuses.push(moveLimitFor(level, cert) - cert);
    }
    for (let i = 1; i < bonuses.length; i++) {
      expect(bonuses[i]).toBeLessThanOrEqual(bonuses[i - 1]);
    }
    expect(bonuses[0]).toBe(DIFFICULTY.newPlayerWideBonus);
    expect(bonuses[bonuses.length - 1]).toBe(DIFFICULTY.moveLimitBonus);
  });
});
