import { describe, expect, it } from 'vitest';
import { randomMove } from './randomMove';

describe('randomMove', () => {
  it('produces valid outer-face moves', () => {
    for (let i = 0; i < 500; i++) {
      expect(randomMove()).toMatch(/^[UDLRFB]['2]?$/);
    }
  });

  it('never turns the same face twice in a row', () => {
    let previous = randomMove();
    for (let i = 0; i < 5000; i++) {
      const next = randomMove(previous);
      expect(next[0]).not.toBe(previous[0]);
      previous = next;
    }
  });

  it('covers every face and suffix over many draws', () => {
    const seen = new Set<string>();
    let previous: string | undefined;
    for (let i = 0; i < 5000; i++) {
      previous = randomMove(previous);
      seen.add(previous);
    }
    expect(seen.size).toBe(18);
  });
});
