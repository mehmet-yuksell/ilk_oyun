import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { levelConfigFor, obstaclesForLevel } from '../src/core/difficultyCurve';
import { getValidMoves } from '../src/core/gameLogic';
import { generateVerifiedLevel, type LevelConfig } from '../src/core/levelGenerator';
import { computePar, solve } from '../src/core/solver';

const TOTAL_LEVELS = 500;
/** Tam BFS'i 1-100 arası HER seviyede, sonrasında temsili bir örneklemde çalıştırır (yavaş olmasın diye). */
const RUN_SOLVER_FOR = (n: number) => n <= 100 || n % 25 === 0;
const SOLVER_MAX_STATES = 200_000;
/** Yıldız puanlaması için "par" hesaplamasında kullanılan bütçe -- GameScene'in oyun-içi
 * bütçesinden (DIFFICULTY.livePaSolverMaxStates) daha büyük: burada performans telefonu değil,
 * bu script'i çalıştıran makineyi etkiler, bu yüzden daha gerçekçi (daha az "~" işaretli) bir
 * par tablosu üretmek için daha cömert davranılır.
 */
const PAR_MAX_STATES = 200_000;
const ACCEPTANCE_SAMPLE_IDS = [1, 10, 25, 50, 75, 100];

interface BfsMetrics {
  readonly solvable: boolean;
  readonly minMoves: number | null;
  readonly statesExplored: number;
  readonly truncated: boolean;
}

interface LevelRecord {
  readonly config: LevelConfig;
  readonly metrics: {
    readonly certificateLength: number;
    readonly branchingFactorAtStart: number;
    readonly attemptsUsed: number;
    readonly hasLock: boolean;
    readonly hasTypeLock: boolean;
    readonly mysteryActive: boolean;
    readonly par: number;
    readonly parExact: boolean;
    readonly bfs: BfsMetrics | null;
  };
}

