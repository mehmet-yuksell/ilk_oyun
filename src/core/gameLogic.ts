import type {
  CompletionEvent,
  Container,
  GameState,
  ItemType,
  Move,
  MoveOutcome,
  MoveResult,
} from './types';

export function getTopType(container: Container): ItemType | null {
  const top = container.items[container.items.length - 1];
  return top ? top.type : null;
}

/** Kabın en üstünden başlayarak aynı türden kaç ardışık eşya olduğunu sayar. */
export function getTopRunLength(container: Container): number {
  const { items } = container;
  if (items.length === 0) return 0;
  const topType = items[items.length - 1].type;
  let run = 0;
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i].type !== topType) break;
    run++;
  }
  return run;
}

export function getFreeSpace(container: Container): number {
  return container.capacity - container.items.length;
}

export function isContainerComplete(container: Container): boolean {
  if (container.items.length === 0 || container.items.length !== container.capacity) {
    return false;
  }
  const firstType = container.items[0].type;
  return container.items.every((item) => item.type === firstType);
}

export function isLevelComplete(state: GameState): boolean {
  return state.containers.every((c) => c.items.length === 0);
}

/**
 * Bir kap, lockedWhileNonEmpty ile işaret ettiği kap hâlâ dolu olduğu sürece kilitlidir.
 * Ayrı bir sayaç/geçmiş tutmaz -- yalnızca güncel duruma bakar (saf fonksiyon).
 */
export function isContainerLocked(container: Container, state: GameState): boolean {
  if (!container.lockedWhileNonEmpty) return false;
  const gate = findContainer(state, container.lockedWhileNonEmpty);
  return gate !== undefined && gate.items.length > 0;
}

/** Hiç geçerli hamle kalmadığı (ve seviye de bitmediği) "sıkışmış" durum. Kaybetme yok; geri al ya da ekstra kap önerilir. */
export function isStuck(state: GameState): boolean {
  return !isLevelComplete(state) && getValidMoves(state).length === 0;
}

/** "Ekstra boş kap ekle" kurtarma seçeneği: belirtilen kapasitede yeni, kilitsiz, boş bir kap ekler. */
export function addEmptyContainer(state: GameState, capacity: number): GameState {
  let n = state.containers.length;
  let id = `extra-${n}`;
  while (state.containers.some((c) => c.id === id)) {
    n++;
    id = `extra-${n}`;
  }
  return { containers: [...state.containers, { id, capacity, items: [] }] };
}

function findContainer(state: GameState, id: string): Container | undefined {
  return state.containers.find((c) => c.id === id);
}

export function tryMove(state: GameState, move: Move): MoveOutcome {
  const { sourceId, targetId } = move;
  if (sourceId === targetId) return { ok: false, error: 'same-container' };

  const source = findContainer(state, sourceId);
  if (!source) return { ok: false, error: 'source-not-found' };

  const target = findContainer(state, targetId);
  if (!target) return { ok: false, error: 'target-not-found' };

  if (isContainerLocked(source, state)) return { ok: false, error: 'source-locked' };
  if (isContainerLocked(target, state)) return { ok: false, error: 'target-locked' };

  const movingType = getTopType(source);
  if (movingType === null) return { ok: false, error: 'source-empty' };

  if (target.onlyAccepts && target.onlyAccepts !== movingType) {
    return { ok: false, error: 'target-type-locked' };
  }

  const targetTopType = getTopType(target);
  if (targetTopType !== null && targetTopType !== movingType) {
    return { ok: false, error: 'type-mismatch' };
  }

  const freeSpace = getFreeSpace(target);
  if (freeSpace <= 0) return { ok: false, error: 'target-full' };

  const runLength = getTopRunLength(source);
  const movedCount = Math.min(runLength, freeSpace);

  const splitIndex = source.items.length - movedCount;
  const movingItems = source.items.slice(splitIndex);
  const newSourceItems = source.items.slice(0, splitIndex);
  const newTargetItems = [...target.items, ...movingItems];

  const targetAfterMove: Container = { ...target, items: newTargetItems };
  let completion: CompletionEvent | null = null;
  let finalTargetItems = newTargetItems;
  if (isContainerComplete(targetAfterMove)) {
    completion = { containerId: target.id, type: movingType };
    finalTargetItems = [];
  }

  const containers = state.containers.map((c) => {
    if (c.id === source.id) return { ...c, items: newSourceItems };
    if (c.id === target.id) return { ...c, items: finalTargetItems };
    return c;
  });

  const result: MoveResult = {
    state: { containers },
    movedCount,
    movedType: movingType,
    completion,
  };

  return { ok: true, result };
}

/** Şu anda uygulanabilecek tüm (source, target) hamlelerini listeler. Solver ve "stuck" algılama için kullanılır. */
export function getValidMoves(state: GameState): Move[] {
  const moves: Move[] = [];
  for (const source of state.containers) {
    if (source.items.length === 0) continue;
    for (const target of state.containers) {
      const outcome = tryMove(state, { sourceId: source.id, targetId: target.id });
      if (outcome.ok) moves.push({ sourceId: source.id, targetId: target.id });
    }
  }
  return moves;
}

/**
 * Durumun kanonik string temsilini üretir (kap id'sine göre sıralı).
 * Solver'ın ziyaret-edilen-durum kümesi ve BFS testleri için kullanılır.
 */
export function hashState(state: GameState): string {
  return state.containers
    .map((c) => `${c.id}:${c.items.map((i) => i.type).join(',')}`)
    .sort()
    .join('|');
}
