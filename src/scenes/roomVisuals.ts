/** Oda öğesi kartları için renk paleti -- oyun içi eşya paletinden ayrı, mobilya/dekor hissi veren
 * tonlar. Doygunluk bilinçli olarak yüksek tutulur ("soluk" görünmesin diye). */
const PALETTE: readonly number[] = [
  0xff6a3d, 0x1fd1b8, 0xffc233, 0x4ad66d, 0xff4fa8,
  0x3b8cff, 0xff8c1c, 0x9b5cff, 0xffa94d, 0x19c2a8,
];

export function colorForItemIndex(index: number): number {
  return PALETTE[index % PALETTE.length];
}
