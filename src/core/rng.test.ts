import { describe, expect, it } from 'vitest';
import { mulberry32, pick, randInt } from './rng';

describe('mulberry32', () => {
  it('aynı seed aynı diziyi üretir (determinizm)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('farklı seed farklı dizi üretir', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it('her zaman [0,1) aralığında değer üretir', () => {
    const rng = mulberry32(12345);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('randInt / pick', () => {
  it('randInt sınırlar dahil aralıkta kalır', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 500; i++) {
      const v = randInt(rng, 3, 5);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(5);
    }
  });

  it('pick yalnızca verilen dizideki elemanları döner', () => {
    const rng = mulberry32(7);
    const items = ['a', 'b', 'c'];
    for (let i = 0; i < 100; i++) {
      expect(items).toContain(pick(rng, items));
    }
  });
});
