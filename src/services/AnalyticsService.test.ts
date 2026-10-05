import { describe, expect, it, vi } from 'vitest';
import { ConsoleAnalyticsService } from './AnalyticsService';

describe('ConsoleAnalyticsService', () => {
  it('her olayı console.log üzerinden, ismiyle birlikte yazar', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const analytics = new ConsoleAnalyticsService();

    analytics.track({ name: 'session_start' });
    analytics.track({ name: 'level_start', levelNumber: 5, mode: 'progress' });
    analytics.track({ name: 'level_win', levelNumber: 5, durationMs: 1200, moveCount: 10, undoCount: 1 });
    analytics.track({ name: 'room_item_restored', roomId: 'oturma-odasi', itemId: 'oturma-odasi-0', styleIndex: 1 });

    expect(spy).toHaveBeenCalledTimes(4);
    expect(spy.mock.calls[0][0]).toContain('session_start');
    expect(spy.mock.calls[1][0]).toContain('level_start');

    spy.mockRestore();
  });
});
