import { ROOM_ITEM_COLORS, hexToNum } from './theme';

/** Oda öğesi kartları için renk -- değerler tasarım sisteminde (theme.ts ROOM_ITEM_COLORS). */
export function colorForItemIndex(index: number): number {
  return hexToNum(ROOM_ITEM_COLORS[index % ROOM_ITEM_COLORS.length]);
}
