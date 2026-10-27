import Phaser from 'phaser';
import './style.css';
import { App as CapacitorApp } from '@capacitor/app';
import { SplashScene } from './scenes/SplashScene';
import { RoomScene } from './scenes/RoomScene';
import { GameScene } from './scenes/GameScene';
import { LevelSelectScene } from './scenes/LevelSelectScene';
import { fadeToScene } from './scenes/sceneTransition';
import { installPhaserDefaults } from './scenes/phaserDefaults';
import { loadFonts } from './scenes/fonts';
import { installResizeHandler, physicalSize, renderScale } from './scenes/viewport';
import { ConsoleAnalyticsService } from './services/AnalyticsService';
import { LocalStorageSaveService, restoreFromPreferencesIfMissing } from './services/SaveService';
import { audioEngine } from './services/AudioEngine';
import { music } from './services/MusicService';

async function boot(): Promise<void> {
  // Nunito, Phaser.Game oluşturulmadan ÖNCE yüklenmeli (bkz. scenes/fonts.ts).
  try {
    await loadFonts();
  } catch {
    // Font yüklenemezse (ör. eski tarayıcı) CSS zaten sans-serif yedeğine düşer.
  }
  installPhaserDefaults();

  // İlk sahne (RoomScene) localStorage'ı SENKRON okuyacağı için, native Preferences'taki olası
  // bir yedek varsa Phaser.Game oluşturulmadan ÖNCE localStorage'a kopyalanmalı (bkz. SaveService.ts).
  await restoreFromPreferencesIfMissing(window.localStorage);

  const initial = physicalSize();
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: 'app',
    backgroundColor: '#FDEBDC',
    banner: false,
    disableContextMenu: true,
    // Canvas = pencere CSS boyutu x renderScale (DPR, en fazla 2) -- kenardan kenara, keskin.
    // Sahneler mantıksal (kısa kenar 540) koordinatlarda çalışır, kamera zoom'u dönüştürür
    // (bkz. scenes/viewport.ts). Scale.NONE: boyutu biz yönetiriz (installResizeHandler).
    scale: {
      mode: Phaser.Scale.NONE,
      width: initial.width,
      height: initial.height,
      zoom: 1 / renderScale(),
    },
    render: {
      antialias: true,
      roundPixels: false,
      powerPreference: 'high-performance',
    },
    fps: {
      target: 60,
      min: 20,
    },
    scene: [SplashScene, RoomScene, GameScene, LevelSelectScene],
  };

  new ConsoleAnalyticsService().track({ name: 'session_start' });

  const game = new Phaser.Game(config);
  installResizeHandler(game);

  // Ses: mobil tarayıcılar sesi ancak bir kullanıcı dokunuşundan sonra açar -- bağlam ilk dokunuşta
  // açılır, müzik (ayarda açıksa) o anda yumuşakça girer (bkz. services/AudioEngine.ts).
  audioEngine.installUnlock();
  music.setEnabled(new LocalStorageSaveService(window.localStorage).load().musicEnabled);

  // Yalnızca geliştirme sunucusunda: Playwright ekran görüntüsü betiği (scripts/screenshots.mjs)
  // sahnelere bu kanca üzerinden ulaşır. Production build'de import.meta.env.DEV=false olduğu
  // için bu blok tamamen atılır.
  if (import.meta.env.DEV) {
    (window as unknown as { __cozy?: Phaser.Game }).__cozy = game;
  }

  // Uygulama arka plana gidince oyun döngüsünü tamamen durdurur (pil/CPU tasarrufu, garip ara
  // durumları önler). İlerleme zaten her anlamlı değişiklikte (hamle, yıldız, yenileme) senkron
  // olarak localStorage'a kaydedildiği için burada ayrıca bir kayıt çağrısına gerek yok.
  // Faz 7: native'de Capacitor'ın appStateChange olayı da dinlenir -- bazı Android WebView'lerde
  // visibilitychange gecikiyor/gelmiyor (müzik arka planda çalmaya devam edebiliyordu). İki kaynak
  // aynı idempotent işlevi çağırır; dönüşte kamera yeniden sığdırılır (arkadayken boyut değişmiş olabilir).
  let backgrounded = false;
  const setBackgrounded = (hidden: boolean) => {
    if (hidden === backgrounded) return;
    backgrounded = hidden;
    if (hidden) {
      game.loop.sleep();
      audioEngine.setSuspended(true);
    } else {
      game.loop.wake();
      audioEngine.setSuspended(false);
      window.dispatchEvent(new Event('resize'));
    }
  };
  document.addEventListener('visibilitychange', () => setBackgrounded(document.hidden));
  void CapacitorApp.addListener('appStateChange', ({ isActive }) => setBackgrounded(!isActive)).catch(() => {});

  // Android donanım geri tuşu (web'de hiç tetiklenmez): her sahne 'hardware-back' olayını kendisi ele
  // alır (açık panel varsa önce onu kapatır); ana ekranda uygulamadan çıkılır. Eskiden burada
  // game.scene.start('RoomScene') aktif sahneyi DURDURMADAN Room'u başlatıyordu (iki sahne üst üste).
  CapacitorApp.addListener('backButton', () => {
    const active = game.scene.getScenes(true)[0];
    if (!active) return;
    const exit = () => void CapacitorApp.exitApp();
    if (active.events.listenerCount('hardware-back') > 0) active.events.emit('hardware-back', exit);
    else if (active.scene.key === 'RoomScene') exit();
    else fadeToScene(active, 'RoomScene');
  });
}

void boot();
