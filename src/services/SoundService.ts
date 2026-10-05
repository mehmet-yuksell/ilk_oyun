/**
 * Ses, ayrı bir katman ve ayarlardan kapatılabilir olmalı (çoğu oyuncu sessiz oynar).
 * Harici ses dosyası YOK -- Web Audio API ile basit, kısa osilatör "bip"leri üretilir.
 */
export interface SoundService {
  tap(): void;
  land(): void;
  complete(): void;
  invalid(): void;
}

type AudioContextLike = {
  currentTime: number;
  state: string;
  resume: () => void;
  createOscillator: () => OscillatorNodeLike;
  createGain: () => GainNodeLike;
  destination: unknown;
};
interface OscillatorNodeLike {
  type: OscillatorType;
  frequency: { setValueAtTime: (v: number, t: number) => void };
  connect: (dest: unknown) => unknown;
  start: (t?: number) => void;
  stop: (t?: number) => void;
}
interface GainNodeLike {
  gain: {
    setValueAtTime: (v: number, t: number) => void;
    exponentialRampToValueAtTime: (v: number, t: number) => void;
  };
  connect: (dest: unknown) => unknown;
}

export class WebAudioSoundService implements SoundService {
  private ctx: AudioContextLike | null = null;

  private getContext(): AudioContextLike | null {
    if (this.ctx) return this.ctx;
    const Ctor =
      typeof window !== 'undefined'
        ? ((window as unknown as { AudioContext?: new () => AudioContextLike }).AudioContext ??
          (window as unknown as { webkitAudioContext?: new () => AudioContextLike }).webkitAudioContext)
        : undefined;
    if (!Ctor) return null;
    this.ctx = new Ctor();
    return this.ctx;
  }

  private beep(freq: number, duration: number, type: OscillatorType = 'sine'): void {
    const ctx = this.getContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  tap(): void {
    this.beep(440, 0.05);
  }

  land(): void {
    this.beep(520, 0.08);
  }

  complete(): void {
    this.beep(660, 0.09);
    setTimeout(() => this.beep(880, 0.12), 70);
  }

  invalid(): void {
    this.beep(180, 0.12, 'square');
  }
}

export class NoopSoundService implements SoundService {
  tap(): void {}
  land(): void {}
  complete(): void {}
  invalid(): void {}
}
