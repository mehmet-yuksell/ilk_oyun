import { describe, expect, it } from 'vitest';
import { UndoStack } from './undoStack';

describe('UndoStack', () => {
  it('boşken canUndo false, undo undefined döner', () => {
    const stack = new UndoStack<number>();
    expect(stack.canUndo()).toBe(false);
    expect(stack.undo()).toBeUndefined();
  });

  it('push sonrası LIFO sırayla geri verir', () => {
    const stack = new UndoStack<number>();
    stack.push(1);
    stack.push(2);
    stack.push(3);
    expect(stack.size).toBe(3);
    expect(stack.undo()).toBe(3);
    expect(stack.undo()).toBe(2);
    expect(stack.canUndo()).toBe(true);
    expect(stack.undo()).toBe(1);
    expect(stack.canUndo()).toBe(false);
  });

  it('clear tüm geçmişi siler', () => {
    const stack = new UndoStack<number>();
    stack.push(1);
    stack.push(2);
    stack.clear();
    expect(stack.canUndo()).toBe(false);
    expect(stack.size).toBe(0);
  });
});
