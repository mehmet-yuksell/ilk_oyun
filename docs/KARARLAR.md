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

## Faz 5 — Ana oda ekranı ve meta katmanı

- **Yenilenmemiş eşyalar:** `roomItemArt.ts`de "off" gövde rengi soluk `COLORS.surfaceMuted`
  (açık gri) yerine `COLORS.ink` (koyu mor-lacivert) oldu -- artık gerçekten "koyu, net bir
  siluet". İkincil detay çizgileri (raf ayrımı, çekmece kulpları vb.) zaten düşük alfa'da
  `inkSoft` kullanıyordu, bu da koyu gövde üzerinde zayıf-ama-görünür iç detay bırakıyor --
  tam olarak bir "silüet"ten beklenen his.
- **Yenileme animasyonu güçlendirildi:** eskiden sadece bir altın parıltı + renkli parçacık
  patlaması vardı, ikonun kendisi anlık olarak değişiyordu. Şimdi: `refresh()` önce çağrılıp
  ikon tazece canlı hâliyle çizildikten SONRA o taze karta küçükten-büyüyen bir "Back.easeOut"
  pop + üzerinde kısa bir beyaz ışık parıltısı (ADD blend) bindiriliyor -- "renk ve ışıkla
  canlanma" hissi artık ikonun kendisinde de var, yalnızca yanında değil.
- **Oda sayacı:** zaten ROOMS.length'e göre dinamikti (daha önceki bir fazda düzeltilmişti),
  "Oda 1/10" doğru gösteriyor -- ekran görüntüsüyle yeniden doğrulandı.
- **Üst bar:** mevcut düzen (başlık ortada, oda sayacı altında, yıldız+ayarlar sağ üstte dikey
  istiflenmiş, günlük ödül/bulmaca ortalanmış bir satır) zaten düzenli/dengeli bulundu -- ek
  değişiklik gerekmedi.
- **Açılış splash ekranı:** yeni `SplashScene.ts` -- "Cozy Sort" markası + basit bir işaret
  (650ms tut + kısa pop/fade-in), sonra RoomScene'e yumuşak geçiş. `?level=N` debug modunda
  splash tamamen atlanır (doğrudan GameScene) -- debug iş akışını yavaşlatmamak için.
- **Yumuşak sahne geçişleri:** yeni `sceneTransition.ts` (`fadeToScene`) -- kamerayı kısaca
  siyaha söndürüp hedef sahneyi başlatıyor; hedef sahneler kendi create()'lerinde
  `fadeIn()` çağırıyor (RoomScene, GameScene). Uygulandığı yerler: splash->oda, OYNA/günlük
  bulmaca->oyun, oyun geri butonu->oda, kazanma/kaybetme panelindeki "Odaya Dön"/"Sonraki
  Seviye"->oda. "Tekrar Dene" (aynı seviyeyi anında yeniden başlatır) bilinçli olarak
  fade'siz bırakıldı -- art arda denemede gecikme hissi vermesin diye.
- **Oda tamamlama ekranı YENİDEN YAPILDI:** eskisi 1.4 saniyede kendiliğinden kapanan, oyuncu
  etkileşimi olmayan zayıf bir "toast" idi. Artık kazanma/kaybetme panelleriyle AYNI kart dilini
  kullanan gerçek bir modal: büyük altın yıldız (pop animasyonlu) + başlık + alt metin + oyuncu
  dokunana kadar açık kalan "Devam Et" birincil butonu.
