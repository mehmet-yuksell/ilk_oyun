# Credits / Lisanslar

Cozy Sort'taki tüm görseller, efektler ve sesler kod ile üretilir (Phaser Graphics, Canvas 2D
degradeleri, Web Audio API). Harici görsel veya ses dosyası kullanılmaz.

## Font

| Varlık | Kaynak | Lisans |
|---|---|---|
| **Nunito** (`public/fonts/Nunito-latin.woff2`, `Nunito-latin-ext.woff2`) | The Nunito Project Authors — <https://github.com/googlefonts/nunito>, Google Fonts latin / latin-ext alt kümeleri | SIL Open Font License 1.1 — tam metin: `public/fonts/Nunito-OFL.txt` |

## Görseller

- Arka planlar, eşyalar, kaplar, ikonlar, parçacıklar, konfeti: kod ile çizilir (`src/scenes/*`).
- Uygulama ikonu / splash: `scripts/generateAppIcon.ts` içinde SVG olarak kod ile üretilir.

## Ses ve müzik

- Tüm efektler ve arka plan müziği Web Audio API ile çalışma anında prosedürel olarak üretilir
  (`src/services/SoundService.ts`, `src/services/MusicService.ts`). Kayıtlı ses dosyası yoktur.
