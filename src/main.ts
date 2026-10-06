import Phaser from 'phaser';
import './style.css';
import { App as CapacitorApp } from '@capacitor/app';
import { SplashScene } from './scenes/SplashScene';
import { RoomScene } from './scenes/RoomScene';
import { GameScene } from './scenes/GameScene';
import { SettingsScene } from './scenes/SettingsScene';
import { ConsoleAnalyticsService } from './services/AnalyticsService';

async function boot(): Promise<void> {
  // Fredoka, Phaser.Game oluşturulmadan ÖNCE yüklenmeli: Phaser Text nesneleri, oluşturuldukları
  // anda tarayıcının o anki fontuyla bir canvas dokusuna "pişer" -- font sonradan yüklenirse
  // (ör. @font-face async), zaten çizilmiş metinler otomatik güncellenmez, yedek fontla kalır.
  try {
    await Promise.all([document.fonts.load('400 16px Fredoka'), document.fonts.load('700 16px Fredoka')]);
  } catch {
    // Font yüklenemezse (ör. eski tarayıcı) CSS zaten sans-serif yedeğine düşer.
  }

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: 'app',
    backgroundColor: '#fbf3e7',
    banner: false,
    disableContextMenu: true,
    // Mantıksal çözünürlük sabit 540x960 tutulur; devicePixelRatio'yu çarpan olarak
    // kullanmıyoruz -- yüksek DPR'li telefonlarda (3x gibi) WebGL framebuffer'ını
    // gereksiz yere büyütüp düşük donanımda FPS'i ciddi düşürmemek için.
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 540,
      height: 960,
    },
    fps: {
      target: 60,
      min: 20,
    },
    scene: [SplashScene, RoomScene, GameScene, SettingsScene],
  };

  new ConsoleAnalyticsService().track({ name: 'session_start' });

  const game = new Phaser.Game(config);

  // Uygulama arka plana gidince oyun döngüsünü tamamen durdurur (pil/CPU tasarrufu, garip ara
  // durumları önler). İlerleme zaten her anlamlı değişiklikte (hamle, yıldız, yenileme) senkron
  // olarak localStorage'a kaydedildiği için burada ayrıca bir kayıt çağrısına gerek yok.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      game.loop.sleep();
    } else {
      game.loop.wake();
    }
  });

  // Android donanım geri tuşu: tarayıcıda (web) bu olay hiç tetiklenmez, yalnızca
  // Capacitor'ın native Android kabuğunda çalışır -- orada WebView'in kendi (bu oyunda
  // kullanılmayan) sayfa geçmişine düşüp uygulamayı aniden kapatmak yerine, odaya dönüşü
  // mevcut "Odaya Dön"/"Kapat" sahne akışıyla birebir aynı şekilde yönetir.
  CapacitorApp.addListener('backButton', () => {
    const active = game.scene.getScenes(true)[0];
    if (!active) return;
    if (active.scene.key === 'RoomScene') {
      void CapacitorApp.exitApp();
    } else {
      game.scene.start('RoomScene');
    }
  });
}

void boot();
