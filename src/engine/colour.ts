import { analyse2x2, analyse3x3 } from './analyse';
import type { Facelets } from './facelets';
import { crossDistance, faceDistance } from './solvers';

/*
 * Cross colour modes (D-013, D-095). The helpers solve with one colour at a time; this picks it. A colour
 * whose solve is further along always wins (so a finished white cross keeps white for the rest of the
 * solve); before any progress, the shortest cross (2x2: first face) wins. Ties go to the earlier colour in
 * the allowed list, so white comes first and the choice is deterministic.
 */

/** How far the solve on `colour` has got: 0 = nothing, 1–5 = cross + pairs (2x2: face), then LL stages. */
function progress(state: Facelets, puzzle: '3x3x3' | '2x2x2', colour: number): number {
  if (puzzle === '2x2x2') {
    return { face: 0, oll: 1, pbl: 2, auf: 3, solved: 4 }[analyse2x2(state, colour).stage];
  }
  const report = analyse3x3(state, colour);
  if (report.solved) return 8;
  if (report.solvedUpToAuf) return 7;
  if (report.llOriented) return 6;
  return report.crossSolved ? 1 + report.solvedPairs.length : 0;
}

export function chooseColour(state: Facelets, puzzle: '3x3x3' | '2x2x2', colours: readonly number[]): number {
  if (colours.length === 1) return colours[0]!;
  let best = colours[0]!;
  let bestScore = -Infinity;
  for (const colour of colours) {
    const done = progress(state, puzzle, colour);
    // Progress first; with none yet, the shorter first step wins (at most 8 moves for a cross, 7 for a face).
    const distance =
      done > 0 ? 0 : puzzle === '2x2x2' ? faceDistance(state, colour) : crossDistance(state, colour);
    const score = done * 100 - distance;
    if (score > bestScore) {
      best = colour;
      bestScore = score;
    }
  }
  return best;
}
