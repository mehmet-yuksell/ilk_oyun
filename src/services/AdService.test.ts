import { describe, expect, it } from 'vitest';
import { DEFAULT_AD_FREQUENCY, MockAdService, shouldShowInterstitial } from './AdService';

describe('shouldShowInterstitial', () => {
  it('ilk 8 seviyede asla true dönmez', () => {
    for (let n = 1; n <= 8; n++) {
      expect(shouldShowInterstitial(n)).toBe(false);
    }
  });

  it('serbest bölgeden sonra her 4 seviyede bir true döner', () => {
    expect(shouldShowInterstitial(9)).toBe(false);
    expect(shouldShowInterstitial(10)).toBe(false);
    expect(shouldShowInterstitial(11)).toBe(false);
    expect(shouldShowInterstitial(12)).toBe(true); // 8 + 4
    expect(shouldShowInterstitial(16)).toBe(true); // 8 + 8
    expect(shouldShowInterstitial(20)).toBe(true); // 8 + 12
  });

  it('config özelleştirilebilir (A/B test)', () => {
    const aggressive = { interstitialFreeLevels: 2, interstitialEveryNLevels: 1 };
    expect(shouldShowInterstitial(1, aggressive)).toBe(false);
    expect(shouldShowInterstitial(2, aggressive)).toBe(false);
    expect(shouldShowInterstitial(3, aggressive)).toBe(true);
    expect(shouldShowInterstitial(4, aggressive)).toBe(true);
  });

  it('varsayılan config dışa aktarılmıştır ve tutarlıdır', () => {
    expect(DEFAULT_AD_FREQUENCY.interstitialFreeLevels).toBe(8);
    expect(DEFAULT_AD_FREQUENCY.interstitialEveryNLevels).toBe(4);
  });
});

describe('MockAdService', () => {
  it('showRewarded her zaman true döner', async () => {
    const ads = new MockAdService();
    expect(await ads.showRewarded('extra-container')).toBe(true);
    expect(await ads.showRewarded('double-stars')).toBe(true);
    expect(await ads.showRewarded('double-daily-reward')).toBe(true);
  });

  it('showInterstitial hatasız çözümlenir', async () => {
    const ads = new MockAdService();
    await expect(ads.showInterstitial()).resolves.toBeUndefined();
  });
});
