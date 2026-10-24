import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { CubeViewHandle } from '../../components/CubeView/CubeView';
import { formatMove, invertMove, parseMove } from '../../engine/notation';

export interface LogEntry {
  move: string;
  /** Helper moves are shown in a different colour and never merge with user moves (D-033). */
  source: 'user' | 'helper';
}

interface PlayState {
  /** Scramble the session started from (undo stops here). */
  base: string;
  log: LogEntry[];
  redo: LogEntry[];
}

const EMPTY: PlayState = { base: '', log: [], redo: [] };

/** After this many animated moves the cube's internal move list is rebuilt from the state (see D-061). */
const COMPACT_AFTER = 80;

/** Normalise any notation cubing.js reports ("2R", "Rv") to ours ("M'", "x"). */
export const normalise = (move: string) => {
  const parsed = parseMove(move);
  return parsed ? formatMove(parsed) : null;
};

const inverse = (move: string) => formatMove(invertMove(parseMove(move)!));

/**
 * Free-play move history (SPEC §5.3, D-032): a raw log where undo/redo always revert exactly one physical
 * move, kept in sync with the CubeView.
 */
export function useFreePlay(cube: RefObject<CubeViewHandle | null>) {
  const [state, setState] = useState<PlayState>(EMPTY);
  const stateRef = useRef(state);
  const sinceReset = useRef(0);

  const update = useCallback((next: PlayState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const queue = useCallback(
    (moves: string[]) => {
      sinceReset.current += moves.length;
      return cube.current?.queueMoves(moves) ?? false;
    },
    [cube],
  );

  /** Record moves; `animate` is false for taps, which cubing.js has already animated. */
  const addMoves = useCallback(
    (moves: string[], source: LogEntry['source'], animate: boolean) => {
      const entries = moves.map((move) => ({ move, source }));
      if (animate && !queue(moves)) return;
      if (!animate) sinceReset.current += moves.length;
      const current = stateRef.current;
      update({ ...current, log: [...current.log, ...entries], redo: [] });
    },
    [queue, update],
  );

  const undo = useCallback(() => {
    const current = stateRef.current;
    const last = current.log.at(-1);
    if (!last || !queue([inverse(last.move)])) return;
    update({ ...current, log: current.log.slice(0, -1), redo: [...current.redo, last] });
  }, [queue, update]);

  const redo = useCallback(() => {
    const current = stateRef.current;
    const next = current.redo.at(-1);
    if (!next || !queue([next.move])) return;
    update({ ...current, log: [...current.log, next], redo: current.redo.slice(0, -1) });
  }, [queue, update]);

  /** Start over from `base` (a scramble, or solved). */
  const reset = useCallback(
    (base = '') => {
      sinceReset.current = 0;
      cube.current?.reset(base);
      update({ base, log: [], redo: [] });
    },
    [cube, update],
  );

  const sequence = [state.base, ...state.log.map((e) => e.move)].filter(Boolean).join(' ');

  // Keep cubing.js's move list short: once idle, snap to the same state with an empty move list.
  useEffect(() => {
    if (sinceReset.current < COMPACT_AFTER) return;
    const timer = setTimeout(() => {
      sinceReset.current = 0;
      cube.current?.reset(sequence);
    }, 1500);
    return () => clearTimeout(timer);
  }, [cube, sequence]);

  return { base: state.base, log: state.log, redoStack: state.redo, sequence, addMoves, undo, redo, reset };
}
