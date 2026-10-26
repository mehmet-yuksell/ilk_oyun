import { afterEach, describe, expect, it, vi } from 'vitest';
import { CapacitorHapticService, NoopHapticService, WebVibrationHapticService, createHapticService } from './HapticService';

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

describe('CapacitorHapticService', () => {
  const makeBackend = () => {
    const calls: string[] = [];
    return {
      calls,
      backend: {
        impact: async (style: 'light' | 'medium') => {
          calls.push(`impact:${style}`);
        },
        notification: async (type: 'success' | 'warning') => {
          calls.push(`notify:${type}`);
        },
      },
    };
  };

  it('her seviyeyi doğru eklenti çağrısına eşler', () => {
    const { calls, backend } = makeBackend();
    let t = 0;
    const haptic = new CapacitorHapticService(backend, 35, () => (t += 100));
    haptic.light();
    haptic.medium();
    haptic.success();
    haptic.warning();
    expect(calls).toEqual(['impact:light', 'impact:medium', 'notify:success', 'notify:warning']);
  });

  it('çok hızlı art arda hafif darbeleri seyreltir ama bildirimleri asla atlamaz', () => {
    const { calls, backend } = makeBackend();
    const haptic = new CapacitorHapticService(backend, 35, () => 1000);
    haptic.light();
    haptic.light();
    haptic.success();
    expect(calls).toEqual(['impact:light', 'notify:success']);
  });

  it('eklenti reddederse hata fırlatmaz', async () => {
    const haptic = new CapacitorHapticService(
      { impact: () => Promise.reject(new Error('yok')), notification: () => Promise.reject(new Error('yok')) },
      0,
    );
    expect(() => haptic.light()).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
  });
});

describe('createHapticService', () => {
  it('web\'de sessiz (Noop), native\'de Capacitor uygulaması döner', () => {
    expect(createHapticService(false)).toBeInstanceOf(NoopHapticService);
    expect(createHapticService(true)).toBeInstanceOf(CapacitorHapticService);
  });
});
