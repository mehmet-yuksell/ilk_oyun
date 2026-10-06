/**
 * Ses, ayrı bir katman ve ayarlardan kapatılabilir olmalı (çoğu oyuncu sessiz oynar).
 * Harici ses dosyası YOK -- Web Audio API ile üretilir. Düz osilatör "bip"leri yerine
 * (eski tasarım) her ses artık bir osilatör + alçak/yüksek geçiren bir filtre (BiquadFilter) +
 * kısa bir gain zarfından oluşuyor: filtre tonu yumuşatıp doğal bir "ahşap tıkırtısı" (tap/land)
 * veya "cam çınlaması" (complete) hissi veriyor, çıplak bir osilatörün verdiği elektronik
 * "bip" yerine (bkz. Faz 7 kararları).
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
  createBiquadFilter: () => BiquadFilterNodeLike;
  destination: unknown;
};
interface OscillatorNodeLike {
  type: OscillatorType;
  frequency: { setValueAtTime: (v: number, t: number) => void; exponentialRampToValueAtTime: (v: number, t: number) => void };
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
interface BiquadFilterNodeLike {
  type: BiquadFilterType;
  frequency: { setValueAtTime: (v: number, t: number) => void };
  Q: { setValueAtTime: (v: number, t: number) => void };
  connect: (dest: unknown) => unknown;
}

/** Bir "nota": osilatör tipi/frekansı, filtre tipi/kesim frekansı/Q'su, zarf (gain) süresi ve
 * tepe seviyesi -- her çağrı site bu parametreleri değiştirerek farklı bir "malzeme" taklit eder. */
interface ToneSpec {
  readonly oscType: OscillatorType;
  readonly freq: number;
  /** Verilirse frekans bu hedefe doğru hızla kayar (fiziksel bir vuruşun perde düşüşü hissi). */
  readonly freqGlideTo?: number;
  readonly filterType: BiquadFilterType;
  readonly filterFreq: number;
  readonly filterQ: number;
  readonly peakGain: number;
  readonly duration: number;
  readonly delaySec?: number;
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

  private playTone(spec: ToneSpec): void {
    const ctx = this.getContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const startAt = ctx.currentTime + (spec.delaySec ?? 0);

    const osc = ctx.createOscillator();
    osc.type = spec.oscType;
    osc.frequency.setValueAtTime(spec.freq, startAt);
    if (spec.freqGlideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(spec.freqGlideTo, startAt + spec.duration);
    }

    const filter = ctx.createBiquadFilter();
    filter.type = spec.filterType;
    filter.frequency.setValueAtTime(spec.filterFreq, startAt);
    filter.Q.setValueAtTime(spec.filterQ, startAt);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(spec.peakGain, startAt);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + spec.duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startAt);
    osc.stop(startAt + spec.duration);
  }

  /** Ahşap benzeri kısa bir "tık": ılık bir üçgen dalga, alçak geçiren filtreyle yumuşatılmış,
   * hafif aşağı perde kayması (fiziksel bir vuruşun hissi) + hızlı sönüm. */
  tap(): void {
    this.playTone({
      oscType: 'triangle',
      freq: 520,
      freqGlideTo: 360,
      filterType: 'lowpass',
      filterFreq: 1400,
      filterQ: 0.7,
      peakGain: 0.09,
      duration: 0.06,
    });
  }

  land(): void {
    this.playTone({
      oscType: 'triangle',
      freq: 600,
      freqGlideTo: 400,
      filterType: 'lowpass',
      filterFreq: 1600,
      filterQ: 0.7,
      peakGain: 0.1,
      duration: 0.08,
    });
  }

  /** Cam benzeri bir "çın": yüksek, temiz bir sinüs + bant geçiren filtreyle parlaklık +
   * daha uzun bir sönüm (çınlama hissi); ikinci, biraz daha tiz bir nota kısa bir gecikmeyle
   * üstüne eklenir ("ding-ding"). */
  complete(): void {
    this.playTone({
      oscType: 'sine',
      freq: 1046,
      filterType: 'bandpass',
      filterFreq: 1400,
      filterQ: 1.1,
      peakGain: 0.08,
      duration: 0.18,
    });
    this.playTone({
      oscType: 'sine',
      freq: 1318,
      filterType: 'bandpass',
      filterFreq: 1700,
      filterQ: 1.1,
      peakGain: 0.07,
      duration: 0.22,
      delaySec: 0.07,
    });
  }

  /** Donuk, kısık bir "hayır" sesi: düşük frekans + dar alçak geçiren filtre -- eski keskin
   * kare-dalga "bip" yerine yumuşak/rahatsız etmeyen bir uyarı. */
  invalid(): void {
    this.playTone({
      oscType: 'triangle',
      freq: 220,
      freqGlideTo: 160,
      filterType: 'lowpass',
      filterFreq: 420,
      filterQ: 0.6,
      peakGain: 0.08,
      duration: 0.12,
    });
  }
}

export class NoopSoundService implements SoundService {
  tap(): void {}
  land(): void {}
  complete(): void {}
  invalid(): void {}
}
