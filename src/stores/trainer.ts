import { create } from 'zustand';
import { db as defaultDb, type CubeBuddyDB } from '../db/db';
import type { AlgChoice, ProgressState, TrainerStats } from '../db/types';
import { findCase } from '../data/algs/sets';
import { afterRecognition, afterTimed, emptyStats } from '../features/trainer/srs';

interface TrainerStoreState {
  loaded: boolean;
  choices: Record<string, AlgChoice>;
  progress: Record<string, ProgressState>;
  stats: Record<string, TrainerStats>;
  load: () => Promise<void>;
  setChoice: (caseId: string, selected: AlgChoice['selected'], customAlg?: string) => Promise<void>;
  setProgress: (caseId: string, state: ProgressState) => Promise<void>;
  recordTime: (caseId: string, timeMs: number, setAverage: number | null) => Promise<void>;
  recordRecognition: (caseId: string, correct: boolean) => Promise<void>;
}

/** The alg the user has chosen for a case (D-016): main, an alternative, or their verified custom alg. */
export function chosenAlg(caseId: string, choices: Record<string, AlgChoice>): string {
  const found = findCase(caseId);
  if (!found) return '';
  const choice = choices[caseId];
  if (choice?.selected === 'custom' && choice.customAlg) return choice.customAlg;
  if (typeof choice?.selected === 'number')
    return found.algCase.algs[choice.selected] ?? found.algCase.algs[0];
  return found.algCase.algs[0];
}

/** caseId → alg for every case with a non-default choice (sent to the engine worker). */
export function choiceMap(choices: Record<string, AlgChoice>): Record<string, string> {
  return Object.fromEntries(Object.keys(choices).map((id) => [id, chosenAlg(id, choices)]));
}

export function createTrainerStore(database: CubeBuddyDB = defaultDb) {
  return create<TrainerStoreState>((set, get) => ({
    loaded: false,
    choices: {},
    progress: {},
    stats: {},

    async load() {
      const [choices, progress, stats] = await Promise.all([
        database.algChoices.toArray(),
        database.progress.toArray(),
        database.trainerStats.toArray(),
      ]);
      set({
        loaded: true,
        choices: Object.fromEntries(choices.map((c) => [c.caseId, c])),
        progress: Object.fromEntries(progress.map((p) => [p.caseId, p.state])),
        stats: Object.fromEntries(stats.map((s) => [s.caseId, s])),
      });
    },

    async setChoice(caseId, selected, customAlg) {
      const choice: AlgChoice = {
        caseId,
        selected,
        ...(customAlg ? { customAlg } : {}),
        updatedAt: Date.now(),
      };
      set({ choices: { ...get().choices, [caseId]: choice } });
      await database.algChoices.put(choice);
    },

    async setProgress(caseId, state) {
      set({ progress: { ...get().progress, [caseId]: state } });
      await database.progress.put({ caseId, state, updatedAt: Date.now() });
    },

    async recordTime(caseId, timeMs, average) {
      const next = afterTimed(get().stats[caseId] ?? emptyStats(caseId), timeMs, average);
      set({ stats: { ...get().stats, [caseId]: next } });
      await database.trainerStats.put(next);
    },

    async recordRecognition(caseId, correct) {
      const next = afterRecognition(get().stats[caseId] ?? emptyStats(caseId), correct);
      set({ stats: { ...get().stats, [caseId]: next } });
      await database.trainerStats.put(next);
    },
  }));
}

export const useTrainerStore = createTrainerStore();
