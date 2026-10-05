/** Oda öğesi kartları için renk paleti -- oyun içi eşya paletinden ayrı, mobilya/dekor hissi veren tonlar. */
const PALETTE: readonly number[] = [
  0xd9704f, 0x4f9d8c, 0xc9a53b, 0x7a9d54, 0xd4578a,
  0x5b7fbf, 0xb5651d, 0x8e6fc9, 0xe0954f, 0x5fa8a0,
];

export function colorForItemIndex(index: number): number {
  return PALETTE[index % PALETTE.length];
}
