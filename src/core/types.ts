export type ItemType = string;

export interface Item {
  readonly type: ItemType;
}

/** items[0] = kabın dibi, items[items.length-1] = kabın üstü. */
export interface Container {
  readonly id: string;
  readonly capacity: number;
  readonly items: readonly Item[];
  /**
   * Engel mekaniği: dolu olduğu sürece bu kap kilitlidir (ne kaynak ne hedef olabilir).
   * Belirtilen id'li kap tamamen boşalınca kilit otomatik açılır. Şu anki durumdan
   * türetilir (ayrı bir sayaç/geçmiş gerektirmez) -- bkz. isContainerLocked.
   */
  readonly lockedWhileNonEmpty?: string;
}

export interface GameState {
  readonly containers: readonly Container[];
}

export interface Move {
  readonly sourceId: string;
  readonly targetId: string;
}

export interface CompletionEvent {
  readonly containerId: string;
  readonly type: ItemType;
}

export interface MoveResult {
  readonly state: GameState;
  readonly movedCount: number;
  readonly movedType: ItemType;
  readonly completion: CompletionEvent | null;
}

export type MoveError =
  | 'same-container'
  | 'source-not-found'
  | 'target-not-found'
  | 'source-empty'
  | 'type-mismatch'
  | 'target-full'
  | 'source-locked'
  | 'target-locked';

export type MoveOutcome =
  | { readonly ok: true; readonly result: MoveResult }
  | { readonly ok: false; readonly error: MoveError };
