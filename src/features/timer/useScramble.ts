import { useCallback, useEffect, useState } from 'react';
import type { Puzzle } from '../../db/types';
import { nextScramble } from './scrambles';

interface ScrambleState {
  puzzle: Puzzle;
  scramble: string | null;
  error: boolean;
}

/** Current scramble for `puzzle`; `next()` swaps in the prefetched one. */
export function useScramble(puzzle: Puzzle) {
  const [request, setRequest] = useState(0);
  const [state, setState] = useState<ScrambleState>({ puzzle, scramble: null, error: false });

  useEffect(() => {
    let cancelled = false;
    nextScramble(puzzle).then(
      (scramble) => !cancelled && setState({ puzzle, scramble, error: false }),
      (error: unknown) => {
        console.error('Scramble generation failed', error);
        if (!cancelled) setState({ puzzle, scramble: null, error: true });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [puzzle, request]);

  const next = useCallback(() => {
    // Clear right away so a used scramble is never attached to the next solve.
    setState((s) => ({ ...s, scramble: null, error: false }));
    setRequest((n) => n + 1);
  }, []);
  // A scramble for the previous puzzle is never shown as current.
  const current = state.puzzle === puzzle ? state : { puzzle, scramble: null, error: false };
  return { scramble: current.scramble, error: current.error, next };
}
