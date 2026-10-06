import { DIFFICULTY, type DifficultyRangeRule } from '../config/tuning';
import { ITEM_TYPE_POOL } from './itemTypePool';
import type { LevelConfig } from './levelGenerator';

export type ObstacleKind = 'mystery' | 'lock' | 'typeLock';

/**
 * Hangi engel türlerinin bu seviyede aktif olacağını belirler (ayar tuning.ts'teki DIFFICULTY.obstacles'tan
 * gelir). Nefes seviyelerinde (her breatherEvery'de bir) hiç engel YOKTUR -- "belirgin biçimde daha kolay"
 * hissi için. Aksi halde uygun türler arasında seviye numarasına göre deterministik biçimde döner
 * (rastgelelik yok): seviye 50'ye kadar en fazla 1, sonrasında en fazla 2 engel türü birlikte.
 */
export function obstaclesForLevel(levelNumber: number, isBreather: boolean): readonly ObstacleKind[] {
  if (isBreather) return [];

  const { mysteryStartLevel, lockStartLevel, typeLockStartLevel, maxSimultaneousAfterLevel } = DIFFICULTY.obstacles;
  const eligible: ObstacleKind[] = [];
  if (levelNumber >= mysteryStartLevel) eligible.push('mystery');
  if (levelNumber >= lockStartLevel) eligible.push('lock');
  if (levelNumber >= typeLockStartLevel) eligible.push('typeLock');
  if (eligible.length === 0) return [];

  const maxCount = levelNumber > maxSimultaneousAfterLevel ? Math.min(2, eligible.length) : 1;
  const startIdx = levelNumber % eligible.length;
  const picked: ObstacleKind[] = [];
  for (let i = 0; i < maxCount; i++) {
    picked.push(eligible[(startIdx + i) % eligible.length]);
  }
  return picked;
}

function rangeFor(levelNumber: number): DifficultyRangeRule {
  for (const rule of DIFFICULTY.ranges) {
    if (levelNumber <= rule.maxLevel) return rule;
  }
  return DIFFICULTY.ranges[DIFFICULTY.ranges.length - 1];
}

/**
 * Hamle limiti: doğrulanmış sertifika uzunluğu (HER ZAMAN gerçekten tamamlanabilir bir çözümün
 * kanıtıdır) + bir pay. Seviye zorlaştıkça sertifika uzunluğu kendiliğinden büyüdüğü için limit de
 * otomatik artar -- ayrıca bir zorluk çarpanına gerek yok. Pay, ilk newPlayerWideBonusUntilLevel
 * seviyede (yeni oyuncu rahatlığı için) geniş tutulur, sonra newPlayerTaperEndLevel'e kadar
 * doğrusal olarak taban moveLimitBonus'a daralır -- bu noktadan sonra kasıtlı olarak sıkıdır ki
 * seviye gerçekten kaybedilebilsin (bkz. tuning.ts: DIFFICULTY).
 */
export function moveLimitFor(levelNumber: number, certificateLength: number): number {
  return certificateLength + moveLimitBonusForLevel(levelNumber);
}

function moveLimitBonusForLevel(levelNumber: number): number {
  const { newPlayerWideBonusUntilLevel, newPlayerWideBonus, newPlayerTaperEndLevel, moveLimitBonus } = DIFFICULTY;
  if (levelNumber <= newPlayerWideBonusUntilLevel) return newPlayerWideBonus;
  if (levelNumber >= newPlayerTaperEndLevel) return moveLimitBonus;
  const t = (levelNumber - newPlayerWideBonusUntilLevel) / (newPlayerTaperEndLevel - newPlayerWideBonusUntilLevel);
  return Math.round(newPlayerWideBonus + (moveLimitBonus - newPlayerWideBonus) * t);
}

/**
 * Seviye numarasından deterministik bir LevelConfig üretir (bkz. src/config/tuning.ts: DIFFICULTY).
 * - Seviye 1-5: 3 tür, 2 boş kap (öğretici, kolay).
 * - Seviye 6-15 / 16-35 / 36-70 / 71+: tür sayısı kademeli artar, bazı aralıklarda boş kap sayısı
 *   düşer (36+'dan itibaren seviyelerin yaklaşık yarısında 1 boş kap -- bkz. aşağıdaki salınım).
 * - Her breatherEvery (varsayılan 5) seviyede bir "nefes seviyesi": fazladan boş kap + daha sığ
 *   karıştırma + hiç engel yok.
 * - Karıştırma derinliği genel eğilimde artar ama nefes seviyelerinde düşer ("testere dişi").
 */
export function levelConfigFor(levelNumber: number, baseSeed = DIFFICULTY.baseSeed): LevelConfig {
  if (levelNumber < 1) throw new Error('levelNumber >= 1 olmalı');

  const isBreather = levelNumber % DIFFICULTY.breatherEvery === 0;
  const { itemTypeRange, emptyContainerRange } = rangeFor(levelNumber);

  const itemTypeCount = clamp(
    itemTypeRange[0] + stepWithinRange(levelNumber, itemTypeRange),
    itemTypeRange[0],
    Math.min(itemTypeRange[1], ITEM_TYPE_POOL.length),
  );

  // Boş kap sayısı: aralığın alt ve üst sınırı arasında, seviye numarasına göre deterministik bir
  // salınımla seçilir (ör. 36-70 aralığında seviyelerin yaklaşık yarısı 1, yarısı 2 boş kap alır).
  const [emptyMin, emptyMax] = emptyContainerRange;
  let emptyContainerCount =
    emptyMin === emptyMax ? emptyMin : emptyMin + (Math.floor(levelNumber / 2) % (emptyMax - emptyMin + 1));

  let shuffleDepthFactor =
    DIFFICULTY.shuffleDepthMinFactor +
    (Math.min(levelNumber, DIFFICULTY.shuffleDepthRampLevels) / DIFFICULTY.shuffleDepthRampLevels) *
      (DIFFICULTY.shuffleDepthMaxFactor - DIFFICULTY.shuffleDepthMinFactor);

  if (isBreather) {
    emptyContainerCount = Math.min(emptyContainerCount + 1, DIFFICULTY.capacity);
    shuffleDepthFactor *= DIFFICULTY.breatherShuffleFactor;
  }

  const filledContainerCount = itemTypeCount; // basit model: her tür tam olarak 1 dolu kabı doldurur
  const containerCount = filledContainerCount + emptyContainerCount;
  const totalItems = itemTypeCount * DIFFICULTY.capacity;
  const shuffleDepth = Math.max(itemTypeCount * 3, Math.round(totalItems * shuffleDepthFactor));

  const obstacles = obstaclesForLevel(levelNumber, isBreather);

  return {
    id: levelNumber,
    seed: (baseSeed + levelNumber * 1013904223) >>> 0,
    itemTypeCount,
    containerCount,
    capacity: DIFFICULTY.capacity,
    emptyContainerCount,
    shuffleDepth,
    hasObstacle: obstacles.includes('lock'),
    hasMysteryItem: obstacles.includes('mystery'),
    hasTypeLock: obstacles.includes('typeLock'),
  };
}

/** [0, range genişliği] arasında, seviye numarasına göre deterministik biçimde kademeli artan bir adım. */
function stepWithinRange(levelNumber: number, range: readonly [number, number]): number {
  const width = range[1] - range[0];
  if (width <= 0) return 0;
  // Aralık içindeki ilerlemeyi 40 seviyelik bloklarla kademeli artırır (ör. 5-6 arası: ilk yarı 5, ikinci yarı 6).
  return Math.min(width, Math.floor(levelNumber / 20));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