- **GERÇEK BİR ÇÖKME HATASI BULUNDU VE DÜZELTİLDİ (test sırasında):** Playwright ile oda
  tamamlama akışını uçtan uca doğrularken (9/10 öğe önceden yenilenmiş bir kayıt enjekte edip
  10.'yu yenileyip "Devam Et"e basarak), "Cannot read properties of undefined (reading
  'items')" hatasıyla sahne çöktü. Kök neden: `migrateSaveData()` eski bir kayıttaki `rooms`
  dizisini OLDUĞU GİBİ kopyalıyordu -- ROOMS 5'ten 10'a çıkarılmadan ÖNCE kaydetmiş biri
  `rooms.length===5` ile kalır, 5. odayı bitirip 6.'ya geçince `saveData.rooms[5]` undefined
  olur ve RoomScene çöker. Düzeltme: `migrateSaveData()` artık `rooms`i her zaman güncel
  `ROOMS.length`e tamamlıyor (mevcut ilerlemeyi index'e göre koruyarak, eksikleri taze
  başlangıçla doldurarak) -- `SaveService.test.ts`e bu senaryo için 2 yeni test eklendi.
  Bu, gerçek oyuncuları etkileyebilecek bir prod hatasıydı (bu oturumun başında ROOMS
  genişletildiğinden beri var olan bir regresyon); ekran görüntülü uçtan uca test olmasaydı
  fark edilmeyebilirdi.
- **Diğer bir teşhis:** oda tamamlama panelinde başta bir `cameras.main.zoomTo(1.05,...)`
  kamera efekti vardı; bu, Playwright ile "Devam Et" butonuna tıklarken tutarsız biçimde
  hedefi kaçırıyordu (muhtemelen zoom sırasında kamera dönüşümüyle ilgili bir Phaser pointer
  hit-test tuhaflığı). Kazanma/kaybetme panellerinde böyle bir zoom hiç yoktu ve onlar
  güvenilir çalışıyordu -- bu yüzden zoom efekti tamamen kaldırıldı (sadelik isteğiyle de
  uyumlu), buton artık her zaman güvenilir tıklanabiliyor.
- Doğrulama: tsc temiz, 121/121 test yeşil (2 yeni migrasyon testi), build başarılı. Playwright
  ile splash ekranı, splash->oda geçişi, OYNA->oyun->geri->oda tam döngüsü (0 konsol hatası),
  ve enjekte edilmiş kayıtla uçtan uca oda-tamamlama->devam->sonraki oda akışı doğrulandı.

## Faz 6 — Yeni oyuncu deneyimi

