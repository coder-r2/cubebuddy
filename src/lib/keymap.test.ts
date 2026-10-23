import { describe, expect, it } from 'vitest';
import { CSTIMER_KEYMAP, moveForKey } from './keymap';

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
