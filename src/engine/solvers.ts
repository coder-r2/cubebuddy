import {
  analyse2x2,
  analyse3x3,
  crossSolved,
  f2lSolved,
  faceWithColour,
  frameForCentre,
  frameForFace,
  llCornersPermuted,
  llEdgesOriented,
  llOriented,
  slotSolved,
  SLOT_PIECES,
  SLOTS,
  solvedUpToAuf,
  type Slot,
} from './analyse';
import { CORNER_FACELETS, EDGE_MOVE, CORNER_MOVE, FACE_MOVES, readPieces } from './cubies';
import { applyMoves, isSolved, solvedFacelets, type Facelets } from './facelets';
import {
  CPLL_ALGS,
  EO_ALGS,
  EPLL_ALGS,
  OCLL_ALGS,
  OLL_ALGS,
  ORTEGA_OLL_ALGS,
  PBL_ALGS,
  PLL_ALGS,
  type LLAlg,
} from './llAlgs';
import { FACES, parseAlg, type Move } from './notation';
import { getCrossTable, getFaceTable, getPairTable, getSlotTable, moveFacePattern } from './tables';

export type StepKind =
  'cross' | 'pair' | 'eo' | 'ocll' | 'oll' | 'cpll' | 'epll' | 'pll' | 'auf' | 'face' | 'ortega-oll' | 'pbl';

export interface Step {
  kind: StepKind;
  label: string;
  /** Case name for LL steps, e.g. "OLL 27 (Sune)" or "T". */
  caseName?: string;
  /** The alg used for an LL step, without AUFs. */
  alg?: string;
  /** F2L slot being solved, relative to the cross on the bottom. */
  slot?: Slot;
  moves: Move[];
}

export type F2LStyle = 'front-right' | 'rotationless';
export type LLMode = '2-look' | 'full';

export interface SolveOptions {
  /** Cross colour (3x3) or first-face colour (2x2), as a home-face index; 0 = white. */
  colour?: number;
  f2lStyle?: F2LStyle;
  llMode?: LLMode;
}

const opposite = (face: number) => (face + 3) % 6;

/** Skip a move on the same face as the previous one, and fix the order of commuting opposite faces. */
const redundant = (face: number, previous: number) =>
  face === previous || (previous >= 0 && face === opposite(previous) && face < previous);

// ---------------------------------------------------------------------------------------------------------
// Cross: the cross table is exact, so following strictly decreasing distances gives an optimal solution.

const crossIndex = (v: ArrayLike<number>) => ((v[0]! * 24 + v[1]!) * 24 + v[2]!) * 24 + v[3]!;

export function solveCross(state: Facelets, colour = 0): Step {
  const { prefix, state: framed } = frameForCentre(state, colour);
  const { edges } = readPieces(framed);
  const table = getCrossTable();
  let values = [edges[4]!, edges[5]!, edges[6]!, edges[7]!];
  let distance = table[crossIndex(values)]!;
  const path: Move[] = [];
  let previous = -1;
  while (distance > 0) {
    let advanced = false;
    for (let m = 0; m < 18 && !advanced; m++) {
      const face = Math.floor(m / 3);
      if (face === previous) continue;
      const next = values.map((v) => EDGE_MOVE[m]![v]!);
      if (table[crossIndex(next)] === distance - 1) {
        values = next;
        distance--;
        previous = face;
        path.push(FACE_MOVES[m]!);
        advanced = true;
      }
    }
    if (!advanced) throw new Error('Cross search failed');
  }
  return { kind: 'cross', label: 'Cross', moves: [...prefix, ...path] };
}

// ---------------------------------------------------------------------------------------------------------
// F2L pairs: IDA* in a frame where the target slot is front-right (SPEC §6.3).

const Y_FOR_SLOT: Record<Slot, Move[]> = {
  FR: [],
  FL: parseAlg("y'"),
  BL: parseAlg('y2'),
  BR: parseAlg('y'),
};

/** Face moves in tie-break order: R and U first. Front-right style uses ⟨R, U, F, L⟩ only. */
const MOVE_ORDER: Record<F2LStyle, number[]> = {
  'front-right': [1, 0, 2, 4].flatMap((f) => [f * 3, f * 3 + 1, f * 3 + 2]),
  rotationless: [1, 0, 2, 4, 5, 3].flatMap((f) => [f * 3, f * 3 + 1, f * 3 + 2]),
};

interface PairProblem {
  slot: Slot;
  /** Cross edges DR DF DL DB, target corner, target edge, then (corner, edge) of each preserved slot. */
  values: Uint8Array;
  preserved: Int8Array[];
}

