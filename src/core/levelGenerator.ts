import { getTopRunLength, getTopType, isLevelComplete, tryMove } from './gameLogic';
import { ITEM_TYPE_POOL } from './itemTypePool';
import { mulberry32, pick, randInt, type Rng } from './rng';
import type { Container, GameState, Move } from './types';

export interface LevelConfig {
  readonly id: number;
  readonly seed: number;
  readonly itemTypeCount: number;
  readonly containerCount: number;
  readonly capacity: number;
  readonly emptyContainerCount: number;
  readonly shuffleDepth: number;
  /** true ise generateVerifiedLevel tek bir "kilitli kap" engeli eklemeyi dener (en iyi çaba, başarısız olursa sessizce atlanır). */
  readonly hasObstacle: boolean;
}

export interface GeneratedLevel {
  readonly initialState: GameState;
  /**
   * Çözümü oynatan hamle listesi (kaynaktan hedefe). Karıştırma adımlarının tersten
   * tekrar oynatılmasıyla elde edilir; bu yüzden "muhtemelen çözülebilir" değil,
   * yapısı gereği çözülebilirliğin bir TANIĞIdır (sonradan verifyCertificate ile
   * gerçek motor üzerinde bağımsızca doğrulanır).
   */
  readonly certificate: readonly Move[];
}

interface ReverseStep {
  readonly from: string;
  readonly to: string;
  readonly count: number;
}

/** Çözülmüş durumdan başlayıp geçerli hamlelerin tersini uygulayarak karıştırır. */
export function generateLevel(config: LevelConfig): GeneratedLevel {
  const { itemTypeCount, containerCount, capacity, emptyContainerCount, shuffleDepth, seed } = config;

  if (itemTypeCount > ITEM_TYPE_POOL.length) {
    throw new Error(`itemTypeCount (${itemTypeCount}) eşya türü havuzunu (${ITEM_TYPE_POOL.length}) aşıyor`);
  }
  const filledContainerCount = containerCount - emptyContainerCount;
  if (filledContainerCount < itemTypeCount) {
    throw new Error(
      `containerCount - emptyContainerCount (${filledContainerCount}) itemTypeCount'tan (${itemTypeCount}) küçük olamaz`,
    );
  }

  const types = ITEM_TYPE_POOL.slice(0, itemTypeCount);
  const containers: Container[] = [];
  for (let i = 0; i < filledContainerCount; i++) {
    const type = types[i % itemTypeCount];
    containers.push({
      id: `C${i}`,
      capacity,
      items: Array.from({ length: capacity }, () => ({ type })),
    });
  }
  for (let i = 0; i < emptyContainerCount; i++) {
    containers.push({ id: `C${filledContainerCount + i}`, capacity, items: [] });
  }

  let state: GameState = { containers };
  const rng = mulberry32(seed);
  const reverseSteps: ReverseStep[] = [];

  for (let step = 0; step < shuffleDepth; step++) {
    const candidate = pickReverseStep(state, rng);
    if (!candidate) continue;
    state = applyRawSlice(state, candidate.from, candidate.to, candidate.count);
    reverseSteps.push(candidate);
  }

  const certificate: Move[] = [];
  for (let i = reverseSteps.length - 1; i >= 0; i--) {
    const s = reverseSteps[i];
    certificate.push({ sourceId: s.to, targetId: s.from });
  }

  return { initialState: state, certificate };
}

/**
 * Karıştırma sırasında kaptan (from) kaba (to) tür kontrolü yapmadan ham bir dilim taşır.
 * Yalnızca üreteç içinde kullanılır; gerçek oyun kuralını (tryMove) temsil etmez.
 */
function applyRawSlice(state: GameState, fromId: string, toId: string, count: number): GameState {
  const from = state.containers.find((c) => c.id === fromId)!;
  const movingItems = from.items.slice(from.items.length - count);

  return {
    containers: state.containers.map((c) => {
      if (c.id === fromId) return { ...c, items: c.items.slice(0, c.items.length - count) };
      if (c.id === toId) return { ...c, items: [...c.items, ...movingItems] };
      return c;
    }),
  };
}

