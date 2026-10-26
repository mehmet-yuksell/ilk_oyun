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