function pairHeuristic(v: Uint8Array, preserved: Int8Array[], cross: Int8Array, pair: Int8Array): number {
  let h = cross[crossIndex(v)]!;
  const p = pair[((v[4]! * 24 + v[5]!) * 24 + v[1]!) * 24 + v[0]!]!;
  if (p > h) h = p;
  for (let i = 0; i < preserved.length; i++) {
    const s = preserved[i]![v[6 + 2 * i]! * 24 + v[7 + 2 * i]!]!;
    if (s > h) h = s;
  }
  return h;
}

/** Depth-limited search; returns move indices or null. */
function searchPair(problem: PairProblem, bound: number, order: number[]): number[] | null {
  const cross = getCrossTable();
  const pair = getPairTable();
  const n = problem.values.length;
  const stack: Uint8Array[] = Array.from({ length: bound + 1 }, () => new Uint8Array(n));
  stack[0]!.set(problem.values);
  const path: number[] = [];

  const dfs = (depth: number, previous: number): boolean => {
    const v = stack[depth]!;
    const h = pairHeuristic(v, problem.preserved, cross, pair);
    if (h === 0) return true;
    if (depth + h > bound) return false;
    const next = stack[depth + 1]!;
    for (const m of order) {
      const face = Math.floor(m / 3);
      if (redundant(face, previous)) continue;
      const cm = CORNER_MOVE[m]!;
      const em = EDGE_MOVE[m]!;
      for (let i = 0; i < 4; i++) next[i] = em[v[i]!]!;
      next[4] = cm[v[4]!]!;
      next[5] = em[v[5]!]!;
      for (let i = 6; i < n; i += 2) {
        next[i] = cm[v[i]!]!;
        next[i + 1] = em[v[i + 1]!]!;
      }
      path.push(m);
      if (dfs(depth + 1, face)) return true;
      path.pop();
    }
    return false;
  };
  return dfs(0, -1) ? path : null;
}

function pairProblem(framed: Facelets, slot: Slot): PairProblem {
  const rotated = applyMoves(framed, Y_FOR_SLOT[slot]);
  const { corners, edges } = readPieces(rotated);
  const keep = SLOTS.filter((s) => s !== 'FR' && slotSolved(rotated, s));
  const values = new Uint8Array(6 + keep.length * 2);
  values.set([edges[4]!, edges[5]!, edges[6]!, edges[7]!, corners[4]!, edges[8]!]);
  keep.forEach((s, i) => {
    values[6 + 2 * i] = corners[SLOT_PIECES[s].corner]!;
    values[7 + 2 * i] = edges[SLOT_PIECES[s].edge]!;
  });
  return { slot, values, preserved: keep.map(getSlotTable) };
}

/** Express moves made after rotation `r` as moves on the unrotated cube. */
function conjugate(moves: Move[], r: Move[]): Move[] {
  if (r.length === 0) return moves;
  const rotated = applyMoves(solvedFacelets(), r);
  return moves.map((m) => ({
    family: FACES[rotated[FACES.indexOf(m.family as never) * 9 + 4]!]!,
    amount: m.amount,
  }));
}

const MAX_PAIR_DEPTH = 16;

/** Solve the unsolved pair with the shortest solution (greedy order, SPEC §6.3). Null if F2L is done. */
export function solveNextPair(state: Facelets, colour = 0, style: F2LStyle = 'front-right'): Step | null {
  const { prefix, state: framed } = frameForCentre(state, colour);
  if (!crossSolved(framed)) throw new Error('Solve the cross first');
  const problems = SLOTS.filter((slot) => !slotSolved(framed, slot)).map((slot) => pairProblem(framed, slot));
  if (problems.length === 0) return null;

  const cross = getCrossTable();
  const pair = getPairTable();
  const order = MOVE_ORDER[style];
  const start = Math.min(...problems.map((p) => pairHeuristic(p.values, p.preserved, cross, pair)));
  for (let bound = start; bound <= MAX_PAIR_DEPTH; bound++) {
    for (const problem of problems) {
      const path = searchPair(problem, bound, order);
      if (!path) continue;
      const moves = path.map((m) => FACE_MOVES[m]!);
      const rotation = Y_FOR_SLOT[problem.slot];
      return {
        kind: 'pair',
        label: `F2L pair (${problem.slot})`,
        slot: problem.slot,
        moves:
          style === 'front-right'
            ? [...prefix, ...rotation, ...moves]
            : [...prefix, ...conjugate(moves, rotation)],
      };
    }
  }
  throw new Error('F2L search failed');
}

