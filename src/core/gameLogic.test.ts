import { describe, expect, it } from 'vitest';
import {
  addEmptyContainer,
  getFreeSpace,
  getTopRunLength,
  getTopType,
  getValidMoves,
  hashState,
  isContainerComplete,
  isContainerLocked,
  isLevelComplete,
  isStuck,
  tryMove,
} from './gameLogic';
import type { GameState } from './types';
import { createDemoLevel } from './levels/demoLevel';

function state(containers: GameState['containers']): GameState {
  return { containers };
}

describe('getTopType / getTopRunLength / getFreeSpace', () => {
  it('boş kapta üst tür null, run 0 döner', () => {
    const c = { id: 'A', capacity: 4, items: [] };
    expect(getTopType(c)).toBeNull();
    expect(getTopRunLength(c)).toBe(0);
    expect(getFreeSpace(c)).toBe(4);
  });

  it('ardışık aynı türden üst run doğru sayılır', () => {
    const c = {
      id: 'A',
      capacity: 4,
      items: [{ type: 'book' }, { type: 'cup' }, { type: 'cup' }, { type: 'cup' }],
    };
    expect(getTopType(c)).toBe('cup');
    expect(getTopRunLength(c)).toBe(3);
    expect(getFreeSpace(c)).toBe(0);
  });
});

describe('isContainerComplete', () => {
  it('kapasiteye ulaşmış ve tek türden ise tamamlanmıştır', () => {
    const c = {
      id: 'A',
      capacity: 2,
      items: [{ type: 'book' }, { type: 'book' }],
    };
    expect(isContainerComplete(c)).toBe(true);
  });

  it('dolu ama karışık türdeyse tamamlanmamıştır (sıkışmış kap)', () => {
    const c = {
      id: 'A',
      capacity: 2,
      items: [{ type: 'cup' }, { type: 'book' }],
    };
    expect(isContainerComplete(c)).toBe(false);
  });

  it('kapasiteye ulaşmamışsa tamamlanmamıştır', () => {
    const c = { id: 'A', capacity: 4, items: [{ type: 'book' }] };
    expect(isContainerComplete(c)).toBe(false);
  });
});

describe('tryMove - geçersiz hamleler', () => {
  const base = state([
    { id: 'A', capacity: 4, items: [{ type: 'book' }] },
    { id: 'B', capacity: 4, items: [{ type: 'cup' }] },
    { id: 'C', capacity: 4, items: [] },
  ]);

  it('kaynak ve hedef aynıysa same-container hatası', () => {
    const outcome = tryMove(base, { sourceId: 'A', targetId: 'A' });
    expect(outcome).toEqual({ ok: false, error: 'same-container' });
  });

  it('olmayan kaynak id source-not-found hatası verir', () => {
    const outcome = tryMove(base, { sourceId: 'X', targetId: 'A' });
    expect(outcome).toEqual({ ok: false, error: 'source-not-found' });
  });

  it('olmayan hedef id target-not-found hatası verir', () => {
    const outcome = tryMove(base, { sourceId: 'A', targetId: 'X' });
    expect(outcome).toEqual({ ok: false, error: 'target-not-found' });
  });

  it('boş kaynaktan taşıma source-empty hatası verir', () => {
    const outcome = tryMove(base, { sourceId: 'C', targetId: 'A' });
    expect(outcome).toEqual({ ok: false, error: 'source-empty' });
  });

  it('hedefin üstü farklı türdeyse type-mismatch hatası verir', () => {
    const outcome = tryMove(base, { sourceId: 'A', targetId: 'B' });
    expect(outcome).toEqual({ ok: false, error: 'type-mismatch' });
  });

  it('hedef doluysa (free space 0) target-full hatası verir', () => {
    const full = state([
      { id: 'A', capacity: 1, items: [{ type: 'book' }] },
      { id: 'B', capacity: 1, items: [{ type: 'book' }] },
    ]);
    const outcome = tryMove(full, { sourceId: 'A', targetId: 'B' });
    expect(outcome).toEqual({ ok: false, error: 'target-full' });
  });
});

