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

  function makeFakeAudioContext() {
    const osc = {
      type: 'sine',
      frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    const gain = {
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    };
    const filter = {
      type: 'lowpass',
      frequency: { setValueAtTime: vi.fn() },
      Q: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
    };
    const ctx = {
      currentTime: 0,
      state: 'running',
      resume: vi.fn(),
      createOscillator: vi.fn(() => osc),
      createGain: vi.fn(() => gain),
      createBiquadFilter: vi.fn(() => filter),
      destination: {},
    };
    return { ctx, osc, gain, filter };
  }

  it('AudioContext varsa osilatör + filtre oluşturup çalar (tap: ahşap tıkırtısı)', () => {
    const { ctx, osc, filter, gain } = makeFakeAudioContext();
    vi.stubGlobal('window', { AudioContext: function FakeAudioContext() { return ctx; } });

    const sound = new WebAudioSoundService();
    sound.tap();

    expect(ctx.createOscillator).toHaveBeenCalledTimes(1);
    expect(ctx.createBiquadFilter).toHaveBeenCalledTimes(1);
    expect(osc.start).toHaveBeenCalledTimes(1);
    expect(osc.stop).toHaveBeenCalledTimes(1);
    // Osilatör -> filtre -> gain -> hoparlör zinciri (filtrelenmemiş çıplak bir "bip" değil).
    expect(osc.connect).toHaveBeenCalledWith(filter);
    expect(filter.connect).toHaveBeenCalledWith(gain);
  });

  it('complete() iki ayrı (biraz gecikmeli) nota çalar -- "ding-ding" çınlaması', () => {
    const { ctx } = makeFakeAudioContext();
    vi.stubGlobal('window', { AudioContext: function FakeAudioContext() { return ctx; } });

    const sound = new WebAudioSoundService();
    sound.complete();

    expect(ctx.createOscillator).toHaveBeenCalledTimes(2);
    expect(ctx.createBiquadFilter).toHaveBeenCalledTimes(2);
  });

  it('her ses türü farklı bir filtre tipi/frekansı kullanır (tap/land ahşap=lowpass, complete cam=bandpass)', () => {
    const tapCtx = makeFakeAudioContext();
    vi.stubGlobal('window', { AudioContext: function FakeAudioContext() { return tapCtx.ctx; } });
    new WebAudioSoundService().tap();
    expect(tapCtx.filter.type).toBe('lowpass');

    vi.unstubAllGlobals();
    const completeCtx = makeFakeAudioContext();
    vi.stubGlobal('window', { AudioContext: function FakeAudioContext() { return completeCtx.ctx; } });
    new WebAudioSoundService().complete();
    expect(completeCtx.filter.type).toBe('bandpass');
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
