import { mulberry32 } from '../core/rng';
import { DEFAULT_MUSIC_VOLUME, audioEngine, type AudioContextLike, type AudioEngine } from './AudioEngine';

/**
 * Prosedürel, sakin, döngüsel arka plan müziği -- dosya yok, lisans sorunu yok (bkz. CREDITS.md).
 *
 * 72 BPM, 8 ölçülük döngü (Cmaj7 – Am7 – Fmaj7 – G6, her akor 2 ölçü):
 *  - pad: akor notaları, hafif detune'lu üçgen dalgalar, alçak geçiren filtre, yavaş atak/bırakma
 *  - tıngırtı melodi: C majör pentatonik, SABİT tohumla üretilir (her döngü aynı -- "şarkı" hissi),
 *    kısa yankı (delay) ile
 *  - bas: akor kökü, 1. ve 3. vuruşta yumuşak sinüs
 * Zamanlama "lookahead" ile: her 120 ms'de bir sonraki ~0.6 sn'deki notalar AudioContext saatine göre
 * planlanır (setTimeout titremesi ritmi bozmaz).
 */

const BPM = 72;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const LOOP_BARS = 8;
const LOOKAHEAD_SEC = 0.6;
const TICK_MS = 120;

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

interface Chord {
  readonly root: number;
  readonly notes: readonly number[];
}

// MIDI numaraları: C4=60
const CHORDS: readonly Chord[] = [
  { root: 48, notes: [60, 64, 67, 71] }, // Cmaj7
  { root: 45, notes: [57, 60, 64, 67] }, // Am7
  { root: 41, notes: [57, 60, 65, 69] }, // Fmaj7
  { root: 43, notes: [55, 59, 62, 64] }, // G6
];
const PENTATONIC = [72, 74, 76, 79, 81, 84]; // C5 D5 E5 G5 A5 C6

interface MelodyNote {
  readonly bar: number;
  readonly eighth: number;
  readonly note: number;
}

/** Deterministik melodi: her ölçüde 2-4 nota, küçük adımlarla gezinen bir "rastgele yürüyüş". */
export function buildMelody(seed = 20241026): MelodyNote[] {
  const rng = mulberry32(seed);
  const out: MelodyNote[] = [];
  let idx = 2;
  for (let bar = 0; bar < LOOP_BARS; bar++) {
    const count = 2 + Math.floor(rng() * 3);
    const slots = new Set<number>();
    while (slots.size < count) slots.add(Math.floor(rng() * 8));
    for (const eighth of [...slots].sort((a, b) => a - b)) {
      idx = Math.max(0, Math.min(PENTATONIC.length - 1, idx + Math.floor(rng() * 3) - 1));
      out.push({ bar, eighth, note: PENTATONIC[idx] });
    }
  }
  return out;
}

export interface MusicService {
  setEnabled(enabled: boolean): void;
  readonly enabled: boolean;
}

export class ProceduralMusicService implements MusicService {
  private readonly engine: AudioEngine;
  private readonly melody = buildMelody();
  private timer: ReturnType<typeof setInterval> | null = null;
  private loopStart = 0;
  /** Bir sonraki planlanacak olay zamanı (döngü başından saniye, sürekli artar). */
  private cursor = 0;
  private wantEnabled = false;
  private echoIn: unknown = null;

  constructor(engine: AudioEngine) {
    this.engine = engine;
  }

  get enabled(): boolean {
    return this.wantEnabled;
  }

  setEnabled(enabled: boolean): void {
    this.wantEnabled = enabled;
    if (enabled) {
      this.engine.onUnlock(() => {
        if (this.wantEnabled) this.start();
      });
    } else {
      this.stop();
    }
  }

  private start(): void {
    const ctx = this.engine.context();
    if (!ctx || this.timer) return;
    this.engine.fadeMusic(DEFAULT_MUSIC_VOLUME, 1.5);
    this.ensureEcho(ctx);
    this.loopStart = ctx.currentTime + 0.1;
    this.cursor = 0;
    this.timer = setInterval(() => this.schedule(), TICK_MS);
    this.schedule();
  }

  private stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    this.engine.fadeMusic(0.0001, 0.6);
  }

  /** Melodi için tek, paylaşılan geri beslemeli yankı (her notaya ayrı delay açmamak için). */
  private ensureEcho(ctx: AudioContextLike): void {
    if (this.echoIn || !ctx.createDelay) return;
    const input = ctx.createGain();
    input.gain.setValueAtTime(1, 0);
    const delay = ctx.createDelay(1);
    delay.delayTime.setValueAtTime(BEAT * 0.75, 0);
    const feedback = ctx.createGain();
    feedback.gain.setValueAtTime(0.32, 0);
    const wet = ctx.createGain();
    wet.gain.setValueAtTime(0.4, 0);
    input.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(this.engine.musicOutput());
    this.echoIn = input;
  }

  private schedule(): void {
    const ctx = this.engine.context();
    if (!ctx) return;
    // Bağlam askıdaysa (arka plan) saat ilerlemez -- yeni nota birikmez.
    const horizon = ctx.currentTime - this.loopStart + LOOKAHEAD_SEC;
    const loopLen = BAR * LOOP_BARS;
    // Planlama 1/8 nota adımlarıyla ilerler.
    const step = BEAT / 2;
    while (this.cursor < horizon) {
      const t = this.cursor;
      const inLoop = t % loopLen;
      const bar = Math.floor(inLoop / BAR + 1e-6);
      const eighth = Math.round((inLoop - bar * BAR) / step);
      const at = this.loopStart + t;
      if (at >= ctx.currentTime - 0.01) this.playStep(ctx, at, bar, eighth);
      this.cursor += step;
    }
  }

  private playStep(ctx: AudioContextLike, at: number, bar: number, eighth: number): void {
    const chord = CHORDS[Math.floor(bar / 2) % CHORDS.length];
    // Pad: her akorun başında (çift ölçünün ilk vuruşu), 2 ölçü boyunca
    if (bar % 2 === 0 && eighth === 0) {
      for (const n of chord.notes) {
        for (const detune of [-5, 5]) this.voice(ctx, at, midi(n), 'triangle', 0.026, BAR * 2, 1.1, 1.4, 900, detune);
      }
    }
    // Bas: 1. ve 3. vuruş
    if (eighth === 0 || eighth === 4) this.voice(ctx, at, midi(chord.root), 'sine', 0.07, BEAT * 1.6, 0.02, 0.9, 400);
    // Melodi
    for (const m of this.melody) {
      if (m.bar === bar && m.eighth === eighth) this.voice(ctx, at, midi(m.note), 'sine', 0.05, 0.9, 0.006, 0.8, 2600, 0, true);
    }
  }

  private voice(
    ctx: AudioContextLike,
    at: number,
    freq: number,
    type: OscillatorType,
    peak: number,
    hold: number,
    attack: number,
    release: number,
    cutoff: number,
    detune = 0,
    echo = false,
  ): void {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (detune && osc.detune) osc.detune.setValueAtTime(detune, at);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, at);
    filter.Q.setValueAtTime(0.5, at);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + attack);
    const end = at + Math.max(attack + 0.05, hold);
    gain.gain.exponentialRampToValueAtTime(0.0001, end + release);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.engine.musicOutput());
    if (echo && this.echoIn) gain.connect(this.echoIn);
    osc.start(at);
    osc.stop(end + release + 0.05);
  }
}

/** Uygulama genelinde tek müzik çalar (sahneler arası kesintisiz). */
export const music = new ProceduralMusicService(audioEngine);
