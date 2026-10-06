/**
 * TEK AYAR DOSYASI -- zorluk sayıları, renk paleti, konfeti miktarı ve animasyon süreleri
 * burada toplanır. Oyunun "hissini" telefonda oynarken ayarlamak için başka hiçbir dosyaya
 * dokunmaya gerek kalmasın diye: tüm diğer dosyalar (theme.ts, juiceConfig.ts,
 * difficultyCurve.ts, confetti.ts) buradaki sabitleri içe aktarıp kullanır.
 */

// ---------------------------------------------------------------------
// RENK PALETİ
// ---------------------------------------------------------------------

export interface RoomTheme {
  readonly bgTop: string;
  readonly bgBottom: string;
}

/**
 * Her 10 seviyede bir sırayla değişen canlı, doygun degrade arkaplan temaları. Her iki durak da
 * (üst/alt) DOYGUN tutulur -- üstte soluk/pastel bir ton YOK, aksi halde arkaplan "soluk" okunur.
 */
export const ROOM_THEMES: readonly RoomTheme[] = [
  { bgTop: '#FF8C4A', bgBottom: '#FF3B52' }, // doygun turuncu-şeftali -> doygun mercan-kırmızı
  { bgTop: '#1FE0C2', bgBottom: '#1D6FE0' }, // doygun turkuaz -> doygun mavi
  { bgTop: '#C158FF', bgBottom: '#FF2E95' }, // doygun mor -> doygun pembe
  { bgTop: '#F5D91A', bgBottom: '#FF8A1C' }, // doygun limon -> doygun turuncu
  { bgTop: '#2FE070', bgBottom: '#0FADA0' }, // doygun çimen yeşili -> doygun turkuaz-yeşil
] as const;

/** Tema her THEME_CHANGE_EVERY_LEVELS seviyede bir döner (seviye 1-10 -> tema 0, 11-20 -> tema 1, ...). */
export const THEME_CHANGE_EVERY_LEVELS = 10;

export function themeIndexForLevel(levelNumber: number): number {
  const n = Math.max(1, Math.floor(levelNumber));
  return Math.floor((n - 1) / THEME_CHANGE_EVERY_LEVELS) % ROOM_THEMES.length;
}

export function themeForLevel(levelNumber: number): RoomTheme {
  return ROOM_THEMES[themeIndexForLevel(levelNumber)];
}

/** Doygun vurgu paleti -- en az 10 renk, metin/ikon kontrastı güçlü koyu mor-lacivert ile birlikte. */
export const PALETTE = {
  ink: '#352455', // koyu mor-lacivert -- ana metin
  inkSoft: '#6E5A8C', // ikincil metin
  cream: '#FFFBF5', // koyu zeminde metin

  surface: '#FFFFFF',
  surfaceMuted: '#E6DFEE',

  coral: '#FF5A5F',
  turquoise: '#1FD1C4',
  mustard: '#FFD23F',
  purple: '#8E5BFF',
  green: '#3DDC84',
  pink: '#FF6FB5',
  sky: '#3BA7FF',
  amber: '#FF9F1C',
  maroon: '#D7263D',
  navy: '#3A56D4',

  gold: '#FFC94A',
  success: '#2FBE6B',
  danger: '#E8415A',
} as const;

/** 10 eşya türü için sırayla kullanılan doygun aksan renkleri (ITEM_TYPE_POOL sırasıyla eşleşir). */
export const ITEM_ACCENTS: readonly string[] = [
  PALETTE.coral,
  PALETTE.turquoise,
  PALETTE.mustard,
  PALETTE.purple,
  PALETTE.green,
  PALETTE.pink,
  PALETTE.sky,
  PALETTE.amber,
  PALETTE.maroon,
  PALETTE.navy,
];

// ---------------------------------------------------------------------
// ZORLUK
// ---------------------------------------------------------------------

export interface DifficultyRangeRule {
  /** Bu seviyeye kadar (dahil) geçerli; son kuralın maxLevel'i Infinity'dir. */
  readonly maxLevel: number;
  readonly itemTypeRange: readonly [number, number];
  readonly emptyContainerRange: readonly [number, number];
}

