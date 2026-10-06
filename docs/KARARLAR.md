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

## Faz 3 — Sonuç ekranları (kazanma/kaybetme) yeniden tasarımı

- **Taşma hatasının kök nedeni:** eski "kurdele" `panelW + 70` genişliğinde
  VE -8° döndürülmüştü; Phaser container'ları çocuklarını otomatik maskelemez,
  bu yüzden geniş+döndürülmüş kurdele panelin yuvarlak köşeli kartının
  dışına taşıyordu. Düzeltme: rozet artık panelden DAR (`panelW - 48`),
  döndürülmemiş, sade yuvarlak-köşeli bir bant -- hem taşma yapısal olarak
  imkansız hem de "daha sakin/profesyonel" isteğine uyuyor (klasik oyun
  kurdelesi yerine düz bir rozet/pill).
- **Ton:** "KAYBETTİNİZ" (kırmızı, siyah kontürlü, bağırgan) -> "Hamle Hakkın
  Bitti" (amber rozet, koyu mürekkep metin, kontürsüz). Panel kenarlığı da
  `COLORS.danger` yerine `COLORS.amber` -- "kaybetme" yerine "mola/tekrar
  dene" hissi veriyor.
- **"Odaya Dön":** düz metinden gerçek bir ikincil (çerçeveli, dolgusuz) pill
  butona çevrildi; "Tekrar Dene" (birincil, dolgulu) butonun ALTINA
  yerleşti, aynı genişlik, 46px yükseklik (dokunma hedefi zone'u yine de
  >=48dp). Panel yüksekliği 340->380'e çıktı, iki buton için yer açmak üzere.
- Kazanma paneli zaten aynı kart kromunu kullanıyordu (yuvarlak köşe, renkli
  kenarlık, aynı birincil buton stili); ek bir değişiklik gerekmedi, sadece
  yıldız/sayaç animasyonu kısaltıldı (stagger 180->110ms, pop süresi
  260->220ms, sayaç 700->520ms, panel giriş 260->220ms) -- "zarif ve kısa"
  isteği için (`JUICE.levelCompletePanel`, tuning.ts).
- **Doğrulama yöntemi:** Playwright ile gerçek bir kayıp/kazanç tetiklendi --
  kayıp için hamle+geri-al döngüsü, kazanç için `levelConfigFor(1)` +
  `generateVerifiedLevel` ile üretilen GERÇEK sertifika (çözüm hamle listesi)
  tekrar oynatıldı (bkz. scripts/_get-certificate.ts, scripts/_win-shoot.cjs
  -- ikisi de gitignored, tek seferlik). Her iki panel 360x800 ve 412x915'te
  ekran görüntüsüyle kontrol edildi, taşma/kesilme yok.

## Faz 4 — Görsel dilin sadeleştirilmesi

