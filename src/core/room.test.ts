import { describe, expect, it } from 'vitest';
import { createInitialRoomProgress, isRoomComplete, restoreItem, restoredCount } from './room';
import type { RoomDef } from './room';

const testRoom: RoomDef = {
  id: 'test-room',
  name: 'Test Odası',
  items: [
    { id: 'a', label: 'A', cost: 10 },
    { id: 'b', label: 'B', cost: 20 },
  ],
};

describe('createInitialRoomProgress', () => {
  it('tüm öğeleri yenilenmemiş olarak başlatır', () => {
    const progress = createInitialRoomProgress(testRoom);
    expect(progress.roomId).toBe('test-room');
    expect(progress.items.a).toEqual({ restored: false, styleIndex: null });
    expect(progress.items.b).toEqual({ restored: false, styleIndex: null });
  });
});

describe('isRoomComplete / restoredCount', () => {
  it('başlangıçta tamamlanmamıştır ve sayım 0dır', () => {
    const progress = createInitialRoomProgress(testRoom);
    expect(isRoomComplete(progress)).toBe(false);
    expect(restoredCount(progress)).toBe(0);
  });

  it('tüm öğeler yenilenince tamamlanmış sayılır', () => {
    let progress = createInitialRoomProgress(testRoom);
    const r1 = restoreItem(testRoom, progress, 'a', 0, 100);
    expect(r1.ok).toBe(true);
    if (r1.ok) progress = r1.progress;
    expect(isRoomComplete(progress)).toBe(false);
    expect(restoredCount(progress)).toBe(1);

    const r2 = restoreItem(testRoom, progress, 'b', 1, 100);
    expect(r2.ok).toBe(true);
    if (r2.ok) progress = r2.progress;
    expect(isRoomComplete(progress)).toBe(true);
    expect(restoredCount(progress)).toBe(2);
  });
});

describe('restoreItem', () => {
  it('yeterli yıldızla başarılı olur ve maliyeti düşer', () => {
    const progress = createInitialRoomProgress(testRoom);
    const outcome = restoreItem(testRoom, progress, 'a', 0, 50);
    expect(outcome).toEqual({
      ok: true,
      progress: { roomId: 'test-room', items: { a: { restored: true, styleIndex: 0 }, b: { restored: false, styleIndex: null } } },
      starsRemaining: 40,
    });
  });

  it('seçilen stil kaydedilir', () => {
    const progress = createInitialRoomProgress(testRoom);
    const outcome = restoreItem(testRoom, progress, 'a', 1, 50);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.progress.items.a.styleIndex).toBe(1);
  });

  it('yetersiz yıldızda not-enough-stars hatası verir ve progress değişmez', () => {
    const progress = createInitialRoomProgress(testRoom);
    const outcome = restoreItem(testRoom, progress, 'b', 0, 5);
    expect(outcome).toEqual({ ok: false, error: 'not-enough-stars' });
  });

  it('zaten yenilenmiş öğede already-restored hatası verir', () => {
    let progress = createInitialRoomProgress(testRoom);
    const r1 = restoreItem(testRoom, progress, 'a', 0, 100);
    if (r1.ok) progress = r1.progress;
    const r2 = restoreItem(testRoom, progress, 'a', 1, 100);
    expect(r2).toEqual({ ok: false, error: 'already-restored' });
  });

  it('olmayan öğe id\'sinde item-not-found hatası verir', () => {
    const progress = createInitialRoomProgress(testRoom);
    const outcome = restoreItem(testRoom, progress, 'does-not-exist', 0, 1000);
    expect(outcome).toEqual({ ok: false, error: 'item-not-found' });
  });
});
