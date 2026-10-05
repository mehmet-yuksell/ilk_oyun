export interface DailyRewardState {
  readonly lastClaimedDate: string | null; // "YYYY-MM-DD"
  readonly streak: number;
}

export function todayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dateKeyMinusOneDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - 1);
  return todayKey(date);
}

export function canClaimDailyReward(state: DailyRewardState, today: string): boolean {
  return state.lastClaimedDate !== today;
}

export interface ClaimResult {
  readonly claimed: boolean;
  readonly state: DailyRewardState;
  readonly starsAwarded: number;
}

/** Saf fonksiyon: bugün için ödül talep edilmemişse claim eder, streak'i günceller. */
export function claimDailyReward(state: DailyRewardState, today: string, baseReward: number): ClaimResult {
  if (!canClaimDailyReward(state, today)) {
    return { claimed: false, state, starsAwarded: 0 };
  }

  const isConsecutive = state.lastClaimedDate === dateKeyMinusOneDay(today);
  const streak = isConsecutive ? state.streak + 1 : 1;
  const starsAwarded = baseReward + (streak - 1) * 5; // ardışık günlerde küçük bir bonus

  return {
    claimed: true,
    state: { lastClaimedDate: today, streak },
    starsAwarded,
  };
}
