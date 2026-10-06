import type Phaser from 'phaser';

const DRAG_THRESHOLD = 8;

/** GameInputController'ın sahneden ihtiyaç duyduğu her şey (dar arayüz). Kap/hamle mantığına hiç
 * dokunmaz -- yalnızca "hangi kaba basıldı/sürüklendi/bırakıldı"yı saptayıp GameScene'in zaten
 * sahip olduğu seçim/hamle/geri bildirim fonksiyonlarını çağırır. */
export interface InputHost {
  isAnimating: () => boolean;
  findContainerAt: (x: number, y: number) => string | null;
  getTopRunLengthFor: (containerId: string) => number;
  getSelectedId: () => string | null;
  setSelectedId: (id: string | null) => void;
  moveRunVisual: (containerId: string, dx: number, dy: number) => void;
  drawFrames: () => void;
  render: () => void;
  attemptMove: (sourceId: string, targetId: string) => void;
  feedbackTap: () => void;
  cancelTutorial: () => void;
}

/**
 * Hem "dokun-seç-taşı" hem de "sürükle-bırak" akışını tek bir pointer döngüsünde (down/move/up)
 * destekler: kısa bir dokunuş seçim olarak, DRAG_THRESHOLD'u aşan bir hareket sürükleme olarak
 * yorumlanır. Sürükleme sırasında kaynağın üst "run"ı (bkz. getTopRunLengthFor) pointer ile
 * birlikte görsel olarak ötelenir (moveRunVisual); gerçek hamle yalnızca bırakma anında denenir.
 */
export class GameInputController {
  private activePointerId: string | null = null;
  private dragRunLength = 0;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragging = false;

  private readonly host: InputHost;

  constructor(host: InputHost) {
    this.host = host;
  }

  /** render()'ın "sürüklenen üst run'ı yukarıda göster" kararı için (bkz. GameScene.render). */
  getActivePointerId(): string | null {
    return this.activePointerId;
  }

  getDragRunLength(): number {
    return this.dragRunLength;
  }

  reset(): void {
    this.activePointerId = null;
    this.dragRunLength = 0;
    this.dragging = false;
  }

  onPointerDown(pointer: Phaser.Input.Pointer): void {
    this.host.cancelTutorial();
    if (this.host.isAnimating()) return;
    const id = this.host.findContainerAt(pointer.x, pointer.y);
    if (!id) return;

    // activePointerId her kapta (boş olsa bile) set edilir: tap-select akışında
    // ikinci dokunuş (hedef) boş bir kaba yapılabilir. Sürükleme sadece dolu
    // kaynaklarda anlamlıdır (dragRunLength=0 ise moveRunVisual zaten no-op olur).
    this.activePointerId = id;
    this.dragRunLength = this.host.getTopRunLengthFor(id);
    this.dragStartX = pointer.x;
    this.dragStartY = pointer.y;
    this.dragging = false;
  }

  onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.host.isAnimating() || !this.activePointerId) return;
    const dx = pointer.x - this.dragStartX;
    const dy = pointer.y - this.dragStartY;
    if (!this.dragging && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      this.dragging = true;
    }
    if (this.dragging) {
      this.host.moveRunVisual(this.activePointerId, dx, dy);
    }
  }

  onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.host.isAnimating()) return;
    const pressedId = this.activePointerId;
    const wasDragging = this.dragging;
    this.activePointerId = null;
    this.dragging = false;

    if (!pressedId) {
      // Boş alana dokunma: seçimi iptal eder.
      if (!this.host.findContainerAt(pointer.x, pointer.y) && this.host.getSelectedId()) {
        this.host.setSelectedId(null);
        this.host.drawFrames();
        this.host.render();
      }
      return;
    }

    if (wasDragging) {
      const targetId = this.host.findContainerAt(pointer.x, pointer.y);
      this.host.setSelectedId(null);
      if (targetId && targetId !== pressedId) {
        this.host.attemptMove(pressedId, targetId);
      } else {
        this.host.render();
      }
      return;
    }

    // Gerçek sürükleme olmadı: bu bir "tap" (dokun-seç-taşı akışı).
    const selectedId = this.host.getSelectedId();
    if (selectedId === null) {
      this.host.setSelectedId(pressedId);
      this.host.feedbackTap();
    } else if (selectedId === pressedId) {
      this.host.setSelectedId(null);
    } else {
      this.host.setSelectedId(null);
      this.host.attemptMove(selectedId, pressedId);
      return;
    }
    this.host.drawFrames();
    this.host.render();
  }
}