describe('tryMove - geçerli hamleler', () => {
  it('boş hedefe tüm üst run taşınır', () => {
    const s = state([
      { id: 'A', capacity: 4, items: [{ type: 'book' }, { type: 'cup' }, { type: 'cup' }] },
      { id: 'B', capacity: 4, items: [] },
    ]);
    const outcome = tryMove(s, { sourceId: 'A', targetId: 'B' });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error('unreachable');
    expect(outcome.result.movedCount).toBe(2);
    expect(outcome.result.movedType).toBe('cup');
    expect(outcome.result.completion).toBeNull();

    const [a, b] = outcome.result.state.containers;
    expect(a.items).toEqual([{ type: 'book' }]);
    expect(b.items).toEqual([{ type: 'cup' }, { type: 'cup' }]);
  });

  it('hedefin boş yeri run uzunluğundan azsa, sadece sığan kadarı taşınır', () => {
    const s = state([
      { id: 'A', capacity: 4, items: [{ type: 'cup' }, { type: 'cup' }, { type: 'cup' }] },
      // B'nin dibinde 'pot' var ki dolunca homojen olmasın ve bu test completion'dan bağımsız kalsın.
      { id: 'B', capacity: 4, items: [{ type: 'pot' }, { type: 'cup' }, { type: 'cup' }] },
    ]);
    const outcome = tryMove(s, { sourceId: 'A', targetId: 'B' });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error('unreachable');
    expect(outcome.result.movedCount).toBe(1);
    const [a, b] = outcome.result.state.containers;
    expect(a.items).toHaveLength(2);
    expect(b.items).toHaveLength(4);
  });

  it('hedef tam dolup tek türden olunca otomatik boşalır (completion)', () => {
    const s = state([
      { id: 'A', capacity: 4, items: [{ type: 'book' }, { type: 'book' }, { type: 'book' }, { type: 'cup' }] },
      { id: 'B', capacity: 4, items: [{ type: 'cup' }, { type: 'cup' }, { type: 'cup' }] },
    ]);
    const outcome = tryMove(s, { sourceId: 'A', targetId: 'B' });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error('unreachable');
    expect(outcome.result.completion).toEqual({ containerId: 'B', type: 'cup' });

    const [a, b] = outcome.result.state.containers;
    expect(a.items).toEqual([{ type: 'book' }, { type: 'book' }, { type: 'book' }]);
    expect(b.items).toEqual([]);
  });

  it('dolan kap tek türden değilse (dipte farklı tür varsa) completion tetiklenmez', () => {
    const s = state([
      { id: 'A', capacity: 2, items: [{ type: 'red' }, { type: 'red' }] },
      { id: 'B', capacity: 3, items: [{ type: 'blue' }, { type: 'red' }] },
    ]);
    // A'nın üstü: red x2 (run=2), B boş yeri: 1 -> sadece 1 red taşınır, B=[blue, red, red] dolu ama karışık.
    const outcome = tryMove(s, { sourceId: 'A', targetId: 'B' });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error('unreachable');
    expect(outcome.result.completion).toBeNull();
    const [, b] = outcome.result.state.containers;
    expect(b.items).toEqual([{ type: 'blue' }, { type: 'red' }, { type: 'red' }]);
  });
});

describe('isLevelComplete', () => {
  it('tüm kaplar boşsa seviye tamamlanmıştır', () => {
    expect(isLevelComplete(state([{ id: 'A', capacity: 4, items: [] }]))).toBe(true);
  });

  it('herhangi bir kapta eşya varsa seviye tamamlanmamıştır', () => {
    expect(
      isLevelComplete(state([{ id: 'A', capacity: 4, items: [{ type: 'book' }] }])),
    ).toBe(false);
  });
});

describe('getValidMoves', () => {
  it('yalnızca gerçekten uygulanabilir hamleleri listeler', () => {
    const s = state([
      { id: 'A', capacity: 4, items: [{ type: 'book' }] },
      { id: 'B', capacity: 4, items: [{ type: 'cup' }] },
      { id: 'C', capacity: 4, items: [] },
    ]);
    const moves = getValidMoves(s);
    // A->B ve B->A type-mismatch; A->C ve B->C geçerli.
    expect(moves).toEqual(
      expect.arrayContaining([
        { sourceId: 'A', targetId: 'C' },
        { sourceId: 'B', targetId: 'C' },
      ]),
    );
    expect(moves).not.toEqual(
      expect.arrayContaining([{ sourceId: 'A', targetId: 'B' }]),
    );
    expect(moves).toHaveLength(2);
  });
});

