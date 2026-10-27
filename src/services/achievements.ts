import { isRoomComplete, restoredCount } from '../core/room';
import type { TranslationKey } from '../i18n/translations';
import { collectedRatingStars, type SaveData } from './SaveService';

/**
 * Hafif, zorlamasız başarımlar (Faz 6): hepsi zaten oynarken kendiliğinden ilerleyen hedefler,
 * kayıttan TÜRETİLİR (ayrı sayaç tutulmaz) -- yalnızca "açıldı" listesi saklanır ki bildirim bir
 * kez gösterilsin ve küçük bonus bir kez verilsin. Reklam/satın alma yok.
 */
export interface AchievementDef {
  readonly id: string;
  readonly titleKey: TranslationKey;
  readonly descKey: TranslationKey;
  readonly target: number;
  readonly progress: (data: SaveData) => number;
}

/** Her açılan başarım için verilen küçük yıldız bonusu. */
export const ACHIEVEMENT_BONUS_STARS = 5;

const levelsCompleted = (d: SaveData) => Math.max(0, d.currentLevel - 1);
const perfectLevels = (d: SaveData) => Object.values(d.levelStars).filter((n) => n >= 3).length;
const itemsRestored = (d: SaveData) => d.rooms.reduce((sum, r) => sum + restoredCount(r), 0);
const roomsCompleted = (d: SaveData) => d.rooms.filter((r) => isRoomComplete(r)).length;

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'first-win', titleKey: 'achFirstWinTitle', descKey: 'achFirstWinDesc', target: 1, progress: levelsCompleted },
  { id: 'level-10', titleKey: 'achLevel10Title', descKey: 'achLevelsDesc', target: 10, progress: levelsCompleted },
  { id: 'level-25', titleKey: 'achLevel25Title', descKey: 'achLevelsDesc', target: 25, progress: levelsCompleted },
  { id: 'level-50', titleKey: 'achLevel50Title', descKey: 'achLevelsDesc', target: 50, progress: levelsCompleted },
  { id: 'level-100', titleKey: 'achLevel100Title', descKey: 'achLevelsDesc', target: 100, progress: levelsCompleted },
  { id: 'perfect-10', titleKey: 'achPerfectTitle', descKey: 'achPerfectDesc', target: 10, progress: perfectLevels },
  { id: 'stars-100', titleKey: 'achStarsTitle', descKey: 'achStarsDesc', target: 100, progress: collectedRatingStars },
  { id: 'restore-5', titleKey: 'achRestoreTitle', descKey: 'achRestoreDesc', target: 5, progress: itemsRestored },
  { id: 'room-1', titleKey: 'achRoomTitle', descKey: 'achRoomDesc', target: 1, progress: roomsCompleted },
  { id: 'streak-3', titleKey: 'achStreak3Title', descKey: 'achStreakDesc', target: 3, progress: (d) => d.dailyReward.streak },
  { id: 'streak-7', titleKey: 'achStreak7Title', descKey: 'achStreakDesc', target: 7, progress: (d) => d.dailyReward.streak },
];

export interface AchievementResult {
  readonly data: SaveData;
  readonly unlocked: readonly AchievementDef[];
}

/** Hedefine ulaşmış ama henüz açılmamış başarımları açar, her biri için bonus yıldızı ekler. Saf. */
export function applyAchievements(data: SaveData): AchievementResult {
  const done = new Set(data.achievements);
  const unlocked = ACHIEVEMENTS.filter((a) => !done.has(a.id) && a.progress(data) >= a.target);
  if (unlocked.length === 0) return { data, unlocked };
  return {
    data: {
      ...data,
      stars: data.stars + unlocked.length * ACHIEVEMENT_BONUS_STARS,
      achievements: [...data.achievements, ...unlocked.map((a) => a.id)],
    },
    unlocked,
  };
}

export function achievementProgress(def: AchievementDef, data: SaveData): { value: number; done: boolean } {
  const value = Math.min(def.target, def.progress(data));
  return { value, done: data.achievements.includes(def.id) || value >= def.target };
}
