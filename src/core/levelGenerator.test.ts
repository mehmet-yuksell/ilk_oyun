import { describe, expect, it } from 'vitest';
import { generateLevel, generateVerifiedLevel, verifyCertificate, type LevelConfig } from './levelGenerator';
import { isContainerLocked, isLevelComplete, tryMove } from './gameLogic';

const baseConfig: LevelConfig = {
  id: 1,
  seed: 1234,
  itemTypeCount: 3,
  containerCount: 5,
  capacity: 4,
  emptyContainerCount: 2,
  shuffleDepth: 25,
  hasObstacle: false,
};

describe('generateLevel', () => {
  it('aynı config her zaman aynı başlangıç durumunu ve sertifikayı üretir (determinizm)', () => {
    const a = generateLevel(baseConfig);
    const b = generateLevel(baseConfig);
    expect(a.initialState).toEqual(b.initialState);
    expect(a.certificate).toEqual(b.certificate);
  });

  it('farklı seed farklı bir karıştırma üretir', () => {
    const a = generateLevel(baseConfig);
    const b = generateLevel({ ...baseConfig, seed: baseConfig.seed + 1 });
    expect(a.initialState).not.toEqual(b.initialState);
  });

  it('hiçbir kap kapasitesini aşmaz ve her tür için toplam eşya sayısı kapasitenin katıdır', () => {
    const { initialState } = generateLevel(baseConfig);
    for (const c of initialState.containers) {
      expect(c.items.length).toBeLessThanOrEqual(c.capacity);
    }

    const totalsByType = new Map<string, number>();
    for (const c of initialState.containers) {
      for (const item of c.items) {
        totalsByType.set(item.type, (totalsByType.get(item.type) ?? 0) + 1);
      }
    }
    expect(totalsByType.size).toBe(baseConfig.itemTypeCount);
    for (const total of totalsByType.values()) {
      expect(total % baseConfig.capacity).toBe(0);
      expect(total).toBeGreaterThan(0);
    }
  });

  it('itemTypeCount havuzu aşarsa hata fırlatır', () => {
    expect(() => generateLevel({ ...baseConfig, itemTypeCount: 99 })).toThrow();
  });

  it('dolu kap sayısı tür sayısından azsa hata fırlatır', () => {
    expect(() => generateLevel({ ...baseConfig, itemTypeCount: 5, containerCount: 5, emptyContainerCount: 3 })).toThrow();
  });
});

describe('verifyCertificate', () => {
  it('generateLevel çıktısının sertifikası gerçek motor üzerinde geçerlidir', () => {
    const { initialState, certificate } = generateLevel(baseConfig);
    const check = verifyCertificate(initialState, certificate);
    expect(check.valid).toBe(true);
    expect(check.actualMoveCount).toBeGreaterThan(0);
  });

  it('boş bir sertifika, tamamlanmamış bir durum için geçersiz sayılır', () => {
    const { initialState } = generateLevel(baseConfig);
    const check = verifyCertificate(initialState, []);
    expect(check.valid).toBe(false);
    expect(check.failureReason).toMatch(/tamamlanmadı/);
  });

  it('geçersiz bir hamle içeren sertifika reddedilir', () => {
    const { initialState } = generateLevel(baseConfig);
    const check = verifyCertificate(initialState, [{ sourceId: 'does-not-exist', targetId: 'also-not' }]);
    expect(check.valid).toBe(false);
    expect(check.failureReason).toMatch(/geçersiz/);
  });
});

describe('generateVerifiedLevel', () => {
  it('doğrulanmış bir seviye döner ve sertifika gerçekten oynatılabilir', () => {
    const result = generateVerifiedLevel(baseConfig);
    expect(result.attemptsUsed).toBeGreaterThanOrEqual(1);
    expect(result.verifiedMoveCount).toBeGreaterThan(0);

    let state = result.initialState;
    for (const move of result.certificate) {
      if (isLevelComplete(state)) break;
      const outcome = tryMove(state, move);
      expect(outcome.ok).toBe(true);
      if (outcome.ok) state = outcome.result.state;
    }
    expect(isLevelComplete(state)).toBe(true);
  });

  it('çeşitli konfigürasyonlarda (küçükten büyüğe) hep doğrulanmış bir seviye üretir', () => {
    const configs: LevelConfig[] = [
      { id: 1, seed: 1, itemTypeCount: 2, containerCount: 4, capacity: 4, emptyContainerCount: 2, shuffleDepth: 10, hasObstacle: false },
      { id: 2, seed: 2, itemTypeCount: 5, containerCount: 7, capacity: 4, emptyContainerCount: 2, shuffleDepth: 60, hasObstacle: true },
      { id: 3, seed: 3, itemTypeCount: 10, containerCount: 12, capacity: 4, emptyContainerCount: 2, shuffleDepth: 180, hasObstacle: true },
    ];
    for (const config of configs) {
      const result = generateVerifiedLevel(config);
      expect(result.verifiedMoveCount).toBeGreaterThan(0);
    }
  });
});

describe('tek engel mekaniği: kilitli kap enjeksiyonu', () => {
  it('hasObstacle=false iken hiçbir kap kilitlenmez', () => {
    const result = generateVerifiedLevel({ ...baseConfig, hasObstacle: false });
    expect(result.hasLock).toBe(false);
    expect(result.initialState.containers.some((c) => c.lockedWhileNonEmpty)).toBe(false);
  });

  it('hasObstacle=true ve yeterince büyük bir seviyede kilit eklenir ve sertifika yine de geçerlidir', () => {
    const big: LevelConfig = {
      id: 42,
      seed: 777,
      itemTypeCount: 6,
      containerCount: 8,
      capacity: 4,
      emptyContainerCount: 2,
      shuffleDepth: 80,
      hasObstacle: true,
    };
    const result = generateVerifiedLevel(big);
    expect(result.hasLock).toBe(true);

    const lockedContainer = result.initialState.containers.find((c) => c.lockedWhileNonEmpty);
    expect(lockedContainer).toBeDefined();

    // Kilit, başlangıçta gerçekten aktiftir (kapı kabı başta dolu olmalı).
    expect(isContainerLocked(lockedContainer!, result.initialState)).toBe(true);

    // Sertifika, kilit AÇIKKEN motor üzerinde baştan sona geçerli şekilde oynanabilir
    // (generateVerifiedLevel zaten bunu iç doğrulamasında kontrol etti; burada bağımsızca tekrarlıyoruz).
    const check = verifyCertificate(result.initialState, result.certificate);
    expect(check.valid).toBe(true);

    // Sertifikayı bizzat oynatıp, kilitli kaba ait hamle gelene kadar kapı kabının
    // gerçekten boşalmış olduğunu doğrula (yani kilit, oyuncuyu asla imkansız bir hamleye zorlamıyor).
    let state = result.initialState;
    for (const move of result.certificate) {
      if (isLevelComplete(state)) break;
      if (move.sourceId === lockedContainer!.id || move.targetId === lockedContainer!.id) {
        expect(isContainerLocked(lockedContainer!, state)).toBe(false);
      }
      const outcome = tryMove(state, move);
      expect(outcome.ok).toBe(true);
      if (outcome.ok) state = outcome.result.state;
    }
  });
});
