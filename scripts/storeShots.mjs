// Mağaza ekran görüntüleri (Play Store: 1080x2160, en fazla 2:1). Kullanım:
//   npx vite --port 5199 --strictPort   (ayrı terminalde)
//   node scripts/storeShots.mjs [docs/store]
// "Temiz" kareler: öğretici/ipucu/başarım bildirimleri önceden görülmüş sayılır, ekranda yalnızca oyun kalır.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const outDir = process.argv[2] ?? 'docs/store';
const url = 'http://localhost:5199/';
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 360, height: 720 }, deviceScaleFactor: 3 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const wait = (ms) => page.waitForTimeout(ms);
const shot = async (name) => {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file });
  console.log('  ->', file);
};
const waitScene = (key) => page.waitForFunction((k) => window.__cozy?.scene.getScenes(true).some((s) => s.scene.key === k), key, { timeout: 20000 });
const start = (key, data) => page.evaluate(([k, d]) => window.__cozy.scene.getScenes(true)[0].scene.start(k, d), [key, data ?? {}]);

/** Orta ilerlemeli, "temiz" bir kayıt hazırlar: ilk odada 6 eşya yenilenmiş, `current - 1` seviye geçilmiş. */
async function seed(current = 38) {
  await page.goto(url);
  await waitScene('RoomScene');
  await page.evaluate(async (current) => {
    const { ACHIEVEMENTS } = await import('/src/scenes/../services/achievements.ts');
    const key = 'yerli-yerinde-save-v1';
    const scene = window.__cozy.scene.getScene('RoomScene');
    const base = scene.saveService.load();
    const levelStars = {};
    for (let i = 1; i < current; i++) levelStars[i] = i % 4 === 0 ? 2 : 3;
    const rooms = base.rooms.map((r, ri) => {
      if (ri !== 0) return r;
      const items = { ...r.items };
      Object.keys(items).slice(0, 6).forEach((id, i) => (items[id] = { ...items[id], restored: true, styleIndex: i % 2 }));
      return { ...r, items };
    });
    const data = {
      ...base,
      currentLevel: current,
      stars: 145,
      levelStars,
      rooms,
      seenHints: ['moveTutorial', 'mystery', 'lock', 'typeLock'],
      dailyReward: { lastClaimedDate: null, streak: 3 },
    };
    // ilerlemeye zaten uyan başarımlar açılmış sayılır -> çekimde bildirim çıkmaz
    data.achievements = ACHIEVEMENTS.filter((a) => a.progress(data) >= a.target).map((a) => a.id);
    data.dailyReward = { lastClaimedDate: null, streak: 3 };
    localStorage.setItem(key, JSON.stringify(data));
  }, current);
  await page.goto(url);
  await waitScene('RoomScene');
  await wait(1600);
}

await seed();
await shot('01-ana-ekran');

await seed(8);

await start('GameScene', { mode: 'progress', levelNumber: 8 });
await waitScene('GameScene');
await wait(1400);
await page.evaluate(() => {
  const s = window.__cozy.scene.getScene('GameScene');
  const c = s.gameState.containers.find((x) => x.items.length >= 2);
  s.selectedId = c.id;
  s.drawFrames();
  s.render();
});
await wait(700);
await shot('02-oyun');

await page.evaluate(async () => {
  const { solve } = await import('/src/core/solver.ts');
  const s = window.__cozy.scene.getScene('GameScene');
  s.selectedId = null;
  const path = solve(s.gameState, { maxStates: 400000 }).path;
  for (const m of path ?? []) {
    while (s.isAnimating) await new Promise((r) => setTimeout(r, 25));
    s.attemptMove(m.sourceId, m.targetId);
    await new Promise((r) => setTimeout(r, 40));
  }
});
await wait(3400);
await shot('03-kazanma');

await seed();
await start('LevelSelectScene');
await waitScene('LevelSelectScene');
await wait(1200);
await shot('04-seviyeler');

const lavender = await page.evaluate(async () => {
  const { generateVerifiedLevel } = await import('/src/core/levelGenerator.ts');
  const { levelConfigFor } = await import('/src/core/difficultyCurve.ts');
  let best = 21;
  let bestCount = Infinity;
  for (let n = 21; n <= 30; n++) {
    const r = generateVerifiedLevel(levelConfigFor(n));
    if (r.mysteryActive || r.hasLock || r.hasTypeLock) continue;
    if (r.initialState.containers.length < bestCount) {
      best = n;
      bestCount = r.initialState.containers.length;
    }
  }
  return best;
});
console.log('  lavanta seviyesi:', lavender);
await start('GameScene', { mode: 'progress', levelNumber: lavender });
await waitScene('GameScene');
await wait(1600);
await shot('05-lavanta-bolumu');

await start('RoomScene');
await waitScene('RoomScene');
await wait(1400);
await page.evaluate(() => window.__cozy.scene.getScene('RoomScene').openDaily());
await wait(900);
await shot('06-gunluk-seri');

console.log(errors.length ? errors : 'Konsol hatası yok.');
await browser.close();