/** Colours (home faces) of the pieces belonging to `slot`, as seen in the current cube. */
export function slotColours(
  state: Facelets,
  colour: number,
  slot: Slot,
): { corner: number[]; edge: number[] } {
  const { state: framed } = frameForCentre(state, colour);
  const rotated = applyMoves(framed, Y_FOR_SLOT[slot]);
  const c = (face: number) => rotated[face * 9 + 4]!;
  return { corner: [c(3), c(2), c(1)], edge: [c(2), c(1)] };
}

// ---------------------------------------------------------------------------------------------------------
// Last layer: brute force over the alg lists with pre-AUFs (and post-AUFs for PLL). At most a few hundred
// short simulations, so effectively instant.

const AUFS = ['', 'U', "U'", 'U2'].map(parseAlg);
const parsedAlgs = new Map<string, Move[]>();
const parsed = (alg: string) => {
  let moves = parsedAlgs.get(alg);
  if (!moves) parsedAlgs.set(alg, (moves = parseAlg(alg)));
  return moves;
};

interface Match {
  entry: LLAlg | null;
  moves: Move[];
}

function bruteForce(
  state: Facelets,
  algs: readonly LLAlg[],
  goal: (s: Facelets) => boolean,
  finish?: (s: Facelets) => Move[] | null,
): Match | null {
  let best: Match | null = null;
  for (const pre of AUFS) {
    for (const entry of algs) {
      const moves = [...pre, ...parsed(entry.alg)];
      const after = applyMoves(state, moves);
      if (!goal(after)) continue;
      const tail = finish ? finish(after) : [];
      if (!tail) continue;
      const all = [...moves, ...tail];
      if (!best || all.length < best.moves.length) best = { entry, moves: all };
    }
  }
  return best;
}

/** The U turn (if any) that solves the cube, or null. */
function aufToSolve(state: Facelets, cornersOnly = false): Move[] | null {
  return AUFS.find((auf) => isSolved(applyMoves(state, auf), cornersOnly)) ?? null;
}

function llStep(kind: StepKind, label: string, prefix: Move[], match: Match | null): Step {
  if (!match) throw new Error(`No ${label} alg matches this case`);
  return {
    kind,
    label,
    caseName: match.entry?.name,
    alg: match.entry?.alg,
    moves: [...prefix, ...match.moves],
  };
}

/** The next last-layer step (2-look: EO → OCLL → CPLL → EPLL; full: OLL → PLL), then the final AUF. */
export function solveLastLayerStep(state: Facelets, colour = 0, mode: LLMode = '2-look'): Step | null {
  const { prefix, state: s } = frameForCentre(state, colour);
  if (!f2lSolved(s)) throw new Error('Finish F2L first');
  if (isSolved(s)) return null;

  if (!llOriented(s)) {
    if (mode === 'full') {
      return llStep(
        'oll',
        'OLL',
        prefix,
        bruteForce(s, OLL_ALGS, (t) => f2lSolved(t) && llOriented(t)),
      );
    }
    if (!llEdgesOriented(s)) {
      return llStep(
        'eo',
        'Orient edges',
        prefix,
        bruteForce(s, EO_ALGS, (t) => f2lSolved(t) && llEdgesOriented(t)),
      );
    }
    return llStep(
      'ocll',
      'Orient corners',
      prefix,
      bruteForce(s, OCLL_ALGS, (t) => f2lSolved(t) && llOriented(t)),
    );
  }

  if (!solvedUpToAuf(s)) {
    if (mode === '2-look' && !llCornersPermuted(s)) {
      return llStep(
        'cpll',
        'Permute corners',
        prefix,
        bruteForce(s, CPLL_ALGS, (t) => f2lSolved(t) && llOriented(t) && llCornersPermuted(t)),
      );
    }
    const algs = mode === 'full' ? PLL_ALGS : EPLL_ALGS;
    const label = mode === 'full' ? 'PLL' : 'Permute edges';
    return llStep(
      mode === 'full' ? 'pll' : 'epll',
      label,
      prefix,
      bruteForce(s, algs, solvedUpToAuf, aufToSolve),
    );
  }

  return { kind: 'auf', label: 'Final U turn', moves: [...prefix, ...aufToSolve(s)!] };
}

// ---------------------------------------------------------------------------------------------------------
// 2x2 (Ortega): first face by an exact pattern table, then OLL and PBL by brute force.

