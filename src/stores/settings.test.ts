import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { CubeBuddyDB } from '../db/db';
import { createSettingsStore, DEFAULT_SETTINGS } from './settings';

let dbCounter = 0;
const freshDb = () => new CubeBuddyDB(`cubebuddy-test-${dbCounter++}`);

describe('settings store', () => {
  it('uses defaults when nothing is stored', async () => {
    const store = createSettingsStore(freshDb());
    await store.getState().hydrate();
    expect(store.getState().hydrated).toBe(true);
    expect(store.getState().settings).toEqual(DEFAULT_SETTINGS);
  });

  it('persists updates and restores them in a new store', async () => {
    const database = freshDb();
    const first = createSettingsStore(database);
    await first.getState().hydrate();
    await first.getState().update({ animationSpeed: 2, theme: 'dark' });

    const second = createSettingsStore(database);
    await second.getState().hydrate();
    expect(second.getState().settings.animationSpeed).toBe(2);
    expect(second.getState().settings.theme).toBe('dark');
    expect(second.getState().settings.updatedAt).toBeGreaterThan(0);
  });

  it('fills in defaults for fields missing from an older stored row', async () => {
    const database = freshDb();
    const { holdMs: _omitted, ...partial } = DEFAULT_SETTINGS;
    await database.settings.put({ key: 'singleton', ...partial, animationSpeed: 3 } as never);

    const store = createSettingsStore(database);
    await store.getState().hydrate();
    expect(store.getState().settings.animationSpeed).toBe(3);
    expect(store.getState().settings.holdMs).toBe(DEFAULT_SETTINGS.holdMs);
  });
});