/**
 * Rastgele bir (from, to, count) karıştırma adayı seçer. Güvenlik koşulları:
 * 1) Alınan dilim ya kaynağın üst run'ından KISA kalmalı (altta farklı tür kalır, kaynağın
 *    üstü aynı türde sabit kalır) ya da kabın TAMAMI olmalı (kaynak tamamen boşalır).
 * 2) Hedefin üstü, taşınan türle AYNI olamaz. Aksi halde yeni dilim hedefteki eski run'la
 *    birleşir; sertifika tersten oynatılırken motor bu birleşik run'ın TAMAMINI tek seferde
 *    geri çeker (gerçek run-uzunluğu hesaplamasından dolayı), bu da planlanandan fazla eşya
 *    taşıyıp sonraki sertifika hamlelerini geçersiz kılar.
 * Bu iki koşul bilinen başarısızlık modlarını önler; kalan nadir durumlar
 * generateVerifiedLevel'daki replay doğrulamasıyla (ve farklı tohumla yeniden denemeyle) yakalanır.
 */
function pickReverseStep(state: GameState, rng: Rng, maxAttempts = 20): ReverseStep | null {
  const ids = state.containers.map((c) => c.id);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const fromId = ids[randInt(rng, 0, ids.length - 1)];
    const from = state.containers.find((c) => c.id === fromId)!;
    if (from.items.length === 0) continue;

    const movingType = getTopType(from)!;

    const toCandidates = ids.filter((id) => id !== fromId);
    const toId = toCandidates[randInt(rng, 0, toCandidates.length - 1)];
    const to = state.containers.find((c) => c.id === toId)!;
    if (getTopType(to) === movingType) continue;

    const freeSpace = to.capacity - to.items.length;
    if (freeSpace <= 0) continue;

    const runLength = getTopRunLength(from);
    const safeMax = from.items.length === runLength ? runLength : runLength - 1;
    const maxCount = Math.min(safeMax, freeSpace);
    if (maxCount < 1) continue;

    const count = randInt(rng, 1, maxCount);
    return { from: fromId, to: toId, count };
  }
  return null;
}

export interface CertificateCheckResult {
  readonly valid: boolean;
  readonly actualMoveCount: number;
  readonly failureReason?: string;
}

/** Sertifikayı GERÇEK motor (tryMove) üzerinde oynatarak bağımsızca doğrular. */
export function verifyCertificate(initialState: GameState, certificate: readonly Move[]): CertificateCheckResult {
  let state = initialState;
  let applied = 0;

  for (const move of certificate) {
    if (isLevelComplete(state)) break;
    const outcome = tryMove(state, move);
    if (!outcome.ok) {
      return {
        valid: false,
        actualMoveCount: applied,
        failureReason: `hamle ${applied} (${move.sourceId}->${move.targetId}) geçersiz: ${outcome.error}`,
      };
    }
    state = outcome.result.state;
    applied++;
  }

  if (!isLevelComplete(state)) {
    return { valid: false, actualMoveCount: applied, failureReason: 'sertifika tükendi ama seviye tamamlanmadı' };
  }
  return { valid: true, actualMoveCount: applied };
}

export interface VerifiedLevel {
  readonly config: LevelConfig;
  readonly initialState: GameState;
  readonly certificate: readonly Move[];
  /** Sertifikanın motor üzerinde gerçekten oynatıldığında kullanılan hamle sayısı (erken bitişlerde certificate.length'ten kısa olabilir). */
  readonly verifiedMoveCount: number;
  readonly attemptsUsed: number;
  /** tryInjectLock başarıyla bir "kilitli kap" engeli ekleyebildiyse true. */
  readonly hasLock: boolean;
}

const SEED_RETRY_STRIDE = 7919; // tohumu her denemede deterministik biçimde değiştiren asal sayı

