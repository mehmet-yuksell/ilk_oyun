export type AnalyticsEvent =
  | { readonly name: 'session_start' }
  | { readonly name: 'level_start'; readonly levelNumber: number; readonly mode: string }
  | {
      readonly name: 'level_win';
      readonly levelNumber: number;
      readonly durationMs: number;
      readonly moveCount: number;
      readonly undoCount: number;
    }
  | { readonly name: 'level_stuck'; readonly levelNumber: number }
  | {
      readonly name: 'level_lost';
      readonly levelNumber: number;
      readonly moveCount: number;
      readonly undoCount: number;
      readonly moveLimit: number;
    }
  | { readonly name: 'booster_used'; readonly booster: 'extra-container' | 'undo' }
  | { readonly name: 'ad_offered'; readonly placement: string }
  | { readonly name: 'ad_watched'; readonly placement: string }
  | { readonly name: 'room_item_restored'; readonly roomId: string; readonly itemId: string; readonly styleIndex: 0 | 1 };

export interface AnalyticsService {
  track(event: AnalyticsEvent): void;
}

/**
 * Şimdilik konsola yazar. Olaylar bir sonraki adımda (canlı veri biriktikçe) seviye
 * zorluğunu kalibre etmek için kullanılacak -- bu yüzden şema şimdiden bu amaca uygun
 * (süre/hamle/undo sayısı gibi ölçülebilir alanlar) tasarlandı.
 */
export class ConsoleAnalyticsService implements AnalyticsService {
  track(event: AnalyticsEvent): void {
    // eslint-disable-next-line no-console
    console.log(`[analytics] ${event.name}`, event);
  }
}
