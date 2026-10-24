import type { Penalty } from '../../db/types';

export interface TimedResult {
  timeMs: number;
  penalty: Penalty;
}

/** Time that counts for statistics: +2 adds two seconds, DNF is infinitely slow. */
export function effectiveTime({ timeMs, penalty }: TimedResult): number {
  return penalty === 'DNF' ? Infinity : timeMs + penalty;
}

/** `12.34`, `1:02.34`; truncated (not rounded) to centiseconds as the WCA does. */
export function formatTime(ms: number): string {
  if (!Number.isFinite(ms)) return 'DNF';
  const cs = Math.floor(ms / 10);
  const minutes = Math.floor(cs / 6000);
  const seconds = Math.floor((cs % 6000) / 100);
  const hundredths = String(cs % 100).padStart(2, '0');
  return minutes > 0
    ? `${minutes}:${String(seconds).padStart(2, '0')}.${hundredths}`
    : `${seconds}.${hundredths}`;
}

/** A solve as shown in lists: `14.34+` for +2 (time already includes it), `DNF` for DNF. */
export function formatResult(result: TimedResult): string {
  if (result.penalty === 'DNF') return 'DNF';
  return formatTime(effectiveTime(result)) + (result.penalty ? '+' : '');
}

/** Stat values: `null` (not enough solves) shows as a dash. */
export const formatStat = (ms: number | null) => (ms === null ? '–' : formatTime(ms));

/**
 * Parse a typed time (SPEC §5.4). Accepts cstimer-style input:
 * - digits only, read right to left as cs, s, min: `1234` → 12.34, `10234` → 1:02.34
 * - decimal seconds `12.34`, minutes `1:02.34`
 * - `DNF`, and a trailing `+` for +2 (`12.34+`)
 * Returns null for anything else.
 */
export function parseTypedTime(input: string): TimedResult | null {
  const text = input.trim().toUpperCase();
  if (text === 'DNF') return { timeMs: 0, penalty: 'DNF' };

  const plusTwo = text.endsWith('+');
  const body = plusTwo ? text.slice(0, -1).trim() : text;
  let ms: number;

  if (/^\d{1,7}$/.test(body)) {
    const digits = body.padStart(3, '0');
    const cs = Number(digits.slice(-2));
    const seconds = Number(digits.slice(-4, -2));
    const minutes = Number(digits.slice(0, -4) || '0');
    if (seconds >= 60 && minutes > 0) return null;
    ms = ((minutes * 60 + seconds) * 100 + cs) * 10;
  } else {
    const match = /^(?:(\d+):)?(\d+)(?:\.(\d{1,3}))?$/.exec(body);
    if (!match) return null;
    const [, min, sec = '0', frac = ''] = match;
    if (min !== undefined && Number(sec) >= 60) return null;
    ms = (Number(min ?? 0) * 60 + Number(sec)) * 1000 + Number(frac.padEnd(3, '0'));
  }

  if (ms <= 0) return null;
  return { timeMs: ms, penalty: plusTwo ? 2000 : 0 };
}