- **20:9 siyah bantlar:** Phaser'ın Scale.FIT'i sabit 540x960 mantıksal çözünürlüğü korumak için
  üstten/alttan letterbox bırakıyor (bu bantlar `<body>`nin arkaplanı). Bantları ekranı yeniden
  tasarlayarak değil -- `document.body.style.background`'ı o anki sahnenin degradesiyle eşleyerek
  (`scenes/bodyBackground.ts`, her sahnenin `drawBackground()`'ında çağrılır) giderdik. Sonuç:
  360x800 (tam 20:9) gibi en uç oranda bile bant görünmüyor (ekran görüntüsüyle doğrulandı).
  Ayrıca `#app`deki fazladan flex-ortalamayı kaldırdık (Phaser'ın kendi Scale.CENTER_BOTH'uyla
  çakışıp canvas konumunu öngörülenden saptırıyordu -- oynanışı bozmuyordu ama gereksiz bir
  tutarsızlıktı, bkz. önceki fazlardan kalma not).
- **Renk paleti yumuşatıldı:** ROOM_THEMES'in 5 teması ve PALETTE'in 10 vurgu rengi (tuning.ts)
  daha önceki fazda "neon" seviyesine çıkarılmıştı (ör. #1FE0C2, #C158FF, #F5D91A gibi saf uçlar);
  şimdi hepsi aynı "yumuşatılmış mücevher tonu" diline (orta-yüksek doygunluk, aşırı uç YOK)
  çekildi. roomVisuals.ts'teki mobilya paleti de aynı yönde güncellendi. Hiçbir test tam hex
  değerine bağlı değildi (grep ile doğrulandı), bu yüzden serbestçe ayarlandı.
- **Eşya yüzleri sadeleştirildi:** yanak allığı (blush) tamamen kaldırıldı -- en "çocuksu" okunan
  öğeydi; gözler çift-katmanlı büyük anime-gözünden tek tonlu dolgu + tek küçük parıltıya indi;
  ağız küçültüldü. `FaceSpec`ten artık kullanılmayan cheekY/cheekGapX/cheekR alanları silindi
  (10 çizici fonksiyonun hepsinden). Ayrıca tutarlılık için drawTeddyBear'ın az farklı kontur
  kalınlığı (1.4) diğerleriyle aynı varsayılana (1.6) çekildi.
- **Kap (konteyner) görünümü:** "cam" hissi için üstte ince bir iç gölge şeridi + hemen altında
  parlak bir "rim" çizgisi eklendi; dış çerçeve zaten amber/ahşap tonundaydı, korundu.
- **Kilit rozeti BÜYÜK bir hata içeriyordu:** eski kod rozeti kabın üst-ORTASINA koyuyordu --
  tam olarak en üstteki eşyanın durduğu yer, bu yüzden rozet neredeyse tamamen eşyanın ARKASINDA
  gizleniyordu (yüksek çözünürlüklü ekran görüntüsüyle doğrulandı, bkz. _review-screenshots/
  faz4/obstacle-level33-hires.png). Düzeltme: rozet üst-SOL köşeye taşındı (tip-lock rozetiyle
  simetrik, üst-SAĞ köşede), büyütüldü (yarıçap ~15) ve gerçek bir asma kilit şekli (kavis+gövde+
  anahtar deliği) olarak yeniden çizildi, her zaman okunur kalması için beyaz rozet zemini üstünde.
  Tip-lock rozeti de aynı ölçeğe (yarıçap 9->11) büyütüldü.
- **Gizemli eşya ("?"):** koyu mor-gri gövde yerine AÇIK bir degrade (daha az "ağır/koyu") + ince
  noktalı çerçeve ("örtülü" hissi, ağırlık katmadan) + "?" artık kontrastlı koyu mürekkep renginde
  (önceden koyu zeminde krem renkliydi).
- **Animasyonlar kısaltıldı/yumuşatıldı** (tuning.ts: JUICE): move.duration 260->220, arcHeight
  60->44; land squash 1.18/0.82 -> 1.1/0.9 (daha az "zıplama"), duration 160->140; completion
  kamera titremesi 140ms/0.006 -> 110ms/0.004. Confetti parça sayısı 150->90 (reduced-motion:
  36->28) -- "abartılı" bulunup azaltıldı.
- **Tipografi ölçeği:** `theme.ts`'e `TYPE_SCALE` sabiti eklendi (screenTitle 28 / panelTitle 22 /
  sectionTitle 18 / hudCounter 15 / body 13 / caption 12) ve en önemli 9 metin ögesine (ekran
  başlıkları, panel başlıkları, seviye/oda rozetleri, HUD sayaçları, ipucu gövdesi) bağlandı --
  üst bardaki "Hamle/Kalan eşya" 13->15px, "Oda N/10" 12->14px'e büyüdü. Dokunma hedefi (zone)
  taraması yapıldı: GameScene/RoomScene/SettingsScene'deki TÜM `.zone()` çağrıları zaten >=48px
  (bir önceki fazdan kalma iş) -- ek değişiklik gerekmedi.
- Doğrulama: tsc temiz, 119/119 test yeşil, build başarılı. Playwright ile oda/oyun/ayarlar
  ekranları + 5 oda teması (seviye 15/25/35/45) + 3 engelli seviye (12 gizemli, 31/33 kilitli)
  + kazanma/kaybetme panelleri ekran görüntüsüyle incelendi.
