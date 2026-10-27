// Geliştirme sunucusu gerekir: npx vite --port 5199 --strictPort  (sahnelere DEV modundaki window.__cozy kancasıyla ulaşır)
// Faz 7 hata taraması: hızlı dokunma, çift dokunma, döndürme, WebGL bağlam kaybı.
const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2] || '_review-screenshots/bug';
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e.message)));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto('http://localhost:5199/');
  await p.evaluate(() => localStorage.clear());
  await p.goto('http://localhost:5199/');
  await p.waitForFunction(() => window.__cozy?.scene.getScenes(true).some((s) => s.scene.key === 'RoomScene'));
  await p.waitForTimeout(900);
  const active = () => p.evaluate(() => window.__cozy.scene.getScenes(true).map((s) => s.scene.key).join('+'));
  const report = (name, ok, extra = '') => console.log(`${ok ? 'GEÇTİ ' : 'KALDI '} ${name}${extra ? ' -- ' + extra : ''}`);

  // 1) Hızlı rastgele dokunma (oyun)
  await p.evaluate(() => window.__cozy.scene.getScene('RoomScene').scene.start('GameScene', { mode: 'progress', levelNumber: 3 }));
  await p.waitForTimeout(1200);
  const before = await p.evaluate(() => {
    const s = window.__cozy.scene.getScene('GameScene');
    s.moveLimit = 0; // test boyunca kaybetme paneli girdiyi kilitlemesin
    return s.gameState.containers.reduce((n, c) => n + c.items.length, 0);
  });
  for (let i = 0; i < 300; i++) {
    const x = 20 + Math.random() * 350;
    const y = 120 + Math.random() * 600;
    await p.mouse.click(x, y, { delay: 0 });
    if (i % 25 === 0) await p.waitForTimeout(30);
  }
  await p.waitForTimeout(1500);
  const after = await p.evaluate(() => {
    const s = window.__cozy.scene.getScene('GameScene');
    const items = s.gameState.containers.reduce((n, c) => n + c.items.length, 0);
    const vis = s.itemsLayer.list.filter((c) => c.active && c.visible).length;
    return { items, vis, animating: s.isAnimating, moves: s.moveCount };
  });
  // tamamlanan gruplar eşyayı azaltır; görünür eşya sayısı her zaman durumla eşleşmeli
  report('hızlı 300 dokunuş: durum ↔ görsel tutarlı', after.items === after.vis && !after.animating && after.items <= before,
    `başta ${before} eşya, sonra ${after.items} eşya / ${after.vis} görünür, ${after.moves} hamle`);

  // 2) Çift dokunma: OYNA'ya 50 ms arayla iki kez -> tek geçiş
  await p.evaluate(() => window.__cozy.scene.getScenes(true)[0].scene.start('RoomScene'));
  await p.waitForTimeout(1200);
  const playPt = await p.evaluate(() => {
    const s = window.__cozy.scene.getScene('RoomScene');
    const cam = s.cameras.main;
    const rect = window.__cozy.canvas.getBoundingClientRect();
    const k = rect.width / window.__cozy.scale.width;
    const y = s.vp.height - 20 - 50; // createPlayButton y (safeBottom=20)
    return { x: rect.left + (s.vp.width / 2 - cam.scrollX) * cam.zoom * k, y: rect.top + (y - cam.scrollY) * cam.zoom * k };
  });
  let starts = 0;
  await p.evaluate(() => {
    window.__starts = 0;
    const g = window.__cozy.scene.getScene('GameScene');
    g.events.on('create', () => window.__starts++);
  });
  await p.mouse.click(playPt.x, playPt.y);
  await p.waitForTimeout(50);
  await p.mouse.click(playPt.x, playPt.y);
  await p.waitForTimeout(1500);
  starts = await p.evaluate(() => window.__starts);
  report('OYNA çift dokunuş: tek geçiş', starts === 1 && (await active()) === 'GameScene', `GameScene create sayısı: ${starts}, aktif: ${await active()}`);

  // 3) Döndürme: oyun ortasında yatay -> dikey
  await p.setViewportSize({ width: 844, height: 390 });
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${out}-landscape.png` });
  await p.setViewportSize({ width: 390, height: 844 });
  await p.waitForTimeout(700);
  const rot = await p.evaluate(() => {
    const g = window.__cozy;
    const s = g.scene.getScene('GameScene');
    return { w: g.scale.width, h: g.scale.height, zoom: +s.cameras.main.zoom.toFixed(3), items: s.itemsLayer.list.filter((c) => c.active).length };
  });
  report('döndürme: canvas yeniden boyutlandı, sahne korunuyor', rot.w === 780 && rot.h === 1688 && rot.items > 0, JSON.stringify(rot));
  await p.screenshot({ path: `${out}-after-rotate.png` });

  // 4) WebGL bağlam kaybı + geri gelme
  const lost = await p.evaluate(async () => {
    const gl = window.__cozy.renderer.gl;
    const ext = gl && gl.getExtension('WEBGL_lose_context');
    if (!ext) return 'eklenti yok';
    ext.loseContext();
    await new Promise((r) => setTimeout(r, 500));
    ext.restoreContext();
    await new Promise((r) => setTimeout(r, 1200));
    return gl.isContextLost() ? 'hâlâ kayıp' : 'geri geldi';
  });
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${out}-after-contextloss.png` });
  // geri geldikten sonra bir hamle yapılabiliyor mu?
  const moved = await p.evaluate(async () => {
    const { getValidMoves } = await import('/src/core/gameLogic.ts');
    const s = window.__cozy.scene.getScene('GameScene');
    const m = getValidMoves(s.gameState)[0];
    if (!m) return 'hamle yok';
    const before = s.moveCount;
    s.attemptMove(m.sourceId, m.targetId);
    await new Promise((r) => setTimeout(r, 900));
    return s.moveCount === before + 1 ? 'hamle ok' : 'hamle olmadı';
  });
  report('WebGL bağlam kaybı: geri geliyor ve oynanabiliyor', lost === 'geri geldi' && moved === 'hamle ok', `${lost}, ${moved}`);

  console.log(errors.length ? 'KONSOL HATALARI:\n  ' + [...new Set(errors)].slice(0, 8).join('\n  ') : 'konsol hatası yok');
  await b.close();
})().catch((e) => console.log('HATA', e.message));
