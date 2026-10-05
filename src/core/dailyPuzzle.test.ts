import { describe, expect, it } from 'vitest';
import { dailyPuzzleConfig } from './dailyPuzzle';
import { generateVerifiedLevel } from './levelGenerator';

describe('dailyPuzzleConfig', () => {
  it('aynı tarih her zaman aynı config\'i üretir (determinizm)', () => {
    expect(dailyPuzzleConfig('2026-03-05')).toEqual(dailyPuzzleConfig('2026-03-05'));
  });

  it('farklı tarihler farklı seed üretir', () => {
    const a = dailyPuzzleConfig('2026-03-05');
    const b = dailyPuzzleConfig('2026-03-06');
    expect(a.seed).not.toBe(b.seed);
  });

  it('üretilen günlük bulmaca gerçekten çözülebilir', () => {
    const result = generateVerifiedLevel(dailyPuzzleConfig('2026-03-05'));
    expect(result.verifiedMoveCount).toBeGreaterThan(0);
  });

  it('30 ardışık gün için hepsi çözülebilir üretilir', () => {
    for (let day = 1; day <= 30; day++) {
      const key = `2026-03-${String(day).padStart(2, '0')}`;
      const result = generateVerifiedLevel(dailyPuzzleConfig(key));
      expect(result.verifiedMoveCount).toBeGreaterThan(0);
    }
  });
});
