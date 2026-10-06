import Phaser from 'phaser';

/**
 * Siyaha kısa bir "fade out" ile geçip hedef sahneyi başlatır -- ham scene.start() sert bir kesme
 * yapıyordu (bkz. Faz 5 kararları). Hedef sahne kendi create()'inde fadeIn() çağırırsa (bkz.
 * GameScene/RoomScene) iki ucu da yumuşak tam bir geçiş oluşur.
 */
export function fadeToScene(scene: Phaser.Scene, key: string, data?: object, duration = 220): void {
  scene.cameras.main.fadeOut(duration, 0, 0, 0);
  scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
    scene.scene.start(key, data);
  });
}
