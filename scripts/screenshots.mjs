// Playwright ile oyunun ana ekranlarının ekran görüntüsünü alır (denetim + mağaza görselleri).
// Kullanım:  node scripts/screenshots.mjs <çıktı-klasörü> [--width 390 --height 844 --dpr 2 --url http://localhost:5199]
// Önce `npx vite --port 5199 --strictPort` ile geliştirme sunucusunu başlatın: betik sahnelere
// yalnızca DEV modunda açılan window.__cozy kancası üzerinden ulaşır (bkz. src/main.ts).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const outDir = args.find((a) => !a.startsWith('--')) ?? '_review-screenshots';
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const width = Number(opt('width', 390));
const height = Number(opt('height', 844));
const dpr = Number(opt('dpr', 2));
const url = opt('url', 'http://localhost:5199');
const only = opt('only', '');
const prefix = opt('prefix', '');
// Çentikli telefon simülasyonu: --notch 47,34 -> safe-area üst/alt (CSS px)
const notch = opt('notch', '');

fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, hasTouch: true, isMobile: true });
const page = await context.newPage();
if (notch) {
  const [top, bottom] = notch.split(',').map(Number);
  await page.addInitScript(([t, b]) => {
    document.addEventListener('DOMContentLoaded', () => {
      const st = document.createElement('style');
      st.textContent = ':root{--sat:' + t + 'px !important;--sab:' + b + 'px !important;}';
      document.head.appendChild(st);
    });
  }, [top, bottom]);
}
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

const wait = (ms) => page.waitForTimeout(ms);
const shot = async (name) => {
  const file = path.join(outDir, `${prefix}${name}.png`);
  await page.screenshot({ path: file });
  console.log('  ->', file);
};
const activeKey = () => page.evaluate(() => window.__cozy.scene.getScenes(true).map((s) => s.scene.key).join(','));
const waitScene = async (key, extra = 500) => {
  await page.waitForFunction((k) => window.__cozy?.scene.getScenes(true).some((s) => s.scene.key === k), key, { timeout: 15000 });
  await wait(extra);
};
const startScene = (key, data) => page.evaluate(([k, d]) => {
  const active = window.__cozy.scene.getScenes(true)[0];
  active.scene.start(k, d);
}, [key, data ?? {}]);

/** Taze bir kayıtla başlar (isteğe bağlı alanlar üzerine yazılır). */
async function freshSave(overrides = {}) {
  await page.goto(url);
  await page.evaluate((o) => {
    localStorage.clear();
    if (Object.keys(o).length) localStorage.setItem('__pending_overrides', JSON.stringify(o));
  }, overrides);
  if (Object.keys(overrides).length) {
    // Önce varsayılan kaydı oluşturması için bir kez yükle, sonra alanları yamala.
    await page.goto(url);
    await waitScene('RoomScene', 300);
    await page.evaluate(() => {
      const key = 'yerli-yerinde-save-v1';
      const o = JSON.parse(localStorage.getItem('__pending_overrides'));
      localStorage.removeItem('__pending_overrides');
      const scene = window.__cozy.scene.getScene('RoomScene');
      const base = JSON.parse(localStorage.getItem(key) ?? 'null') ?? scene.saveService.load();
      localStorage.setItem(key, JSON.stringify({ ...base, ...o }));
    });
  }
  await page.goto(url);
}

/** GameScene'deki aktif seviyeyi gerçek çözücüyle (BFS) çözüp hamleleri oyunun kendi attemptMove'u ile oynatır. */
async function solveCurrentLevel(stopBeforeLast = 0) {
  return page.evaluate(async (stopBefore) => {
    const { solve } = await import('/src/core/solver.ts');
    const scene = window.__cozy.scene.getScene('GameScene');
    const result = solve(scene.gameState, { maxStates: 400000 });
    if (!result.path) return 'çözülemedi';
    const moves = result.path.slice(0, result.path.length - stopBefore);
    for (const m of moves) {
      while (scene.isAnimating) await new Promise((r) => setTimeout(r, 30));
      scene.attemptMove(m.sourceId, m.targetId);
      await new Promise((r) => setTimeout(r, 40));
    }
    return `ok ${moves.length} hamle`;
  }, stopBeforeLast);
}

const want = (name) => !only || only.split(',').includes(name);

console.log(`Ekran: ${width}x${height} @${dpr}x  ->  ${outDir}`);

await freshSave();
if (want('splash')) {
  await wait(380);
  await shot('01-splash');
}
await waitScene('RoomScene', 700);
if (want('room')) await shot('02-room');