describe('demo seviye çözülebilirlik kanıtı (BFS)', () => {
  it('createDemoLevel() başlangıç durumundan isLevelComplete durumuna ulaşılabilir', () => {
    const start = createDemoLevel();
    const startKey = hashState(start);

    const visited = new Set<string>([startKey]);
    let frontier: GameState[] = [start];
    let solved = false;
    let depth = 0;
    const MAX_DEPTH = 60;
    const MAX_VISITED = 200_000;

    while (frontier.length > 0 && !solved && depth < MAX_DEPTH && visited.size < MAX_VISITED) {
      const nextFrontier: GameState[] = [];
      for (const current of frontier) {
        if (isLevelComplete(current)) {
          solved = true;
          break;
        }
        for (const move of getValidMoves(current)) {
          const outcome = tryMove(current, move);
          if (!outcome.ok) continue;
          const key = hashState(outcome.result.state);
          if (visited.has(key)) continue;
          visited.add(key);
          nextFrontier.push(outcome.result.state);
        }
      }
      frontier = nextFrontier;
      depth++;
    }

    expect(solved).toBe(true);
  });
});

describe('isContainerLocked / kilitli kap hamle reddi', () => {
  it('lockedWhileNonEmpty işaret ettiği kap doluyken kilitlidir', () => {
    const gate = { id: 'gate', capacity: 4, items: [{ type: 'book' }] };
    const locked = { id: 'locked', capacity: 4, items: [{ type: 'cup' }], lockedWhileNonEmpty: 'gate' };
    expect(isContainerLocked(locked, state([gate, locked]))).toBe(true);
  });

  it('işaret ettiği kap boşalınca kilit otomatik açılır', () => {
    const gate = { id: 'gate', capacity: 4, items: [] };
    const locked = { id: 'locked', capacity: 4, items: [{ type: 'cup' }], lockedWhileNonEmpty: 'gate' };
    expect(isContainerLocked(locked, state([gate, locked]))).toBe(false);
  });

  it('lockedWhileNonEmpty yoksa hiçbir zaman kilitli değildir', () => {
    const c = { id: 'A', capacity: 4, items: [] };
    expect(isContainerLocked(c, state([c]))).toBe(false);
  });

  it('tryMove kilitli kaynaktan hamleyi source-locked ile reddeder', () => {
    const s = state([
      { id: 'gate', capacity: 4, items: [{ type: 'book' }] },
      { id: 'A', capacity: 4, items: [{ type: 'cup' }], lockedWhileNonEmpty: 'gate' },
      { id: 'B', capacity: 4, items: [] },
    ]);
    expect(tryMove(s, { sourceId: 'A', targetId: 'B' })).toEqual({ ok: false, error: 'source-locked' });
  });

  it('tryMove kilitli hedefe hamleyi target-locked ile reddeder', () => {
    const s = state([
      { id: 'gate', capacity: 4, items: [{ type: 'book' }] },
      { id: 'A', capacity: 4, items: [{ type: 'cup' }] },
      { id: 'B', capacity: 4, items: [], lockedWhileNonEmpty: 'gate' },
    ]);
    expect(tryMove(s, { sourceId: 'A', targetId: 'B' })).toEqual({ ok: false, error: 'target-locked' });
  });

  it('kilitli kap getValidMoves çıktısında hiç yer almaz', () => {
    const s = state([
      { id: 'gate', capacity: 4, items: [{ type: 'book' }] },
      { id: 'A', capacity: 4, items: [{ type: 'cup' }], lockedWhileNonEmpty: 'gate' },
      { id: 'B', capacity: 4, items: [] },
    ]);
    const moves = getValidMoves(s);
    expect(moves.some((m) => m.sourceId === 'A' || m.targetId === 'A')).toBe(false);
  });

  it('gate boşalınca kilitli kap tekrar kullanılabilir olur', () => {
    const s = state([
      { id: 'gate', capacity: 4, items: [] },
      { id: 'A', capacity: 4, items: [{ type: 'cup' }], lockedWhileNonEmpty: 'gate' },
      { id: 'B', capacity: 4, items: [] },
    ]);
    const outcome = tryMove(s, { sourceId: 'A', targetId: 'B' });
    expect(outcome.ok).toBe(true);
  });
});

