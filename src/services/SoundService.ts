import type { AudioContextLike, AudioEngine } from './AudioEngine';

/**
 * Ses efektleri -- ayrı bir katman, Ayarlar'dan (efekt) ayrıca kapatılabilir (müzikten bağımsız).
 * Harici ses dosyası YOK -- Web Audio API ile üretilir. Her ses bir osilatör + filtre (BiquadFilter) +
 * kısa bir gain zarfı: filtre tonu yumuşatıp doğal bir "ahşap tıkırtısı" (tap/land), "cam çınlaması"
 * (complete) ya da "çan" (star/win) hissi verir -- çıplak elektronik "bip" yerine.
 *
 * Faz 4: üretimde tüm efektler paylaşılan AudioEngine'in efekt veriyoluna bağlanır (tek AudioContext).
 * Motor verilmezse (testler) kendi bağlamını açıp doğrudan hoparlöre bağlanır.
 */
export interface SoundService {
  /** Kap seçimi */
  tap(): void;
  /** Eşya rafa iner */
  land(): void;
  /** Bir grup tamamlandı */
  complete(): void;
  /** Geçersiz hamle (nazik "hayır") */
  invalid(): void;
  /** Kazanma panelinde n. yıldız (0..2) -- her biri bir üst nota */
  star(index: number): void;
  /** Seviye kazanıldı */
  win(): void;
  /** UI butonu */
  button(): void;
  /** Kilit açıldı */
  unlock(): void;
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
  /** Atak süresi (sn) -- 0 ise anında tepe (vuruş), >0 ise yumuşak giriş (çan/pad). */
  readonly attack?: number;
}

/** Nota adlarından frekans (A4 = 440). */
const NOTE: Record<string, number> = {
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  G5: 783.99,
  A5: 880.0,
  C6: 1046.5,
  E6: 1318.51,
  G6: 1567.98,
};

export class WebAudioSoundService implements SoundService {
  private ctx: AudioContextLike | null = null;
  private readonly engine: AudioEngine | null;
  private readonly random: () => number;

  constructor(engine: AudioEngine | null = null, random: () => number = Math.random) {
    this.engine = engine;
    this.random = random;
  }

  private getContext(): AudioContextLike | null {
    if (this.engine) return this.engine.context();
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
    if (ctx.state === 'suspended') void ctx.resume();

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
    const attack = spec.attack ?? 0;
    if (attack > 0) {
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(spec.peakGain, startAt + attack);
    } else {
      gain.gain.setValueAtTime(spec.peakGain, startAt);
    }
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + spec.duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.engine ? this.engine.sfxOutput() : ctx.destination);
    osc.start(startAt);
    osc.stop(startAt + spec.duration + 0.02);
  }

  /** Tekrarlanan seslerin robotik duyulmaması için ±%4'lük perde oynaması. */
  private vary(freq: number, amount = 0.04): number {
    return freq * (1 + (this.random() * 2 - 1) * amount);
  }

  /** Ahşap benzeri kısa bir "tık": ılık bir üçgen dalga, alçak geçiren filtreyle yumuşatılmış,
   * hafif aşağı perde kayması (fiziksel bir vuruşun hissi) + hızlı sönüm. */
  tap(): void {
    const f = this.vary(560, 0.02);
    this.playTone({
      oscType: 'triangle',
      freq: f,
      freqGlideTo: f * 0.68,
      filterType: 'lowpass',
      filterFreq: 1500,
      filterQ: 0.7,
      peakGain: 0.11,
      duration: 0.07,
    });
  }

  /** Eşya rafa iner: tap'ten biraz daha dolgun ve alçak bir "tok" -- her inişte hafif farklı perde. */
  land(): void {
    const f = this.vary(430);
    this.playTone({
      oscType: 'triangle',
      freq: f,
      freqGlideTo: f * 0.62,
      filterType: 'lowpass',
      filterFreq: 1300,
      filterQ: 0.9,
      peakGain: 0.13,
      duration: 0.11,
    });
  }

  /** Cam benzeri bir "çın": yüksek, temiz bir sinüs + bant geçiren filtreyle parlaklık +
   * daha uzun bir sönüm (çınlama hissi); ikinci, bir üçlü yukarı nota kısa bir gecikmeyle
   * üstüne eklenir ("ding-ding"). */
  complete(): void {
    this.playTone({
      oscType: 'sine',
      freq: NOTE.C6,
      filterType: 'bandpass',
      filterFreq: 1500,
      filterQ: 1.0,
      peakGain: 0.12,
      duration: 0.32,
      attack: 0.004,
    });
    this.playTone({
      oscType: 'sine',
      freq: NOTE.E6,
      filterType: 'bandpass',
      filterFreq: 1800,
      filterQ: 1.0,
      peakGain: 0.1,
      duration: 0.42,
      delaySec: 0.08,
      attack: 0.004,
    });
  }

  /** Nazik "hayır": iki kısa, inen, kısık nota ("ıh-ıh") -- sert bir uyarı sesi değil. */
  invalid(): void {
    this.playTone({ oscType: 'triangle', freq: 330, freqGlideTo: 300, filterType: 'lowpass', filterFreq: 650, filterQ: 0.6, peakGain: 0.1, duration: 0.09 });
    this.playTone({ oscType: 'triangle', freq: 262, freqGlideTo: 230, filterType: 'lowpass', filterFreq: 600, filterQ: 0.6, peakGain: 0.09, duration: 0.12, delaySec: 0.11 });
  }

  /** Küçük çan: temel sinüs + yumuşak bir oktav üst harmonik, uzun sönüm. */
  private bell(freq: number, delaySec = 0, peak = 0.1, duration = 0.7): void {
    this.playTone({ oscType: 'sine', freq, filterType: 'lowpass', filterFreq: 5000, filterQ: 0.5, peakGain: peak, duration, delaySec, attack: 0.005 });
    this.playTone({ oscType: 'sine', freq: freq * 2, filterType: 'lowpass', filterFreq: 6000, filterQ: 0.5, peakGain: peak * 0.25, duration: duration * 0.5, delaySec, attack: 0.003 });
  }

  star(index: number): void {
    const notes = [NOTE.E5, NOTE.G5, NOTE.C6];
    this.bell(notes[Math.max(0, Math.min(2, index))], 0, 0.11, 0.8);
  }

  /** Kazanma: yükselen yumuşak çan arpeji (C-E-G-C) + altta tek bir sıcak taban notası. */
  win(): void {
    [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((f, i) => this.bell(f, i * 0.09, 0.09, 0.9));
    this.playTone({ oscType: 'triangle', freq: 261.63, filterType: 'lowpass', filterFreq: 900, filterQ: 0.5, peakGain: 0.08, duration: 1.2, attack: 0.03 });
  }

  /** UI butonu: kısa, yumuşak bir "tık" (tap'ten tiz ve kısa). */
  button(): void {
    this.playTone({ oscType: 'triangle', freq: 760, freqGlideTo: 520, filterType: 'lowpass', filterFreq: 2200, filterQ: 0.7, peakGain: 0.08, duration: 0.05 });
  }

  /** Kilit açıldı: iki yükselen kısa çan. */
  unlock(): void {
    this.bell(NOTE.G5, 0, 0.08, 0.45);
    this.bell(NOTE.D5 * 2, 0.07, 0.07, 0.5);
  }
}

export class NoopSoundService implements SoundService {
  tap(): void {}
  land(): void {}
  complete(): void {}
  invalid(): void {}
  star(): void {}
  win(): void {}
  button(): void {}
  unlock(): void {}
}
