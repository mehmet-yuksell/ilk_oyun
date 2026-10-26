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
