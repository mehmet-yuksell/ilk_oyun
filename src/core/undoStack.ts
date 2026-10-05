/** Sınırsız geri-al için basit, jenerik bir geçmiş yığını. GameState immutable olduğundan referans saklamak yeterlidir. */
export class UndoStack<T> {
  private readonly entries: T[] = [];

  push(entry: T): void {
    this.entries.push(entry);
  }

  canUndo(): boolean {
    return this.entries.length > 0;
  }

  /** Son girdiyi çıkarıp döner. Yığın boşsa undefined döner. */
  undo(): T | undefined {
    return this.entries.pop();
  }

  clear(): void {
    this.entries.length = 0;
  }

  get size(): number {
    return this.entries.length;
  }
}
