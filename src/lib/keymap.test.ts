import { describe, expect, it } from 'vitest';
import {
  bindKey,
  CSTIMER_KEYMAP,
  effectiveKeymap,
  isBindableKey,
  keyLabel,
  moveForKey,
  unbindKey,
} from './keymap';

describe('cstimer keymap', () => {
  it('has the core face-turn pairs from cstimer', () => {
    expect(moveForKey('KeyI')).toBe('R');
    expect(moveForKey('KeyK')).toBe("R'");
    expect(moveForKey('KeyJ')).toBe('U');
    expect(moveForKey('KeyF')).toBe("U'");
    expect(moveForKey('KeyH')).toBe('F');
    expect(moveForKey('KeyG')).toBe("F'");
    expect(moveForKey('Semicolon')).toBe('y');
    expect(moveForKey('KeyA')).toBe("y'");
  });

  it('covers every outer face in both directions', () => {
    const moves = new Set(Object.values(CSTIMER_KEYMAP));
    for (const face of ['U', 'D', 'L', 'R', 'F', 'B']) {
      expect(moves).toContain(face);
      expect(moves).toContain(`${face}'`);
    }
  });

  it('lets user overrides win and ignores unmapped keys', () => {
    expect(moveForKey('KeyI', { KeyI: 'U2' })).toBe('U2');
    expect(moveForKey('F13')).toBeUndefined();
  });
});

describe('keymap editing', () => {
  it('binds, unbinds and keeps overrides minimal', () => {
    let overrides = bindKey({}, 'KeyQ', 'R2');
    expect(moveForKey('KeyQ', overrides)).toBe('R2');
    overrides = unbindKey(overrides, 'KeyI');
    expect(moveForKey('KeyI', overrides)).toBeUndefined();
    expect(effectiveKeymap(overrides).KeyI).toBeUndefined();
    overrides = bindKey(overrides, 'KeyI', 'R');
    overrides = bindKey(overrides, 'KeyQ', "z'");
    expect(overrides).toEqual({});
    expect(unbindKey({ F1: 'R' }, 'F1')).toEqual({});
  });

  it('labels keys and only allows typing keys', () => {
    expect(keyLabel('KeyI')).toBe('I');
    expect(keyLabel('Digit5')).toBe('5');
    expect(keyLabel('Semicolon')).toBe(';');
    expect(keyLabel('Backslash')).toBe('\\');
    expect(isBindableKey('KeyZ')).toBe(true);
    expect(isBindableKey('Space')).toBe(false);
    expect(isBindableKey('ArrowLeft')).toBe(false);
  });
});
