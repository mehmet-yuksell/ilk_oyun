import { afterEach, describe, expect, it, vi } from 'vitest';
import { NoopSoundService, WebAudioSoundService } from './SoundService';

describe('WebAudioSoundService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('window/AudioContext yoksa (ör. Node ortamı) sessizce hiçbir şey yapmaz', () => {
    const sound = new WebAudioSoundService();
    expect(() => {
      sound.tap();
      sound.land();
      sound.complete();
      sound.invalid();
    }).not.toThrow();
  });

  it('AudioContext varsa osilatör oluşturup çalar', () => {
    const osc = { type: 'sine', frequency: { setValueAtTime: vi.fn() }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
    const gain = {
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    };
    const ctx = {
      currentTime: 0,
      state: 'running',
      resume: vi.fn(),
      createOscillator: vi.fn(() => osc),
      createGain: vi.fn(() => gain),
      destination: {},
    };
    function FakeAudioContext() {
      return ctx;
    }
    vi.stubGlobal('window', { AudioContext: FakeAudioContext });

    const sound = new WebAudioSoundService();
    sound.tap();

    expect(ctx.createOscillator).toHaveBeenCalledTimes(1);
    expect(osc.start).toHaveBeenCalledTimes(1);
    expect(osc.stop).toHaveBeenCalledTimes(1);
  });
});

describe('NoopSoundService', () => {
  it('hiçbir metodu çağırmak hata fırlatmaz', () => {
    const sound = new NoopSoundService();
    expect(() => {
      sound.tap();
      sound.land();
      sound.complete();
      sound.invalid();
    }).not.toThrow();
  });
});
