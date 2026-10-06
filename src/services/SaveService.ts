import { Preferences } from '@capacitor/preferences';
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

function isValidRoomProgress(value: unknown): value is RoomProgress {
  return !!value && typeof value === 'object' && typeof (value as RoomProgress).items === 'object';
}

/**
 * Eski (ör. v1) bir kayıttan gelen BİLİNMEYEN/kaldırılmış alanları (ör. eski removeAdsPurchased)
 * sessizce atar: yalnızca güncel SaveData şeklinde var olan anahtarlar, değeri tanımlıysa, mevcut
 * varsayılanın üzerine yazılır. Böylece sürüm alanı ne olursa olsun kayıt her zaman güncel şekle
 * geçer -- kilitlenme veya veri kaybı olmadan.
 *
 * `rooms` ayrıca BOYUT olarak da onarılır: ROOMS listesi büyütülmeden ÖNCE kaydedilmiş eski bir
 * kayıtta `rooms.length` güncel `ROOMS.length`'ten kısa olabilir -- RoomScene o zaman eksik
 * indekse erişip çökerdi (bkz. Faz 5 kararları, bu hata test sırasında gerçekten yakalandı).
 * Eksik odalar için taze bir başlangıç ilerlemesi eklenir, mevcut ilerleme (index'e göre
 * eşlenerek) korunur.
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

  const roomsFromPartial = Array.isArray(partial.rooms) ? (partial.rooms as unknown[]) : [];
  merged.rooms = ROOMS.map((room, i) => (isValidRoomProgress(roomsFromPartial[i]) ? roomsFromPartial[i] : createInitialRoomProgress(room)));

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

export const STORAGE_KEY = 'yerli-yerinde-save-v1';

/**
 * localStorage'a EK OLARAK @capacitor/preferences'a da (en-son-durumu) yazar -- native
 * platformlarda (Android) verinin yalnızca WebView depolamasına değil, native
 * SharedPreferences'a da yedeklenmesi için (ör. WebView depolaması farklı bir nedenle
 * temizlenirse kurtarılabilsin diye, bkz. restoreFromPreferencesIfMissing). load()/save()
 * imzası SENKRON kalır (oyun kodunun onlarca yerinde böyle kullanılıyor) -- bu yüzden
 * Preferences yazısı "fire-and-forget" (ateşle-unut), hiçbir çağrı yerini async yapmaz.
 * Web'de @capacitor/preferences zaten kendi içinde localStorage'a düşer, bu yüzden web'de bu
 * sadece zararsız bir ikinci (ayrı anahtarlı) yazıdır.
 */
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
    const json = JSON.stringify(data);
    this.storage.setItem(this.key, json);
    void Preferences.set({ key: this.key, value: json }).catch(() => {
      // Eklenti kullanılamıyorsa (ör. tarayıcıda bazı kısıtlı ortamlar) sessizce yok say --
      // localStorage yazısı zaten yapıldı, oyunun birincil kayıt yolu bozulmaz.
    });
  }
}

/**
 * Uygulama açılışında BİR KERE (bkz. main.ts) çağrılır: localStorage'ta hiç kayıt yoksa ama
 * native Preferences'ta bir yedek varsa (ör. WebView depolaması farklı bir nedenle temizlenmiş
 * olabilir), onu localStorage'a geri yazar -- böylece LocalStorageSaveService.load() (senkron)
 * normal şekilde bulur. localStorage'ta zaten veri varsa hiçbir şey yapmaz (localStorage her
 * zaman üstün kaynaktır, Preferences yalnızca bir yedektir). Web'de @capacitor/preferences
 * kendi içinde zaten localStorage kullandığından burada pratikte hep "localStorage zaten dolu"
 * koluna düşer -- yalnızca gerçek native platformlarda anlamlı bir fark yaratır.
 */
export async function restoreFromPreferencesIfMissing(storage: KeyValueStorage, key: string = STORAGE_KEY): Promise<void> {
  if (storage.getItem(key)) return;
  try {
    const { value } = await Preferences.get({ key });
    if (value) storage.setItem(key, value);
  } catch {
    // Eklenti kullanılamıyorsa sessizce atla -- createDefaultSaveData() ile devam edilir.
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
