// Geliştirme sunucusu gerekir: npx vite --port 5199 --strictPort  (sahnelere DEV modundaki window.__cozy kancasıyla ulaşır)
// Sahne geçiş döngüsünde birikme (dinleyici / tween / doku / nesne) denetimi.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto('http://localhost:5199/');
  await p.waitForFunction(() => window.__cozy?.scene.getScenes(true).some((s) => s.scene.key === 'RoomScene'));
  await p.waitForTimeout(800);
  const stats = () =>
    p.evaluate(() => {
      const g = window.__cozy;
      const room = g.scene.getScene('RoomScene');
      return {
        textures: g.textures.getTextureKeys().length,
        roomChildren: room.children.length,
        roomTweens: room.tweens.getTweens().length,
        roomBackListeners: room.events.listenerCount('hardware-back'),
        gameBackListeners: g.scene.getScene('GameScene').events.listenerCount('hardware-back'),
        heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
      };
    });
  const go = async (key, data) => {
    await p.evaluate(([k, d]) => window.__cozy.scene.getScenes(true)[0].scene.start(k, d), [key, data ?? {}]);
    await p.waitForFunction((k) => window.__cozy.scene.getScenes(true).some((s) => s.scene.key === k), key);
    await p.waitForTimeout(350);
  };
  console.log('başlangıç', await stats());
  for (let i = 0; i < 10; i++) {
    await go('LevelSelectScene');
    await go('GameScene', { mode: 'progress', levelNumber: 1 + (i % 3) });
    await go('RoomScene');
  }
  await p.waitForTimeout(800);
  console.log('10 döngü sonra', await stats());
  for (let i = 0; i < 10; i++) {
    await go('LevelSelectScene');
    await go('GameScene', { mode: 'progress', levelNumber: 1 + (i % 3) });
    await go('RoomScene');
  }
  console.log('20 döngü sonra', await stats());
  console.log(errors.length ? errors : 'hata yok');
  await b.close();
})();
