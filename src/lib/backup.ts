import type { CubeBuddyDB } from '../db/db';
import type { AlgChoice, Progress, Session, Settings, Solve, TrainerStats } from '../db/types';
import {
  decodeChoice,
  decodeProgress,
  decodeSession,
  decodeSettings,
  decodeSolve,
  decodeStats,
  encodeChoice,
  encodeProgress,
  encodeSolve,
  encodeStats,
} from '../sync/codec';
import { requestFullPush } from '../sync/syncEngine';

// JSON backup of everything on this device (SPEC §5.9). Records are validated with the same decoders as
// cloud data, and importing merges by updatedAt, so restoring an old backup never overwrites newer data.

export const SCHEMA_VERSION = 1;

export interface Backup {
  app: 'cubebuddy';
  schemaVersion: number;
  exportedAt: number;
  settings: Settings | null;
  sessions: Session[];
  solves: Solve[];
  algChoices: AlgChoice[];
  progress: Progress[];
  trainerStats: TrainerStats[];
}

export class BackupFormatError extends Error {}

export async function exportBackup(db: CubeBuddyDB, now = Date.now()): Promise<Backup> {
  const [settingsRow, sessions, solves, algChoices, progress, trainerStats] = await Promise.all([
    db.settings.get('singleton'),
    db.sessions.toArray(),
    db.solves.toArray(),
    db.algChoices.toArray(),
    db.progress.toArray(),
    db.trainerStats.toArray(),
  ]);
  const live = new Set(sessions.filter((s) => !s.deleted).map((s) => s.id));
  let settings: Settings | null = null;
  if (settingsRow) {
    const { key: _key, ...rest } = settingsRow;
    settings = rest;
  }
  return {
    app: 'cubebuddy',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now,
    settings,
    sessions: sessions.filter((s) => live.has(s.id)),
    solves: solves
      .filter((s) => !s.deleted && live.has(s.sessionId))
      .sort((a, b) => a.createdAt - b.createdAt),
    algChoices,
    progress,
    trainerStats,
  };
}

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const obj = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

/** Parse and validate a backup file; invalid records are dropped, a wrong file throws. */
export function parseBackup(text: string): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupFormatError('This file isn’t a CubeBuddy backup (it isn’t valid JSON).');
  }
  const data = obj(raw);
  if (data.app !== 'cubebuddy' || typeof data.schemaVersion !== 'number') {
    throw new BackupFormatError('This file isn’t a CubeBuddy backup.');
  }
  if (data.schemaVersion > SCHEMA_VERSION) {
    throw new BackupFormatError(
      'This backup was made by a newer version of CubeBuddy. Reload the app and try again.',
    );
  }
  const id = (r: unknown, key: string) => String(obj(r)[key] ?? '');
  return {
    app: 'cubebuddy',
    schemaVersion: data.schemaVersion,
    exportedAt: typeof data.exportedAt === 'number' ? data.exportedAt : 0,
    settings: data.settings ? decodeSettings(obj(data.settings)) : null,
    sessions: list(data.sessions)
      .map((r) => decodeSession(id(r, 'id'), obj(r)))
      .filter((r): r is Session => r !== null && r.id !== ''),
    // Solves, choices, progress and stats go through the cloud encoders so they're checked the same way.
    solves: list(data.solves)
      .map((r) => {
        const s = obj(r) as unknown as Solve;
        return typeof s.id === 'string' && typeof s.sessionId === 'string'
          ? decodeSolve(
              s.id,
              s.sessionId,
              safeEncode(() => encodeSolve(s)),
            )
          : null;
      })
      .filter((r): r is Solve => r !== null),
    algChoices: list(data.algChoices)
      .map((r) =>
        decodeChoice(
          id(r, 'caseId'),
          safeEncode(() => encodeChoice(r as AlgChoice)),
        ),
      )
      .filter((r): r is AlgChoice => r !== null && r.caseId !== ''),
    progress: list(data.progress)
      .map((r) =>
        decodeProgress(
          id(r, 'caseId'),
          safeEncode(() => encodeProgress(r as Progress)),
        ),
      )
      .filter((r): r is Progress => r !== null && r.caseId !== ''),
    trainerStats: list(data.trainerStats)
      .map((r) =>
        decodeStats(
          id(r, 'caseId'),
          safeEncode(() => encodeStats(r as TrainerStats)),
        ),
      )
      .filter((r): r is TrainerStats => r !== null && r.caseId !== ''),
  };
}

function safeEncode(encode: () => string): string | undefined {
  try {
    return encode();
  } catch {
    return undefined;
  }
}

export interface BackupImportResult {
  added: number;
  updated: number;
  unchanged: number;
}

/** Merge a backup into the local data: new records are added, newer records replace older ones. */
export async function importBackup(db: CubeBuddyDB, backup: Backup): Promise<BackupImportResult> {
  const result: BackupImportResult = { added: 0, updated: 0, unchanged: 0 };
  const merge = async <T extends { updatedAt: number }>(
    table: 'sessions' | 'solves' | 'algChoices' | 'progress' | 'trainerStats',
    records: readonly T[],
    keyOf: (r: T) => string,
  ) => {
    if (!records.length) return;
    const locals = (await db.table(table).bulkGet(records.map(keyOf))) as (T | undefined)[];
    const winners = records.filter((r, i) => {
      const local = locals[i];
      if (!local) result.added++;
      else if (r.updatedAt > local.updatedAt) result.updated++;
      else result.unchanged++;
      return !local || r.updatedAt > local.updatedAt;
    });
    await db.table(table).bulkPut(winners);
  };

  await db.transaction(
    'rw',
    [db.settings, db.sessions, db.solves, db.algChoices, db.progress, db.trainerStats],
    async () => {
      if (backup.settings) {
        const local = await db.settings.get('singleton');
        if (!local || backup.settings.updatedAt > local.updatedAt) {
          await db.settings.put({ key: 'singleton', ...backup.settings });
        }
      }
      await merge('sessions', backup.sessions, (r) => r.id);
      // Solves of sessions that are neither in the backup nor on this device would be invisible orphans.
      const sessionIds = new Set([
        ...backup.sessions.map((s) => s.id),
        ...(await db.sessions.toCollection().primaryKeys()),
      ]);
      await merge(
        'solves',
        backup.solves.filter((s) => sessionIds.has(s.sessionId)),
        (r) => r.id,
      );
      await merge('algChoices', backup.algChoices, (r) => r.caseId);
      await merge('progress', backup.progress, (r) => r.caseId);
      await merge('trainerStats', backup.trainerStats, (r) => r.caseId);
    },
  );
  // Imported records keep their old timestamps; make sure the next sync uploads them.
  await requestFullPush(db);
  return result;
}
