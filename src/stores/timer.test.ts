import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { CubeBuddyDB } from '../db/db';
import fixture from '../features/timer/__fixtures__/cstimer-export.txt?raw';
import { parseCstimer } from '../features/timer/cstimer';
import { createTimerStore } from './timer';

let dbCounter = 0;
const freshDb = () => new CubeBuddyDB(`cubebuddy-timer-test-${dbCounter++}`);

async function loadedStore(database = freshDb()) {
  const store = createTimerStore(database);
  await store.getState().load();
  return store;
}

describe('timer store', () => {
  it('creates a default 3x3 session on first load', async () => {
    const store = await loadedStore();
    const { sessions, currentSessionId } = store.getState();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ name: '3x3', puzzle: '3x3x3' });
    expect(currentSessionId).toBe(sessions[0]!.id);
  });

  it('persists solves, penalty edits and deletions', async () => {
    const database = freshDb();
    const store = await loadedStore(database);
    const first = await store
      .getState()
      .addSolve({ timeMs: 12_340, penalty: 0, scramble: 'R U', source: 'timer' });
    await store.getState().addSolve({ timeMs: 9_000, penalty: 0, scramble: 'F', source: 'typed' });
    await store.getState().updateSolve(first.id, { penalty: 2000, comment: 'lockup' });

    const reloaded = await loadedStore(database);
    expect(reloaded.getState().solves.map((s) => [s.timeMs, s.penalty, s.comment])).toEqual([
      [12_340, 2000, 'lockup'],
      [9_000, 0, ''],
    ]);

    await reloaded.getState().deleteSolve(first.id);
    expect((await loadedStore(database)).getState().solves).toHaveLength(1);
    expect((await database.solves.get(first.id))?.deleted).toBe(true);
  });

  it('keeps solves separate per session and switches between them', async () => {
    const store = await loadedStore();
    const original = store.getState().currentSessionId!;
    await store.getState().addSolve({ timeMs: 1000, penalty: 0, scramble: '', source: 'timer' });
    const twoByTwo = await store.getState().createSession('Ortega', '2x2x2');
    expect(store.getState().currentSessionId).toBe(twoByTwo.id);
    expect(store.getState().solves).toEqual([]);
    await store.getState().selectSession(original);
    expect(store.getState().solves).toHaveLength(1);
  });

  it('renames and deletes sessions, always leaving one', async () => {
    const store = await loadedStore();
    const id = store.getState().currentSessionId!;
    await store.getState().renameSession(id, '  Main  ');
    expect(store.getState().sessions[0]!.name).toBe('Main');
    await store.getState().deleteSession(id);
    const { sessions, currentSessionId } = store.getState();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.id).not.toBe(id);
    expect(currentSessionId).toBe(sessions[0]!.id);
  });

  it('imports a cstimer file, skips unsupported events and duplicates on re-import', async () => {
    const store = await loadedStore();
    const parsed = parseCstimer(fixture);

    const first = await store.getState().importSessions(parsed);
    expect(first).toEqual({
      sessionsCreated: 3,
      solvesAdded: 8,
      duplicatesSkipped: 0,
      unsupportedSessions: ['4x4'],
    });
    expect(store.getState().sessions.map((s) => s.name)).toEqual(['3x3', 'cstimer 1', 'One-handed', '2x2']);

    const second = await store.getState().importSessions(parsed);
    expect(second).toEqual({
      sessionsCreated: 0,
      solvesAdded: 0,
      duplicatesSkipped: 8,
      unsupportedSessions: ['4x4'],
    });
  });

  it('round-trips cstimer import → export', async () => {
    const store = await loadedStore();
    const parsed = parseCstimer(fixture);
    await store.getState().importSessions(parsed);
    const imported = store.getState().sessions.filter((s) => s.name !== '3x3');

    const exported = parseCstimer(await store.getState().exportSessions(imported.map((s) => s.id)));
    expect(exported).toEqual(parsed.filter((s) => s.puzzle));
  });
});
