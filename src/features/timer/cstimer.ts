import type { Penalty, Puzzle } from '../../db/types';

/*
 * cstimer export format (D-059), confirmed against a real export:
 * { "session1": [[[penalty, timeMs, …splits], scramble, comment, unixSeconds, …], …], …,
 *   "properties": { "sessionData": "<JSON string: { "1": { name, opt: { scrType }, rank, … } }>" } }
 * penalty: 0 = none, 2000 = +2, -1 = DNF.
 */

export interface PortableSolve {
  timeMs: number;
  penalty: Penalty;
  scramble: string;
  comment: string;
  createdAt: number;
}

export interface PortableSession {
  name: string;
  /** null when the cstimer session is for an event CubeBuddy doesn't support (e.g. 4x4). */
  puzzle: Puzzle | null;
  solves: PortableSolve[];
}

/** cstimer scramble types → puzzle. Missing/empty scrType is cstimer's default, WCA 3x3. */
export function puzzleForScrType(scrType: unknown): Puzzle | null {
  if (scrType === undefined || scrType === null || scrType === '') return '3x3x3';
  if (typeof scrType !== 'string') return null;
  if (scrType.startsWith('333')) return '3x3x3';
  if (scrType.startsWith('222')) return '2x2x2';
  return null;
}

const SCR_TYPE: Record<Puzzle, string> = { '3x3x3': '333', '2x2x2': '222so' };

function toPenalty(raw: unknown): Penalty {
  if (raw === -1) return 'DNF';
  return typeof raw === 'number' && raw > 0 ? 2000 : 0;
}

function fromPenalty(penalty: Penalty): number {
  return penalty === 'DNF' ? -1 : penalty;
}

interface SessionMeta {
  name?: unknown;
  opt?: { scrType?: unknown };
}

export class CstimerFormatError extends Error {}

/** Parse a cstimer export file. Throws CstimerFormatError if it isn't one. */
export function parseCstimer(text: string): PortableSession[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new CstimerFormatError('This file isn’t valid JSON, so it isn’t a cstimer export.');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new CstimerFormatError('This file doesn’t look like a cstimer export.');
  }
  const record = data as Record<string, unknown>;
  const sessionKeys = Object.keys(record).filter((key) => /^session\d+$/.test(key));
  if (sessionKeys.length === 0) throw new CstimerFormatError('No cstimer sessions found in this file.');

  let meta: Record<string, SessionMeta> = {};
  const properties = record.properties as { sessionData?: unknown } | undefined;
  if (typeof properties?.sessionData === 'string') {
    try {
      meta = JSON.parse(properties.sessionData) as Record<string, SessionMeta>;
    } catch {
      // Without metadata, sessions fall back to numbered 3x3 sessions.
    }
  }

  const sessions: PortableSession[] = [];
  for (const key of sessionKeys.sort((a, b) => Number(a.slice(7)) - Number(b.slice(7)))) {
    const raw = record[key];
    if (!Array.isArray(raw) || raw.length === 0) continue;
    const number = key.slice(7);
    const info = meta[number] ?? {};
    const rawName = info.name === undefined ? number : String(info.name);

    const solves: PortableSolve[] = [];
    for (const entry of raw) {
      if (!Array.isArray(entry) || !Array.isArray(entry[0])) continue;
      const [[penalty, timeMs], scramble, comment, seconds] = entry as [
        [unknown, unknown],
        unknown,
        unknown,
        unknown,
      ];
      if (typeof timeMs !== 'number' || !Number.isFinite(timeMs) || timeMs < 0) continue;
      solves.push({
        timeMs: Math.round(timeMs),
        penalty: toPenalty(penalty),
        scramble: typeof scramble === 'string' ? scramble : '',
        comment: typeof comment === 'string' ? comment : '',
        // Very old cstimer versions stored no timestamp; 0 keeps them first and still de-duplicates.
        createdAt: typeof seconds === 'number' ? seconds * 1000 : 0,
      });
    }

    sessions.push({
      // cstimer names sessions 1, 2, 3… by default; make those recognisable after import.
      name: /^\d+$/.test(rawName) ? `cstimer ${rawName}` : rawName,
      puzzle: puzzleForScrType(info.opt?.scrType),
      solves,
    });
  }
  return sessions;
}

/** Serialise sessions into a file cstimer can import ("Import from file"). */
export function serializeCstimer(sessions: readonly PortableSession[]): string {
  const output: Record<string, unknown> = {};
  const sessionData: Record<string, unknown> = {};

  sessions.forEach((session, index) => {
    const number = index + 1;
    output[`session${number}`] = session.solves.map((solve) => [
      [fromPenalty(solve.penalty), solve.timeMs],
      solve.scramble,
      solve.comment,
      Math.round(solve.createdAt / 1000),
    ]);
    sessionData[number] = {
      name: session.name,
      opt: session.puzzle && session.puzzle !== '3x3x3' ? { scrType: SCR_TYPE[session.puzzle] } : {},
      rank: number,
    };
  });

  output.properties = { sessionData: JSON.stringify(sessionData) };
  return JSON.stringify(output);
}

/** De-duplication key from SPEC §5.4: (timestamp, time, scramble). Timestamps compare at 1 s precision. */
export const solveKey = (solve: Pick<PortableSolve, 'createdAt' | 'timeMs' | 'scramble'>) =>
  `${Math.round(solve.createdAt / 1000)}|${solve.timeMs}|${solve.scramble.trim()}`;
