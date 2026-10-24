import { useEffect } from 'react';
import { moveForKey } from './keymap';

export function isEditable(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

interface CubeKeys {
  keymap: Readonly<Record<string, string>>;
  onMove: (move: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onEscape: () => void;
  /** While true (e.g. a helper is playing) only Esc works. */
  locked: boolean;
  /** Extra keys by `KeyboardEvent.key`, e.g. arrows for stepping through a solution. */
  extra?: Record<string, () => void>;
}

/** Cube keyboard: cstimer layout (D-031/D-058), Ctrl+Z / Ctrl+Y / Backspace, Esc. */
export function useCubeKeys({ keymap, onMove, onUndo, onRedo, onEscape, locked, extra }: CubeKeys) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditable(e.target) || document.querySelector('dialog[open]')) return;
      if (e.key === 'Escape') {
        onEscape();
        return;
      }
      if (locked) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if ((ctrl && e.key.toLowerCase() === 'z' && !e.shiftKey) || (!ctrl && e.key === 'Backspace')) {
        e.preventDefault();
        onUndo();
        return;
      }
      if (ctrl && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault();
        onRedo();
        return;
      }
      if (ctrl || e.altKey || e.repeat) return;
      const action = extra?.[e.key];
      if (action) {
        e.preventDefault();
        action();
        return;
      }
      const move = moveForKey(e.code, keymap);
      if (!move) return;
      e.preventDefault();
      onMove(move);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [keymap, onMove, onUndo, onRedo, onEscape, locked, extra]);
}