function main(): void {
  const records: LevelRecord[] = [];
  let totalAttempts = 0;
  let maxAttemptsSeen = 0;
  let lockEligible = 0;
  let lockInjected = 0;
  let mysteryEligible = 0;
  let mysteryActiveCount = 0;
  let typeLockEligible = 0;
  let typeLockInjected = 0;
  const start = Date.now();

  for (let n = 1; n <= TOTAL_LEVELS; n++) {
    const baseConfig = levelConfigFor(n);
    const result = generateVerifiedLevel(baseConfig);
    totalAttempts += result.attemptsUsed;
    maxAttemptsSeen = Math.max(maxAttemptsSeen, result.attemptsUsed);
    if (baseConfig.hasObstacle) {
      lockEligible++;
      if (result.hasLock) lockInjected++;
    }
    if (baseConfig.hasMysteryItem) {
      mysteryEligible++;
      if (result.mysteryActive) mysteryActiveCount++;
    }
    if (baseConfig.hasTypeLock) {
      typeLockEligible++;
      if (result.hasTypeLock) typeLockInjected++;
    }

    const branchingFactorAtStart = getValidMoves(result.initialState).length;
    const { par, exact: parExact } = computePar(result.initialState, result.verifiedMoveCount, PAR_MAX_STATES);

    let bfs: BfsMetrics | null = null;
    if (RUN_SOLVER_FOR(n)) {
      const r = solve(result.initialState, { maxStates: SOLVER_MAX_STATES });
      bfs = {
        solvable: r.solvable,
        minMoves: r.path ? r.path.length : null,
        statesExplored: r.statesExplored,
        truncated: r.truncated,
      };
    }

    records.push({
      config: result.config,
      metrics: {
        certificateLength: result.verifiedMoveCount,
        branchingFactorAtStart,
        attemptsUsed: result.attemptsUsed,
        hasLock: result.hasLock,
        hasTypeLock: result.hasTypeLock,
        mysteryActive: result.mysteryActive,
        par,
        parExact,
        bfs,
      },
    });

    if (n % 100 === 0) {
      console.log(`  ...${n}/${TOTAL_LEVELS} üretildi`);
    }
  }

  const elapsedMs = Date.now() - start;

  const outPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'levels.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(records, null, 2));

  const bfsAttempted = records.filter((r) => r.metrics.bfs !== null);
  const bfsSolved = bfsAttempted.filter((r) => r.metrics.bfs!.solvable);
  const bfsTruncated = bfsAttempted.filter((r) => r.metrics.bfs!.truncated);
  const parExactCount = records.filter((r) => r.metrics.parExact).length;

  console.log('');
  console.log(`${TOTAL_LEVELS}/${TOTAL_LEVELS} seviye üretildi; HEPSİNİN sertifikası gerçek motor üzerinde (tryMove replay) çözülebilir olarak doğrulandı.`);
  console.log(`Üretim denemesi: ortalama ${(totalAttempts / TOTAL_LEVELS).toFixed(3)} / seviye, en kötü durum ${maxAttemptsSeen} deneme.`);
  console.log(`Kilitli kap: ${lockInjected}/${lockEligible} uygun seviyede eklendi (${lockEligible > 0 ? ((lockInjected / lockEligible) * 100).toFixed(0) : 0}%).`);
  console.log(`Gizemli eşya: ${mysteryActiveCount}/${mysteryEligible} uygun seviyede aktif (bu bir sunum bayrağıdır, enjeksiyon başarısızlığı yoktur -- her zaman %100 olmalı).`);
  console.log(`Tek türlü kap: ${typeLockInjected}/${typeLockEligible} uygun seviyede eklendi (${typeLockEligible > 0 ? ((typeLockInjected / typeLockEligible) * 100).toFixed(0) : 0}%) -- düşük boş kap sayısı nedeniyle güvenli aday bulma oranı düşük, bu beklenen bir sınırlamadır.`);
  console.log(
    `BFS çapraz-doğrulama (${bfsAttempted.length} seviyede denendi, 1-100 TAMAMI + 25'in katları): ${bfsSolved.length}/${bfsAttempted.length} kesin çözüldü, ` +
      `${bfsTruncated.length} tanesinde durum bütçesi (${SOLVER_MAX_STATES.toLocaleString('tr-TR')}) yetmedi (bu "çözülemez" DEĞİL, "bu bütçede kanıtlanamadı" demektir -- sertifika kanıtı zaten geçerli).`,
  );
  console.log(`Par (yıldız hedefi): ${parExactCount}/${TOTAL_LEVELS} seviyede GERÇEK BFS en kısa yoldan (tam), kalanında doğrulanmış sertifika uzunluğundan (yaklaşık, "~").`);
  console.log(`Süre: ${elapsedMs} ms`);
  console.log(`Çıktı: ${outPath}`);
  console.log('');

  console.log('--- KABUL TABLOSU (seviye 1, 10, 25, 50, 75, 100) ---');
  console.log('  #id    tür  kap  boşKap  engel(ler)                  par');
  for (const id of ACCEPTANCE_SAMPLE_IDS) {
    const rec = records[id - 1];
    const obstacles = obstaclesForLevel(id, id % 5 === 0);
    const obstacleStr = obstacles.length === 0 ? '(yok)' : obstacles.join('+');
    const parStr = `${rec.metrics.par}${rec.metrics.parExact ? '' : ' (~)'}`;
    console.log(
      `  #${String(id).padStart(3)}   ${String(rec.config.itemTypeCount).padStart(2)}   ${String(rec.config.containerCount).padStart(2)}    ${String(rec.config.emptyContainerCount).padStart(2)}      ${obstacleStr.padEnd(26)}  ${parStr}`,
    );
  }
  console.log('');

  console.log('--- ZORLUK EĞRİSİ: seviye 1-100, BFS gerçek en kısa yol (minMoves) ---');
  console.log('(dalgalı ama yumuşak yükselen olmalı; ani sıçrama varsa işaretlenir)');
  let prevMin: number | null = null;
  const jumps: string[] = [];
  for (let n = 1; n <= 100; n++) {
    const rec = records[n - 1];
    const bfs = rec.metrics.bfs;
    const minMoves = bfs && bfs.solvable ? bfs.minMoves! : null;
    const bar = minMoves !== null ? '#'.repeat(Math.round(minMoves / 2)) : '?';
    const breather = n % 5 === 0 ? ' *nefes*' : '';
    console.log(`  #${String(n).padStart(3)} ${String(minMoves ?? (bfs?.truncated ? 'kesildi' : '-')).padStart(6)} ${bar}${breather}`);
    if (minMoves !== null && prevMin !== null) {
      const delta = minMoves - prevMin;
      if (delta > 15 && n % 5 !== 0 && (n - 1) % 5 !== 0) {
        jumps.push(`  #${n - 1}(${prevMin}) -> #${n}(${minMoves}): +${delta}`);
      }
    }
    if (minMoves !== null) prevMin = minMoves;
  }
  console.log('');
  if (jumps.length === 0) {
    console.log('Ani sıçrama (nefes seviyesi dışında, 2 komşu seviye arası >15 hamle artış) BULUNMADI.');
  } else {
    console.log(`${jumps.length} ani sıçrama bulundu:`);
    for (const j of jumps) console.log(j);
  }
  console.log('');
}

main();
