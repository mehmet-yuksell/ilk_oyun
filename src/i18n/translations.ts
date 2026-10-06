export type Language = 'tr' | 'en';

export const translations = {
  appTitle: { tr: 'Cozy Sort', en: 'Cozy Sort' },
  moveLabel: { tr: 'Hamle', en: 'Moves' },
  remainingItemsLabel: { tr: 'Kalan eşya', en: 'Items left' },
  undoButton: { tr: 'Geri Al', en: 'Undo' },
  extraContainerButton: { tr: 'Ekstra Kap ({remaining})', en: 'Extra Bin ({remaining})' },
  stuckBanner: { tr: 'Hamle kalmadı — Geri Al ya da Ekstra Kap dene!', en: 'No moves left — try Undo or an Extra Bin!' },
  backToRoom: { tr: 'Oda', en: 'Room' },
  levelCompleteWithStars: { tr: 'Seviye tamamlandı! +{stars} yıldız', en: 'Level complete! +{stars} stars' },
  levelCompleteNoStars: { tr: 'Seviye tamamlandı!', en: 'Level complete!' },
  dailyPuzzleCompleteWithStars: { tr: 'Günlük bulmaca bitti! +{stars} yıldız', en: 'Daily puzzle complete! +{stars} stars' },
  dailyPuzzleLabel: { tr: 'Günlük Bulmaca', en: 'Daily Puzzle' },
  levelLabel: { tr: 'Seviye {n}', en: 'Level {n}' },
  demoLevelLabel: { tr: 'Örnek seviye', en: 'Sample level' },
  generatedLevelLabel: { tr: 'Üretilmiş seviye #{n}', en: 'Generated level #{n}' },
  lockedContainerNote: { tr: ', kilitli kap var', en: ', has a locked bin' },
  comboLabel: { tr: 'Combo x{n}!', en: 'Combo x{n}!' },
  comboText2: { tr: 'Harika!', en: 'Great!' },
  comboText3: { tr: 'Müthiş!', en: 'Awesome!' },
  comboText4Plus: { tr: 'Muhteşem!', en: 'Amazing!' },
  nextLevelButton: { tr: 'Sonraki Seviye', en: 'Next Level' },
  levelLostTitle: { tr: 'Hamle Hakkın Bitti', en: 'Out of Moves' },
  levelLostBody: {
    tr: '{limit} hamle içinde tamamlanamadı ama sorun değil — tekrar deneyebilirsin.',
    en: "Couldn't finish within {limit} moves — no worries, give it another try.",
  },
  retryButton: { tr: 'Tekrar Dene', en: 'Try Again' },
  backToRoomButton: { tr: 'Odaya Dön', en: 'Back to Room' },
  starsEarnedLabel: { tr: '+{stars} yıldız', en: '+{stars} stars' },
  hintMysteryTitle: { tr: 'Gizemli eşya', en: 'Mystery item' },
  hintMysteryBody: {
    tr: 'Yüzü kapalı eşyalar yalnızca kabın en üstüne gelince açılır.',
    en: 'Hidden items only reveal their face once they reach the top of a bin.',
  },
  hintLockTitle: { tr: 'Kilitli kap', en: 'Locked bin' },
  hintLockBody: {
    tr: 'Asma kilitli kap, işaret ettiği kap tamamen boşalınca açılır.',
    en: 'A padlocked bin unlocks once the bin it depends on is fully emptied.',
  },
  hintTypeLockTitle: { tr: 'Tek türlü kap', en: 'Type-locked bin' },
  hintTypeLockBody: {
    tr: 'Renkli işaretli kap yalnızca o türden eşyaları kabul eder.',
    en: 'A color-marked bin only accepts items of that matching type.',
  },
  roomCounterLabel: { tr: 'Oda {current}/{total}', en: 'Room {current}/{total}' },
  itemsRestoredLabel: { tr: '{restored}/{total} öğe yenilendi', en: '{restored}/{total} items restored' },
  playButton: { tr: 'OYNA', en: 'PLAY' },
  dailyRewardButton: { tr: 'Günlük Ödül', en: 'Daily Reward' },
  dailyRewardClaimed: { tr: 'Alındı', en: 'Claimed' },
  dailyPuzzleButton: { tr: 'Günlük Bulmaca', en: 'Daily Puzzle' },
  chooseStyleTitle: { tr: '{item} için stil seç', en: 'Choose a style for {item}' },
  styleA: { tr: 'Stil A', en: 'Style A' },
  styleB: { tr: 'Stil B', en: 'Style B' },
  cancel: { tr: 'Vazgeç', en: 'Cancel' },
  restoredLabel: { tr: 'Yenilendi', en: 'Restored' },
  roomCompleteTitle: { tr: '{room} tamamlandı!', en: '{room} complete!' },
  roomCompleteSubtitle: { tr: 'Tüm eşyalar yenilendi.', en: 'Every item has been restored.' },
  allRoomsCompleteNote: { tr: 'Tüm odalar tamamlandı! Yeni odalar yakında.', en: 'All rooms complete! New rooms coming soon.' },
  continueButton: { tr: 'Devam Et', en: 'Continue' },
  settingsButton: { tr: 'Ayarlar', en: 'Settings' },
  settingsTitle: { tr: 'Ayarlar', en: 'Settings' },
  languageLabel: { tr: 'Dil', en: 'Language' },
  soundLabel: { tr: 'Ses', en: 'Sound' },
  hapticLabel: { tr: 'Titreşim', en: 'Haptics' },
  onLabel: { tr: 'Açık', en: 'On' },
  offLabel: { tr: 'Kapalı', en: 'Off' },
  closeButton: { tr: 'Kapat', en: 'Close' },
} as const;

export type TranslationKey = keyof typeof translations;

export function t(key: TranslationKey, lang: Language, params?: Readonly<Record<string, string | number>>): string {
  let text: string = translations[key][lang];
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replace(`{${name}}`, String(value));
    }
  }
  return text;
}
