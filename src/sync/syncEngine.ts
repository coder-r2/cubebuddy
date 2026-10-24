import type { CubeBuddyDB } from '../db/db';
import type { AlgChoice, Progress, Session, Settings, Solve, TrainerStats } from '../db/types';
import { cursorAfter, type Cloud, type CloudWrite, type PulledDocs, type SyncCursor } from './cloudTypes';
import {
  chunkIdOf,
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
  sessionData,
} from './codec';

/*
 * One sync round (SPEC §7.3, D-039, D-092): pull what changed in the cloud, merge it locally record by
 * record (last write wins by updatedAt; deletions are tombstones), then push what changed locally.
 *
 * "Changed locally" means updatedAt is later than the start of the last push on this device, so nothing
 * needs to be tracked per write. The first round for an account on a device pulls and pushes everything,
 * which merges the two sides as a union.
 */

const SYNC_KEY = 'sync';

export interface SyncState {
  uid: string;
  cursor: SyncCursor | null;
  lastPushedAt: number;
}

/** Which in-memory stores need reloading after a pull. */
export type ChangedArea = 'settings' | 'timer' | 'trainer';

export interface SyncResult {
  pulled: number;
  pushed: number;
  changed: Set<ChangedArea>;
}

export async function readSyncState(db: CubeBuddyDB): Promise<SyncState | null> {
  const row = await db.syncMeta.get(SYNC_KEY);
  return (row?.value as SyncState | undefined) ?? null;
}

export const clearSyncState = (db: CubeBuddyDB) => db.syncMeta.delete(SYNC_KEY);

/** Push every local record on the next round (after a JSON import brought in old timestamps). */
export async function requestFullPush(db: CubeBuddyDB) {
  const state = await readSyncState(db);
  if (state) await db.syncMeta.put({ key: SYNC_KEY, value: { ...state, lastPushedAt: 0 } });
}

type RecordTable = 'sessions' | 'solves' | 'algChoices' | 'progress' | 'trainerStats';
type DirtyKeys = Record<RecordTable, string[]> & { settings: boolean };

async function dirtyKeys(db: CubeBuddyDB, since: number): Promise<DirtyKeys> {
  const keys = (table: RecordTable) =>
    db.table(table).where('updatedAt').above(since).primaryKeys() as Promise<string[]>;
  const [sessions, solves, algChoices, progress, trainerStats, settings] = await Promise.all([
    keys('sessions'),
    keys('solves'),
    keys('algChoices'),
    keys('progress'),
    keys('trainerStats'),
    db.settings.get('singleton'),
  ]);
  return {
    sessions,
    solves,
    algChoices,
    progress,
    trainerStats,
    settings: !!settings && settings.updatedAt > since,
  };
}

/** Put the remote records that are newer than the local ones; returns the keys now equal to the cloud. */
async function mergeRecords<T extends { updatedAt: number }>(
  db: CubeBuddyDB,
  table: RecordTable,
  remote: readonly T[],
  keyOf: (record: T) => string,
  skipIfAbsent: (record: T) => boolean = () => false,
): Promise<{ inSync: string[]; written: number }> {
  if (remote.length === 0) return { inSync: [], written: 0 };
  const locals = (await db.table(table).bulkGet(remote.map(keyOf))) as (T | undefined)[];
  const winners: T[] = [];
  const inSync: string[] = [];
  remote.forEach((record, i) => {
    const local = locals[i];
    if (!local && skipIfAbsent(record)) return;
    if (!local || record.updatedAt > local.updatedAt) winners.push(record);
    if (!local || record.updatedAt >= local.updatedAt) inSync.push(keyOf(record));
  });
  await db.table(table).bulkPut(winners);
  return { inSync, written: winners.length };
}

function decodeMap<T>(value: unknown, decode: (key: string, text: unknown) => T | null): T[] {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value as Record<string, unknown>)
    .map(([key, text]) => decode(key, text))
    .filter((record): record is T => record !== null);
}