function facePattern(state: Facelets, colour: number): number {
  let pattern = 0;
  for (let pos = 0; pos < 8; pos++) {
    const stickers = CORNER_FACELETS[pos]!;
    for (let i = 0; i < 3; i++) if (state[stickers[i]!] === colour) pattern |= (i + 1) << (pos * 2);
  }
  return pattern;
}

/** Bottom-face candidates, starting with no rotation. */
const FACE_ORDER = [3, 0, 1, 2, 4, 5];

export function solveFace(state: Facelets, colour = 0): Step {
  const table = getFaceTable();
  let best: { prefix: Move[]; pattern: number; distance: number } | null = null;
  for (const face of FACE_ORDER) {
    const { prefix, state: framed } = frameForFace(state, face);
    const pattern = facePattern(framed, colour);
    const distance = table[pattern]!;
    if (!best || distance < best.distance) best = { prefix, pattern, distance };
  }
  let { pattern, distance } = best!;
  const path: Move[] = [];
  let previous = -1;
  while (distance > 0) {
    let advanced = false;
    for (let m = 0; m < 18 && !advanced; m++) {
      const face = Math.floor(m / 3);
      if (face === previous) continue;
      const next = moveFacePattern(pattern, m);
      if (table[next] === distance - 1) {
        pattern = next;
        distance--;
        previous = face;
        path.push(FACE_MOVES[m]!);
        advanced = true;
      }
    }
    if (!advanced) throw new Error('Face search failed');
  }
  return { kind: 'face', label: 'First face', moves: [...best!.prefix, ...path] };
}

const cornerFaceUniform = (s: Facelets, face: number) =>
  [2, 6, 8].every((i) => s[face * 9 + i] === s[face * 9]);

const DS = ['', 'D', "D'", 'D2'].map(parseAlg);
const NO_ALG: LLAlg = { name: '', alg: '' };

export function solveOrtegaStep(state: Facelets, colour = 0): Step | null {
  if (isSolved(state, true)) return null;
  const face = faceWithColour(state, colour);
  if (face < 0) throw new Error('Make the first face first');
  const { prefix, state: s } = frameForFace(state, face);

  if (!cornerFaceUniform(s, 0)) {
    const match = bruteForce(s, ORTEGA_OLL_ALGS, (t) => cornerFaceUniform(t, 0) && cornerFaceUniform(t, 3));
    return llStep('ortega-oll', 'OLL', prefix, match);
  }

  const auf = aufToSolve(s, true);
  if (auf) return { kind: 'auf', label: 'Final U turn', moves: [...prefix, ...auf] };

  // PBL: try pre-D adjustments too, and finish with U and D turns.
  let best: Match | null = null;
  for (const preD of DS) {
    const start = applyMoves(s, preD);
    const match = bruteForce(
      start,
      [NO_ALG, ...PBL_ALGS],
      () => true,
      (t) => {
        for (const d of DS) {
          const u = aufToSolve(applyMoves(t, d), true);
          if (u) return [...d, ...u];
        }
        return null;
      },
    );
    if (match && (!best || preD.length + match.moves.length < best.moves.length)) {
      best = { entry: match.entry, moves: [...preD, ...match.moves] };
    }
  }
  return llStep('pbl', 'PBL', prefix, best);
}

// ---------------------------------------------------------------------------------------------------------

/** The next helper step for the current stage, or null when solved. */
export function nextStep(
  state: Facelets,
  puzzle: '3x3x3' | '2x2x2',
  options: SolveOptions = {},
): Step | null {
  const colour = options.colour ?? 0;
  if (puzzle === '2x2x2') {
    const report = analyse2x2(state, colour);
    if (report.solved) return null;
    return report.faceSolved ? solveOrtegaStep(state, colour) : solveFace(state, colour);
  }
  const report = analyse3x3(state, colour);
  switch (report.stage) {
    case 'solved':
      return null;
    case 'cross':
      return solveCross(state, colour);
    case 'f2l':
      return solveNextPair(state, colour, options.f2lStyle);
    default:
      return solveLastLayerStep(state, colour, options.llMode);
  }
}

/** Chain every helper step until solved (full CFOP / Ortega, SPEC §6.3). */
export function solveAll(state: Facelets, puzzle: '3x3x3' | '2x2x2', options: SolveOptions = {}): Step[] {
  const steps: Step[] = [];
  let current = state;
  for (let i = 0; i < 20; i++) {
    const step = nextStep(current, puzzle, options);
    if (!step) return steps;
    steps.push(step);
    current = applyMoves(current, step.moves);
  }
  throw new Error('Solver did not converge');
}
