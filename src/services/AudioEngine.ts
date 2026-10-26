/**
 * Oyunun TEK ses bağlamı (AudioContext) + iki ayrı veriyolu (efekt / müzik). Eskiden her sahne kendi
 * AudioContext'ini açıyordu (tarayıcılar sayıyı sınırlar, mobilde pil yer). Ayrıca:
 *  - Mobil tarayıcı autoplay kısıtı: bağlam ilk kullanıcı dokunuşunda (pointerdown/touchend/keydown)
 *    açılır (resume). Açılınca bekleyen dinleyiciler (ör. müzik başlatma) çağrılır.
 *  - Uygulama arka plana gidince bağlam askıya alınır, dönünce sürdürülür (main.ts).
 * Harici ses dosyası YOK -- tüm sesler Web Audio ile üretilir (bkz. CREDITS.md).
 */

export interface AudioParamLike {
  value?: number;
  setValueAtTime: (v: number, t: number) => void;
  linearRampToValueAtTime?: (v: number, t: number) => void;
  exponentialRampToValueAtTime: (v: number, t: number) => void;
  cancelScheduledValues?: (t: number) => void;
}

export interface AudioContextLike {
  currentTime: number;
  state: string;
  resume: () => unknown;
  suspend?: () => unknown;
  createOscillator: () => {
    type: OscillatorType;
    frequency: AudioParamLike;
    detune?: AudioParamLike;
    connect: (dest: unknown) => unknown;
    start: (t?: number) => void;
    stop: (t?: number) => void;
  };
  createGain: () => { gain: AudioParamLike; connect: (dest: unknown) => unknown };
  createBiquadFilter: () => {
    type: BiquadFilterType;
    frequency: AudioParamLike;
    Q: AudioParamLike;
    connect: (dest: unknown) => unknown;
  };
  createDelay?: (max?: number) => { delayTime: AudioParamLike; connect: (dest: unknown) => unknown };
  destination: unknown;
}

type GainLike = ReturnType<AudioContextLike['createGain']>;

/** Varsayılan seviyeler: müzik bilerek düşük (arka planda, efektleri bastırmadan). */
export const DEFAULT_SFX_VOLUME = 0.9;
export const DEFAULT_MUSIC_VOLUME = 0.32;

export class AudioEngine {
  private ctx: AudioContextLike | null = null;
  private sfx: GainLike | null = null;
  private music: GainLike | null = null;
  private unlocked = false;
  private readonly unlockListeners: (() => void)[] = [];
  private readonly factory: () => AudioContextLike | null;

  constructor(factory?: () => AudioContextLike | null) {
    this.factory = factory ?? defaultFactory;
  }

  context(): AudioContextLike | null {
    if (this.ctx) return this.ctx;
    this.ctx = this.factory();
    if (!this.ctx) return null;
    this.sfx = this.ctx.createGain();
    this.sfx.gain.setValueAtTime(DEFAULT_SFX_VOLUME, 0);
    this.sfx.connect(this.ctx.destination);
    this.music = this.ctx.createGain();
    this.music.gain.setValueAtTime(DEFAULT_MUSIC_VOLUME, 0);
    this.music.connect(this.ctx.destination);
    return this.ctx;
  }

  /** Efekt seslerinin bağlanacağı veriyolu (yoksa doğrudan hoparlör). */
  sfxOutput(): unknown {
    this.context();
    return this.sfx ?? this.ctx?.destination;
  }

  musicOutput(): unknown {
    this.context();
    return this.music ?? this.ctx?.destination;
  }

  get isUnlocked(): boolean {
    return this.unlocked;
  }

  /** Kullanıcı dokunuşunun içinden çağrılmalı (autoplay kuralı). */
  unlock(): void {
    const ctx = this.context();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();
    if (this.unlocked) return;
    this.unlocked = true;
    for (const fn of this.unlockListeners.splice(0)) fn();
  }

  /** Kilit açılınca (veya zaten açıksa hemen) çağrılır. */
  onUnlock(fn: () => void): void {
    if (this.unlocked) fn();
    else this.unlockListeners.push(fn);
  }

  /** İlk dokunuşta kilidi açan belge dinleyicilerini kurar (bir kez). */
  installUnlock(target: Pick<Document, 'addEventListener' | 'removeEventListener'> = document): void {
    const events = ['pointerdown', 'touchend', 'keydown'] as const;
    const handler = () => {
      this.unlock();
      for (const e of events) target.removeEventListener(e, handler, true);
    };
    for (const e of events) target.addEventListener(e, handler, true);
  }

  /** Uygulama arka plana gidince / dönünce. */
  setSuspended(suspended: boolean): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (suspended) void ctx.suspend?.();
    else if (this.unlocked) void ctx.resume();
  }

  /** Müzik veriyolunu yumuşakça hedef seviyeye götürür (açma/kapama geçişi). */
  fadeMusic(to: number, seconds = 0.6): void {
    const ctx = this.context();
    if (!ctx || !this.music) return;
    const g = this.music.gain;
    const now = ctx.currentTime;
    g.cancelScheduledValues?.(now);
    g.setValueAtTime(Math.max(0.0001, g.value ?? DEFAULT_MUSIC_VOLUME), now);
    g.exponentialRampToValueAtTime(Math.max(0.0001, to), now + seconds);
  }
}

function defaultFactory(): AudioContextLike | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: new () => AudioContextLike; webkitAudioContext?: new () => AudioContextLike };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

/** Uygulama genelinde paylaşılan tek motor. */
export const audioEngine = new AudioEngine();