async function applyPull(db: CubeBuddyDB, pulled: PulledDocs, first: boolean) {
  const changed = new Set<ChangedArea>();
  const inSync = new Set<string>();
  const mark = (table: string, keys: readonly string[]) => keys.forEach((k) => inSync.add(`${table}:${k}`));

  let remoteSettings: Settings | null = null;
  const choices: AlgChoice[] = [];
  const progress: Progress[] = [];
  const stats: TrainerStats[] = [];
  for (const doc of pulled.meta) {
    if (doc.id === 'settings') remoteSettings = decodeSettings(doc.data);
    if (doc.id === 'algs') {
      choices.push(...decodeMap(doc.data.choices, decodeChoice));
      progress.push(...decodeMap(doc.data.progress, decodeProgress));
      stats.push(...decodeMap(doc.data.trainerStats, decodeStats));
    }
  }
  const sessions = pulled.sessions
    .map((doc) => decodeSession(doc.id, doc.data))
    .filter((s): s is Session => s !== null);
  const solves: Solve[] = [];
  for (const doc of pulled.solveChunks) {
    const sessionId = doc.data.sessionId;
    if (typeof sessionId !== 'string') continue;
    solves.push(...decodeMap(doc.data.solves, (id, text) => decodeSolve(id, sessionId, text)));
  }

  const tables = [db.settings, db.sessions, db.solves, db.algChoices, db.progress, db.trainerStats];
  db.applyingRemote = true;
  try {
    await db.transaction('rw', tables, async () => {
      if (remoteSettings) {
        const local = await db.settings.get('singleton');
        // On a device's first sync the account's settings win: they're what the user set up before.
        if (first || !local || remoteSettings.updatedAt > local.updatedAt) {
          await db.settings.put({ key: 'singleton', ...remoteSettings });
          changed.add('settings');
        }
        if (first || !local || remoteSettings.updatedAt >= local.updatedAt) inSync.add('settings');
      }

      const results = [
        ['algChoices', await mergeRecords(db, 'algChoices', choices, (r) => r.caseId)],
        ['progress', await mergeRecords(db, 'progress', progress, (r) => r.caseId)],
        ['trainerStats', await mergeRecords(db, 'trainerStats', stats, (r) => r.caseId)],
        ['sessions', await mergeRecords(db, 'sessions', sessions, (r) => r.id)],
        // A deleted solve this device never had needs no local copy.
        [
          'solves',
          await mergeRecords(
            db,
            'solves',
            solves,
            (r) => r.id,
            (r) => r.deleted,
          ),
        ],
      ] as const;
      for (const [table, result] of results) {
        mark(table, result.inSync);
        if (result.written) changed.add(table === 'sessions' || table === 'solves' ? 'timer' : 'trainer');
      }

      if (first && sessions.length) {
        // Every device starts with an empty "3x3" session; don't end up with one copy per device.
        const remoteIds = new Set(sessions.map((s) => s.id));
        const remoteNames = new Set(sessions.filter((s) => !s.deleted).map((s) => `${s.name}|${s.puzzle}`));
        for (const local of await db.sessions.toArray()) {
          if (remoteIds.has(local.id) || !remoteNames.has(`${local.name}|${local.puzzle}`)) continue;
          const solveCount = await db.solves
            .where('[sessionId+createdAt]')
            .between([local.id, -Infinity], [local.id, Infinity])
            .count();
          if (solveCount === 0) {
            await db.sessions.delete(local.id);
            inSync.add(`sessions:${local.id}`);
            changed.add('timer');
          }
        }
      }
    });
  } finally {
    db.applyingRemote = false;
  }
  return {
    changed,
    inSync,
    pulled: sessions.length + solves.length + choices.length + progress.length + stats.length,
  };
}

async function buildWrites(db: CubeBuddyDB, dirty: DirtyKeys, inSync: Set<string>): Promise<CloudWrite[]> {
  const writes: CloudWrite[] = [];
  const pending = (table: RecordTable) => dirty[table].filter((key) => !inSync.has(`${table}:${key}`));
  const present = <T>(records: (T | undefined)[]) => records.filter((r): r is T => r !== undefined);

  if (dirty.settings && !inSync.has('settings')) {
    const row = await db.settings.get('singleton');
    if (row) {
      const { key: _key, ...settings } = row;
      writes.push({ collection: 'meta', id: 'settings', data: settings, merge: false });
    }
  }

  const choices = present(await db.algChoices.bulkGet(pending('algChoices')));
  const progress = present(await db.progress.bulkGet(pending('progress')));
  const stats = present(await db.trainerStats.bulkGet(pending('trainerStats')));
  if (choices.length || progress.length || stats.length) {
    const data: Record<string, unknown> = {};
    if (choices.length) data.choices = Object.fromEntries(choices.map((c) => [c.caseId, encodeChoice(c)]));
    if (progress.length)
      data.progress = Object.fromEntries(progress.map((p) => [p.caseId, encodeProgress(p)]));
    if (stats.length) data.trainerStats = Object.fromEntries(stats.map((s) => [s.caseId, encodeStats(s)]));
    writes.push({ collection: 'meta', id: 'algs', data, merge: true });
  }

  for (const session of present(await db.sessions.bulkGet(pending('sessions')))) {
    writes.push({ collection: 'sessions', id: session.id, data: sessionData(session), merge: false });
  }

  const chunks = new Map<string, { sessionId: string; solves: Record<string, string> }>();
  for (const solve of present(await db.solves.bulkGet(pending('solves')))) {
    const id = chunkIdOf(solve);
    const chunk = chunks.get(id) ?? { sessionId: solve.sessionId, solves: {} };
    chunk.solves[solve.id] = encodeSolve(solve);
    chunks.set(id, chunk);
  }
  for (const [id, data] of chunks) writes.push({ collection: 'solveChunks', id, data, merge: true });
  return writes;
}

/** Pull, merge and push once for the signed-in user `uid`. */
export async function syncOnce(
  db: CubeBuddyDB,
  cloud: Cloud,
  uid: string,
  now: () => number = Date.now,
): Promise<SyncResult> {
  const saved = await readSyncState(db);
  const first = !saved || saved.uid !== uid;
  const start = now();
  // A clock that went backwards would hide edits from the watermark; push everything instead.
  const since = first || start < saved.lastPushedAt ? 0 : saved.lastPushedAt;
  const cursor = first ? null : saved.cursor;

  // Collect what changed locally before merging, so remote records written by the merge aren't pushed back.
  const dirty = await dirtyKeys(db, since);
  const pulled = await cloud.pull(cursor);
  const { changed, inSync, pulled: pulledCount } = await applyPull(db, pulled, first);
  const writes = await buildWrites(db, dirty, inSync);
  if (writes.length) await cloud.push(writes);

  let next = cursor;
  for (const doc of [...pulled.meta, ...pulled.sessions, ...pulled.solveChunks]) {
    if (cursorAfter(doc.syncedAt, next)) next = doc.syncedAt;
  }
  // Anything written from here on has updatedAt ≥ start, so it is picked up next round.
  const state: SyncState = { uid, cursor: next, lastPushedAt: start - 1 };
  await db.syncMeta.put({ key: SYNC_KEY, value: state });
  return { pulled: pulledCount, pushed: writes.length, changed };
}
