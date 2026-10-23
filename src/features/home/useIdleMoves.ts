import { useEffect, type RefObject } from 'react';
import type { CubeViewHandle } from '../../components/CubeView/CubeView';
import { randomMove } from '../../lib/randomMove';

const INTERVAL_MS = 2000;
/** After this many moves the state is re-expressed as a short setup so the move list stays small. */
const COMPACT_AFTER = 120;

async function shortSetupFor(moves: string): Promise<string> {
  const [{ cube3x3x3 }, { experimentalSolve3x3x3IgnoringCenters }] = await Promise.all([
    import('cubing/puzzles'),
    import('cubing/search'),
  ]);
  const kpuzzle = await cube3x3x3.kpuzzle();
  const solution = await experimentalSolve3x3x3IgnoringCenters(kpuzzle.defaultPattern().applyAlg(moves));
  return solution.invert().toString();
}

/** Plays one random face turn every 2 s on the given cube while the tab is visible (SPEC §5.1). */
export function useIdleMoves(cube: RefObject<CubeViewHandle | null>) {
  useEffect(() => {
    let setup = '';
    let moves: string[] = [];
    let compacting = false;

    const tick = () => {
      if (document.hidden || compacting || !cube.current) return;

      if (moves.length >= COMPACT_AFTER) {
        compacting = true;
        const all = `${setup} ${moves.join(' ')}`;
        shortSetupFor(all)
          .then((short) => {
            setup = short;
            moves = [];
            cube.current?.reset(short);
          })
          .catch((error: unknown) => console.warn('Idle cube compaction failed', error))
          .finally(() => {
            compacting = false;
          });
        return;
      }

      const move = randomMove(moves.at(-1));
      if (cube.current.queueMoves([move])) moves.push(move);
    };

    const id = window.setInterval(tick, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [cube]);
}
