import type { Puzzle } from '../../db/types';

/** WCA event ids used by cubing.js. */
export const EVENT_FOR_PUZZLE: Record<Puzzle, '333' | '222'> = { '3x3x3': '333', '2x2x2': '222' };

// One scramble per puzzle is generated ahead of time, so "next" is instant after a solve.
const prefetched = new Map<Puzzle, Promise<string>>();

async function generate(puzzle: Puzzle): Promise<string> {
  // Loaded on demand: random-state scrambles run in cubing.js's own worker (D-055).
  const { randomScrambleForEvent } = await import('cubing/scramble');
  return (await randomScrambleForEvent(EVENT_FOR_PUZZLE[puzzle])).toString();
}

/** A fresh random-state scramble; starts generating the following one in the background. */
export function nextScramble(puzzle: Puzzle): Promise<string> {
  const ready = prefetched.get(puzzle) ?? generate(puzzle);
  const following = ready.then(
    () => generate(puzzle),
    () => generate(puzzle),
  );
  // Avoid unhandled rejections for a prefetch nobody has asked for yet.
  following.catch(() => undefined);
  prefetched.set(puzzle, following);
  return ready;
}
