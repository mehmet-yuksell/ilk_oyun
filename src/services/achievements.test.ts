import { describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/preferences', () => ({ Preferences: { get: vi.fn(), set: vi.fn().mockResolvedValue(undefined) } }));

const { createDefaultSaveData, migrateSaveData } = await import('./SaveService');
const { ACHIEVEMENTS, ACHIEVEMENT_BONUS_STARS, achievementProgress, applyAchievements } = await import('./achievements');

describe('başarımlar', () => {
  it('yeni oyuncuda hiçbir başarım açılmaz', () => {
    const r = applyAchievements(createDefaultSaveData());
    expect(r.unlocked).toEqual([]);
    expect(r.data.stars).toBe(0);
  });

  it('ilk seviye geçilince "İlk Adım" açılır, bonus bir kez verilir', () => {
    const d = { ...createDefaultSaveData(), currentLevel: 2 };
    const first = applyAchievements(d);
    expect(first.unlocked.map((a) => a.id)).toEqual(['first-win']);
    expect(first.data.stars).toBe(ACHIEVEMENT_BONUS_STARS);
    const second = applyAchievements(first.data);
    expect(second.unlocked).toEqual([]);
    expect(second.data).toBe(first.data);
  });

  it('birden çok hedef aynı anda açılabilir (ör. 26. seviyeye gelen eski kayıt)', () => {
    const d = { ...createDefaultSaveData(), currentLevel: 26 };
    const ids = applyAchievements(d).unlocked.map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(['first-win', 'level-10', 'level-25']));
    expect(ids).not.toContain('level-50');
  });

  it('mükemmel seviye ve seri başarımları kayıttan türetilir', () => {
    const levelStars: Record<string, number> = {};
    for (let i = 1; i <= 10; i++) levelStars[String(i)] = 3;
    const d = { ...createDefaultSaveData(), currentLevel: 11, levelStars, dailyReward: { lastClaimedDate: '2026-10-26', streak: 3 } };
    const ids = applyAchievements(d).unlocked.map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(['perfect-10', 'streak-3']));
    expect(ids).not.toContain('streak-7');
  });

  it('ilerleme hedefle sınırlanır, açılmış başarım "tamam" sayılır', () => {
    const def = ACHIEVEMENTS.find((a) => a.id === 'level-10')!;
    expect(achievementProgress(def, { ...createDefaultSaveData(), currentLevel: 4 })).toEqual({ value: 3, done: false });
    expect(achievementProgress(def, { ...createDefaultSaveData(), currentLevel: 40 }).value).toBe(10);
  });

  it('eski kayıtta achievements alanı yoksa / bozuksa boş dizi olur', () => {
    expect(migrateSaveData({ stars: 3 }).achievements).toEqual([]);
    expect(migrateSaveData({ achievements: 'bozuk' }).achievements).toEqual([]);
  });

  it('tüm kimlikler benzersiz', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });
});
