import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { levelConfigFor } from '../src/core/difficultyCurve';
import { getValidMoves } from '../src/core/gameLogic';
import { generateVerifiedLevel, type LevelConfig } from '../src/core/levelGenerator';
import { solve } from '../src/core/solver';

const TOTAL_LEVELS = 500;
/** Tam BFS doğrulamasını her seviyede değil (yavaş olur), temsili bir örneklemde çalıştırır. */
const RUN_SOLVER_FOR = (n: number) => n <= 20 || n % 25 === 0;
const SOLVER_MAX_STATES = 120_000;

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
    readonly bfs: BfsMetrics | null;
  };
}

function main(): void {
  const records: LevelRecord[] = [];
  let totalAttempts = 0;
  let maxAttemptsSeen = 0;
  let obstacleEligible = 0;
  let obstacleInjected = 0;
  const start = Date.now();

  for (let n = 1; n <= TOTAL_LEVELS; n++) {
    const baseConfig = levelConfigFor(n);
    const result = generateVerifiedLevel(baseConfig);
    totalAttempts += result.attemptsUsed;
    maxAttemptsSeen = Math.max(maxAttemptsSeen, result.attemptsUsed);
    if (baseConfig.hasObstacle) {
      obstacleEligible++;
      if (result.hasLock) obstacleInjected++;
    }

    const branchingFactorAtStart = getValidMoves(result.initialState).length;

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

  console.log('');
  console.log(`${TOTAL_LEVELS}/${TOTAL_LEVELS} seviye üretildi; HEPSİNİN sertifikası gerçek motor üzerinde (tryMove replay) çözülebilir olarak doğrulandı.`);
  console.log(`Üretim denemesi: ortalama ${(totalAttempts / TOTAL_LEVELS).toFixed(3)} / seviye, en kötü durum ${maxAttemptsSeen} deneme.`);
  console.log(`Kilitli kap engeli: ${obstacleInjected}/${obstacleEligible} uygun ("ileri") seviyede başarıyla eklendi.`);
  console.log(
    `BFS çapraz-doğrulama (${bfsAttempted.length} örnek seviyede denendi): ${bfsSolved.length}/${bfsAttempted.length} kesin çözüldü, ` +
      `${bfsTruncated.length} tanesinde durum bütçesi (${SOLVER_MAX_STATES.toLocaleString('tr-TR')}) yetmedi (bu "çözülemez" DEĞİL, "bu bütçede kanıtlanamadı" demektir -- sertifika kanıtı zaten geçerli).`,
  );
  console.log(`Süre: ${elapsedMs} ms`);
  console.log(`Çıktı: ${outPath}`);
  console.log('');

  console.log('Zorluk eğrisi örneklemi:');
  console.log(
    '  #id    tür  kap  boşKap  shuffle  sertifika  dallanma  BFS',
  );
  const sampleIds = [1, 2, 5, 9, 10, 11, 20, 25, 50, 99, 100, 101, 150, 200, 250, 300, 350, 400, 450, 490, 500];
  for (const id of sampleIds) {
    const rec = records[id - 1];
    const bfs = rec.metrics.bfs;
    const bfsStr = bfs
      ? bfs.truncated
        ? `kesildi (${bfs.statesExplored.toLocaleString('tr-TR')} durum)`
        : `${bfs.minMoves} hamle (${bfs.statesExplored.toLocaleString('tr-TR')} durum)`
      : '-';
    const breather = rec.config.id % 10 === 0 ? ' *nefes*' : '';
    const lockMark = rec.metrics.hasLock ? ' 🔒' : '';
    console.log(
      `  #${String(id).padStart(3)}   ${String(rec.config.itemTypeCount).padStart(2)}   ${String(rec.config.containerCount).padStart(2)}    ${String(rec.config.emptyContainerCount).padStart(2)}      ${String(rec.config.shuffleDepth).padStart(4)}     ${String(rec.metrics.certificateLength).padStart(4)}       ${String(rec.metrics.branchingFactorAtStart).padStart(3)}     ${bfsStr}${breather}${lockMark}`,
    );
  }
}

main();