if (want('settings')) {
  await page.evaluate(() => window.__cozy.scene.getScene('RoomScene').openSettings());
  await wait(700);
  await shot('03-settings');
  await startScene('RoomScene');
  await waitScene('RoomScene', 600);
}

if (want('levels')) {
  const hasLevels = await page.evaluate(() => !!window.__cozy.scene.getScene('LevelSelectScene'));
  if (hasLevels) {
    await startScene('LevelSelectScene');
    await waitScene('LevelSelectScene', 700);
    await shot('04-levels');
    await startScene('RoomScene');
    await waitScene('RoomScene', 400);
  }
}

if (want('game') || want('win')) {
  await startScene('GameScene', { mode: 'progress', levelNumber: 1 });
  await waitScene('GameScene', 900);
  if (want('game')) await shot('05-game-level1');
  if (want('game')) {
    // Gerçek dokunuşla bir kap seç (girdi yolunu da sınar).
    const pt = await page.evaluate(() => {
      const scene = window.__cozy.scene.getScene('GameScene');
      const c = scene.gameState.containers.find((x) => x.items.length > 0);
      const l = scene.layouts.get(c.id);
      const rect = window.__cozy.canvas.getBoundingClientRect();
      const cam = scene.cameras.main;
      const k = rect.width / window.__cozy.scale.width;
      const toScreen = (wx, wy) => ({ x: rect.left + (wx - cam.scrollX) * cam.zoom * k, y: rect.top + (wy - cam.scrollY) * cam.zoom * k });
      return toScreen(l.centerX, l.topY + l.rect.height - 30);
    });
    await page.mouse.click(pt.x, pt.y);
    await wait(450);
    await shot('06-game-selected');
    await page.mouse.click(pt.x, pt.y);
    await wait(200);
  }
  if (want('win')) {
    console.log('  çözücü:', await solveCurrentLevel());
    await wait(3200);
    await shot('07-win');
  }
}

if (want('mid')) {
  const levelStars = {};
  for (let i = 1; i < 34; i++) levelStars[i] = 1 + ((i * 7) % 3);
  await freshSave({ currentLevel: 34, stars: 180, levelStars });
  await waitScene('RoomScene', 600);
  await shot('08a-room-mid');
  await startScene('LevelSelectScene');
  await waitScene('LevelSelectScene', 800);
  await shot('08b-levels-mid');
  await startScene('GameScene', { mode: 'progress', levelNumber: 34 });
  await waitScene('GameScene', 900);
  await shot('08-game-level34');
}

if (want('late')) {
  await startScene('GameScene', { mode: 'progress', levelNumber: 120 });
  await waitScene('GameScene', 900);
  await shot('09-game-level120');
}

if (want('lost')) {
  await startScene('GameScene', { mode: 'progress', levelNumber: 20 });
  await waitScene('GameScene', 700);
  await page.evaluate(() => {
    const scene = window.__cozy.scene.getScene('GameScene');
    scene.moveCount = scene.moveLimit;
    scene.checkStuckOrWin();
  });
  await wait(1200);
  await shot('10-lost');
}

if (want('decor')) {
  for (const lvl of [11, 21, 31, 41]) {
    await freshSave({ currentLevel: lvl, stars: 60 });
    await waitScene('RoomScene', 400);
    await startScene('GameScene', { mode: 'progress', levelNumber: lvl });
    await waitScene('GameScene', 1200);
    await shot(`11-decor-level${lvl}`);
  }
}

if (want('progress')) {
  const levelStars = {};
  for (let i = 1; i < 14; i++) levelStars[i] = 3;
  await freshSave({ currentLevel: 14, stars: 90, levelStars, achievements: [], dailyReward: { lastClaimedDate: null, streak: 0 } });
  await waitScene('RoomScene', 2600);
  await shot('12-achievement-toast');
  await wait(3600);
  await page.evaluate(() => window.__cozy.scene.getScene('RoomScene').openAchievements());
  await wait(700);
  await shot('13-achievements');
  await startScene('RoomScene');
  await waitScene('RoomScene', 4000);
  await page.evaluate(() => window.__cozy.scene.getScene('RoomScene').openDaily());
  await wait(700);
  await shot('14-daily');
}

console.log('Aktif sahne:', await activeKey());
if (errors.length) {
  console.log('KONSOL HATALARI:');
  for (const e of errors) console.log('  !', e);
  process.exitCode = 2;
} else {
  console.log('Konsol hatası yok.');
}
await browser.close();
