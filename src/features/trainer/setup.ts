import type { AlgCase, AlgSet, Goal } from '../../data/algs/types';
import { getSet } from '../../data/algs/sets';
import { applyMoves, centre, solvedFacelets } from '../../engine/facelets';
import { formatAlg, invertAlg, mergeMoves, parseAlg, type Move } from '../../engine/notation';

/*
 * Timed-drill setup scrambles (D-028, D-056). The case is built as: randomise everything the case ignores,
 * then the inverse of (pre-AUF + alg); cubing.js's solver turns that state into a normal-looking scramble.
 * Setups that equal an inverted alg of the case are rejected, so the scramble never gives the answer away.
 * Scrambles are applied holding the last layer on top (cross / first face on the bottom).
 */

const AUFS = ['', 'U', "U'", 'U2'];
const DS = ['', 'D', "D'", 'D2'];

const pick = <T>(items: readonly T[], random: () => number) => items[Math.floor(random() * items.length)]!;
const mains = (setId: Parameters<typeof getSet>[0], keep: (c: AlgCase) => boolean = () => true) =>
  getSet(setId)!
    .cases.filter(keep)
    .map((c) => c.algs[0]);

/** Moves applied before the case to scramble the pieces it doesn't care about. */
function randomiser(goal: Goal, random: () => number): string[] {
  const auf = () => pick(AUFS, random);
  switch (goal) {
    case 'eo':
      // Corner-only OLLs, so the edge orientation that defines the case is untouched.
      return [
        pick(
          mains('oll-2look', (c) => c.goal !== 'eo'),
          random,
        ),
        auf(),
        pick(mains('pll'), random),
        auf(),
      ];
    case 'oll':
      return [pick(mains('pll'), random), auf()];
    case 'cpll':
      return [
        pick(
          mains('pll-2look', (c) => c.goal !== 'cpll'),
          random,
        ),
        auf(),
      ];
    case 'pll':
      return [auf()];
    case 'f2l-pair':
      return [pick(mains('oll'), random), auf(), pick(mains('pll'), random), auf()];
    case 'ortega-oll':
      return [
        pick(
          mains('ortega', (c) => c.goal === 'pbl'),
          random,
        ),
        auf(),
        pick(DS, random),
      ];
    case 'pbl':
      return [auf(), pick(DS, random)];
    case 'cll':
      return [auf()];
  }
}

// Every whole-cube orientation: 6 choices of top face × 4 y-turns.
const ROTATIONS = ['', 'x', 'x2', "x'", 'z', "z'"].flatMap((r) =>
  AUFS.map((y) => `${r} ${y.replace('U', 'y')}`.trim()),
);

/** Rotation that returns the centres to their home faces (cubing.js's solver requires an unrotated cube). */
function reorient(moves: Move[]): Move[] {
  const state = applyMoves(solvedFacelets(), moves);
  for (const r of ROTATIONS) {
    const rotation = parseAlg(r);
    const s = applyMoves(state, rotation);
    if ([0, 1, 2, 3, 4, 5].every((f) => centre(s, f) === f)) return rotation;
  }
  throw new Error('No reorientation found');
}

export interface Setup {
  scramble: string;
  /** The moves (randomiser + case) the scramble reproduces, for tests. */
  target: string;
}

const normalise = (alg: string) => formatAlg(mergeMoves(parseAlg(alg)));

export async function caseSetup(
  set: AlgSet,
  algCase: AlgCase,
  random: () => number = Math.random,
  /** The user's custom alg, if any: also never revealed. */
  customAlg?: string,
): Promise<Setup> {
  const goal = algCase.goal ?? set.goal;
  const [{ cube3x3x3, cube2x2x2 }, search] = await Promise.all([
    import('cubing/puzzles'),
    import('cubing/search'),
  ]);
  const known = customAlg ? [...algCase.algs, customAlg] : algCase.algs;
  const forbidden = new Set(known.map((a) => normalise(formatAlg(invertAlg(parseAlg(a))))));

  for (let attempt = 0; attempt < 8; attempt++) {
    const moves = [
      ...randomiser(goal, random).flatMap((a) => parseAlg(a)),
      ...invertAlg([...parseAlg(pick(AUFS, random)), ...parseAlg(algCase.algs[0])]),
    ];
    const target = formatAlg([...moves, ...reorient(moves)]);
    const kpuzzle = await (set.puzzle === '2x2x2' ? cube2x2x2 : cube3x3x3).kpuzzle();
    const pattern = kpuzzle.defaultPattern().applyAlg(target);
    const solution =
      set.puzzle === '2x2x2'
        ? await search.experimentalSolve2x2x2(pattern)
        : await search.experimentalSolve3x3x3IgnoringCenters(pattern);
    // Our notation (cubing.js writes half turns as "R2'").
    const scramble = formatAlg(parseAlg(solution.invert().toString()));
    if (scramble && !forbidden.has(normalise(scramble))) return { scramble, target };
  }
  throw new Error('Could not build a setup scramble');
}
