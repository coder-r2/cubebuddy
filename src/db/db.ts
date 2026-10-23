import { Dexie, type EntityTable } from 'dexie';
import type { AlgChoice, Progress, Session, SettingsRow, Solve, SyncMeta, TrainerStats } from './types';

// The database name is namespaced because every coder-r2.github.io project shares one origin (D-030).
export const DB_NAME = 'cubebuddy';

export class CubeBuddyDB extends Dexie {
  settings!: EntityTable<SettingsRow, 'key'>;
  sessions!: EntityTable<Session, 'id'>;
  solves!: EntityTable<Solve, 'id'>;
  algChoices!: EntityTable<AlgChoice, 'caseId'>;
  progress!: EntityTable<Progress, 'caseId'>;
  trainerStats!: EntityTable<TrainerStats, 'caseId'>;
  syncMeta!: EntityTable<SyncMeta, 'key'>;

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
  }
}

export const db = new CubeBuddyDB();
