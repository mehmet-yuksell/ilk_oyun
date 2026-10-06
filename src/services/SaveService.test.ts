import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROOMS } from '../core/roomDefs';

// @capacitor/preferences'ın registerPlugin() ile dönen nesnesi spyOn edilemiyor (own property
// değil) -- modülü tamamen sahteleştiriyoruz, böylece get/set çağrılarını test başına kontrol
// edebiliyoruz. vi.mock üstte (hoisted) olmalı, bu yüzden SaveService import'undan ÖNCE.
const preferencesMock = {
  get: vi.fn().mockResolvedValue({ value: null }),
  set: vi.fn().mockResolvedValue(undefined),
};
vi.mock('@capacitor/preferences', () => ({ Preferences: preferencesMock }));

const {
  createDefaultSaveData,
  InMemoryKeyValueStorage,
  LocalStorageSaveService,
  migrateSaveData,
  restoreFromPreferencesIfMissing,
  SAVE_DATA_VERSION,
  STORAGE_KEY,
} = await import('./SaveService');

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
    expect(data.version).toBe(SAVE_DATA_VERSION);
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

  it('eski sürümden kalan kaldırılmış alanlar (ör. removeAdsPurchased) sessizce atılır', () => {
    const storage = new InMemoryKeyValueStorage();
    storage.setItem('yerli-yerinde-save-v1', JSON.stringify({ version: 1, stars: 30, removeAdsPurchased: true }));
    const service = new LocalStorageSaveService(storage);
    const loaded = service.load();
    expect(loaded.stars).toBe(30);
    expect(loaded.version).toBe(SAVE_DATA_VERSION);
    expect((loaded as unknown as Record<string, unknown>).removeAdsPurchased).toBeUndefined();
  });
});

describe('migrateSaveData', () => {
  it('geçersiz/eksik girdide varsayılana düşer', () => {
    expect(migrateSaveData(null)).toEqual(createDefaultSaveData());
    expect(migrateSaveData(undefined)).toEqual(createDefaultSaveData());
    expect(migrateSaveData('bozuk')).toEqual(createDefaultSaveData());
  });

  it('bilinen alanları korur, bilinmeyen/kaldırılmış alanları yok sayar, sürümü günceller', () => {
    const migrated = migrateSaveData({ version: 1, stars: 42, removeAdsPurchased: true, someFutureRemovedField: 'x' });
    expect(migrated.stars).toBe(42);
    expect(migrated.version).toBe(SAVE_DATA_VERSION);
    expect((migrated as unknown as Record<string, unknown>).someFutureRemovedField).toBeUndefined();
  });

  it('ROOMS listesi büyüdükten sonra, eski kayıttaki kısa rooms dizisi güncel uzunluğa tamamlanır', () => {
    // ROOMS 5'ten 10'a çıkarılmadan ÖNCE kaydedilmiş bir oyuncuyu simüle eder -- bkz. Faz 5
    // kararları: bu durum gerçek bir çökmeye yol açıyordu (RoomScene eksik indekse erişiyordu).
    const oldProgress = { roomId: ROOMS[0].id, items: { [`${ROOMS[0].id}-0`]: { restored: true, styleIndex: 0 as const } } };
    const migrated = migrateSaveData({ version: 1, stars: 10, rooms: [oldProgress] });
    expect(migrated.rooms).toHaveLength(ROOMS.length);
    expect(migrated.rooms[0]).toEqual(oldProgress); // mevcut ilerleme korunur
    expect(Object.values(migrated.rooms[1].items).every((s) => !s.restored)).toBe(true); // yeni odalar taze baslar
  });

  it('rooms hiç array değilse (bozuk veri) tamamen taze bir rooms listesi üretir', () => {
    const migrated = migrateSaveData({ version: 1, rooms: 'not-an-array' });
    expect(migrated.rooms).toEqual(createDefaultSaveData().rooms);
  });
});

describe('LocalStorageSaveService + @capacitor/preferences', () => {
  beforeEach(() => {
    preferencesMock.get.mockReset();
    preferencesMock.set.mockReset().mockResolvedValue(undefined);
  });

  it('save() localStorage ile birlikte Preferences\'a da (aynı anahtarla) yazar', async () => {
    const storage = new InMemoryKeyValueStorage();
    const service = new LocalStorageSaveService(storage);
    const data = { ...createDefaultSaveData(), stars: 55 };

    service.save(data);

    expect(storage.getItem(STORAGE_KEY)).toBe(JSON.stringify(data));
    // Preferences yazısı fire-and-forget (await edilmiyor) -- mikro görev kuyruğunun
    // boşalmasını bekleyip çağrıldığını doğruluyoruz.
    await Promise.resolve();
    expect(preferencesMock.set).toHaveBeenCalledWith({ key: STORAGE_KEY, value: JSON.stringify(data) });
  });

  it('Preferences.set reddedilse bile save() hata fırlatmaz (localStorage zaten birincil kaynak)', () => {
    preferencesMock.set.mockReset().mockRejectedValue(new Error('eklenti yok'));
    const storage = new InMemoryKeyValueStorage();
    const service = new LocalStorageSaveService(storage);

    expect(() => service.save(createDefaultSaveData())).not.toThrow();
  });
});

describe('restoreFromPreferencesIfMissing', () => {
  beforeEach(() => {
    preferencesMock.get.mockReset();
    preferencesMock.set.mockReset().mockResolvedValue(undefined);
  });

  it('localStorage zaten doluysa Preferences\'a hiç bakmaz', async () => {
    const storage = new InMemoryKeyValueStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ stars: 1 }));

    await restoreFromPreferencesIfMissing(storage);

    expect(preferencesMock.get).not.toHaveBeenCalled();
    expect(storage.getItem(STORAGE_KEY)).toBe(JSON.stringify({ stars: 1 }));
  });

  it('localStorage boşsa ve Preferences\'ta bir yedek varsa, onu localStorage\'a geri yazar', async () => {
    const backup = JSON.stringify({ ...createDefaultSaveData(), stars: 77 });
    preferencesMock.get.mockResolvedValue({ value: backup });
    const storage = new InMemoryKeyValueStorage();

    await restoreFromPreferencesIfMissing(storage);

    expect(storage.getItem(STORAGE_KEY)).toBe(backup);
  });

  it('localStorage boş ve Preferences\'ta da yedek yoksa localStorage boş kalır', async () => {
    preferencesMock.get.mockResolvedValue({ value: null });
    const storage = new InMemoryKeyValueStorage();

    await restoreFromPreferencesIfMissing(storage);

    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('Preferences.get reddedilirse sessizce vazgeçer, hata fırlatmaz', async () => {
    preferencesMock.get.mockRejectedValue(new Error('eklenti yok'));
    const storage = new InMemoryKeyValueStorage();

    await expect(restoreFromPreferencesIfMissing(storage)).resolves.toBeUndefined();
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });
});
