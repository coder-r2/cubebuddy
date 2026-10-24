import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { CubeBuddyDB } from '../db/db';
import type { Solve } from '../db/types';
import { createSettingsStore } from '../stores/settings';
import { createTimerStore } from '../stores/timer';
import { createTrainerStore } from '../stores/trainer';
import { MemoryCloud } from './memoryCloud';
import { readSyncState, requestFullPush, syncOnce } from './syncEngine';

let dbCounter = 0;
const freshDb = () => new CubeBuddyDB(`cubebuddy-sync-test-${dbCounter++}`);
const UID = 'user-1';

const liveSolves = async (db: CubeBuddyDB) => (await db.solves.toArray()).filter((s) => !s.deleted);
const liveSessions = async (db: CubeBuddyDB) => (await db.sessions.toArray()).filter((s) => !s.deleted);

/** A device: its own database and stores, sharing one cloud with the other devices. */
async function device() {
  const db = freshDb();
  const timer = createTimerStore(db);
  await timer.getState().load();
  return { db, timer, settings: createSettingsStore(db), trainer: createTrainerStore(db) };
}

async function addSolves(timer: ReturnType<typeof createTimerStore>, times: number[]) {
  const added: Solve[] = [];
  for (const timeMs of times) {
    added.push(await timer.getState().addSolve({ timeMs, penalty: 0, scramble: 'R U', source: 'timer' }));
  }
  return added;
}

