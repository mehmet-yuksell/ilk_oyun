# DEVLOG — "Profesyonel cila" turu

Çalışma dalı: `profesyonel-cila` (main'e dokunulmadı, push yapılmadı).
Kural: oyun mekaniği / seviye mantığı (`src/core/**`, `src/data/levels.json`) DEĞİŞMEZ — yalnızca görünüm,
animasyon, ses, UI/UX ve cila katmanı. Reklam / reklam SDK'sı yok.

Ekran görüntüsü aracı: `node scripts/screenshots.mjs <klasör>` (önce `npx vite --port 5199 --strictPort`).
Betik sahnelere yalnızca DEV modunda açılan `window.__cozy` kancasıyla ulaşır, kazanma ekranına
gerçek çözücüyle (BFS) seviyeyi çözerek gelir.

---

## FAZ 0 — Denetim (kod yazmadan önce)

Başlangıç durumu: `npm run build` ✓, `npm test` ✓ (16 dosya / 133 test). Önce görüntüleri:
`docs/before-after/before/` (390x844 @2x — splash, oda, ayarlar, seviye 1, seçili kap, kazanma,
seviye 34, seviye 120, kaybetme).

### Neler "amatör" görünüyor (sonraki fazlar bu listeye göre ilerler)

**A. Temel / render**
1. **Letterbox bantları** — sabit 540x960 + `Scale.FIT` yüzünden 19.5:9 telefonda ekranın ~%18'i
   üstte/altta ayrı bantlar; bant ile sahne arasında sert renk dikişi var, kazanma/kaybetme karartması
   bantları örtmüyor. (→ Faz 1)
2. **Bulanık çizim** — 540 mantıksal piksel yüksek DPI ekranda ~2x büyütülüyor; Phaser `Text`
   dokuları çözünürlük 1'de pişiyor → yazılar ve kenarlar yumuşak/bulanık. (→ Faz 1)
3. **Font hatası** — paketlenmiş Fredoka dosyası **"ş" harfini bozuk çiziyor** (çengel bir sonraki
   harfin altına kayıyor: "Titreşim" → "Titresįm"). ğ/ı/İ/ö/ç/ü düzgün. (→ Faz 1, font değişimi)
4. Font ailesi her dosyada `'Fredoka, sans-serif'` olarak elle yazılmış; boyutlar 12/13/14/15/16/17/18/19/22/28/34,
   ağırlıklar '600'/'700'/'bold' karışık — `TYPE_SCALE` var ama çoğu yerde kullanılmıyor. (→ Faz 1)
5. Dağınık sabit renkler: `0x241437`, `0x1a1020`, `0x2b2320` (karartmalar), `#F2C49B` (el), ayrı
   `roomVisuals.ts` paleti, `0xfff8f0` … (→ Faz 1)

**B. Renk / arka plan**
6. Palet "cozy" değil: doygun mercan→kırmızı, turkuaz→okyanus mavisi degradeler bağıran, enerji
   içeceği reklamı gibi; sıcak/sakin oda hissi yok. (→ Faz 1)
7. Arka planda %58 yükseklikte sert yatay "duvar/zemin" çizgisi; rastgele dev yarı saydam daireler ve
   kapların altında bir hata gibi okunan "halı" elipsleri. (→ Faz 1)
8. Hareket yok: arka plan tamamen statik (toz/ışık parçacığı, doku yok). (→ Faz 1)

**C. Oyun nesneleri**
9. Kaplar düz beyaz kartlar + ince turuncu çizgi; malzeme hissi (cam/ahşap raf), zemin gölgesi,
   iç parlama yok; kapasite çizgileri defter satırı gibi. (→ Faz 2)
10. Her eşyanın altında ayrı bir gölge elipsi var → üst üste dizilince eşyaların ARASINDA havada
    asılı gölgeler oluşuyor. (→ Faz 2)
11. Seçim: yalnızca çerçeve rengi değişiyor + 10px kalkma; parlama halkası / sallanma yok. (→ Faz 2)
12. Uçuş tek "yonga" ile `Quad.easeInOut`; squash & stretch zayıf, iniş "pop"u ve gölge tepkisi yok;
    çoklu taşımada "×3" rozeti ham metin kutusu. (→ Faz 2)

**D. Geri bildirim**
13. Geçersiz hamle = **sert kırmızı çerçeve flaşı** (istenmeyen); "Hamle kalmadı" bandı kırmızı
    zemin üzerinde metin. (→ Faz 3)
14. Tamamlama efekti: düz renkli daireler + beyaz dikdörtgen flaş; konfeti var ama ışıltı/yıldız yok.
15. Kazanma paneli: sayaç ile buton arasında büyük boş beyaz alan, başlık vurgusuz, yıldızlarda
    parlama yok, butonda nabız yok. Kaybetme paneli: aynı boşluk + eski tarz "parlak şerit" başlık.
16. Haptik yalnızca `navigator.vibrate` (iOS'ta yok, Android WebView'de güvenilmez) — Capacitor
    Haptics kullanılmıyor. (→ Faz 3)

**E. Ses**
17. Yalnızca 4 kısa prosedürel ton; müzik yok; tek "Ses" anahtarı (müzik/efekt ayrımı yok);
    autoplay kilidi için açık bir "ilk dokunuşta aç" akışı yok. (→ Faz 4)

**F. Menü / UI**
18. Ana ekran (oda): logo/başlık yok; mobilyalar düz koyu mor siluetler (yer tutucu gibi);
    "Günlük Ödül"/"Günlük Bulmaca" birincil butonla aynı stilde; ince ilerleme çubuğu; garip
    "vasistas" pencere; OYNA butonu çevresinde büyük boşluk. (→ Faz 5)
19. Butonlarda basılma (scale-down) / bırakma animasyonu yok — hepsi yalnızca `pointerup` zonu.
    Butonlardaki "parlak üst şerit" 2010'ların glossy tarzı. (→ Faz 5)
20. Seviye seçim ekranı yok. (→ Faz 5)
21. Ayarlar: TR/EN/Açık/Kapalı dikdörtgen haplar (gerçek anahtar değil); müzik satırı yok; ekranın
    %65'i boş; Odaya/Ayarlara geçiş **anında** (`scene.start`, fade yok). (→ Faz 5)
22. Geçişler siyaha fade — sıcak/cozy bir oyunda sert; kremaya fade daha yumuşak. (→ Faz 5)
23. HUD: "Hamle: 0/23   Kalan eşya: 12" beyaz kontur metin — ucuz görünüyor; seviye hapındaki
    yıldız ikonu anlamsız. (→ Faz 2/5)
24. Splash: küçük bir tik kutusu + yazı; akılda kalan bir logo yok. (→ Faz 5/7)

**G. Performans**
25. `GameScene.render()` her durum değişikliğinde TÜM eşya görsellerini yok edip yeniden oluşturuyor
    (her eşya = Container + 2 Graphics, her çizim onlarca path komutu) → çöp toplayıcı baskısı ve
    WebGL'de her karede yeniden tessellation. Eşya çizimleri bir kez dokuya pişirilmeli. (→ Faz 2)
26. Her render'da tüm üst eşyalar için yeni sonsuz "nefes" tween'leri oluşturuluyor; eski nesneler
    yok edilse de tween temizliği implicit. (→ Faz 2)

**H. Erişilebilirlik**
27. Eşyalar şekil + renkle ayrışıyor (iyi), ama "tek türlü kap" rozeti yalnızca renkli halka —
    renk körü için yalnızca renge bağlı. (→ Faz 7)
28. Ayar haplarının görsel yüksekliği 32px (dokunma zonu 48px — zon iyi, görsel küçük).

### Faz 0 kararları
- Kanca: `main.ts`'e yalnızca DEV modda `window.__cozy = game` eklendi (prod build'den atılıyor) — ekran görüntüsü betiğinin sahnelere erişmesi için tek yol.
- Bulanıklık + letterbox (A1, A2) render temeli olduğu için Faz 5 yerine **Faz 1'de** çözülecek — sonraki tüm fazların ekran görüntüleri bunun üzerine kurulu.

