import { afterEach, describe, expect, it, vi } from 'vitest';
import { NoopHapticService, WebVibrationHapticService } from './HapticService';

describe('WebVibrationHapticService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('navigator.vibrate destekleniyorsa her seviye için çağırır', () => {
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { vibrate });

    const haptic = new WebVibrationHapticService();
    haptic.light();
    haptic.medium();
    haptic.success();
    haptic.warning();

    expect(vibrate).toHaveBeenCalledTimes(4);
  });

  it('navigator.vibrate yoksa sessizce hiçbir şey yapmaz (hata fırlatmaz)', () => {
    vi.stubGlobal('navigator', {});
    const haptic = new WebVibrationHapticService();
    expect(() => haptic.light()).not.toThrow();
  });
});

describe('NoopHapticService', () => {
  it('hiçbir metodu çağırmak hata fırlatmaz', () => {
    const haptic = new NoopHapticService();
    expect(() => {
      haptic.light();
      haptic.medium();
      haptic.success();
      haptic.warning();
    }).not.toThrow();
  });
});
