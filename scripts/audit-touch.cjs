// Geliştirme sunucusu gerekir: npx vite --port 5199 --strictPort  (sahnelere DEV modundaki window.__cozy kancasıyla ulaşır)
// Dokunma hedefi denetimi: aktif sahnedeki her etkileşimli nesnenin ekrandaki (CSS px) boyutu >= 48 mi?
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await p.goto(process.env.URL || 'http://localhost:5199/');
  await p.evaluate(() => localStorage.clear());
  await p.goto(process.env.URL || 'http://localhost:5199/');
  await p.waitForFunction(() => window.__cozy?.scene.getScenes(true).some((s) => s.scene.key === 'RoomScene'));
  await p.waitForTimeout(1200);
  const audit = (label) => p.evaluate((l) => {
    const g = window.__cozy;
    const s = g.scene.getScenes(true)[0];
    const cssPerPhys = g.canvas.getBoundingClientRect().width / g.scale.width;
    const z = s.cameras.main.zoom;
    const bad = [];
    let total = 0;
    for (const o of s.input._list) {
      if (!o.input || !o.input.enabled || !o.active) continue;
      // sahne-üstü görünürlük: ebeveyn zincirinde görünmez olan sayılmaz
      let vis = o.visible; let par = o.parentContainer; let scale = o.scaleX;
      let sy = o.scaleY;
      while (par) { vis = vis && par.visible; scale *= par.scaleX; sy *= par.scaleY; par = par.parentContainer; }
      if (!vis) continue;
      const ha = o.input.hitArea;
      if (!ha || ha.width === undefined) continue;
      const w = ha.width * Math.abs(scale) * z * cssPerPhys;
      const h = ha.height * Math.abs(sy) * z * cssPerPhys;
      if (w > 1500 || h > 1500) continue; // tam ekran karartmalar
      total++;
      if (w < 47.5 || h < 47.5) bad.push(`${o.type}${o.name ? '#' + o.name : ''} ${w.toFixed(0)}x${h.toFixed(0)}`);
    }
    return `${l}: ${total} hedef, 48px altı: ${bad.length}${bad.length ? ' -> ' + [...new Set(bad)].slice(0, 12).join(', ') : ''}`;
  }, label);
  console.log(await audit('Oda'));
  await p.evaluate(() => window.__cozy.scene.getScene('RoomScene').openSettings());
  await p.waitForTimeout(600);
  console.log(await audit('Oda+Ayarlar'));
  const go = async (k, d) => {
    await p.evaluate(([k, d]) => window.__cozy.scene.getScenes(true)[0].scene.start(k, d), [k, d || {}]);
    await p.waitForTimeout(1300);
  };
  await go('LevelSelectScene');
  console.log(await audit('Seviyeler'));
  await go('GameScene', { mode: 'progress', levelNumber: 2 });
  console.log(await audit('Oyun'));
  await b.close();
})();
