import { ITEM_TYPE_POOL } from './itemTypePool';
import type { LevelConfig } from './levelGenerator';

const CAPACITY = 4;
const BASE_SEED = 20240101;
/** "İleri seviyeler" eşiği: bu numaradan itibaren tek engel mekaniği (kilitli kap) denenir. */
const OBSTACLE_START_LEVEL = 50;

/**
 * Seviye numarasından deterministik bir LevelConfig üretir.
 * - İlk 10 seviye: 2 tür, bol boş kap (çok kolay).
 * - Sonra yavaşça artan tür sayısı ve karıştırma derinliği.
 * - Her 10. seviye "nefes seviyesi": bir fazla boş kap + daha sığ karıştırma.
 */
export function levelConfigFor(levelNumber: number, baseSeed = BASE_SEED): LevelConfig {
  if (levelNumber < 1) throw new Error('levelNumber >= 1 olmalı');

  const isBreather = levelNumber % 10 === 0;

  const itemTypeCount = clamp(2 + Math.floor((levelNumber - 1) / 40), 2, ITEM_TYPE_POOL.length);
  let emptyContainerCount = clamp(3 - Math.floor((levelNumber - 1) / 60), 1, 3);

  let shuffleDepthFactor = 1.5 + (Math.min(levelNumber, 400) / 400) * 3; // 1.5x -> 4.5x toplam eşya

  if (isBreather) {
    emptyContainerCount = Math.min(emptyContainerCount + 1, CAPACITY);
    shuffleDepthFactor *= 0.7;
  }

  const filledContainerCount = itemTypeCount; // basit model: her tür tam olarak 1 dolu kabı doldurur
  const containerCount = filledContainerCount + emptyContainerCount;
  const totalItems = itemTypeCount * CAPACITY;
  const shuffleDepth = Math.max(itemTypeCount * 3, Math.round(totalItems * shuffleDepthFactor));

  return {
    id: levelNumber,
    seed: (baseSeed + levelNumber * 1013904223) >>> 0,
    itemTypeCount,
    containerCount,
    capacity: CAPACITY,
    emptyContainerCount,
    shuffleDepth,
    hasObstacle: levelNumber >= OBSTACLE_START_LEVEL,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
