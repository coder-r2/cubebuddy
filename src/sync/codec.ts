import type { AlgChoice, Penalty, Progress, Session, Settings, Solve, TrainerStats } from '../db/types';
import { DEFAULT_SETTINGS } from '../stores/settings';

// How records are stored in Firestore (SPEC §7.3, D-039, D-092). Solves and alg records live as JSON
// strings inside map fields: one indexed value per record keeps documents far below Firestore's
// index-entry limit, and set-with-merge then replaces exactly one record per key.

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Solves are grouped into one doc per session per week of their creation time. */
export const chunkIdOf = (solve: Pick<Solve, 'sessionId' | 'createdAt'>) =>
  `${solve.sessionId}_${Math.floor(solve.createdAt / WEEK_MS)}`;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isPenalty = (v: unknown): v is Penalty => v === 0 || v === 2000 || v === 'DNF';
const SOURCES: readonly Solve['source'][] = ['timer', 'typed', 'cstimer'];

function parseJson(text: unknown): unknown {
  if (!isStr(text)) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function encodeSolve(s: Solve): string {
  return JSON.stringify([
    s.timeMs,
    s.penalty,
    s.scramble,
    s.comment,
    s.source,
    s.createdAt,
    s.updatedAt,
    s.deleted ? 1 : 0,
  ]);
}

export function decodeSolve(id: string, sessionId: string, text: unknown): Solve | null {
  const v = parseJson(text);
  if (!Array.isArray(v) || v.length < 8) return null;
  const [timeMs, penalty, scramble, comment, source, createdAt, updatedAt, deleted] = v as unknown[];
  if (!isNum(timeMs) || !isPenalty(penalty) || !isStr(scramble) || !isStr(comment)) return null;
  if (!SOURCES.includes(source as Solve['source']) || !isNum(createdAt) || !isNum(updatedAt)) return null;
  return {
    id,
    sessionId,
    timeMs,
    penalty,
    scramble,
    comment,
    source: source as Solve['source'],
    createdAt,
    updatedAt,
    deleted: deleted === 1,
  };
}

export function sessionData({ id: _id, ...rest }: Session): Record<string, unknown> {
  return rest;
}

export function decodeSession(id: string, d: Record<string, unknown>): Session | null {
  if (!isStr(d.name) || (d.puzzle !== '3x3x3' && d.puzzle !== '2x2x2')) return null;
  if (!isNum(d.createdAt) || !isNum(d.updatedAt) || typeof d.deleted !== 'boolean') return null;
  return {
    id,
    name: d.name,
    puzzle: d.puzzle,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    deleted: d.deleted,
  };
}

/** Known settings fields only, falling back to defaults, so an older or newer client's doc can't break us. */
export function decodeSettings(d: Record<string, unknown>): Settings | null {
  if (!isNum(d.updatedAt)) return null;
  const settings = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    const value = d[key];
    const fallback = DEFAULT_SETTINGS[key];
    const valid =
      key === 'level'
        ? [null, 1, 2, 3, 4].includes(value as number | null)
        : Array.isArray(fallback)
          ? Array.isArray(value)
          : typeof value === typeof fallback && value !== null;
    if (valid) (settings as Record<string, unknown>)[key] = value;
  }
  return settings;
}

export const encodeChoice = ({ caseId: _c, ...rest }: AlgChoice) => JSON.stringify(rest);
export const encodeProgress = ({ caseId: _c, ...rest }: Progress) => JSON.stringify(rest);
export const encodeStats = ({ caseId: _c, ...rest }: TrainerStats) => JSON.stringify(rest);

function asObject(text: unknown): Record<string, unknown> | null {
  const v = parseJson(text);
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function decodeChoice(caseId: string, text: unknown): AlgChoice | null {
  const v = asObject(text);
  if (!v || !isNum(v.updatedAt)) return null;
  if (v.selected !== 0 && v.selected !== 1 && v.selected !== 2 && v.selected !== 'custom') return null;
  return {
    caseId,
    selected: v.selected,
    ...(isStr(v.customAlg) ? { customAlg: v.customAlg } : {}),
    updatedAt: v.updatedAt,
  };
}

export function decodeProgress(caseId: string, text: unknown): Progress | null {
  const v = asObject(text);
  if (!v || !isNum(v.updatedAt)) return null;
  if (v.state !== 'none' && v.state !== 'learning' && v.state !== 'learned') return null;
  return { caseId, state: v.state, updatedAt: v.updatedAt };
}

export function decodeStats(caseId: string, text: unknown): TrainerStats | null {
  const v = asObject(text);
  if (!v || !isNum(v.updatedAt) || !isNum(v.recognitionMisses) || !isNum(v.box) || !isNum(v.lastSeen))
    return null;
  if (!Array.isArray(v.recentTimesMs) || !v.recentTimesMs.every(isNum)) return null;
  return {
    caseId,
    recentTimesMs: v.recentTimesMs,
    recognitionMisses: v.recognitionMisses,
    box: v.box,
    lastSeen: v.lastSeen,
    updatedAt: v.updatedAt,
  };
}
