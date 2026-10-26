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

describe('WebAudioSoundService (Faz 4 sesleri)', () => {
  it('yeni sesler (yıldız, kazanma, buton, kilit) AudioContext yoksa hata fırlatmaz', () => {
    const sound = new WebAudioSoundService();
    expect(() => {
      sound.star(0);
      sound.star(5);
      sound.win();
      sound.button();
      sound.unlock();
    }).not.toThrow();
  });

  it('paylaşılan motor verilirse efektler motorun efekt veriyoluna bağlanır', async () => {
    const { AudioEngine } = await import('./AudioEngine');
    const param = () => ({ setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
    const gains: { connect: ReturnType<typeof vi.fn> }[] = [];
    const ctx = {
      currentTime: 0,
      state: 'running',
      resume: vi.fn(),
      createOscillator: vi.fn(() => ({ type: 'sine', frequency: param(), connect: vi.fn(), start: vi.fn(), stop: vi.fn() })),
      createGain: vi.fn(() => {
        const g = { gain: param(), connect: vi.fn() };
        gains.push(g);
        return g;
      }),
      createBiquadFilter: vi.fn(() => ({ type: 'lowpass', frequency: param(), Q: param(), connect: vi.fn() })),
      destination: {},
    };
    const engine = new AudioEngine(() => ctx as never);
    const sound = new WebAudioSoundService(engine);
    sound.tap();
    const sfxBus = gains[0];
    const toneGain = gains[gains.length - 1];
    expect(toneGain.connect).toHaveBeenCalledWith(sfxBus);
  });

  it('art arda inişler hafif farklı perdede çalar (robotik tekrar yok)', () => {
    const freqs: number[] = [];
    const param = () => ({ setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
    const ctx = {
      currentTime: 0,
      state: 'running',
      resume: vi.fn(),
      createOscillator: vi.fn(() => ({
        type: 'sine',
        frequency: { setValueAtTime: (v: number) => freqs.push(v), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      })),
      createGain: vi.fn(() => ({ gain: param(), connect: vi.fn() })),
      createBiquadFilter: vi.fn(() => ({ type: 'lowpass', frequency: param(), Q: param(), connect: vi.fn() })),
      destination: {},
    };
    vi.stubGlobal('window', { AudioContext: function FakeAudioContext() { return ctx; } });
    let r = 0;
    const sound = new WebAudioSoundService(null, () => (r = (r + 0.37) % 1));
    sound.land();
    sound.land();
    expect(freqs[0]).not.toBe(freqs[1]);
    vi.unstubAllGlobals();
  });
});
