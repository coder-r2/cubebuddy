import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { CubeBuddyDB } from '../db/db';
import { createSettingsStore } from '../stores/settings';
import { createTimerStore } from '../stores/timer';
import { createTrainerStore } from '../stores/trainer';
import { BackupFormatError, exportBackup, importBackup, parseBackup, SCHEMA_VERSION } from './backup';

let dbCounter = 0;
const freshDb = () => new CubeBuddyDB(`cubebuddy-backup-test-${dbCounter++}`);

async function populated() {
  const db = freshDb();
  const timer = createTimerStore(db);
  await timer.getState().load();
  await timer
    .getState()
    .addSolve({ timeMs: 12_340, penalty: 2000, scramble: "R U R'", source: 'timer', comment: 'nice' });
  await timer.getState().addSolve({ timeMs: 9_870, penalty: 'DNF', scramble: 'F2 D', source: 'typed' });
  const doomed = await timer.getState().addSolve({ timeMs: 1, penalty: 0, scramble: 'U', source: 'timer' });
  await timer.getState().deleteSolve(doomed.id);
  await timer.getState().createSession('2x2 practice', '2x2x2');
  await timer.getState().addSolve({ timeMs: 4_000, penalty: 0, scramble: 'R U2', source: 'timer' });
  const settings = createSettingsStore(db);
  await settings.getState().hydrate();
  await settings.getState().update({ level: 3, llMode: 'full', keymap: { KeyQ: 'R' } });
  const trainer = createTrainerStore(db);
  await trainer.getState().setChoice('pll-t', 'custom', "R U R' U' R' F R2 U' R' U' R U R' F'");
  await trainer.getState().setProgress('oll-27', 'learned');
  await trainer.getState().recordTime('oll-27', 1200, null);
  return db;
}

describe('JSON backup', () => {
  it('round-trips export → import into an empty device', async () => {
    const source = await populated();
    const backup = await exportBackup(source, 42);
    expect(backup).toMatchObject({ app: 'cubebuddy', schemaVersion: SCHEMA_VERSION, exportedAt: 42 });
    expect(backup.solves).toHaveLength(3); // the deleted solve is left out

    const target = freshDb();
    const result = await importBackup(target, parseBackup(JSON.stringify(backup)));
    expect(result.added).toBe(backup.sessions.length + 3 + 1 + 1 + 1);
    expect(await exportBackup(target, 42)).toEqual(backup);
  });

  it('never replaces newer local data and skips duplicates on re-import', async () => {
    const db = await populated();
    const backup = await exportBackup(db);
    const solve = backup.solves[0]!;
    await db.solves.update(solve.id, { comment: 'edited later', updatedAt: solve.updatedAt + 1000 });

    const result = await importBackup(db, parseBackup(JSON.stringify(backup)));
    expect(result.added).toBe(0);
    expect(result.updated).toBe(0);
    expect((await db.solves.get(solve.id))?.comment).toBe('edited later');
  });

  it('rejects files that are not CubeBuddy backups, or come from a newer version', () => {
    expect(() => parseBackup('nope')).toThrow(BackupFormatError);
    expect(() => parseBackup('{"sessions":[]}')).toThrow(BackupFormatError);
    expect(() =>
      parseBackup(JSON.stringify({ app: 'cubebuddy', schemaVersion: SCHEMA_VERSION + 1 })),
    ).toThrow(/newer version/);
  });

  it('drops malformed records but keeps the rest', () => {
    const parsed = parseBackup(
      JSON.stringify({
        app: 'cubebuddy',
        schemaVersion: 1,
        sessions: [
          { id: 's', name: '3x3', puzzle: '3x3x3', createdAt: 1, updatedAt: 1, deleted: false },
          { id: 'bad' },
        ],
        solves: [
          {
            id: 'a',
            sessionId: 's',
            timeMs: 1000,
            penalty: 0,
            scramble: 'R',
            comment: '',
            source: 'timer',
            createdAt: 1,
            updatedAt: 1,
            deleted: false,
          },
          { id: 'b', sessionId: 's', timeMs: 'fast' },
        ],
        progress: [{ caseId: 'oll-1', state: 'maybe', updatedAt: 1 }],
      }),
    );
    expect(parsed.sessions.map((s) => s.id)).toEqual(['s']);
    expect(parsed.solves.map((s) => s.id)).toEqual(['a']);
    expect(parsed.progress).toEqual([]);
    expect(parsed.settings).toBeNull();
  });
});
