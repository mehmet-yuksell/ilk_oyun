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