---

## FAZ 1 — Tasarım sistemi

**Yapılanlar**
- `src/scenes/theme.ts` tek tasarım sistemi dosyası oldu: 8 tonlu cozy palet (krem, şeftali, terrakota, bal,
  adaçayı, lavanta, puslu mavi, gül kurusu) + ahşap tonları + sıcak erik-kahve metin, 10 eşya "boya" rengi,
  5 oda teması (şeftali sabah, adaçayı bahçe, lavanta akşam, bal öğleden sonra, puslu mavi), tipografi rolleri
  (`textStyle(role)`), RADIUS / SPACING / katmanlı yumuşak gölge (`drawSoftShadow`) / EASE / DURATION.
  `config/tuning.ts`'teki renkler buraya taşındı (tuning geriye dönük uyum için yeniden dışa aktarıyor).
  Dağınık sabitler (karartma `0x241437/0x1a1020/0x2b2320`, ten `#F2C49B`, oda mobilya paleti, ekran/cam tonları) temaya alındı.
- **Font: Fredoka → Nunito** (OFL, latin + latin-ext woff2, 75 KB; eski Fredoka TTF 159 KB). FontFace API ile
  Phaser'dan önce yükleniyor (`scenes/fonts.ts`). Yeni test `i18n/fontCoverage.test.ts`: her çeviri karakteri
  (ğ ş ı İ ö ç ü dahil) font alt kümelerinin unicode aralığında mı — ekran görüntüsünde de doğrulandı ("Titreşim" düzgün).
