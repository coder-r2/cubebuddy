import { describe, expect, it } from 'vitest';
import type { Penalty } from '../../db/types';
import { computeStats, rollingAverages, trimCount, trimmedAverage } from './stats';

const DNF = Infinity;
const solve = (seconds: number, penalty: Penalty = 0) => ({ timeMs: seconds * 1000, penalty });

describe('trimCount', () => {
  it('trims ⌈5 %⌉ from each end', () => {
    expect([5, 12, 50, 100].map(trimCount)).toEqual([1, 1, 3, 5]);
  });
});

describe('trimmedAverage', () => {
  it('removes the best and worst of five', () => {
    expect(trimmedAverage([10, 11, 12, 13, 30])).toBe(12);
  });

  it('counts a single DNF as the worst solve', () => {
    expect(trimmedAverage([10, 11, 12, 13, DNF])).toBe(12);
  });

  it('is DNF with two DNFs in an Ao5', () => {
    expect(trimmedAverage([10, 11, 12, DNF, DNF])).toBe(DNF);
  });

  it('allows up to three DNFs in an Ao50', () => {
    const times = Array.from({ length: 50 }, (_, i) => 10 + i);
    times[0] = DNF;
    times[1] = DNF;
    times[2] = DNF;
    // Trims the 3 DNFs on top and 13, 14, 15 at the bottom; keeps 16…59.
    expect(trimmedAverage(times)).toBe((16 + 59) / 2);
    times[3] = DNF;
    expect(trimmedAverage(times)).toBe(DNF);
  });

  it('trims five from each end of an Ao100', () => {
    const times = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(trimmedAverage(times)).toBe(50.5);
  });
});

describe('rollingAverages', () => {
  it('is null until there are enough solves', () => {
    expect(rollingAverages([10, 20, 30, 40, 50, 60], 5)).toEqual([null, null, null, null, 30, 40]);
  });
});

describe('computeStats', () => {
  it('handles an empty session', () => {
    const stats = computeStats([]);
    expect(stats).toMatchObject({ count: 0, solved: 0, pb: null, worst: null, mean: null });
    expect(stats.averages[5]).toEqual({ current: null, best: null });
  });

  it('applies +2 to singles, averages and the mean, and excludes DNFs from the mean', () => {
    const stats = computeStats([solve(10), solve(12, 2000), solve(9, 'DNF'), solve(11), solve(13), solve(8)]);
    expect(stats.count).toBe(6);
    expect(stats.solved).toBe(5);
    expect(stats.pb).toBe(8000);
    expect(stats.worst).toBe(14000);
    expect(stats.mean).toBe((10 + 14 + 11 + 13 + 8) * 200);
    // Ao5 #1: 10, 14, DNF, 11, 13 → drop 10 and DNF → (14+11+13)/3
    // Ao5 #2: 14, DNF, 11, 13, 8 → drop 8 and DNF → (14+11+13)/3
    expect(stats.averages[5].current).toBeCloseTo(12_666.67, 1);
    expect(stats.averages[5].best).toBeCloseTo(12_666.67, 1);
    expect(stats.averages[12]).toEqual({ current: null, best: null });
  });

  it('tracks the best average separately from the current one', () => {
    const stats = computeStats([20, 10, 10, 10, 10, 10, 30, 30].map((s) => solve(s)));
    expect(stats.averages[5].best).toBe(10_000);
    expect(stats.averages[5].current).toBeCloseTo(50_000 / 3, 5);
  });

  it('reports a DNF current average but keeps a finite best', () => {
    const stats = computeStats([
      solve(10),
      solve(10),
      solve(10),
      solve(10),
      solve(10),
      solve(1, 'DNF'),
      solve(1, 'DNF'),
    ]);
    expect(stats.averages[5].best).toBe(10_000);
    expect(stats.averages[5].current).toBe(DNF);
  });

  it('returns no PB when every solve is a DNF', () => {
    const stats = computeStats([solve(10, 'DNF')]);
    expect(stats.pb).toBeNull();
    expect(stats.mean).toBeNull();
  });
});
