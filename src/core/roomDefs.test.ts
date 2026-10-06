import { describe, expect, it } from 'vitest';
import { ROOMS } from './roomDefs';

describe('ROOMS', () => {
  it('başlangıçta tam olarak 10 oda tanımlıdır', () => {
    expect(ROOMS).toHaveLength(10);
  });

  it('her odada tam olarak 10 yenilenebilir öğe vardır', () => {
    for (const room of ROOMS) {
      expect(room.items).toHaveLength(10);
    }
  });

  it('oda id\'leri ve her odadaki öğe id\'leri benzersizdir', () => {
    const roomIds = ROOMS.map((r) => r.id);
    expect(new Set(roomIds).size).toBe(roomIds.length);

    for (const room of ROOMS) {
      const itemIds = room.items.map((i) => i.id);
      expect(new Set(itemIds).size).toBe(itemIds.length);
    }
  });

  it('her öğenin maliyeti pozitiftir', () => {
    for (const room of ROOMS) {
      for (const item of room.items) {
        expect(item.cost).toBeGreaterThan(0);
      }
    }
  });
});
