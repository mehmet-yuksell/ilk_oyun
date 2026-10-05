/**
 * Tüm animasyon/efekt süreleri ve büyüklükleri burada toplanır -- telefonda oynarken
 * "oyun hissini" ayarlamak için başka hiçbir dosyaya bakmaya gerek kalmasın diye.
 * Süreler ms, mesafeler piksel cinsindendir.
 */
export const JUICE = {
  /** Bir kap seçilince üst run'ın yukarı kalkma animasyonu. */
  select: {
    liftDistance: 10,
    duration: 120,
  },
  /** Taşıma sırasında eşyaların kaynaktan hedefe yay çizerek gitmesi. */
  move: {
    duration: 260,
    arcHeight: 60,
  },
  /** Yerleşme anındaki squash & stretch sıçraması. */
  land: {
    duration: 160,
    squashScaleX: 1.18,
    squashScaleY: 0.82,
  },
  /** Bir kap tamamlanınca: parçacık patlaması + kamera titremesi. */
  completion: {
    particleCount: 10,
    particleDuration: 420,
    particleSpeedMin: 60,
    particleSpeedMax: 140,
    cameraShakeDuration: 140,
    cameraShakeIntensity: 0.006,
  },
  /** Geçersiz hamlede hedefin kırmızı flaşı. */
  invalid: {
    duration: 250,
  },
  /** Kilit açılma parıltısı. */
  unlock: {
    duration: 450,
  },
  /** Art arda tamamlamalarda combo metni. */
  combo: {
    displayDuration: 700,
    riseDistance: 40,
    minComboToShow: 2,
  },
  /** Kap tamamlanınca eşyaların küçük yıldızlara dönüşüp üstteki sayaca uçması. */
  starFly: {
    starCount: 4,
    duration: 520,
    arcHeight: 90,
    staggerMs: 50,
  },
  /** Boştaki eşyaların hafif "nefes alma" pulsasyonu. */
  idle: {
    scaleAmount: 0.035,
    duration: 1400,
  },
  /** İlk seviyede el animasyonlu dokunmatik öğretici. */
  tutorialHand: {
    pressDuration: 220,
    travelDuration: 500,
    holdDuration: 260,
    cycleGapMs: 500,
  },
} as const;
