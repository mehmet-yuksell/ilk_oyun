/** Oda öğesi kartları için renk paleti -- oyun içi eşya paletinden ayrı, mobilya/dekor hissi veren
 * tonlar. Doygunluk belirgin ama ROOM_THEMES/PALETTE (tuning.ts) ile aynı "yumuşatılmış mücevher
 * tonu" diline oturacak şekilde dengelenmiştir (bkz. Faz 4 kararları). */
const PALETTE: readonly number[] = [
  0xe8764a, 0x2bb0a8, 0xe8b23e, 0x45b876, 0xdb6098,
  0x4288c9, 0xdb8530, 0x8763c9, 0xdb9850, 0x2a9e94,
];

export function colorForItemIndex(index: number): number {
  return PALETTE[index % PALETTE.length];
}
