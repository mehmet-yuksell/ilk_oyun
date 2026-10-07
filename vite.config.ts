import { defineConfig } from 'vite';

/**
 * Phaser'ı ayrı bir "vendor" parçasına ayırır -- toplam indirilen baytı azaltmaz (Phaser zaten
 * neredeyse hiç tree-shake edilemiyor, bkz. docs/KARARLAR.md Faz 7 notu) ama Phaser neredeyse
 * hiç değişmediği için (biz güncellemediğimiz sürece) tarayıcı onu farklı deploy'lar arasında
 * ÖNBELLEKTEN kullanabilir -- yalnızca küçük uygulama kodu parçası yeniden indirilir.
 */
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // Bu projede Vite'ın bundler'ı Rolldown -- manualChunks klasik Rollup'ın nesne
        // kısayolunu değil, bir FONKSİYON bekliyor.
        manualChunks: (id: string) => (id.includes('node_modules/phaser') ? 'phaser' : undefined),
      },
    },
  },
});
