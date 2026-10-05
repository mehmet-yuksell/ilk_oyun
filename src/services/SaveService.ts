import type { DailyRewardState } from '../core/dailyReward';
import type { RoomProgress } from '../core/room';
import { createInitialRoomProgress } from '../core/room';
import { ROOMS } from '../core/roomDefs';
import type { Language } from '../i18n/translations';

export interface SaveData {
  readonly version: 1;
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
  /** Mock IAP yer tutucusu: gerçek ödeme SDK'sı yok, Ayarlar ekranından anında "satın alınmış" sayılır. */
  readonly removeAdsPurchased: boolean;
  /** Daha önce ipucu balonu gösterilmiş engel türleri ('mystery'|'lock'|'typeLock') -- her biri yalnızca ilk görüldüğünde anlatılır. */
  readonly seenHints: readonly string[];
}

export function createDefaultSaveData(): SaveData {
  return {
    version: 1,
    stars: 0,
    currentLevel: 1,
    currentRoomIndex: 0,
    rooms: ROOMS.map((room) => createInitialRoomProgress(room)),
    dailyReward: { lastClaimedDate: null, streak: 0 },
    language: 'tr',
    soundEnabled: true,
    hapticEnabled: true,
    removeAdsPurchased: false,
    seenHints: [],
  };
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
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      // Eksik alanlar (ör. ileride eklenen yeni bir alan) varsayılana düşer -- basit ileriye dönük uyumluluk.
      return { ...createDefaultSaveData(), ...parsed };
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