export const DIFFICULTY = {
  capacity: 4,
  baseSeed: 20240101,
  /** Her N seviyede bir "nefes seviyesi": önceki seviyeden belirgin biçimde daha kolay. */
  breatherEvery: 5,

  /** Seviye aralıkları -- tür sayısı ve boş kap sayısı buradan, seviye numarasına göre deterministik seçilir. */
  ranges: [
    { maxLevel: 5, itemTypeRange: [3, 3], emptyContainerRange: [2, 2] },
    { maxLevel: 15, itemTypeRange: [4, 5], emptyContainerRange: [2, 2] },
    { maxLevel: 35, itemTypeRange: [5, 6], emptyContainerRange: [2, 2] },
    { maxLevel: 70, itemTypeRange: [6, 7], emptyContainerRange: [1, 2] },
    { maxLevel: Infinity, itemTypeRange: [7, 8], emptyContainerRange: [1, 2] },
  ] as readonly DifficultyRangeRule[],
  /** Hamle limiti = sertifika uzunluğu (o seviyeyi gerçekten çözmek için kanıtlanmış gereken hamle
   * sayısı) + bu sabit pay. Zorlukla orantılı çarpan YOK -- seviye zorlaştıkça sertifika uzunluğu
   * zaten kendiliğinden büyür, limit de onunla birlikte büyür. Pay sadece 1-2 yanlışı (hamle+geri
   * al) tolere etmeye yeter; bu kasıtlı olarak sıkı tutulur ki seviye gerçekten kaybedilebilsin. */
  moveLimitBonus: 3,

  obstacles: {
    /** Gizemli eşya (yalnızca kabın en üstündeyken yüzü açılır) bu seviyeden itibaren görülebilir. */
    mysteryStartLevel: 12,
    /** Kilitli kap (başka bir kap boşalınca açılır) bu seviyeden itibaren görülebilir. */
    lockStartLevel: 30,
    /** Tek türlü kap (yalnızca belirli bir türü kabul eder) bu seviyeden itibaren görülebilir. */
    typeLockStartLevel: 50,
    /** Bu seviyeden sonra bir seviyede en fazla 2 engel türü birlikte bulunabilir (öncesinde en fazla 1). */
    maxSimultaneousAfterLevel: 50,
  },

  /** "+ Ekstra Kap" seviye başına verilen ücretsiz hak sayısı (reklam/satın alma katmanı yok --
   * bkz. GameScene.onAddExtraContainer). Kalan hak sayısı butonun üzerinde gösterilir. */
  extraContainerFreeUsesPerLevel: 1,

  /** Karıştırma derinliği: shuffleDepthMinFactor -> shuffleDepthMaxFactor arası, shuffleDepthRampLevels seviyede tırmanır. */
  shuffleDepthMinFactor: 1.5,
  shuffleDepthMaxFactor: 4.5,
  shuffleDepthRampLevels: 400,
  /** Nefes seviyelerinde karıştırma derinliği bu çarpanla azaltılır. */
  breatherShuffleFactor: 0.7,

  /**
   * Oyun içi (canlı) par hesaplaması için BFS durum bütçesi. Telefon performansı için düşük
   * tutulur -- bütçe yetmezse (çoğunlukla ileri seviyelerde) par, doğrulanmış sertifika
   * uzunluğuna düşer (gerçek ama muhtemelen optimal olmayan bir çözüm -- bkz. levelGenerator.ts).
   */
  livePaSolverMaxStates: 30_000,
} as const;

// ---------------------------------------------------------------------
// KONFETİ
// ---------------------------------------------------------------------

export const CONFETTI = {
  /** Seviye tamamlanınca toplam parça sayısı (köşe topları + üst yağmur dahil). */
  defaultParticleCount: 150,
  /** prefers-reduced-motion açıkken kullanılan azaltılmış miktar. */
  reducedMotionParticleCount: 36,
  shapes: ['rect', 'circle', 'star', 'ribbon'] as const,
  fallDurationMinMs: 1100,
  fallDurationMaxMs: 1900,
  spinDegPerSecMin: 180,
  spinDegPerSecMax: 540,
  /** Toplam parçanın bu oranı iki alt köşeden "top" gibi fırlar; kalanı üstten yağmur gibi düşer. */
  cannonShare: 0.45,
  /** Nesne havuzu boyutu (object pool) -- art arda patlamalarda yeni nesne oluşturmamak için. */
  poolSize: 220,
} as const;

export type ConfettiShape = (typeof CONFETTI.shapes)[number];

// ---------------------------------------------------------------------
// ANİMASYON SÜRELERİ (JUICE) -- süreler ms, mesafeler piksel cinsindendir.
// ---------------------------------------------------------------------

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
    durationMin: 1200,
    durationMax: 1900,
  },
  /** Rastgele göz kırpma (karakter yüzleri). */
  blink: {
    everyMsMin: 2200,
    everyMsMax: 4500,
    closeDuration: 70,
    holdDuration: 60,
    openDuration: 90,
  },
  /** Bir karakter seçilince "heyecan": gözler büyür + küçük zıplama. */
  excited: {
    duration: 180,
    eyeScale: 1.35,
    hopHeight: 6,
  },
  /** İlk seviyede el animasyonlu dokunmatik öğretici. */
  tutorialHand: {
    pressDuration: 220,
    travelDuration: 500,
    holdDuration: 260,
    cycleGapMs: 500,
  },
  /** Seviye bitiş panelinde yıldızların sırayla belirmesi + sayaç sayma hızı -- "zarif ve kısa"
   * olması için stagger/süre kısa tutulur (bkz. Faz 3 kararları). */
  levelCompletePanel: {
    starPopStaggerMs: 110,
    starPopDuration: 220,
    counterDurationMs: 520,
    panelInDuration: 220,
  },
  /** Kap tamamlanınca hafif ekran titremesi + combo metni eşiği (completion ile paylaşılır). */
  screenShake: {
    duration: 120,
    intensity: 0.004,
  },
} as const;

