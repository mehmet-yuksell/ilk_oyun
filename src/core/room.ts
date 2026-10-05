export interface RestorableItemDef {
  readonly id: string;
  readonly label: string;
  readonly cost: number;
}

export interface RoomDef {
  readonly id: string;
  readonly name: string;
  readonly items: readonly RestorableItemDef[];
}

export interface ItemRestoreState {
  readonly restored: boolean;
  readonly styleIndex: 0 | 1 | null;
}

export interface RoomProgress {
  readonly roomId: string;
  readonly items: Readonly<Record<string, ItemRestoreState>>;
}

export function createInitialRoomProgress(room: RoomDef): RoomProgress {
  const items: Record<string, ItemRestoreState> = {};
  for (const item of room.items) {
    items[item.id] = { restored: false, styleIndex: null };
  }
  return { roomId: room.id, items };
}

export function isRoomComplete(progress: RoomProgress): boolean {
  return Object.values(progress.items).every((s) => s.restored);
}

export function restoredCount(progress: RoomProgress): number {
  return Object.values(progress.items).filter((s) => s.restored).length;
}

export type RestoreError = 'item-not-found' | 'already-restored' | 'not-enough-stars';

export type RestoreOutcome =
  | { readonly ok: true; readonly progress: RoomProgress; readonly starsRemaining: number }
  | { readonly ok: false; readonly error: RestoreError };

/** Saf fonksiyon: bir öğeyi seçilen stille yeniler, yıldız bakiyesinden maliyeti düşer. */
export function restoreItem(
  room: RoomDef,
  progress: RoomProgress,
  itemId: string,
  styleIndex: 0 | 1,
  stars: number,
): RestoreOutcome {
  const def = room.items.find((i) => i.id === itemId);
  if (!def) return { ok: false, error: 'item-not-found' };

  const current = progress.items[itemId];
  if (current?.restored) return { ok: false, error: 'already-restored' };
  if (stars < def.cost) return { ok: false, error: 'not-enough-stars' };

  return {
    ok: true,
    progress: {
      ...progress,
      items: { ...progress.items, [itemId]: { restored: true, styleIndex } },
    },
    starsRemaining: stars - def.cost,
  };
}
