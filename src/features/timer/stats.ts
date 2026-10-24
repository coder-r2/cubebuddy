import { effectiveTime, type TimedResult } from './time';

// Statistics (SPEC §5.4). Times are effective times in ms; Infinity means DNF.

/** Solves removed from each end of an average of `n`: ⌈5 % · n⌉ (Ao5/Ao12 → 1, Ao50 → 3, Ao100 → 5). */
export const trimCount = (n: number) => Math.ceil(n * 0.05);

/** WCA-style trimmed mean; Infinity (DNF) when there are more DNFs than trimmed solves. */
export function trimmedAverage(times: readonly number[]): number {
  const n = times.length;
  const trim = trimCount(n);
  const dnfs = times.filter((t) => t === Infinity).length;
  if (dnfs > trim) return Infinity;
  const kept = [...times].sort((a, b) => a - b).slice(trim, n - trim);
  return kept.reduce((sum, t) => sum + t, 0) / kept.length;
}

/**
 * Rolling average of `size` ending at each solve (null until there are enough solves).
 * Used for current/best averages, the history list and the graph.
 */
export function rollingAverages(times: readonly number[], size: number): (number | null)[] {
  return times.map((_, i) => (i + 1 < size ? null : trimmedAverage(times.slice(i + 1 - size, i + 1))));
}

export interface AverageStat {
  current: number | null;
  best: number | null;
}

export interface SessionStats {
  count: number;
  solved: number;
  /** The most recent solve (Infinity for a DNF). */
  latest: number | null;
  pb: number | null;
  worst: number | null;
  /** Mean of non-DNF solves. */
  mean: number | null;
  averages: Record<AverageSize, AverageStat>;
  /** Rolling Ao5/Ao12 at each solve, oldest first. */
  rolling: Record<5 | 12, (number | null)[]>;
}

export const AVERAGE_SIZES = [5, 12, 50, 100] as const;
export type AverageSize = (typeof AVERAGE_SIZES)[number];

function summarise(rolling: (number | null)[]): AverageStat {
  const values = rolling.filter((v): v is number => v !== null);
  if (values.length === 0) return { current: null, best: null };
  return { current: values[values.length - 1] ?? null, best: Math.min(...values) };
}

/** All statistics for a session's solves, oldest first. */
export function computeStats(solves: readonly TimedResult[]): SessionStats {
  const times = solves.map(effectiveTime);
  const finite = times.filter(Number.isFinite);
  const rollingBySize = Object.fromEntries(
    AVERAGE_SIZES.map((size) => [size, rollingAverages(times, size)]),
  ) as Record<AverageSize, (number | null)[]>;

  return {
    count: times.length,
    solved: finite.length,
    latest: times.length ? times[times.length - 1]! : null,
    pb: finite.length ? Math.min(...finite) : null,
    worst: finite.length ? Math.max(...finite) : null,
    mean: finite.length ? finite.reduce((sum, t) => sum + t, 0) / finite.length : null,
    averages: Object.fromEntries(
      AVERAGE_SIZES.map((size) => [size, summarise(rollingBySize[size])]),
    ) as Record<AverageSize, AverageStat>,
    rolling: { 5: rollingBySize[5], 12: rollingBySize[12] },
  };
}
