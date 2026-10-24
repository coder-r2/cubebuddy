import { describe, expect, it } from 'vitest';
import { rng } from '../../engine/testUtils';
import { afterRecognition, afterTimed, emptyStats, pickCase, setAverage, weight } from './srs';

describe('spaced repetition', () => {
  it('moves a case up a box when faster than average and down when slower', () => {
    let s = afterTimed(emptyStats('a'), 2000, 3000, 1);
    expect(s.box).toBe(1);
    s = afterTimed(s, 4000, 3000, 2);
    expect(s.box).toBe(0);
    expect(s.recentTimesMs).toEqual([2000, 4000]);
  });

  it('keeps only the last five times', () => {
    let s = emptyStats('a');
    for (let i = 1; i <= 7; i++) s = afterTimed(s, i * 1000, null, i);
    expect(s.recentTimesMs).toEqual([3000, 4000, 5000, 6000, 7000]);
    expect(s.box).toBe(4);
  });

  it('sends a misrecognised case back to box 0 and counts the miss', () => {
    const s = afterRecognition({ ...emptyStats('a'), box: 3, lastSeen: 1 }, false, 2);
    expect(s).toMatchObject({ box: 0, recognitionMisses: 1, lastSeen: 2 });
  });

  it('weights new, slow and missed cases more', () => {
    const solid = { ...emptyStats('a'), box: 4, lastSeen: 1, recentTimesMs: [1000] };
    const slow = { ...solid, recentTimesMs: [4000] };
    expect(weight(undefined, null)).toBeGreaterThan(weight(solid, 2000));
    expect(weight(slow, 2000)).toBeGreaterThan(weight(solid, 2000));
    expect(weight({ ...solid, recognitionMisses: 3 }, 2000)).toBeGreaterThan(weight(solid, 2000));
    expect(setAverage([solid, slow])).toBe(2500);
  });

  it('picks hard cases more often and never repeats immediately', () => {
    const stats = {
      easy: { ...emptyStats('easy'), box: 4, lastSeen: 1, recentTimesMs: [1000] },
      hard: { ...emptyStats('hard'), box: 0, lastSeen: 1, recentTimesMs: [5000] },
      other: { ...emptyStats('other'), box: 4, lastSeen: 1, recentTimesMs: [1000] },
    };
    const random = rng(3);
    const counts: Record<string, number> = { easy: 0, hard: 0, other: 0 };
    for (let i = 0; i < 3000; i++) counts[pickCase(['easy', 'hard', 'other'], stats, random)]!++;
    expect(counts.hard).toBeGreaterThan(counts.easy! * 3);
    for (let i = 0; i < 50; i++) expect(pickCase(['easy', 'hard'], stats, random, 'hard')).toBe('easy');
    expect(pickCase(['solo'], {}, random, 'solo')).toBe('solo');
  });
});
