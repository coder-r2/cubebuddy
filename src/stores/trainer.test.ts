import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { CubeBuddyDB } from '../db/db';
import { chosenAlg, choiceMap, createTrainerStore } from './trainer';

let n = 0;
const freshDb = () => new CubeBuddyDB(`cubebuddy-trainer-test-${n++}`);

describe('trainer store', () => {
  it('persists alg choices, progress and drill stats', async () => {
    const database = freshDb();
    const store = createTrainerStore(database);
    await store.getState().load();
    await store.getState().setChoice('pll-ua', 1);
    await store.getState().setChoice('oll-27', 'custom', "U R U R' U R U2 R'");
    await store.getState().setProgress('oll-27', 'learned');
    await store.getState().recordTime('oll-27', 1500, null);
    await store.getState().recordRecognition('pll-ua', false);

    const again = createTrainerStore(database);
    await again.getState().load();
    const { choices, progress, stats } = again.getState();
    expect(chosenAlg('pll-ua', choices)).toBe("M2 U M U2 M' U M2");
    expect(chosenAlg('oll-27', choices)).toBe("U R U R' U R U2 R'");
    expect(chosenAlg('oll-1', choices)).toBe("R U2 R2 F R F' U2 R' F R F'");
    expect(progress['oll-27']).toBe('learned');
    expect(stats['oll-27']?.recentTimesMs).toEqual([1500]);
    expect(stats['pll-ua']?.recognitionMisses).toBe(1);
    expect(choiceMap(choices)).toEqual({ 'pll-ua': "M2 U M U2 M' U M2", 'oll-27': "U R U R' U R U2 R'" });
  });
});
