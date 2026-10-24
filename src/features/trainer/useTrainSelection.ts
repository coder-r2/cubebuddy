import { useState } from 'react';
import type { ProgressState } from '../../db/types';
import type { AlgSet } from '../../data/algs/types';

const key = (setId: string) => `cubebuddy:trainer:train:${setId}`;

function read(setId: string): string[] | null {
  try {
    const raw = localStorage.getItem(key(setId));
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

/**
 * Cases picked for the drills (per set, per device). Until the user picks, it defaults to the cases marked
 * "Learning", or the whole set if none are.
 */
export function useTrainSelection(set: AlgSet, progress: Record<string, ProgressState>) {
  const [stored, setStored] = useState<string[] | null>(() => read(set.id));
  const learning = set.cases.filter((c) => progress[c.id] === 'learning').map((c) => c.id);
  const ids = stored ?? (learning.length ? learning : set.cases.map((c) => c.id));

  const save = (next: string[]) => {
    setStored(next);
    try {
      localStorage.setItem(key(set.id), JSON.stringify(next));
    } catch {
      // Selection still works for this visit.
    }
  };

  return {
    selected: new Set(ids),
    toggle: (id: string) => save(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]),
    setAll: save,
  };
}