- **El animasyonlu öğretici zaten vardı** (önceki bir fazdan: `startTutorialHand()`, metin YOK --
  yalnızca kaynak-kaptan hedef-kaba giden animasyonlu bir el), ama "bir kere gösterilsin ve
  kayıtta saklansın" eksikti -- eski tetik koşulu yalnızca `sessionMode==='progress' &&
  levelNumber===1` idi, yani seviye 1 her tekrar oynandığında (ör. kaybedip "Tekrar Dene" ile
  değil ama odaya dönüp tekrar "OYNA" ile) yeniden gösteriliyordu. Artık `saveData.seenHints`
  dizisine `'moveTutorial'` anahtarıyla eklenen, engel ipucu mekanizmasıyla (bkz.
  `maybeShowObstacleHints`) AYNI düzende bir bayrak var -- gösterilmeden hemen önce kaydediliyor.
  Playwright ile doğrulandı: ilk oynanışta el görünüyor (ekran görüntüsüyle yakalandı), seviye 1
  tekrar oynandığında (odaya dönüp OYNA) hiç görünmüyor.
- **Hamle limiti: yeni oyuncu rahatlığı geri getirildi, ama yalnızca erken seviyelerde.** Bir
  önceki fazda (bu projenin daha erken bir aşamasında) kullanıcı limiti kasıtlı olarak çok sıkı
  tutmuştu (par + sabit 3) -- bu görev AÇIKÇA ilk 15 seviyede "geniş pay" istiyor. İkisini
  birden karşılamak için `moveLimitFor` artık seviyeye göre değişen bir pay kullanıyor
  (tuning.ts: `newPlayerWideBonusUntilLevel=15`, `newPlayerWideBonus=9`,
  `newPlayerTaperEndLevel=40`): seviye 1-15'te pay 9 (ör. seviye 1: cert=14, limit=23 -- önceki
  17'den belirgin biçimde daha rahat), 16-40 arası DOĞRUSAL olarak taban paya (3) daralır, 40+
  için eski sıkı davranış aynen korunur (kullanıcının "gerçekten kaybedilebilsin" isteği ileri
  seviyelerde bozulmadı). `difficultyCurve.test.ts`e 4 yeni test eklendi (geniş pay aralığı,
  taban pay aralığı, monoton daralma, "her zaman certten büyük").
- **"Tekrar Dene" zaten aynı düzeni veriyordu** -- seviye üretimi tamamen `levelNumber`den
  türeyen sabit bir tohumla deterministik (`baseSeed + levelNumber*1013904223`), bu da
  doğrulandı (iki ayrı üretim çağrısı birebir aynı initialState üretti). Kod değişikliği
  gerekmedi.
- Doğrulama: tsc temiz, 125/125 test yeşil (4 yeni), build başarılı. Playwright ile: (a) ilk
  oynanışta öğretici elin göründüğü, ikinci oynanışta görünmediği ekran görüntüleriyle
  kanıtlandı; (b) gerçek seviye verisiyle yeni hamle payı tablosu (seviye 1/10/15/16/25/40/
  41/60/100) hesaplanıp kademeli daralma doğrulandı.

## Faz 7 — Teknik sağlamlaştırma

**Not:** Faz 7 kapsamı çok büyük (ses + depolama + arka plan/geri tuşu + GameScene bölünmesi +
Android yapılandırması + paket boyutu) -- riski azaltmak için her alt-parça kendi içinde
test/build doğrulamasından geçtikçe ayrı commit'lere bölündü (tek dev commit yerine), ama hepsi
bu "Faz 7" başlığı altında, aşağıda sırayla belgeleniyor.

- **Ses tasarımı yenilendi** (SoundService.ts): çıplak osilatör "bip"leri yerine her ses artık
  osilatör -> BiquadFilter -> gain zinciri kullanıyor. tap/land: üçgen dalga + alçak geçiren
  filtre + hafif aşağı perde kayması ("ahşap tıkırtısı" hissi). complete: iki sinüs notası +
  bant geçiren filtre, kısa bir gecikmeyle art arda ("cam çınlaması", "ding-ding"). invalid:
  düşük frekans + dar alçak geçiren filtre (eski keskin kare-dalga yerine donuk/rahatsız
  etmeyen bir uyarı). Harici ses dosyası yok, tamamen Web Audio API ile üretiliyor. Mevcut
  testin sahte AudioContext'i `createBiquadFilter`i de içerecek şekilde genişletildi (yeni
  davranış için 2 yeni test eklendi, mevcut test zayıflatılmadı).
- **@capacitor/preferences eklendi** (yeni bağımlılık). `SaveService` API'si (load/save) BİLEREK
  senkron kaldı -- oyun kodunun onlarca yerinde senkron kullanılıyor, tamamını async'e çevirmek
  bu fazın kapsamına göre orantısız bir risk olurdu. Bunun yerine: `save()` artık localStorage'a
  YAZDIKTAN SONRA Preferences'a da (aynı anahtarla) "ateşle-unut" (fire-and-forget, await
  edilmeyen, hata yutan) bir yedek yazıyor -- native Android'de SharedPreferences'a da gider.
  Yeni `restoreFromPreferencesIfMissing()` fonksiyonu uygulama açılışında (main.ts, Phaser.Game
  oluşturulmadan ÖNCE, tek seferlik `await`) localStorage boşsa Preferences'taki olası bir
  yedeği geri yazar. Web'de @capacitor/preferences zaten kendi içinde localStorage kullandığı
  için bu pratikte zararsız bir ikinci (ayrı anahtarlı) yazıdır -- davranış değişmez.
  `vi.spyOn` Capacitor'ın registerPlugin() nesnesinde çalışmadığından (own property değil)
  testler `vi.mock('@capacitor/preferences', ...)` ile tam modül sahteleştirmesine geçti.
  6 yeni test eklendi (save+Preferences yazısı, hata toleransı, restore senaryoları).
  Doğrulama: Playwright ile gerçek bir "günlük ödül al" + sayfa yenileme döngüsünde yıldızların
  doğru kalıcı olduğu kanıtlandı (0 konsol hatası).

- **Arka plana geçiş / Android geri tuşu:** main.ts'teki `visibilitychange` tabanlı pause/resume
  (`game.loop.sleep()`/`wake()`) Playwright ile simüle edildi (documenti `hidden=true` + olay
  gönderimi, 1.5sn "arka planda" bekleme, sonra `hidden=false`) -- oyun durumu bozulmadı, geri
  dönünce bir hamle normal şekilde işlendi (0 konsol hatası). Android donanım geri tuşu
  (`CapacitorApp.addListener('backButton', ...)`) gerçek bir native Capacitor/Android ortamı
  gerektirdiği için bu web-only Playwright ortamında DOĞRUDAN tetiklenemedi -- ama kullandığı
  aynı `scene.start('RoomScene')` / oda-çıkış yolu, uygulama içi "Geri" butonu ve panel
  "Odaya Dön" aksiyonlarıyla zaten birebir aynı kod yolu (kod incelemesiyle doğrulandı) ve o
  yollar yukarıdaki navigasyon testlerinde defalarca çalıştı. **Kalan risk:** gerçek cihazda
  native geri tuşunun son bir kez elle test edilmesi önerilir (bkz. docs/YAYIN.md).

- **GameScene.ts bölündü** (1709 -> 1011 satır, %41 azalma): 698 satır 6 odaklı modüle taşındı:
  - `gameTypes.ts` (24 satır): paylaşılan `Layout`/`Button`/`ActiveObstacles`/`SessionMode`/
    `FeedbackKind` tipleri.
  - `gameInput.ts` (127 satır, GİRDİ): `GameInputController` -- dokun/sürükle algılama,
    DRAG_THRESHOLD mantığı, tap-seç-taşı akışı. Dar bir `InputHost` arayüzüyle besleniyor.
  - `gameAnimations.ts` (282 satır, ANİMASYONLAR): `GameJuiceFx` -- flashUnlock/flashInvalid/
    flashCompletion/flyStarsToCounter/showCombo/animateMove/playLandBounce/moveRunVisual/
    boşta göz kırpma zamanlayıcısı.
  - `gameTutorial.ts` (143 satır, ÖĞRETİCİ): `TutorialController` -- el animasyonu + ilk
    oynanabilir hamleyi bulma.
  - `gameHud.ts` (113 satır, HUD): createButton/createBackButton/drawStarGlyph/starPoints.
  - `gamePanels.ts` (242 satır, PANELLER): showLevelCompletePanel/showLevelLostPanel (tam
    bağımsız fonksiyonlar, parametre + callback alırlar).

  GameScene.ts'te KALANLAR (çekirdek, state-ağırlıklı, taşınması riskli bulundu): create()/
  loadLevel() (seviye yükleme), computeLayouts()/drawFrames()/render() (durumdan görsele
  eşleme -- oyunun kalbi), attemptMove()/onUndo()/onAddExtraContainer() (hamle orkestrasyonu),
  checkStuckOrWin()/onLevelWon()/onLevelLost() (kazanma/kaybetme akışı), lock/typelock rozet
  çizimi (drawFrames'e çok sıkı bağlı).

  **Teknik not:** tsconfig'te `erasableSyntaxOnly` açık olduğu için constructor parametre-
  property kısayolu (`constructor(private readonly x: T)`) derlemedi (TS1294) -- 3 sınıfta
  (GameJuiceFx/GameInputController/TutorialController) açık alan tanımı + atamaya çevrildi.

  Her modül GameScene'den "host" arayüzleriyle (getter/callback fonksiyonları) beslenir --
  GameScene içindeki mutable durum (gameState, layouts, selectedId, vb.) tek kaynak olarak
  kalır, modüller buna doğrudan değil callback üzerinden erişir. Kod, mekanik olarak taşındı
  (mantık satır satır aynı) -- davranış değişikliği YOK.

  Doğrulama: tsc temiz, 133/133 test yeşil, build başarılı. Playwright ile TAM regresyon:
  splash->oda->oyun->geri döngüsü, arka plan/ön plan geçişi, kalıcılık, gerçek bir kayıp
  (hamle+geri-al döngüsü -- girdi denetleyicisini ve paneli test eder), gerçek bir kazanç
  (üretilen seviyenin gerçek çözüm sertifikası tekrar oynatılarak -- animateMove/attemptMove
  zincirini ve paneli test eder), öğreticinin ilk oynanışta görünüp ikincide görünmediği, ve
  kilitli kap rozetinin hâlâ doğru çizildiği ekran görüntüleriyle kanıtlandı. Hepsi bölünmeden
  önceki haliyle piksel-piksel aynı sonuçları verdi.

- **Android sürüm/imzalama/minify:** `versionCode` 1->2, `versionName` "1.0"->"1.1.0" (bkz.
  docs/YAYIN.md -- her Play Store yüklemesinde ikisi de artırılmalı). Release build artık
  `minifyEnabled true` + `shrinkResources true` kullanıyor; Capacitor'ın kendi kütüphane
  modüllerinin (capacitor-android, @capacitor/app, @capacitor/preferences) consumer-proguard
  kuralları otomatik birleştiği için elle keep kuralı eklemeye gerek kalmadı ("güvenli açılış").
  **Keystore OLUŞTURULMADI** (görev böyle istedi) -- imzalama adımları, versionCode/versionName
  yönetimi ve bir release öncesi yapılması gereken elle doğrulama (`./gradlew assembleRelease`
  + gerçek cihazda test, bu ortamda Android SDK olmadığı için YAPILAMADI) docs/YAYIN.md'ye
  yazıldı. `npx cap sync android` çalıştırılıp @capacitor/preferences'ın native modül olarak
  doğru kaydedildiği doğrulandı (capacitor.build.gradle/capacitor.settings.gradle otomatik
  güncellendi, commit'e dahil edildi).

- **Üretim paket boyutu ölçüldü:** `vite.config.ts` eklenerek Phaser ayrı bir "vendor" parçasına
  bölündü (Rolldown -- bu projenin bundler'ı -- klasik Rollup'ın nesne kısayolunu değil
  fonksiyon bekliyor, ilk deneme bir çalışma zamanı hatası verdi, düzeltildi). Sonuç kesin
  olarak şunu gösterdi: **`phaser-*.js` 1196.90 KB ham / 318.74 KB gzip, kendi oyun kodumuz
  (`index-*.js`) yalnızca 96.97 KB ham / 30.64 KB gzip.** Yani ~1.3MB'lık paketin >%92'si Phaser
  kütüphanesinin kendisi -- kendi kodumuz zaten küçük. Toplam indirilen bayt bölünmeyle
  değişmedi (beklenen; bu bir küçültme değil, bir önbellekleme iyileştirmesi) ama artık Phaser
  (biz güncellemediğimiz sürece hiç değişmeyen) ayrı bir parça olduğu için sonraki deploy'larda
  dönen kullanıcılar yalnızca küçük uygulama parçasını yeniden indirir.
  **Phaser'ı daha fazla küçültme (ör. kullanılmayan Matter.js fizik motorunu atma) resmi
  npm/Vite araçlarıyla MÜMKÜN DEĞİL** -- Phaser bunu package.json `exports` üzerinden ayrı bir
  "lite" girdi noktası olarak sunmuyor, yalnızca topluluk tarafından Phaser'ı kaynağından özel
  bir webpack yapılandırmasıyla yeniden derleyerek yapılabiliyor; bu, Phaser sürüm
  güncellemelerinde kırılgan, desteksiz bir hack olacağından denenmedi (risk/fayda oranı kötü).
  Oyun zaten `main.ts`'teki Phaser.Game config'inde `physics` anahtarını hiç kullanmıyor (fizik
  motoru çalışma zamanında zaten devreye girmiyor) -- yalnızca paket BOYUTU etkilenmiyor.
  Doğrulama: tsc temiz, 133/133 test yeşil, `npm run build` + `npm run preview` ile gerçek
  üretim paketi Playwright'ta sıfır konsol hatasıyla çalıştırıldı.
