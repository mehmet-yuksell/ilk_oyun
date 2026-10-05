import type { GameState } from '../types';

/**
 * Faz 1 el yazması demo seviyesi: 3 eşya türü, kapasite 4, 5 kap (3 dolu + 2 boş).
 * Çözülebilirliği src/core/gameLogic.test.ts içindeki BFS testiyle doğrulanır.
 */
export function createDemoLevel(): GameState {
  return {
    containers: [
      {
        id: 'A',
        capacity: 4,
        items: [{ type: 'book' }, { type: 'cup' }, { type: 'plate' }, { type: 'book' }],
      },
      {
        id: 'B',
        capacity: 4,
        items: [{ type: 'cup' }, { type: 'plate' }, { type: 'cup' }, { type: 'plate' }],
      },
      {
        id: 'C',
        capacity: 4,
        items: [{ type: 'plate' }, { type: 'book' }, { type: 'cup' }, { type: 'book' }],
      },
      { id: 'D', capacity: 4, items: [] },
      { id: 'E', capacity: 4, items: [] },
    ],
  };
}
