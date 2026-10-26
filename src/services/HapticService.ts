import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/**
 * Titreşim geri bildirimi için arayüz -- sahneler hiçbir zaman eklentiyi doğrudan çağırmaz.
 * Varsayılan (createHapticService): native platformda (Android) @capacitor/haptics, web'de sessiz
 * (Noop) -- web'de navigator.vibrate tarayıcıdan tarayıcıya tutarsız ve masaüstünde anlamsız.
 * Kullanıcı Ayarlar'dan kapatabilir (SaveData.hapticEnabled, sahnelerin feedback() kapısı).
 */
export interface HapticService {
  light(): void;
  medium(): void;
  success(): void;
  warning(): void;
}

/** @capacitor/haptics'in kullandığımız kısmı -- testte sahtesi verilir. */
export interface HapticsBackend {
  impact(style: 'light' | 'medium'): Promise<void>;
  notification(type: 'success' | 'warning'): Promise<void>;
}

const capacitorBackend: HapticsBackend = {
  impact: (style) => Haptics.impact({ style: style === 'light' ? ImpactStyle.Light : ImpactStyle.Medium }),
  notification: (type) => Haptics.notification({ type: type === 'success' ? NotificationType.Success : NotificationType.Warning }),
};

export class CapacitorHapticService implements HapticService {
  private readonly backend: HapticsBackend;
  /** Art arda çok hızlı dokunuşlarda motoru boğmamak için en kısa aralık (ms). */
  private readonly minIntervalMs: number;
  private lastAt = -Infinity;
  private readonly now: () => number;

  constructor(backend: HapticsBackend = capacitorBackend, minIntervalMs = 35, now: () => number = () => Date.now()) {
    this.backend = backend;
    this.minIntervalMs = minIntervalMs;
    this.now = now;
  }

  private fire(call: () => Promise<void>, force = false): void {
    const t = this.now();
    if (!force && t - this.lastAt < this.minIntervalMs) return;
    this.lastAt = t;
    // Eklenti yoksa / reddederse sessizce yok say -- titreşim hiçbir akışı bozmamalı.
    call().catch(() => {});
  }

  light(): void {
    this.fire(() => this.backend.impact('light'));
  }

  medium(): void {
    this.fire(() => this.backend.impact('medium'));
  }

  success(): void {
    this.fire(() => this.backend.notification('success'), true);
  }

  warning(): void {
    this.fire(() => this.backend.notification('warning'), true);
  }
}

/** Eski web uygulaması (tarayıcı Vibration API) -- artık varsayılan değil, testler/gerektiğinde kullanım için duruyor. */
export class WebVibrationHapticService implements HapticService {
  private vibrate(pattern: number | number[]): void {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  }

  light(): void {
    this.vibrate(10);
  }

  medium(): void {
    this.vibrate(20);
  }

  success(): void {
    this.vibrate([15, 40, 25]);
  }

  warning(): void {
    this.vibrate([10, 30, 10, 30]);
  }
}

export class NoopHapticService implements HapticService {
  light(): void {}
  medium(): void {}
  success(): void {}
  warning(): void {}
}

/** Native'de Capacitor Haptics, web'de sessiz. */
export function createHapticService(isNative: boolean = Capacitor.isNativePlatform()): HapticService {
  return isNative ? new CapacitorHapticService() : new NoopHapticService();
}
