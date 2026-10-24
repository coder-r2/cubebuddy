import { Dexie, type EntityTable } from 'dexie';
import type { AlgChoice, Progress, Session, SettingsRow, Solve, SyncMeta, TrainerStats } from './types';

// The database name is namespaced because every coder-r2.github.io project shares one origin (D-030).
export const DB_NAME = 'cubebuddy';

/** Tables whose records sync to the cloud (everything except syncMeta). */
export const SYNCED_TABLES = [
  'settings',
  'sessions',
  'solves',
  'algChoices',
  'progress',
  'trainerStats',
] as const;
export type SyncedTable = (typeof SYNCED_TABLES)[number];

export class CubeBuddyDB extends Dexie {
  settings!: EntityTable<SettingsRow, 'key'>;
  sessions!: EntityTable<Session, 'id'>;
  solves!: EntityTable<Solve, 'id'>;
  algChoices!: EntityTable<AlgChoice, 'caseId'>;
  progress!: EntityTable<Progress, 'caseId'>;
  trainerStats!: EntityTable<TrainerStats, 'caseId'>;
  syncMeta!: EntityTable<SyncMeta, 'key'>;

  private writeListeners = new Set<(table: SyncedTable) => void>();
  /** True while sync writes cloud data locally, so those writes don't schedule another push. */
  applyingRemote = false;

  constructor(name = DB_NAME) {
    super(name);
    this.version(1).stores({
      settings: 'key',
      sessions: 'id, puzzle, updatedAt',
      solves: 'id, [sessionId+createdAt], updatedAt',
      algChoices: 'caseId, updatedAt',
      progress: 'caseId, updatedAt',
      trainerStats: 'caseId, updatedAt',
      syncMeta: 'key',
    });
    // Tell the sync service about local writes so it can schedule a push (D-092). Which records to push
    // is decided by their updatedAt, not by this signal, so a missed notification only delays a push.
    this.use({
      stack: 'dbcore',
      name: 'cubebuddy-write-notify',
      create: (down) => ({
        ...down,
        table: (tableName) => {
          const table = down.table(tableName);
          if (!(SYNCED_TABLES as readonly string[]).includes(tableName)) return table;
          return {
            ...table,
            mutate: async (req) => {
              const result = await table.mutate(req);
              if (!this.applyingRemote) this.writeListeners.forEach((fn) => fn(tableName as SyncedTable));
              return result;
            },
          };
        },
      }),
    });
  }

  /** Subscribe to local writes on synced tables; returns an unsubscribe function. */
  onLocalWrite(listener: (table: SyncedTable) => void): () => void {
    this.writeListeners.add(listener);
    return () => this.writeListeners.delete(listener);
  }
}

export const db = new CubeBuddyDB();