/** generateLevel + verifyCertificate'i birleştirir; doğrulama başarısız olursa farklı bir tohumla yeniden dener. */
export function generateVerifiedLevel(baseConfig: LevelConfig, maxAttempts = 8): VerifiedLevel {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const config: LevelConfig = { ...baseConfig, seed: baseConfig.seed + attempt * SEED_RETRY_STRIDE };
    const { initialState, certificate } = generateLevel(config);
    const check = verifyCertificate(initialState, certificate);
    if (!check.valid) continue;

    let finalState = initialState;
    let hasLock = false;
    if (config.hasObstacle) {
      const lockRng = mulberry32(config.seed ^ 0x5bd1e995);
      const candidate = tryInjectLock(initialState, certificate, lockRng);
      if (candidate && verifyCertificate(candidate, certificate).valid) {
        finalState = candidate;
        hasLock = true;
      }
      // Aksi halde kilitsiz haliyle devam edilir -- "en iyi çaba", doğrulanamayan bir engel asla eklenmez.
    }

    return {
      config,
      initialState: finalState,
      certificate,
      verifiedMoveCount: check.actualMoveCount,
      attemptsUsed: attempt + 1,
      hasLock,
    };
  }
  throw new Error(`Seviye üretilemedi (${maxAttempts} denemede doğrulanamadı): id=${baseConfig.id}`);
}

/**
 * Sertifikayı oynatarak, GÜVENLE kilitlenebilecek bir (kilitli kap, kapı kabı) çifti arar:
 * kapı kabı sertifika boyunca bir noktadan sonra KALICI olarak boşalıyor ve kilitlenecek kap
 * o noktaya kadar sertifikada hiç kaynak/hedef olarak kullanılmamışsa, kilit eklemek sertifikayı
 * bozmaz (kilit açıldığında kap zaten kullanılabilir, sertifika ona hiç o andan önce dokunmuyor).
 * Uygun çift bulunamazsa null döner (çağıran kilitsiz devam eder).
 */
function tryInjectLock(initialState: GameState, certificate: readonly Move[], rng: Rng): GameState | null {
  const ids = initialState.containers.map((c) => c.id);
  const firstTouchStep = new Map<string, number>();
  const emptyAfterStep: boolean[][] = [];

  let state = initialState;
  for (let step = 0; step < certificate.length; step++) {
    if (isLevelComplete(state)) break;
    const move = certificate[step];
    if (!firstTouchStep.has(move.sourceId)) firstTouchStep.set(move.sourceId, step);
    if (!firstTouchStep.has(move.targetId)) firstTouchStep.set(move.targetId, step);

    const outcome = tryMove(state, move);
    if (!outcome.ok) return null;
    state = outcome.result.state;
    emptyAfterStep.push(ids.map((id) => outcome.result.state.containers.find((c) => c.id === id)!.items.length === 0));
  }

  const totalSteps = emptyAfterStep.length;
  if (totalSteps === 0) return null;

  const permanentlyEmptyFrom = new Map<string, number>();
  for (const id of ids) {
    const idx = ids.indexOf(id);
    for (let step = 0; step < totalSteps; step++) {
      if (emptyAfterStep[step][idx] && emptyAfterStep.slice(step).every((row) => row[idx])) {
        permanentlyEmptyFrom.set(id, step);
        break;
      }
    }
  }

  const candidates: { gate: string; locked: string }[] = [];
  for (const [gateId, gateStep] of permanentlyEmptyFrom) {
    for (const lockedId of ids) {
      if (lockedId === gateId) continue;
      const touchStep = firstTouchStep.get(lockedId);
      if (touchStep !== undefined && touchStep > gateStep) {
        candidates.push({ gate: gateId, locked: lockedId });
      }
    }
  }
  if (candidates.length === 0) return null;

  const choice = pick(rng, candidates);
  return {
    containers: initialState.containers.map((c) =>
      c.id === choice.locked ? { ...c, lockedWhileNonEmpty: choice.gate } : c,
    ),
  };
}
