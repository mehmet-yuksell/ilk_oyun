import { describe, expect, it } from 'vitest';
import { buildMelody } from './MusicService';

describe('buildMelody', () => {
  it('deterministiktir (her döngü aynı melodi)', () => {
    expect(buildMelody(7)).toEqual(buildMelody(7));
  });

  it('8 ölçünün her birinde 2-4 nota, sekizlik konumları 0..7', () => {
    const melody = buildMelody();
    for (let bar = 0; bar < 8; bar++) {
      const inBar = melody.filter((n) => n.bar === bar);
      expect(inBar.length).toBeGreaterThanOrEqual(2);
      expect(inBar.length).toBeLessThanOrEqual(4);
      for (const n of inBar) {
        expect(n.eighth).toBeGreaterThanOrEqual(0);
        expect(n.eighth).toBeLessThan(8);
      }
    }
  });

  it('yalnızca C majör pentatonik notaları kullanır (uyumsuz nota yok)', () => {
    const allowed = new Set([72, 74, 76, 79, 81, 84]);
    for (const n of buildMelody()) expect(allowed.has(n.note)).toBe(true);
  });
});
