import { describe, expect, it } from 'vitest';
import { canClaimDailyReward, claimDailyReward, todayKey } from './dailyReward';

describe('todayKey', () => {
  it('YYYY-MM-DD formatında üretir', () => {
    expect(todayKey(new Date(2026, 2, 5))).toBe('2026-03-05'); // ay 0-indeksli (Mart)
  });

  it('tek haneli ay/günü sıfırla doldurur', () => {
    expect(todayKey(new Date(2026, 0, 9))).toBe('2026-01-09');
  });
});

describe('canClaimDailyReward', () => {
  it('hiç talep edilmemişse true döner', () => {
    expect(canClaimDailyReward({ lastClaimedDate: null, streak: 0 }, '2026-03-05')).toBe(true);
  });

  it('bugün zaten talep edildiyse false döner', () => {
    expect(canClaimDailyReward({ lastClaimedDate: '2026-03-05', streak: 1 }, '2026-03-05')).toBe(false);
  });

  it('farklı bir günse true döner', () => {
    expect(canClaimDailyReward({ lastClaimedDate: '2026-03-04', streak: 1 }, '2026-03-05')).toBe(true);
  });
});

describe('claimDailyReward', () => {
  it('ilk talepte streak 1 olur ve temel ödül verilir', () => {
    const result = claimDailyReward({ lastClaimedDate: null, streak: 0 }, '2026-03-05', 20);
    expect(result.claimed).toBe(true);
    expect(result.state).toEqual({ lastClaimedDate: '2026-03-05', streak: 1 });
    expect(result.starsAwarded).toBe(20);
  });

  it('ardışık günde streak artar ve bonus eklenir', () => {
    const result = claimDailyReward({ lastClaimedDate: '2026-03-04', streak: 3 }, '2026-03-05', 20);
    expect(result.claimed).toBe(true);
    expect(result.state.streak).toBe(4);
    expect(result.starsAwarded).toBe(20 + 3 * 5); // (streak-1)*5 bonus
  });

  it('bir gün atlanırsa streak 1\'e sıfırlanır', () => {
    const result = claimDailyReward({ lastClaimedDate: '2026-03-01', streak: 5 }, '2026-03-05', 20);
    expect(result.claimed).toBe(true);
    expect(result.state.streak).toBe(1);
    expect(result.starsAwarded).toBe(20);
  });

  it('bugün zaten talep edilmişse hiçbir şey değişmez', () => {
    const before = { lastClaimedDate: '2026-03-05', streak: 2 };
    const result = claimDailyReward(before, '2026-03-05', 20);
    expect(result.claimed).toBe(false);
    expect(result.state).toEqual(before);
    expect(result.starsAwarded).toBe(0);
  });
});
