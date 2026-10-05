/**
 * Titreşim geri bildirimi için arayüz. Tarayıcıda Web Vibration API ile, Capacitor
 * paketlemesinde (Faz 6) yerel bir haptics eklentisiyle değiştirilebilir -- GameScene
 * hiçbir zaman navigator.vibrate'i doğrudan çağırmaz.
 */
export interface HapticService {
  light(): void;
  medium(): void;
  success(): void;
  warning(): void;
}

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
