import { describe, expect, it } from 'vitest';
import { createDefaultSaveData, InMemoryKeyValueStorage, LocalStorageSaveService } from './SaveService';
import { ROOMS } from '../core/roomDefs';

describe('createDefaultSaveData', () => {
  it('yeni oyuncu için makul varsayılanlar üretir', () => {
    const data = createDefaultSaveData();
    expect(data.stars).toBe(0);
    expect(data.currentLevel).toBe(1);
    expect(data.currentRoomIndex).toBe(0);
    expect(data.rooms).toHaveLength(ROOMS.length);
    expect(data.dailyReward).toEqual({ lastClaimedDate: null, streak: 0 });
    expect(data.language).toBe('tr');
    expect(data.soundEnabled).toBe(true);
    expect(data.hapticEnabled).toBe(true);
    expect(data.removeAdsPurchased).toBe(false);
  });

  it('her oda için başlangıç ilerlemesi tüm öğeler yenilenmemiş olarak gelir', () => {
    const data = createDefaultSaveData();
    for (const room of data.rooms) {
      expect(Object.values(room.items).every((s) => !s.restored)).toBe(true);
    }
  });
});

describe('LocalStorageSaveService', () => {
  it('hiç kayıt yoksa varsayılan veriyi döner', () => {
    const service = new LocalStorageSaveService(new InMemoryKeyValueStorage());
    expect(service.load()).toEqual(createDefaultSaveData());
  });

  it('save + load round-trip ile veriyi aynen geri verir', () => {
    const service = new LocalStorageSaveService(new InMemoryKeyValueStorage());
    const data = { ...createDefaultSaveData(), stars: 123, currentLevel: 17 };
    service.save(data);
    expect(service.load()).toEqual(data);
  });

  it('bozuk JSON karşısında çökmeden varsayılana düşer', () => {
    const storage = new InMemoryKeyValueStorage();
    storage.setItem('yerli-yerinde-save-v1', '{ bozuk json');
    const service = new LocalStorageSaveService(storage);
    expect(service.load()).toEqual(createDefaultSaveData());
  });

  it('eksik alanlı eski bir kayıtta eksikler varsayılana düşer (ileriye dönük uyumluluk)', () => {
    const storage = new InMemoryKeyValueStorage();
    storage.setItem('yerli-yerinde-save-v1', JSON.stringify({ stars: 50 }));
    const service = new LocalStorageSaveService(storage);
    const loaded = service.load();
    expect(loaded.stars).toBe(50);
    expect(loaded.currentLevel).toBe(1); // varsayılandan geldi
  });

  it('farklı servis örnekleri aynı storage\'ı paylaşınca veriyi görür', () => {
    const storage = new InMemoryKeyValueStorage();
    new LocalStorageSaveService(storage).save({ ...createDefaultSaveData(), stars: 7 });
    const reloaded = new LocalStorageSaveService(storage).load();
    expect(reloaded.stars).toBe(7);
  });
});
