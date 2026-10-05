export type RewardedPlacement = 'extra-container' | 'double-stars' | 'double-daily-reward';

export interface AdService {
  /** true = reklam izlendi, ödül verilebilir. false = iptal edildi/başarısız. */
  showRewarded(placement: RewardedPlacement): Promise<boolean>;
  showInterstitial(): Promise<void>;
}

export interface AdFrequencyConfig {
  /** Bu numaraya kadar olan seviyelerde ASLA geçiş reklamı gösterilmez. */
  readonly interstitialFreeLevels: number;
  /** Serbest bölgeden sonra her N seviyede bir geçiş reklamı gösterilir. */
  readonly interstitialEveryNLevels: number;
}

/** Varsayılan sıklık: ilk 8 seviyede asla, sonra her 4 seviyede bir (A/B test için kolayca değiştirilebilir). */
export const DEFAULT_AD_FREQUENCY: AdFrequencyConfig = {
  interstitialFreeLevels: 8,
  interstitialEveryNLevels: 4,
};

/** Saf fonksiyon: az önce tamamlanan seviye numarasına göre geçiş reklamı gösterilmeli mi? */
export function shouldShowInterstitial(
  completedLevelNumber: number,
  config: AdFrequencyConfig = DEFAULT_AD_FREQUENCY,
): boolean {
  if (completedLevelNumber <= config.interstitialFreeLevels) return false;
  const beyondFreeZone = completedLevelNumber - config.interstitialFreeLevels;
  return beyondFreeZone % config.interstitialEveryNLevels === 0;
}

/** Gerçek SDK yok: kısa bir gecikmeyle her zaman "izlendi" döner. UI katmanı mock olduğunu gösterir. */
export class MockAdService implements AdService {
  async showRewarded(_placement: RewardedPlacement): Promise<boolean> {
    await delay(150);
    return true;
  }

  async showInterstitial(): Promise<void> {
    await delay(150);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
