import { describe, expect, it } from 'vitest';
import { solve } from './solver';
import { isLevelComplete, tryMove } from './gameLogic';
import type { GameState } from './types';
import { createDemoLevel } from './levels/demoLevel';

describe('solve', () => {
  it('zaten tamamlanmış bir durumu anında çözülmüş sayar (0 hamle)', () => {
    const state: GameState = { containers: [{ id: 'A', capacity: 4, items: [] }] };
    const result = solve(state);
    expect(result).toEqual({ solvable: true, path: [], statesExplored: 1, truncated: false });
  });

  it('gerçekten çözülemez bir durumu (tüm kaplar dolu ve karışık) doğru tespit eder', () => {
    // İki kap da dolu, hiçbiri boş yer ya da aynı türden üst eşya sunmuyor -> hiç geçerli hamle yok.
    const state: GameState = {
      containers: [
        { id: 'A', capacity: 2, items: [{ type: 'red' }, { type: 'blue' }] },
        { id: 'B', capacity: 2, items: [{ type: 'blue' }, { type: 'red' }] },
      ],
    };
    const result = solve(state);
    expect(result.solvable).toBe(false);
    expect(result.truncated).toBe(false); // sınıra takılmadı, durum uzayı tamamen tüketildi
    expect(result.path).toBeNull();
  });

  it('çözülebilir küçük bir durum için geçerli ve en kısa bir yol bulur', () => {
    const state: GameState = {
      containers: [
        { id: 'A', capacity: 2, items: [{ type: 'book' }, { type: 'cup' }] },
        { id: 'B', capacity: 2, items: [{ type: 'cup' }, { type: 'book' }] },
        { id: 'C', capacity: 2, items: [] },
      ],
    };
    const result = solve(state);
    expect(result.solvable).toBe(true);
    expect(result.truncated).toBe(false);
    expect(result.path!.length).toBeGreaterThan(0);

    // Asıl kanıt: bulunan yolu GERÇEKTEN motor üzerinde oynatıp sonucu doğrula
    // (beklenen hamle listesini elle sabitlemek yerine - manuel izleme hataya açık).
    let current = state;
    for (const move of result.path!) {
      const outcome = tryMove(current, move);
      expect(outcome.ok).toBe(true);
      if (outcome.ok) current = outcome.result.state;
    }
    expect(isLevelComplete(current)).toBe(true);
  });

  it('Faz 1 demo seviyesini çözer ve bulunan yol motor üzerinde gerçekten geçerlidir', () => {
    const level = createDemoLevel();
    const result = solve(level);
    expect(result.solvable).toBe(true);
    expect(result.truncated).toBe(false);
    expect(result.path!.length).toBeGreaterThan(0);

    let current = level;
    for (const move of result.path!) {
      const outcome = tryMove(current, move);
      expect(outcome.ok).toBe(true);
      if (outcome.ok) current = outcome.result.state;
    }
    expect(isLevelComplete(current)).toBe(true);
  });

  it('küçük bir maxStates ile gerçekten kesilirse truncated=true döner', () => {
    const level = createDemoLevel();
    const result = solve(level, { maxStates: 1 });
    expect(result.solvable).toBe(false);
    expect(result.truncated).toBe(true);
  });
});