describe('sync', () => {
  it('merges local and cloud data as a union on the first sign-in', async () => {
    const cloud = new MemoryCloud();
    const laptop = await device();
    await addSolves(laptop.timer, [10_000, 11_000]);
    await syncOnce(laptop.db, cloud, UID);

    const phone = await device();
    await phone.timer.getState().createSession('OH', '3x3x3');
    await addSolves(phone.timer, [30_000]);
    await syncOnce(phone.db, cloud, UID);
    await syncOnce(laptop.db, cloud, UID);

    for (const { db } of [laptop, phone]) {
      expect((await liveSolves(db)).map((s) => s.timeMs).sort()).toEqual([10_000, 11_000, 30_000]);
      // The phone's own empty "3x3" session was folded into the laptop's.
      expect((await liveSessions(db)).map((s) => s.name).sort()).toEqual(['3x3', 'OH']);
    }
  });

  it('keeps the newest edit of a record (last write wins)', async () => {
    const cloud = new MemoryCloud();
    const a = await device();
    const [solve] = await addSolves(a.timer, [12_000]);
    await syncOnce(a.db, cloud, UID);
    const b = await device();
    await syncOnce(b.db, cloud, UID);

    // A edits first, B edits later; B's later edit wins on both devices whatever order they sync in.
    await a.db.solves.update(solve!.id, { penalty: 2000, updatedAt: Date.now() + 1000 });
    await b.db.solves.update(solve!.id, { penalty: 'DNF', updatedAt: Date.now() + 2000 });
    await syncOnce(b.db, cloud, UID);
    await syncOnce(a.db, cloud, UID);
    await syncOnce(b.db, cloud, UID);
    expect((await a.db.solves.get(solve!.id))?.penalty).toBe('DNF');
    expect((await b.db.solves.get(solve!.id))?.penalty).toBe('DNF');
  });

  it('propagates deletions as tombstones', async () => {
    const cloud = new MemoryCloud();
    const a = await device();
    const [keep, remove] = await addSolves(a.timer, [9_000, 8_000]);
    await syncOnce(a.db, cloud, UID);
    const b = await device();
    await syncOnce(b.db, cloud, UID);
    expect(await liveSolves(b.db)).toHaveLength(2);

    await a.timer.getState().deleteSolve(remove!.id);
    await syncOnce(a.db, cloud, UID);
    await syncOnce(b.db, cloud, UID);
    expect((await liveSolves(b.db)).map((s) => s.id)).toEqual([keep!.id]);

    // Deleting a whole session deletes its solves everywhere too.
    const session = (await liveSessions(b.db))[0]!;
    await createTimerStore(b.db).getState().deleteSession(session.id);
    await syncOnce(b.db, cloud, UID);
    await syncOnce(a.db, cloud, UID);
    expect((await a.db.sessions.get(session.id))?.deleted).toBe(true);
    expect(await liveSolves(a.db)).toEqual([]);
  });

  it('syncs settings: the account wins on a new device, then the newest change wins', async () => {
    const cloud = new MemoryCloud();
    const a = await device();
    await a.settings.getState().hydrate();
    await a.settings.getState().update({ llMode: 'full', level: 4, onboardingDone: true });
    await syncOnce(a.db, cloud, UID);

    const b = await device();
    await b.settings.getState().hydrate();
    await b.settings.getState().update({ theme: 'dark' }); // newer, but the account's settings win
    const result = await syncOnce(b.db, cloud, UID);
    expect(result.changed.has('settings')).toBe(true);
    await b.settings.getState().hydrate();
    expect(b.settings.getState().settings).toMatchObject({ llMode: 'full', level: 4, theme: 'system' });

    await b.settings.getState().update({ animationSpeed: 5 });
    await syncOnce(b.db, cloud, UID);
    await syncOnce(a.db, cloud, UID);
    await a.settings.getState().hydrate();
    expect(a.settings.getState().settings.animationSpeed).toBe(5);
  });

  it('syncs alg choices, progress and trainer stats per case', async () => {
    const cloud = new MemoryCloud();
    const a = await device();
    await a.trainer.getState().load();
    await a.trainer.getState().setChoice('pll-t', 1);
    await a.trainer.getState().setProgress('oll-27', 'learned');
    await a.trainer.getState().recordTime('oll-27', 1500, null);
    await syncOnce(a.db, cloud, UID);

    const b = await device();
    await b.trainer.getState().load();
    await b.trainer.getState().setProgress('pll-t', 'learning');
    const result = await syncOnce(b.db, cloud, UID);
    expect(result.changed.has('trainer')).toBe(true);
    await syncOnce(a.db, cloud, UID);

    for (const { db } of [a, b]) {
      expect((await db.algChoices.get('pll-t'))?.selected).toBe(1);
      expect((await db.progress.get('oll-27'))?.state).toBe('learned');
      expect((await db.progress.get('pll-t'))?.state).toBe('learning');
      expect((await db.trainerStats.get('oll-27'))?.recentTimesMs).toEqual([1500]);
    }
  });

  it('only pushes what changed and stores solves in weekly chunks', async () => {
    const cloud = new MemoryCloud();
    const a = await device();
    await addSolves(a.timer, [1, 2, 3, 4, 5]);
    const first = await syncOnce(a.db, cloud, UID);
    expect(first.pushed).toBe(2); // the session + one chunk with all five solves
    expect(cloud.docs.solveChunks.size).toBe(1);

    expect((await syncOnce(a.db, cloud, UID)).pushed).toBe(0);
    await addSolves(a.timer, [6]);
    expect((await syncOnce(a.db, cloud, UID)).pushed).toBe(1);
    expect(Object.keys(cloud.docs.solveChunks.values().next().value!.data.solves as object)).toHaveLength(6);
  });

  it('pushes everything again after a full-push request (e.g. a JSON import)', async () => {
    const cloud = new MemoryCloud();
    const a = await device();
    const [solve] = await addSolves(a.timer, [1]);
    await syncOnce(a.db, cloud, UID);
    await syncOnce(a.db, cloud, UID);
    // An imported record keeps its old updatedAt, so the watermark alone would never push it.
    await a.db.solves.put({ ...solve!, id: 'imported', createdAt: 5, updatedAt: 5 });
    expect((await syncOnce(a.db, cloud, UID)).pushed).toBe(0);
    await requestFullPush(a.db);
    expect((await readSyncState(a.db))?.lastPushedAt).toBe(0);
    expect((await syncOnce(a.db, cloud, UID)).pushed).toBeGreaterThan(0);
    expect([...cloud.docs.solveChunks.keys()]).toContain(`${solve!.sessionId}_0`);
  });

  it('treats a different account as a first sign-in', async () => {
    const cloud = new MemoryCloud();
    const other = new MemoryCloud();
    const a = await device();
    await addSolves(a.timer, [7]);
    await syncOnce(a.db, cloud, UID);
    const result = await syncOnce(a.db, other, 'user-2');
    expect(result.pushed).toBe(2);
    expect((await readSyncState(a.db))?.uid).toBe('user-2');
  });

  it('ignores malformed cloud records', async () => {
    const cloud = new MemoryCloud();
    await cloud.push([
      { collection: 'sessions', id: 's1', data: { name: 5 }, merge: false },
      {
        collection: 'solveChunks',
        id: 's1_0',
        data: { sessionId: 's1', solves: { x: 'not json' } },
        merge: true,
      },
      { collection: 'meta', id: 'algs', data: { choices: { 'pll-t': '{"selected":9}' } }, merge: true },
    ]);
    const a = await device();
    await syncOnce(a.db, cloud, UID);
    expect(await a.db.sessions.get('s1')).toBeUndefined();
    expect(await a.db.solves.get('x')).toBeUndefined();
    expect(await a.db.algChoices.get('pll-t')).toBeUndefined();
  });
});
