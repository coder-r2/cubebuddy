import type { TrainerStats } from '../../db/types';

/*
 * Spaced-repetition ordering (D-028): cases are drawn at random, weighted towards cases that are new, slow
 * relative to the set average, or often misrecognised. A Leitner box (0 = struggling … 4 = solid) moves up
 * after a good attempt and down after a poor one.
 */

export const MAX_BOX = 4;
const BOX_WEIGHT = [8, 5, 3, 2, 1];
const RECENT = 5;

export const emptyStats = (caseId: string): TrainerStats => ({
  caseId,
  recentTimesMs: [],
  recognitionMisses: 0,
  box: 0,
  lastSeen: 0,
  updatedAt: 0,
});

const mean = (values: readonly number[]) => values.reduce((a, b) => a + b, 0) / values.length;

/** Average of every case's recent times in the set (null if nothing timed yet). */
export function setAverage(stats: readonly TrainerStats[]): number | null {
  const averages = stats.filter((s) => s.recentTimesMs.length).map((s) => mean(s.recentTimesMs));
  return averages.length ? mean(averages) : null;
}

export function weight(stats: TrainerStats | undefined, average: number | null): number {
  if (!stats || stats.lastSeen === 0) return BOX_WEIGHT[0]!; // never practised
  let w = BOX_WEIGHT[stats.box] ?? 1;
  if (average && stats.recentTimesMs.length) {
    const ratio = mean(stats.recentTimesMs) / average;
    w *= Math.min(2, Math.max(0.5, ratio));
  }
  return w + Math.min(stats.recognitionMisses, 5) * 0.5;
}

/** Weighted random pick, avoiding an immediate repeat when there is a choice. */
export function pickCase(
  caseIds: readonly string[],
  stats: Record<string, TrainerStats>,
  random: () => number = Math.random,
  previous?: string,
): string {
  const pool = caseIds.length > 1 ? caseIds.filter((id) => id !== previous) : caseIds;
  const all = Object.values(stats).filter((s) => pool.includes(s.caseId));
  const average = setAverage(all);
  const weights = pool.map((id) => weight(stats[id], average));
  let r = random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i]!;
    if (r < 0) return pool[i]!;
  }
  return pool[pool.length - 1]!;
}

/** After a timed attempt: keep the last few times; faster than the set average moves the case up a box. */
export function afterTimed(
  stats: TrainerStats,
  timeMs: number,
  average: number | null,
  now = Date.now(),
): TrainerStats {
  const recentTimesMs = [...stats.recentTimesMs, timeMs].slice(-RECENT);
  const good = average === null || timeMs <= average;
  const box = good ? Math.min(MAX_BOX, stats.box + 1) : Math.max(0, stats.box - 1);
  return { ...stats, recentTimesMs, box, lastSeen: now, updatedAt: now };
}

/** After a recognition attempt: a miss sends the case back to box 0. */
export function afterRecognition(stats: TrainerStats, correct: boolean, now = Date.now()): TrainerStats {
  return {
    ...stats,
    box: correct ? Math.min(MAX_BOX, stats.box + 1) : 0,
    recognitionMisses: stats.recognitionMisses + (correct ? 0 : 1),
    lastSeen: now,
    updatedAt: now,
  };
}