- **Render temeli** (`scenes/viewport.ts`): canvas = pencere × DPR (en fazla 2), sahneler mantıksal
  koordinatta (kısa kenar 540, uzun kenar ekrana göre uzar), kamera zoom'u dönüştürüyor. Sonuç: letterbox
  bantları yok, yazılar/kenarlar keskin. Metin dokuları kamera zoom'unda pişiyor (`phaserDefaults.ts`).
  Pencere boyutu değişince kamera yeniden sığdırılıyor (sahne yeniden başlatılmaz → oyun durumu kaybolmaz).
- **Linear yok**: `ease` verilmeyen her tween artık `Quad.easeOut` alıyor (Phaser varsayılanı `Power0` = doğrusal idi).
- **Arka plan** (`scenes/background.ts`): duvar degradesi + pencere ışığı + çok silik güneş huzmeleri + sert
  çizgisiz zemin geçişi + vinyet + deterministik kâğıt dokusu, tema+boyut başına bir kez canvas dokusuna
  çizilip önbellekleniyor (çalışma anında tek Image). Üstünde 8-12 yavaş süzülen toz zerreciği
  (`prefers-reduced-motion`'da kapalı).

**Kararlar**
- Palet: önceki turda "pastel = soluk" diye doygun temalara geçilmişti; bu turun isteği açıkça krem/şeftali/adaçayı/lavanta.
  Orta yol: ZEMİNLER açık/pastel, EŞYALAR doygun "boya" tonları → kontrast ve okunurluk korunuyor.
- DPR üst sınırı 2: 3x ekranda framebuffer 2.25 kat büyür; orta seviye Android'de 60 FPS hedefi için 2x yeterince keskin.
- Aşırı oranlar sınırlandı (9:21'den uzun, 4:5'ten geniş): masaüstü yatay pencerede içerik ortalanır, kenarlar tema rengiyle dolar.
- Font tanımı CSS yerine TS'te: unicode aralıkları tek kaynakta, test edilebilir; `vite.config.ts`'e (Vercel) dokunmaya gerek kalmadı.
- Kaynak dosyalar çalışma kopyasında LF'ye çevrildi (depo zaten LF saklıyor, `autocrlf=true` — içerik farkı yok).

**Performans notu**: arka plan tek doku (eskiden her sahnede ~15 Graphics path), zerrecikler 3 tween/adet × 12; sahne
kapanınca Phaser tween'leri ve nesneleri otomatik temizliyor. Arka plan dokuları tema başına bir kez üretilip `TextureManager`'da kalıyor
(5 tema × ~2.5 MB üst sınır; pratikte oturum başına 1-2 tema).

---

## FAZ 2 — Oyun nesneleri

**Yapılanlar**
- **Kaplar = cam önlü ahşap vitrin dolabı** (`scenes/containerView.ts`): ahşap degrade çerçeve + silik damar, krem iç
  duvar, iç üst/yan gölge (derinlik), her yuva için bir **raf tahtası** (eşyalar rafta durur → Faz 0 madde 10'daki havada
  asılı gölgeler bitti), çapraz cam parıltısı, zemine düşen bulanık gölge. Kilitli kap soğuk lavanta-gri tonda.
- **Eşyalar**: 10 siluet korunarak ortak bir ışık geçişi (üstten aydınlık, alttan sıcak gölge, sol-üst seramik parıltısı)
  ve **ayrı** bulanık temas gölgesi. Yüz 3 pişmiş durum (açık / kapalı / heyecanlı).
- **Pişirme hattı** (`bake.ts`, `canvasGraphics.ts`): Phaser Graphics API'sinin kullanılan alt kümesini Canvas 2D'ye
  çeviren adaptör → mevcut çizim kodu değişmeden bir kez yüksek çözünürlüklü dokuya pişiyor (gerçek degrade + shadowBlur).
- **Seçim**: altın parlama halesi nabız atar; run'daki eşyalar `Back.Out` ile kalkar, sonra hafif süzülme + ±2° sallanma;
  rafta kalan gölge küçülüp solar.
- **Taşıma**: her eşya ayrı uçar (55 ms aralık), yay yüksekliği mesafeye göre; uçuşta dikey esneme + yöne doğru eğilme,
  varışta tabandan ezilme; yerleşince `Back.Out` toparlanma ("pop"), gölge bir an yayılır, ayakta halka dalgası.
- Ezilme/esneme ekseni eşyanın **ayağı** (sprite orijini) — eşya rafa basarak eziliyor, havada değil.

**Performans / bellek denetimi** (`scripts/_perfcheck.cjs`, seviye 120, 32 eşya, 25 seç-taşı-geri al döngüsü)
- Eskiden: her durum değişikliğinde ~32 Container + 64 Graphics yok edilip yeniden çiziliyordu; her dokunuşta tüm kap
  çerçeveleri yeniden çiziliyordu. Şimdi: eşyalar **havuzdan** (tür+boyut), kaplar kalıcı, çalışma anında yalnızca Image.
- Denetimde bir **sızıntı bulundu ve düzeltildi**: havuz temizlenirken iç sprite'ların sonsuz "nefes" tween'leri
  durdurulmuyordu (33 → 259 tween). Düzeltme sonrası 25 döngüde: görüntü listesi 28→28, eşya 32→32, tween 33→33, doku 45→46 (halka dokusu bir kez).
- Geri al artık kapları/havuzu yeniden kurmuyor (dizilim imzası değişmediyse).

**Kararlar**
- Kap çerçevesi seçilince hareket etmiyor (yalnızca hale): çerçeve kalkarsa raftaki eşyalarla hizası bozuluyordu.
- "×N" rozeti kaldırıldı: eşyalar tek tek uçtuğu için sayı zaten görülüyor.
- `JUICE` ayarları güncellendi: kalkma 10→16 px / 200 ms, uçuş 300 ms + 55 ms aralık, iniş ezilmesi 1.14/0.86, 260 ms.

---

## FAZ 3 — Geri bildirim ve "juice"

**Yapılanlar**
- **Doğru hamle**: inişte küçük ışıltı patlaması (Phaser ParticleEmitter — dahili havuz, `scenes/fx.ts`).
- **Grup tamamlama**: 4 eşya bir an geri belirip heyecanlı yüzle zıplar → ışıltıya dönüşür; renkli nokta + ışıltı
  patlaması; altın yıldızlar yay çizip HUD yıldızına uçar (varınca HUD yıldızı "pop"); kap çerçevesi hafif büyüyüp
  `Back.Out` ile oturur; **çok hafif zoom vuruşu** (%1.2, mantıksal merkez sabit) + mini titreşim (eski şiddetin %60'ı).
- **Geçersiz hamle**: sert kırmızı çerçeve flaşı kaldırıldı → hedef kap + eşyaları sönümlenen kısa bir yatay
  "hayır" sallanması (2.5 salınım, 7 px → 0). "Hamle kalmadı" bandı kırmızı zeminden sakin koyu erik hapa döndü.
- **Combo**: düz metin yerine Back.Out ile açılan terrakota hap; kenardaki kaplarda ekran içine kaydırılıyor.
- **Kazanma paneli** (`gamePanels.ts`): derecelendirmeye göre kurdele başlık (Mükemmel! / Harika! / Tamamlandı!),
  arkada yavaş dönen sıcak ışınlar, 3 yıldız yay dizilimi (ortadaki büyük) — dolu olanlar sırayla dönerek
  `Back.Out` ile oturur ve ışıltı patlatır; +N sayaç artışı + bitişte pop; eski boş alan yerine Hamle/Süre çipleri;
  "Sonraki Seviye" belirince nabız atar. Panel aşağıdan yükselerek girer, kararma tüm ekranı örter ve alttaki
  oyuna dokunuşları yutar. Son grup kutlaması görülsün diye panel 700 ms gecikmeli.
- **Kaybetme paneli**: aynı dil, bal rengi kurdele, nabızlı "Tekrar Dene", çerçeveli "Odaya Dön".
- **Butonlar** (`scenes/ui.ts`): pişmiş degrade yüz + 3B dudak + yumuşak gölge; basınca küçülüp dudağa iner,
  bırakınca `Back.Out`; parmak dışarı kayarsa iptal; dokunma alanı ≥ 48 px. (Faz 5'te tüm ekranlara yayılacak.)
- **Haptik**: `@capacitor/haptics@8` eklendi. `createHapticService()`: native'de Capacitor Haptics (impact light/medium,
  notification success/warning), web'de sessiz Noop. Hızlı art arda hafif darbeler 35 ms'de bire seyreltiliyor
  (bildirimler asla atlanmaz). Ayarlar'daki "Titreşim" anahtarı (mevcut `hapticEnabled`) kapatıyor. +4 test.

**Bellek denetimi** (seviye 120, 25 döngü): görüntü listesi 30→30, tween 33→33, doku 48→49 (ilk kez kullanılan
efekt dokusu, sonra sabit).

**Kararlar**
- Web'de titreşim tamamen kapalı (istek: "web'de sessizce atla") — eski `navigator.vibrate` sınıfı testler için duruyor ama varsayılan değil.
- Yıldız sesi için şimdilik "complete" sesi kullanılıyor; Faz 4'te ayrı yıldız sesi gelecek.

---

## FAZ 4 — Ses

**Yapılanlar**
- **Tek ses motoru** (`services/AudioEngine.ts`): eskiden her sahne kendi `AudioContext`'ini açıyordu; artık tek bağlam
  + iki veriyolu (efekt / müzik). İlk kullanıcı dokunuşunda (pointerdown/touchend/keydown) açılır — mobil autoplay
  kısıtı. Uygulama arka plana gidince askıya alınır, dönünce sürdürülür.
- **Efektler** (`SoundService.ts`, hepsi Web Audio ile üretilir): seç (ahşap "tık"), bırak/iniş (dolgun "tok", her
  inişte ±%4 perde — robotik tekrar yok), grup tamamlama ("ding-ding" cam çınlaması), hata (iki inen yumuşak nota —
  sert uyarı yok), kazanma (C-E-G-C çan arpeji + sıcak taban notası), panel yıldızları (her yıldız bir üst nota),
  UI butonu, kilit açılma.
- **Müzik** (`MusicService.ts`): prosedürel, sakin 8 ölçülük döngü, 72 BPM — Cmaj7 / Am7 / Fmaj7 / G6 pad (detune'lu
  üçgen + alçak geçiren), sabit tohumla üretilen C majör pentatonik tıngırtı melodisi + yankı, yumuşak bas.
  "Lookahead" zamanlayıcı (120 ms'de bir, 0.6 sn ileri) — setTimeout titremesi ritmi bozmaz. Varsayılan düşük.
- **Ayrı aç/kapa**: Ayarlar'da "Ses efektleri" ve "Müzik" ayrı satırlar (`SaveData.musicEnabled`, eski kayıtlarda
  varsayılan açık — `migrateSaveData` eksik anahtarı varsayılanla doldurur). Müzik kapatılınca 0.6 sn'de yumuşakça susar.
- **Kalıcılık**: ayarlar `SaveService` üzerinden localStorage + `@capacitor/preferences` (native SharedPreferences
  yedeği) — mevcut mekanizma, yeni alan otomatik dahil.
- +11 test (motor: tek bağlam, kilit dinleyicileri, askıya alma, bağlamsız güvenlik; müzik: deterministik melodi,
  yalnızca pentatonik; efektler: veriyolu bağlantısı, perde çeşitliliği). Toplam 151 test.

**Tarayıcıda doğrulama** (`scripts/_audiocheck.cjs`, gerçek Chromium + AnalyserNode):
- dokunuştan önce `unlocked=false`; dokunuştan sonra bağlam `running`, müzik veriyolu tepe ≈ 0.036 (≈ -29 dBFS;
  efektlerin tepesi ≈ 0.1 — müzik bilerek arkada); müzik kapatılınca tepe 0.
- Bilinen sınır: sesin *kulağa nasıl geldiği* otomatik test edilemez — yalnızca çaldığı ve seviyeleri ölçüldü.
  Gerçek cihazda kulakla dinlenmesi önerilir.

**Kararlar**
- Eski ses testleri (tap = 1 osilatör + lowpass, complete = 2 osilatör + bandpass) sözleşme olarak korundu.
- Müzik sahne değil uygulama ömrüne bağlı (sahne geçişlerinde kesilmez).

---

## FAZ 5 — Menü, UI ve sahne geçişleri

**Yapılanlar**
- **Ana ekran (oda)** yeniden tasarlandı: üstte yıldız çipi + Seviyeler/Ayarlar ikon butonları; iki tonlu "Cozy Sort" logosu
  (bal rengi kıvrım, hafif süzülme); oda kartı (çevrilmiş oda adı, sayaç, kalın degrade ilerleme çubuğu — yenilemede
  dolarak artar); oda illüstrasyonu artık ekrandaki boş alana orantılı yerleşiyor (eskiden sabit 960 px koordinatları).
  Yenilenmemiş mobilyalar koyu mor siluet yerine **"boyanmamış" sıcak bej** — yenilemek = boyamak. Alınabilir eşyaların
  fiyat rozeti nabız atar (metinsiz ipucu). Altta Günlük Ödül (bal) / Günlük Bulmaca (adaçayı) ikonlu butonlar ve büyük,
  nabızlı **OYNA** (içinde sıradaki seviye rozeti). Günlük ödülde yıldızlar butondan çipe uçar, sayaç artarak sayar.
- **Seviye seçim ekranı** (`LevelSelectScene`, yeni): 10'arlı bölümler = oda temaları (Şeftali Sabahı, Adaçayı Bahçesi…),
  kart durumları: tamamlanmış (bölüm rengi kenar + en iyi 1-3 yıldız) / sıradaki (terrakota, nabızlı hale, ▶) /
  kilitli (soluk, kilit; dokununca nazik sallanma + ses). Sürükle-kaydır + atalet + sınırda yaylanma; açılışta sıradaki
  seviye ortalanır. Sabit başlıkta toplam yıldız.
- **Ayarlar paneli** (`settingsPanel.ts`): ayrı sahne yerine her ekranda açılan katman (oyun içinden de — seviye durumu
  kaybolmaz). İkonlu satırlar + gerçek animasyonlu anahtarlar (Ses efektleri / Müzik / Titreşim), TR/EN kayan seçici
  (yalnızca seviye dışında; dil değişince ekran geçişle yenilenir), sürüm etiketi. Eski `SettingsScene` silindi.
- **Butonlar** her yerde `ui.ts` (basılma/bırakma animasyonu, ≥48 px alan). Eski `gameHud.ts` kaldırıldı.
- **Oyun HUD'u**: geri + ayarlar ikonları, seviye hapı, iki sayaç çipi ("Hamle 0/23" — kalan hakkı gösteren ince çubuk,
  son 3 hamlede gül kurusu + nabız; "Kalan eşya"). Izgara üst sınırı güvenli alana göre (eskiden sabit 170 px).
- **Geçişler**: siyaha fade yerine krem renge fade + içerik hafif kayarak girer/çıkar; tüm `scene.start` çağrıları
  `fadeToScene` üzerinden (ayarlar/yeniden dene dahil); geçiş sürerken ikinci geçiş isteği yok sayılır.
- **Splash**: tik kutusu yerine logo + mini ahşap raf; oyunun üç eşyası sırayla rafa zıplar.
- **i18n**: oda adları ve 60 eşya adı için İngilizce (core'a dokunmadan, `roomName()` / `itemLabel()`).
- **Android geri tuşu**: her sahne kendisi ele alır (açık panel varsa önce kapanır; ana ekranda çıkış). Eski kodda
  `game.scene.start('RoomScene')` aktif sahneyi DURDURMADAN Room'u başlatıyordu (iki sahne üst üste) — düzeltildi.
- **Kayıt**: `SaveData.levelStars` (seviye başına en iyi 1-3 yıldız; eski kayıtlarda boş, bozuk tip onarılır) +
  `recordLevelStars` / `collectedRatingStars`, +3 test.

**Kritik bulgu ve düzeltme — sekme çökmesi**
- Sahne döngüsü testinde (Seviyeler→Oyun→Oda) tarayıcı sekmesi ~5. turda **çöktü**. İkiye bölmeli arama (her faz
  commit'i ayrı çalışma ağacında aynı testle): Faz 1 temiz, **Faz 2'den itibaren** çöküyor.
- Neden: Phaser `textures.createCanvas` canvas'ı CanvasPool'dan **GPU hızlandırmalı** bağlamla açıyor; `CanvasTexture`
  her `refresh()`'te `getImageData` ile GPU'dan geri okuyor ("GPU stall due to ReadPixels"). Faz 2+ onlarca kalıcı
  pişmiş canvas üretiyor.
- Düzeltme (`bake.ts › createBakedCanvasTexture`): canvas'ı kendimiz, ilk bağlamı `willReadFrequently: true` (CPU) ile
  açıp önce çiziyor, sonra `addCanvas` ile tek seferde yüklüyoruz (refresh/geri okuma yok). Arka planlar da aynı yoldan +
  en fazla 4 arka plan dokusu önbellekte (LRU).
- Sonuç (başsız Chromium): 20 tam döngü çökmesiz; doku sayısı 93'te sabit; JS belleği 159 → **61 MB**; oyun yeniden
  başlatmada FPS 8-12 → **~30** (aynı yazılım GPU'su). Oyunu 6 kez art arda yeniden başlatma testi 4/4 temiz.
- Not: açılışta 4 kez görülen "ReadPixels" uyarısı Phaser'ın tek seferlik özellik testlerinden; döngülerde tekrar etmiyor.

**Ölçekleme doğrulaması** (ekran görüntüsü): 360×640 (16:9), 320×568 (SE), 390×844, 412×915 (20:9), 768×1024 (tablet) ve
çentik simülasyonu (üst 47 / alt 34 px) — hiçbir öğe kesilmiyor, üst şerit çentiğin altında, alt butonlar ev çubuğunun üstünde.

**Kararlar**
- **Tekrar oynama yıldız vermez**: seviye seçiminden geçilmiş bir seviye tekrar oynanabilir; yıldız verilseydi aynı seviyeyi
  tekrarlayarak yıldız biriktirilebilirdi. Yalnızca en iyi derecelendirme güncellenir, panelde "+0" yerine kısa bir not.
- Dil seçimi oyun içi ayarlarda gizli (dil değişimi ekranı yeniden kurar → seviye durumu kaybolurdu).
- Masaüstü yatay pencerede FPS ölçümleri başsız yazılım GPU'sunda alındı — gerçek cihaz değerleri değildir.

---

## FAZ 6 — İlk izlenim ve ilerleme hissi

**Yapılanlar**
- **Öğretici (metinsiz)** yenilendi (`gameTutorial.ts`): kaynak ve hedef kap nabız atarak parlar (`ContainerView.setHint`),
  pişmiş el figürü kaynağa **dokunur** (dokunma halkası), yay çizerek hedefe gider ve tekrar dokunur. Aynı türün üstüne
  koyma hamlesi tercih edilir (kuralı en açık gösteren hamle). İlk seviyede bir kez otomatik; **ilk 3 seviyede 8 sn
  dokunulmazsa** nazik ipucu olarak yeniden gösterilir. Oyuncu dokunduğu an durur.
- **Başarımlar** (`services/achievements.ts`, 11 adet): İlk Adım, 10/25/50/100 seviye, Kusursuz (10 seviye 3 yıldız),
  Yıldız Avcısı (100 seviye yıldızı), Tadilatçı (5 eşya), Yuva Gibi (1 oda), 3 ve 7 günlük seri. Hepsi kayıttan
  **türetilir** (ayrı sayaç yok), yalnızca açılanlar listesi saklanır (`SaveData.achievements`). Açılınca üstten kayan
  bildirim + küçük **+5 ★** bonus (bir kez). Ana ekranda kupa ikonu → ilerleme çubuklu başarım paneli. +7 test.
- **Günlük seri paneli**: Günlük Ödül butonu artık her zaman açılır; 7 günlük şerit (bugün vurgulu, alınan günler bal
  rengi, her günün ödülü), "Ödülü Al +N" ya da "Yarın gel: +N". Önizleme core'daki saf `claimDailyReward` kaydedilmeden
  çağrılarak hesaplanır (core değişmedi).
- **Bölüm dekoru** (`wallDecor.ts`): her oda temasının kendi duvar süsü — perdeli güneşli pencere (şeftali), sarkan saksılar
  (adaçayı), titreşen ışık zinciri + ay penceresi (lavanta), çerçeveler + saat (bal), kitaplı yüzen raf (puslu mavi).
  Izgaranın üstündeki boş duvara ölçeklenir; yer yoksa çizilmez (kalabalık ileri seviyeleri kirletmez).
- **Yeni bölüm bandı**: 11, 21, 31… seviyelerin başında tema renginde kurdele ("Yeni bölüm · Adaçayı Bahçesi") + ışıltı.
- **Engel ipucu kartı** koyu kutudan krem karta döndü; bölüm bandıyla çakışmasın diye o seviyelerde bant bittikten sonra gelir.
- Seviye yıldız toplama Faz 5'te (`levelStars`) gelmişti; seviye ekranı başlığında toplam ve başarımlarda kullanılıyor.

**Doğrulama**: build ✓, 20 dosya / 161 test ✓; 20 sahne döngüsü — doku 96'da sabit, bellek 58 MB sabit, hata yok;
oyun içi 25 döngü — nesne/tween sabit. Ekran görüntüleri: seviye 1 öğretici, 11/21/31/41 dekor + bölüm bandı,
başarım bildirimi, başarımlar paneli, günlük seri.

**Kararlar**
- Başarım bonusu küçük (+5 ★) tutuldu: ekonomiyi bozmadan "fark edildim" hissi; zorunlu görev/sayaç yok.
- Hareketsizlik ipucu yalnızca ilk 3 seviyede — ileri seviyelerde çözümü fısıldamak oyunun zorluğunu bozar.
