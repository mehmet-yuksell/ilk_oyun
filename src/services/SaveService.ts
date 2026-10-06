import type { DailyRewardState } from '../core/dailyReward';
import type { RoomProgress } from '../core/room';
import { createInitialRoomProgress } from '../core/room';
import { ROOMS } from '../core/roomDefs';
import type { Language } from '../i18n/translations';

/** Geçmiş sürümler: v1 bir `removeAdsPurchased: boolean` alanı içeriyordu (reklam/IAP katmanı
 * kaldırılınca atıldı). migrateSaveData() eski kayıtlarda bu alan hâlâ varsa sessizce yok sayar. */
export const SAVE_DATA_VERSION = 2;

export interface SaveData {
  readonly version: typeof SAVE_DATA_VERSION;
  readonly stars: number;
  /** Bir sonraki oynanacak ana ilerleme seviyesi (1'den başlar). */
  readonly currentLevel: number;
  readonly currentRoomIndex: number;
  /** ROOMS ile aynı sırada, her odanın yenileme ilerlemesi. */
  readonly rooms: readonly RoomProgress[];
  readonly dailyReward: DailyRewardState;
  readonly language: Language;
  readonly soundEnabled: boolean;
  readonly hapticEnabled: boolean;
  /** Daha önce ipucu balonu gösterilmiş engel türleri ('mystery'|'lock'|'typeLock') -- her biri yalnızca ilk görüldüğünde anlatılır. */
  readonly seenHints: readonly string[];
}

export function createDefaultSaveData(): SaveData {
  return {
    version: SAVE_DATA_VERSION,
    stars: 0,
    currentLevel: 1,
    currentRoomIndex: 0,
    rooms: ROOMS.map((room) => createInitialRoomProgress(room)),
    dailyReward: { lastClaimedDate: null, streak: 0 },
    language: 'tr',
    soundEnabled: true,
    hapticEnabled: true,
    seenHints: [],
  };
}

/**
 * Eski (ör. v1) bir kayıttan gelen BİLİNMEYEN/kaldırılmış alanları (ör. eski removeAdsPurchased)
 * sessizce atar: yalnızca güncel SaveData şeklinde var olan anahtarlar, değeri tanımlıysa, mevcut
 * varsayılanın üzerine yazılır. Böylece sürüm alanı ne olursa olsun kayıt her zaman güncel şekle
 * geçer -- kilitlenme veya veri kaybı olmadan.
 */
export function migrateSaveData(raw: unknown): SaveData {
  const defaults = createDefaultSaveData();
  if (!raw || typeof raw !== 'object') return defaults;

  const partial = raw as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...defaults };
  for (const key of Object.keys(defaults)) {
    if (partial[key] !== undefined) {
      merged[key] = partial[key];
    }
  }
  merged.version = SAVE_DATA_VERSION;
  return merged as unknown as SaveData;
}

export interface SaveService {
  load(): SaveData;
  save(data: SaveData): void;
}

/** localStorage gibi basit bir anahtar-değer deposu. Tarayıcıda window.localStorage, testte sahte bir bellek deposu verilir. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const STORAGE_KEY = 'yerli-yerinde-save-v1';

export class LocalStorageSaveService implements SaveService {
  private readonly storage: KeyValueStorage;
  private readonly key: string;

  constructor(storage: KeyValueStorage, key: string = STORAGE_KEY) {
    this.storage = storage;
    this.key = key;
  }

  load(): SaveData {
    const raw = this.storage.getItem(this.key);
    if (!raw) return createDefaultSaveData();
    try {
      return migrateSaveData(JSON.parse(raw));
    } catch {
      return createDefaultSaveData();
    }
  }

  save(data: SaveData): void {
    this.storage.setItem(this.key, JSON.stringify(data));
  }
}

export class InMemoryKeyValueStorage implements KeyValueStorage {
  private readonly map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}
