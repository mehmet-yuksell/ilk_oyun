import { describe, expect, it, vi } from 'vitest';
import { AudioEngine, type AudioContextLike } from './AudioEngine';

function fakeContext(state = 'suspended') {
  const param = () => ({ value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() });
  const ctx = {
    currentTime: 0,
    state,
    resume: vi.fn(() => {
      ctx.state = 'running';
    }),
    suspend: vi.fn(),
    createOscillator: vi.fn(),
    createGain: vi.fn(() => ({ gain: param(), connect: vi.fn() })),
    createBiquadFilter: vi.fn(),
    destination: {},
  };
  return ctx;
}

describe('AudioEngine', () => {
  it('tek bir bağlam açar ve efekt/müzik için iki ayrı veriyolu kurar', () => {
    const ctx = fakeContext();
    const factory = vi.fn(() => ctx as unknown as AudioContextLike);
    const engine = new AudioEngine(factory);
    engine.context();
    engine.context();
    expect(factory).toHaveBeenCalledTimes(1);
    expect(ctx.createGain).toHaveBeenCalledTimes(2);
    expect(engine.sfxOutput()).not.toBe(engine.musicOutput());
  });

  it('kilit açılana kadar onUnlock dinleyicileri bekler, açılınca bir kez çalışır', () => {
    const ctx = fakeContext();
    const engine = new AudioEngine(() => ctx as unknown as AudioContextLike);
    const fn = vi.fn();
    engine.onUnlock(fn);
    expect(fn).not.toHaveBeenCalled();
    engine.unlock();
    expect(ctx.resume).toHaveBeenCalled();
    expect(fn).toHaveBeenCalledTimes(1);
    engine.unlock();
    expect(fn).toHaveBeenCalledTimes(1);
    // zaten açıksa hemen çağrılır
    const late = vi.fn();
    engine.onUnlock(late);
    expect(late).toHaveBeenCalledTimes(1);
  });

  it('installUnlock ilk dokunuşta kilidi açar ve dinleyicileri kaldırır', () => {
    const ctx = fakeContext();
    const engine = new AudioEngine(() => ctx as unknown as AudioContextLike);
    const handlers = new Map<string, () => void>();
    const target = {
      addEventListener: vi.fn((e: string, h: () => void) => handlers.set(e, h)),
      removeEventListener: vi.fn((e: string) => handlers.delete(e)),
    };
    engine.installUnlock(target as unknown as Document);
    expect(engine.isUnlocked).toBe(false);
    handlers.get('pointerdown')!();
    expect(engine.isUnlocked).toBe(true);
    expect(handlers.size).toBe(0);
  });

  it('AudioContext yoksa sessizce hiçbir şey yapmaz', () => {
    const engine = new AudioEngine(() => null);
    expect(() => {
      engine.unlock();
      engine.setSuspended(true);
      engine.fadeMusic(0.5);
    }).not.toThrow();
    expect(engine.context()).toBeNull();
  });

  it('arka plana gidince askıya alır, dönünce (kilit açıksa) sürdürür', () => {
    const ctx = fakeContext('running');
    const engine = new AudioEngine(() => ctx as unknown as AudioContextLike);
    engine.unlock();
    engine.setSuspended(true);
    expect(ctx.suspend).toHaveBeenCalled();
    ctx.resume.mockClear();
    engine.setSuspended(false);
    expect(ctx.resume).toHaveBeenCalled();
  });
});
