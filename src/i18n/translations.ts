export type Language = 'tr' | 'en';

export const translations = {
  appTitle: { tr: 'Cozy Sort', en: 'Cozy Sort' },
  moveLabel: { tr: 'Hamle', en: 'Moves' },
  remainingItemsLabel: { tr: 'Kalan eşya', en: 'Items left' },
  undoButton: { tr: 'Geri Al', en: 'Undo' },
  extraContainerButton: { tr: 'Ekstra Kap ({remaining})', en: 'Extra Bin ({remaining})' },
  stuckBanner: { tr: 'Hamle kalmadı — Geri Al ya da Ekstra Kap dene', en: 'No moves left — try Undo or an Extra Bin' },
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
  ratingTitle3: { tr: 'Mükemmel!', en: 'Perfect!' },
  ratingTitle2: { tr: 'Harika!', en: 'Great job!' },
  ratingTitle1: { tr: 'Tamamlandı!', en: 'Complete!' },
  statsMoves: { tr: 'Hamle', en: 'Moves' },
  statsTime: { tr: 'Süre', en: 'Time' },
  starsEarnedCaption: { tr: 'kazanılan yıldız', en: 'stars earned' },
  replayNote: { tr: 'Tekrar oynandı — en iyi skorun kaydedildi', en: 'Replayed — your best score is saved' },
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
  soundLabel: { tr: 'Ses efektleri', en: 'Sound effects' },
  musicLabel: { tr: 'Müzik', en: 'Music' },
  hapticLabel: { tr: 'Titreşim', en: 'Haptics' },
  onLabel: { tr: 'Açık', en: 'On' },
  offLabel: { tr: 'Kapalı', en: 'Off' },
  closeButton: { tr: 'Kapat', en: 'Close' },
  achievementsTitle: { tr: 'Başarımlar', en: 'Achievements' },
  achievementUnlocked: { tr: 'Başarım açıldı!', en: 'Achievement unlocked!' },
  achBonus: { tr: '+{n} yıldız', en: '+{n} stars' },
  achFirstWinTitle: { tr: 'İlk Adım', en: 'First Step' },
  achFirstWinDesc: { tr: 'İlk seviyeyi tamamla', en: 'Complete your first level' },
  achLevel10Title: { tr: 'Isınma Turu', en: 'Warming Up' },
  achLevel25Title: { tr: 'Düzen Ustası', en: 'Tidy Expert' },
  achLevel50Title: { tr: 'Raf Bilgesi', en: 'Shelf Sage' },
  achLevel100Title: { tr: 'Efsane Düzenci', en: 'Legendary Sorter' },
  achLevelsDesc: { tr: '{n} seviye tamamla', en: 'Complete {n} levels' },
  achPerfectTitle: { tr: 'Kusursuz', en: 'Flawless' },
  achPerfectDesc: { tr: '10 seviyeyi 3 yıldızla bitir', en: 'Finish 10 levels with 3 stars' },
  achStarsTitle: { tr: 'Yıldız Avcısı', en: 'Star Collector' },
  achStarsDesc: { tr: 'Toplam 100 seviye yıldızı topla', en: 'Collect 100 level stars' },
  achRestoreTitle: { tr: 'Tadilatçı', en: 'Renovator' },
  achRestoreDesc: { tr: '5 eşyayı yenile', en: 'Restore 5 items' },
  achRoomTitle: { tr: 'Yuva Gibi', en: 'Home Sweet Home' },
  achRoomDesc: { tr: 'Bir odayı tamamen yenile', en: 'Fully restore a room' },
  achStreak3Title: { tr: 'Sadık Ziyaretçi', en: 'Regular Visitor' },
  achStreak7Title: { tr: 'Bir Haftalık Seri', en: 'Week Streak' },
  achStreakDesc: { tr: '{n} gün üst üste uğra', en: 'Visit {n} days in a row' },
  dailyStreakTitle: { tr: 'Günlük Seri', en: 'Daily Streak' },
  dailyDay: { tr: 'Gün {n}', en: 'Day {n}' },
  dailyClaimButton: { tr: 'Ödülü Al', en: 'Claim' },
  dailyComeBack: { tr: 'Yarın gel: +{n} yıldız', en: 'Come back tomorrow: +{n} stars' },
  dailyStreakNote: { tr: 'Her gün uğra, ödül büyüsün. Bir gün kaçırırsan seri baştan başlar.', en: 'Visit daily and the reward grows. Miss a day and the streak restarts.' },
  newChapter: { tr: 'Yeni bölüm', en: 'New chapter' },
  levelsButton: { tr: 'Seviyeler', en: 'Levels' },
  levelSelectTitle: { tr: 'Seviyeler', en: 'Levels' },
  chapter0: { tr: 'Şeftali Sabahı', en: 'Peach Morning' },
  chapter1: { tr: 'Adaçayı Bahçesi', en: 'Sage Garden' },
  chapter2: { tr: 'Lavanta Akşamı', en: 'Lavender Dusk' },
  chapter3: { tr: 'Bal Rengi İkindi', en: 'Honey Afternoon' },
  chapter4: { tr: 'Puslu Mavi', en: 'Misty Blue' },
  chapterRange: { tr: 'Seviye {from}–{to}', en: 'Levels {from}–{to}' },
  room_oturma_odasi: { tr: 'Oturma Odası', en: 'Living Room' },
  room_mutfak: { tr: 'Mutfak', en: 'Kitchen' },
  room_yatak_odasi: { tr: 'Yatak Odası', en: 'Bedroom' },
  room_cocuk_odasi: { tr: 'Çocuk Odası', en: "Kids' Room" },
  room_calisma_odasi: { tr: 'Çalışma Odası', en: 'Study' },
  room_banyo: { tr: 'Banyo', en: 'Bathroom' },
  room_yemek_odasi: { tr: 'Yemek Odası', en: 'Dining Room' },
  room_balkon: { tr: 'Balkon', en: 'Balcony' },
  room_antre: { tr: 'Antre', en: 'Entryway' },
  room_misafir_odasi: { tr: 'Misafir Odası', en: 'Guest Room' },
  settingsSoundSection: { tr: 'Ses ve titreşim', en: 'Sound & haptics' },
  settingsGeneralSection: { tr: 'Genel', en: 'General' },
  versionLabel: { tr: 'Sürüm {v}', en: 'Version {v}' },
  doneButton: { tr: 'Tamam', en: 'Done' },
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

/** Oda adı (core/roomDefs yalnızca Türkçe ad taşır -- çeviri burada, oda kimliğinden). */
export function roomName(roomId: string, fallback: string, lang: Language): string {
  const key = `room_${roomId.replace(/-/g, '_')}` as TranslationKey;
  return key in translations ? t(key, lang) : fallback;
}

/** Oda eşyası adlarının İngilizcesi (core/roomDefs yalnızca Türkçe etiket taşır). */
const ITEM_LABEL_EN: Readonly<Record<string, string>> = {
  Anahtarlık: 'Key Holder', Askılık: 'Coat Rack', Avize: 'Chandelier', Ayakkabılık: 'Shoe Rack', Aydınlatma: 'Lighting',
  Ayna: 'Mirror', 'Bahçe Masası': 'Garden Table', 'Bahçe Sandalyesi': 'Garden Chair', Buzdolabı: 'Fridge', Büfe: 'Sideboard',
  Dolap: 'Cupboard', 'Dosya Dolabı': 'File Cabinet', 'Duvar Fayansı': 'Wall Tiles', 'Duvar Rengi': 'Wall Paint',
  'Duvar Çıkartması': 'Wall Decal', Duş: 'Shower', Fayans: 'Tiles', Fener: 'Lantern', Gardırop: 'Wardrobe', Güneşlik: 'Sunshade',
  Halı: 'Rug', Havlu: 'Towels', Karyola: 'Bed Frame', Kitaplık: 'Bookcase', Koltuk: 'Armchair', Komodin: 'Nightstand',
  Konsol: 'Console Table', 'Korkuluk Süsü': 'Railing Decor', Küvet: 'Bathtub', Lamba: 'Lamp', Lavabo: 'Sink',
  'Masa Örtüsü': 'Tablecloth', Masa: 'Table', Minder: 'Floor Cushion', Musluk: 'Faucet', Nevresim: 'Bedding',
  'Oyuncak Dolabı': 'Toy Cabinet', 'Oyuncak Kutusu': 'Toy Box', Pano: 'Pinboard', Paspas: 'Doormat', Perde: 'Curtains',
  Raf: 'Shelf', 'Resim Çerçevesi': 'Picture Frame', Resim: 'Painting', 'Saksı Bitki': 'Potted Plant', Salıncak: 'Swing Chair',
  Sandalye: 'Chair', Sehpa: 'Coffee Table', 'TV Ünitesi': 'TV Stand', Tezgah: 'Countertop', Vitrin: 'Display Cabinet',
  Yatak: 'Bed', 'Yemek Masası': 'Dining Table', 'Çalışma Masası': 'Desk', 'Çimen Halısı': 'Grass Rug', 'Şemsiye Standı': 'Umbrella Stand',
};

export function itemLabel(label: string, lang: Language): string {
  return lang === 'en' ? ITEM_LABEL_EN[label] ?? label : label;
}