describe('onlyAccepts (tek türlü kap engeli)', () => {
  it('tryMove, onlyAccepts ile eşleşmeyen türü target-type-locked ile reddeder', () => {
    const s = state([
      { id: 'A', capacity: 4, items: [{ type: 'book' }] },
      { id: 'B', capacity: 4, items: [], onlyAccepts: 'cup' },
    ]);
    expect(tryMove(s, { sourceId: 'A', targetId: 'B' })).toEqual({ ok: false, error: 'target-type-locked' });
  });

  it('tryMove, onlyAccepts ile eşleşen türü normal şekilde kabul eder', () => {
    const s = state([
      { id: 'A', capacity: 4, items: [{ type: 'cup' }] },
      { id: 'B', capacity: 4, items: [], onlyAccepts: 'cup' },
    ]);
    const outcome = tryMove(s, { sourceId: 'A', targetId: 'B' });
    expect(outcome.ok).toBe(true);
  });

  it('onlyAccepts kaynaktan çıkışı etkilemez', () => {
    const s = state([
      { id: 'A', capacity: 4, items: [{ type: 'cup' }], onlyAccepts: 'cup' },
      { id: 'B', capacity: 4, items: [] },
    ]);
    const outcome = tryMove(s, { sourceId: 'A', targetId: 'B' });
    expect(outcome.ok).toBe(true);
  });

  it('getValidMoves, onlyAccepts ile eşleşmeyen hamleleri listelemez', () => {
    const s = state([
      { id: 'A', capacity: 4, items: [{ type: 'book' }] },
      { id: 'B', capacity: 4, items: [], onlyAccepts: 'cup' },
    ]);
    expect(getValidMoves(s).some((m) => m.targetId === 'B')).toBe(false);
  });
});

describe('isStuck', () => {
  it('seviye tamamlandıysa stuck değildir', () => {
    expect(isStuck(state([{ id: 'A', capacity: 4, items: [] }]))).toBe(false);
  });

  it('geçerli hamle varsa stuck değildir', () => {
    const s = state([
      { id: 'A', capacity: 4, items: [{ type: 'book' }] },
      { id: 'B', capacity: 4, items: [] },
    ]);
    expect(isStuck(s)).toBe(false);
  });

  it('hiç geçerli hamle yoksa (ve seviye bitmediyse) stuck=true', () => {
    const s = state([
      { id: 'A', capacity: 2, items: [{ type: 'red' }, { type: 'blue' }] },
      { id: 'B', capacity: 2, items: [{ type: 'blue' }, { type: 'red' }] },
    ]);
    expect(isStuck(s)).toBe(true);
  });
});

describe('addEmptyContainer', () => {
  it('belirtilen kapasitede yeni boş bir kap ekler, mevcutları değiştirmez', () => {
    const s = state([{ id: 'A', capacity: 4, items: [{ type: 'book' }] }]);
    const next = addEmptyContainer(s, 4);
    expect(next.containers).toHaveLength(2);
    expect(next.containers[0]).toEqual(s.containers[0]);
    expect(next.containers[1].items).toEqual([]);
    expect(next.containers[1].capacity).toBe(4);
  });

  it('stuck bir durumu hamle yapılabilir hale getirebilir', () => {
    const s = state([
      { id: 'A', capacity: 2, items: [{ type: 'red' }, { type: 'blue' }] },
      { id: 'B', capacity: 2, items: [{ type: 'blue' }, { type: 'red' }] },
    ]);
    expect(isStuck(s)).toBe(true);
    const rescued = addEmptyContainer(s, 2);
    expect(isStuck(rescued)).toBe(false);
  });

  it('id çakışmasını önler', () => {
    const s = state([{ id: 'extra-1', capacity: 4, items: [] }]);
    const next = addEmptyContainer(s, 4);
    const ids = next.containers.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
