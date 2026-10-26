/**
 * TEK AYAR DOSYASI -- zorluk sayıları, konfeti miktarı ve animasyon süreleri burada toplanır.
 * Oyunun "hissini" telefonda oynarken ayarlamak için başka hiçbir dosyaya dokunmaya gerek
 * kalmasın diye: diğer dosyalar (juiceConfig.ts, difficultyCurve.ts, confetti.ts) buradaki
 * sabitleri içe aktarıp kullanır.
 *
 * Renk paleti ve oda temaları Faz 1'de tasarım sistemine (src/scenes/theme.ts) taşındı; eski
 * içe aktarmalar kırılmasın diye buradan yeniden dışa aktarılır.
 */

export {
  ITEM_ACCENTS,
  PALETTE,
  ROOM_THEMES,
  THEME_CHANGE_EVERY_LEVELS,
  themeForLevel,
  themeIndexForLevel,
  type RoomTheme,
} from '../scenes/theme';

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
   * sayısı) + bir pay. Zorlukla orantılı ÇARPAN yok -- seviye zorlaştıkça sertifika uzunluğu
   * zaten kendiliğinden büyür, limit de onunla birlikte büyür. Taban pay (newPlayerTaperEndLevel'den
   * sonra geçerli) kasıtlı olarak sıkı tutulur ki seviye gerçekten kaybedilebilsin -- bkz. moveLimitFor
   * (difficultyCurve.ts), bu değeri newPlayer* ayarlarıyla birlikte kullanır. */
  moveLimitBonus: 3,
  /** Yeni oyuncu rahatlığı: ilk N seviyede (dahil) hamle payı moveLimitBonus yerine bu geniş
   * değeri kullanır (bkz. Faz 6 -- "ilk 15 seviyede daha rahat"). */
  newPlayerWideBonusUntilLevel: 15,
  newPlayerWideBonus: 9,
  /** Geniş paydan taban moveLimitBonus'a doğrusal daralmanın TAMAMLANACAĞI seviye -- bu seviyeden
   * itibaren tekrar taban (sıkı) pay geçerli olur. */
  newPlayerTaperEndLevel: 40,

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
  /** Seviye tamamlanınca toplam parça sayısı (köşe topları + üst yağmur dahil) -- "abartılı"
   * bulunup azaltıldı (bkz. Faz 4 kararları). */
  defaultParticleCount: 90,
  /** prefers-reduced-motion açıkken kullanılan azaltılmış miktar. */
  reducedMotionParticleCount: 28,
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
    liftDistance: 16,
    duration: 200,
  },
  /** Taşıma sırasında eşyaların kaynaktan hedefe yay çizerek gitmesi -- kısa/yumuşak olsun diye
   * süre ve yay yüksekliği azaltıldı (bkz. Faz 4 kararları). */
  move: {
    duration: 300,
    arcHeight: 48,
    /** Run'daki eşyalar arasındaki kalkış gecikmesi (her eşya ayrı uçar -- Faz 2). */
    staggerMs: 55,
    /** Uçuşun ortasında dikey esneme miktarı (squash & stretch'in "stretch" yarısı). */
    stretch: 0.12,
  },
  /** Yerleşme anındaki squash & stretch sıçraması -- "aşırı zıplama" bulunup yumuşatıldı. */
  land: {
    duration: 260,
    squashScaleX: 1.14,
    squashScaleY: 0.86,
  },
  /** Bir kap tamamlanınca: parçacık patlaması + kamera titremesi (daha ince). */
  completion: {
    particleCount: 10,
    particleDuration: 380,
    particleSpeedMin: 60,
    particleSpeedMax: 140,
    cameraShakeDuration: 110,
    cameraShakeIntensity: 0.004,
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

