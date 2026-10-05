import type { LevelConfig } from './levelGenerator';

/** Basit, deterministik string->32bit hash (FNV-1a benzeri). Günlük bulmaca tohumu için yeterli. */
function hashStringToSeed(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Günlük bulmaca, ana ilerlemeden bağımsız, sabit orta zorlukta ve tarihe göre tohumlanmış bir
 * seviyedir -- aynı takvim gününde herkes aynı bulmacayı çözer.
 */
export function dailyPuzzleConfig(dateKey: string): LevelConfig {
  return {
    id: 0,
    seed: hashStringToSeed(`daily:${dateKey}`),
    itemTypeCount: 4,
    containerCount: 7,
    capacity: 4,
    emptyContainerCount: 3,
    shuffleDepth: 40,
    hasObstacle: false,
  };
}
