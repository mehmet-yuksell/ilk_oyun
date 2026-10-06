# Kararlar Günlüğü — "Profesyonelleştirme" Projesi

Bu dosya, 8 fazlık profesyonelleştirme görevi sırasında soru sormadan verilen
tüm belirsiz-nokta kararlarını, gerekçeleriyle birlikte kayıt altına alır.
Kronolojik sırayla, en eski en üstte.

## Faz 0 — Temizlik ve ad tutarlılığı

- **appId değiştirilmedi.** `com.yerliyerinde.app` olarak bırakıldı (görev
  açıkça "DEĞİŞTİRME" dedi). Görünen ad "Cozy Sort" oldu ama paket kimliği
  aynı kaldı — bu, Play Store'da zaten yayınlanmış bir uygulamanın kimliğini
  korumak için standart bir pratiktir; appId değişseydi mevcut kurulumlar
  güncelleme değil yeni-yükleme olarak görülürdü.
- **`android/app/src/main/assets/public` zaten `.gitignore`'daydı ve git'te hiç
  takip edilmiyordu** (kontrol edildi: `git ls-files` 0 sonuç döndü). Bu adım
  için ekstra bir işlem gerekmedi, sadece doğrulandı.
- Geliştirici kokulu metinler temizlendi: `demoLevelLabel` ("Faz 1 demo
  seviyesi — placeholder görseller") artık nötr bir "Örnek seviye" metnine
  çevrildi. Bu metin zaten oyuncunun normal akışta hiç karşılaşamayacağı bir
  fallback'te kullanılıyor (GameScene.loadLevel, hiçbir mode eşleşmezse) ama
  yine de temizlendi.
- **Küçük commit-sınırı notu:** `git rm AdService.ts/test.ts` Faz 1'e
  başlamadan önce (keşif sırasında) erkenden stage edilmişti; Faz 0 commit'i
  atılırken bu staged silme de farkında olmadan Faz 0'a dahil oldu. İçerik
  olarak yanlış bir şey yok (dosyalar zaten kaldırılacaktı), sadece "Faz 0"
  commit mesajı AdService'ten bahsetmiyor. Sonraki fazlarda commit atmadan
  hemen önce `git status` ile stage alanı tekrar doğrulanıyor.

## Faz 1 — Reklam ve para kazanma katmanının tamamen kaldırılması

- **Ekstra Kap ekonomisi:** Eski davranış "ilk 10 seviyede ücretsiz, sonrasında
  ödüllü reklamla" idi. Reklam kaldırılınca en basit ve tutarlı karşılık:
  **her seviyede 1 ücretsiz hak** (zaten `extraContainerUsedThisLevel` ile
  seviye başına 1'le sınırlıydı) — artık seviye numarasına bakılmaksızın her
  zaman geçerli, kalan hak sayısı buton üzerinde "(1)"/"(0)" olarak gösteriliyor
  (`DIFFICULTY.extraContainerFreeUsesPerLevel`, tek yerden ayarlanabilir).
- **Günlük ödül:** Zaten tek dokunuşla tam ödülü veriyordu
  (`onClaimDailyReward`); kaldırılan tek şey ardından gelen "reklamla katla"
  opsiyonel teklifiydi (`offerDoubleDailyReward`). Taban ödül değişmedi.
- **Seviye yıldızı:** Zaten her zaman tam veriliyordu (`PROGRESS_LEVEL_STARS`/
  `DAILY_PUZZLE_STARS`); kaldırılan "yıldızları reklamla katla" bağlantısı
  yalnızca EKSTRA bir bonustu, taban ödülü etkilemiyordu.
- **SaveData sürüm geçişi:** `version` 1 -> 2'ye çıktı. `migrateSaveData()`
  artık körü körüne spread yerine yalnızca güncel `SaveData` şeklindeki
  anahtarları kopyalıyor -- `removeAdsPurchased` gibi kaldırılmış alanlar eski
  kayıtlarda hâlâ dursa bile sessizce atılıyor (test edildi, bkz.
  SaveService.test.ts).
- Geçiş reklamı (interstitial) tamamen kaldırıldı; "Sonraki Seviye" artık
  doğrudan oda ekranına dönüyor.

## Faz 2 — Debug izleri ve geliştirici logları

- Seviye başlığı zaten yalnızca normal modda "Seviye N" gösteriyordu; par/limit
  bilgisi zaten yalnızca `?level=N` debug yolunda ekleniyordu
  (GameScene.loadLevel). Kod değişikliği gerekmedi, Playwright ile her iki
  mod da doğrulandı (bkz. _review-screenshots).
- `ConsoleAnalyticsService.track()` artık yalnızca `import.meta.env.DEV`
  iken `console.log` çağırıyor. Üretim build'inde (`npm run build` ->
  `dist/assets/*.js`) `[analytics]` dizesi aranarak 0 eşleşme ile doğrulandı
  (Vite, DEV'i derleme zamanında `false`'a sabitleyip ölü dalı tamamen
  eliyor). Bundle'da kalan birkaç `console.log` çağrısı Phaser/matter-js'in
  kendi iç kütüphane kodundan geliyor (ör. WebGL context-lost uyarısı,
  matter-js debug logger) -- bunlar bizim kodumuz değil ve çoğu zaten
  devre dışı (`banner:false` ile Phaser'ın kendi banner logu da kapatıldı).
