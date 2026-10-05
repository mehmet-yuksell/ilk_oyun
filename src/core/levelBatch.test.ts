import { describe, expect, it } from 'vitest';
import { levelConfigFor } from './difficultyCurve';
import { generateVerifiedLevel } from './levelGenerator';

const TOTAL_LEVELS = 500;

describe('500 seviyelik toplu üretim', () => {
  it('her seviye üretilir ve sertifikası gerçek motor üzerinde çözülebilir olarak doğrulanır', () => {
    let totalAttempts = 0;
    let maxAttemptsForOneLevel = 0;
    let obstacleEligible = 0;
    let obstacleInjected = 0;

    for (let n = 1; n <= TOTAL_LEVELS; n++) {
      const config = levelConfigFor(n);
      const result = generateVerifiedLevel(config);
      totalAttempts += result.attemptsUsed;
      maxAttemptsForOneLevel = Math.max(maxAttemptsForOneLevel, result.attemptsUsed);
      if (config.hasObstacle) {
        obstacleEligible++;
        if (result.hasLock) obstacleInjected++;
      }

      expect(result.verifiedMoveCount).toBeGreaterThan(0);
    }

    // eslint-disable-next-line no-console
    console.log(
      `[levelBatch] ${TOTAL_LEVELS}/${TOTAL_LEVELS} seviye doğrulandı. ` +
        `Ortalama deneme/seviye: ${(totalAttempts / TOTAL_LEVELS).toFixed(3)}, ` +
        `en kötü durumda tek seviye için deneme: ${maxAttemptsForOneLevel}. ` +
        `Kilitli kap: ${obstacleInjected}/${obstacleEligible} uygun seviyede eklendi.`,
    );

    expect(maxAttemptsForOneLevel).toBeLessThanOrEqual(8); // generateVerifiedLevel'ın varsayılan maxAttempts'i
  });
});
