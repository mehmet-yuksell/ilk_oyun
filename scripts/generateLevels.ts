import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DIFFICULTY } from '../src/config/tuning';
import { levelConfigFor, obstaclesForLevel } from '../src/core/difficultyCurve';
import { getValidMoves } from '../src/core/gameLogic';
import { generateVerifiedLevel, type LevelConfig } from '../src/core/levelGenerator';
import { computePar } from '../src/core/solver';

const TOTAL_LEVELS = 500;
/**
 * Par (yıldız hedefi) hesaplama bütçesi: GameScene'in oyun-içi bütçesiyle AYNI
 * (DIFFICULTY.livePaSolverMaxStates) -- bu script'in ürettiği rapor, gerçek oyunun canlı olarak
 * hesaplayacağı parla BİREBİR tutarlı olsun diye. Büyük itemTypeCount'lu (ör. 40+) seviyelerde BFS
 * çoğunlukla bu bütçeye TAKILIR (truncated) -- bu "çözülemez" değil "bu bütçede kanıtlanamadı"
 * demektir; par o durumda doğrulanmış sertifika uzunluğüne düşer (gerçek ama muhtemelen optimal
 * olmayan bir çözüm, "~" ile işaretlenir).
 */
const PAR_MAX_STATES = DIFFICULTY.livePaSolverMaxStates;
const ACCEPTANCE_SAMPLE_IDS = [1, 10, 25, 50, 75, 100];

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
      },
    });

    if (n % 50 === 0) {
      console.log(`  ...${n}/${TOTAL_LEVELS} üretildi (${((Date.now() - start) / 1000).toFixed(0)}s)`);
    }
  }

  const elapsedMs = Date.now() - start;

  const outPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'levels.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(records, null, 2));

  const parExactCount = records.filter((r) => r.metrics.parExact).length;

  console.log('');
  console.log(`${TOTAL_LEVELS}/${TOTAL_LEVELS} seviye üretildi; HEPSİNİN sertifikası gerçek motor üzerinde (tryMove replay) çözülebilir olarak doğrulandı.`);
  console.log(`Üretim denemesi: ortalama ${(totalAttempts / TOTAL_LEVELS).toFixed(3)} / seviye, en kötü durum ${maxAttemptsSeen} deneme.`);
  console.log(`Kilitli kap: ${lockInjected}/${lockEligible} uygun seviyede eklendi (${lockEligible > 0 ? ((lockInjected / lockEligible) * 100).toFixed(0) : 0}%).`);
  console.log(`Gizemli eşya: ${mysteryActiveCount}/${mysteryEligible} uygun seviyede aktif (bu bir sunum bayrağıdır, enjeksiyon başarısızlığı yoktur).`);
  console.log(`Tek türlü kap: ${typeLockInjected}/${typeLockEligible} uygun seviyede eklendi (${typeLockEligible > 0 ? ((typeLockInjected / typeLockEligible) * 100).toFixed(0) : 0}%) -- düşük boş kap sayısı nedeniyle güvenli aday bulma oranı düşük, bu beklenen/dürüst bir sınırlamadır.`);
  console.log(`Par (yıldız hedefi, bütçe=${PAR_MAX_STATES.toLocaleString('tr-TR')} durum -- oyun-içi bütçeyle AYNI): ${parExactCount}/${TOTAL_LEVELS} seviyede GERÇEK BFS en kısa yoldan (tam), kalan ${TOTAL_LEVELS - parExactCount} seviyede doğrulanmış sertifika uzunluğundan (yaklaşık, "~").`);
  console.log(`Süre: ${elapsedMs} ms (${(elapsedMs / 1000 / 60).toFixed(1)} dk)`);
  console.log(`Çıktı: ${outPath}`);
  console.log('');

  console.log('--- KABUL TABLOSU (seviye 1, 10, 25, 50, 75, 100) ---');
  console.log('  #id    tür  kap  boşKap  engel(ler)                  par');
  for (const id of ACCEPTANCE_SAMPLE_IDS) {
    const rec = records[id - 1];
    const obstacles = obstaclesForLevel(id, id % DIFFICULTY.breatherEvery === 0);
    const obstacleStr = obstacles.length === 0 ? '(yok)' : obstacles.join('+');
    const parStr = `${rec.metrics.par}${rec.metrics.parExact ? '' : ' (~)'}`;
    console.log(
      `  #${String(id).padStart(3)}   ${String(rec.config.itemTypeCount).padStart(2)}   ${String(rec.config.containerCount).padStart(2)}    ${String(rec.config.emptyContainerCount).padStart(2)}      ${obstacleStr.padEnd(26)}  ${parStr}`,
    );
  }
  console.log('');

  console.log('--- ZORLUK EĞRİSİ: seviye 1-100, par (yıldız hedefi) -- "~" = tahmini (BFS bütçeye takıldı) ---');
  console.log('(dalgalı ama yumuşak yükselen olmalı; nefes seviyeleri dışında ani sıçrama olmamalı)');
  let prevPar: number | null = null;
  const jumps: string[] = [];
  for (let n = 1; n <= 100; n++) {
    const rec = records[n - 1];
    const bar = '#'.repeat(Math.max(1, Math.round(rec.metrics.par / 2)));
    const breather = n % DIFFICULTY.breatherEvery === 0 ? ' *nefes*' : '';
    const mark = rec.metrics.parExact ? ' ' : '~';
    console.log(`  #${String(n).padStart(3)} ${String(rec.metrics.par).padStart(4)}${mark} ${bar}${breather}`);
    const isBreatherPair = n % DIFFICULTY.breatherEvery === 0 || (n - 1) % DIFFICULTY.breatherEvery === 0;
    if (prevPar !== null && !isBreatherPair) {
      const delta = rec.metrics.par - prevPar;
      if (delta > 15) jumps.push(`  #${n - 1}(${prevPar}) -> #${n}(${rec.metrics.par}): +${delta}`);
    }
    prevPar = rec.metrics.par;
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
