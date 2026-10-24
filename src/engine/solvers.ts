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
import { CORNER_FACELETS, EDGE_MOVE, FACE_MOVES, readPieces } from './cubies';
import { applyMoves, isSolved, solvedFacelets, type Facelets } from './facelets';
import { algsFor, type LLAlg } from './algSource';
import { FACES, parseAlg, type Move } from './notation';
import { pairCost, solvePair, type TriggerOptions } from './f2lSearch';
import { getSet } from '../data/algs/sets';
import type { AlgCase } from '../data/algs/types';
import { caseState } from './cases';
import { getCrossTable, getFaceTable, moveFacePattern } from './tables';

export type StepKind =
  'cross' | 'pair' | 'eo' | 'ocll' | 'oll' | 'cpll' | 'epll' | 'pll' | 'auf' | 'face' | 'ortega-oll' | 'pbl';

export interface Step {
  kind: StepKind;
  label: string;
  /** Case name for LL steps, e.g. "OLL 27 (Sune)" or "T". */
  caseName?: string;
  /** The alg used for an LL step, without AUFs. */
  alg?: string;
  /** Alg-database case id, for showing the case (LL steps and standard F2L cases). */
  caseId?: string;
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
// F2L pairs: human-move search in a frame where the target slot is front-right (SPEC §6.3, D-084).

const Y_FOR_SLOT: Record<Slot, Move[]> = {
  FR: [],
  FL: parseAlg("y'"),
  BL: parseAlg('y2'),
  BR: parseAlg('y'),
};

/** Express moves made after rotation `r` as moves on the unrotated cube. */
export function conjugate(moves: Move[], r: Move[]): Move[] {
  if (r.length === 0) return moves;
  const rotated = applyMoves(solvedFacelets(), r);
  const map = (face: string) => FACES[rotated[FACES.indexOf(face as never) * 9 + 4]!]!;
  return moves.map((m) => {
    // Outer and wide turns follow their face; slices and rotations aren't needed by callers.
    const wide = m.family.endsWith('w');
    const face = wide ? m.family[0]! : m.family;
    if (!FACES.includes(face as never)) throw new Error(`Can't conjugate ${m.family}`);
    return { family: (wide ? `${map(face)}w` : map(face)) as Move['family'], amount: m.amount };
  });
}

/**
 * Solve the unsolved pair that's quickest to solve with human moves (pair up, hide in an empty slot, insert;
 * D-084), greedy order (SPEC §6.3). Null if F2L is done.
 */
export function solveNextPair(
  state: Facelets,
  colour = 0,
  style: F2LStyle = 'front-right',
  only?: Slot,
): Step | null {
  const { prefix, state: framed } = frameForCentre(state, colour);
  if (!crossSolved(framed)) throw new Error('Solve the cross first');
  let best: { slot: Slot; cost: number; corner: number; edge: number; options: TriggerOptions } | null = null;
  for (const slot of SLOTS) {
    if (slotSolved(framed, slot) || (only && slot !== only)) continue;
    const rotated = applyMoves(framed, Y_FOR_SLOT[slot]);
    const { corners, edges } = readPieces(rotated);
    const corner = corners[SLOT_PIECES.FR.corner]!;
    const edge = edges[SLOT_PIECES.FR.edge]!;
    const options: TriggerOptions = {
      free: SLOTS.filter((s) => s !== 'FR' && !slotSolved(rotated, s)),
      noBack: style === 'front-right',
    };
    const cost = pairCost(corner, edge, options);
    if (!best || cost < best.cost) best = { slot, cost, corner, edge, options };
  }
  if (!best) return null;
  const moves = solvePair(best.corner, best.edge, best.options);
  const rotation = Y_FOR_SLOT[best.slot];
  const known = f2lCase(best.corner, best.edge);
  return {
    kind: 'pair',
    label: `F2L pair (${best.slot})`,
    caseName: known?.name ?? STUCK,
    caseId: known?.id,
    slot: best.slot,
    moves:
      style === 'front-right'
        ? [...prefix, ...rotation, ...moves]
        : [...prefix, ...conjugate(moves, rotation)],
  };
}

/** Name for a pair outside the 41 standard cases: a piece sits in another slot (SPEC §5.6). */
export const STUCK = 'Stuck pieces (take them out first)';

let f2lKeys: Map<number, AlgCase> | null = null;

/** The standard F2L case (F2L Basic set) with the target corner and edge here, under any pre-AUF. */
function f2lCase(corner: number, edge: number): AlgCase | undefined {
  if (!f2lKeys) {
    f2lKeys = new Map();
    for (const algCase of getSet('f2l')!.cases) {
      for (const auf of AUFS) {
        const { corners, edges } = readPieces(applyMoves(caseState(algCase.algs[0]), auf));
        f2lKeys.set(corners[SLOT_PIECES.FR.corner]! * 24 + edges[SLOT_PIECES.FR.edge]!, algCase);
      }
    }
  }
  return f2lKeys.get(corner * 24 + edge);
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
    caseId: match.entry?.id || undefined,
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
        bruteForce(s, algsFor.oll(), (t) => f2lSolved(t) && llOriented(t)),
      );
    }
    if (!llEdgesOriented(s)) {
      return llStep(
        'eo',
        'Orient edges',
        prefix,
        bruteForce(s, algsFor.eo(), (t) => f2lSolved(t) && llEdgesOriented(t)),
      );
    }
    return llStep(
      'ocll',
      'Orient corners',
      prefix,
      bruteForce(s, algsFor.ocll(), (t) => f2lSolved(t) && llOriented(t)),
    );
  }

  if (!solvedUpToAuf(s)) {
    if (mode === '2-look' && !llCornersPermuted(s)) {
      return llStep(
        'cpll',
        'Permute corners',
        prefix,
        bruteForce(s, algsFor.cpll(), (t) => f2lSolved(t) && llOriented(t) && llCornersPermuted(t)),
      );
    }
    const algs = mode === 'full' ? algsFor.pll() : algsFor.epll();
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
const FLIPS = ['', 'x2'].map(parseAlg);
const isRotation = (m: Move) => m.family === 'x' || m.family === 'y' || m.family === 'z';
const NO_ALG: LLAlg = { id: '', name: '', alg: '' };

export function solveOrtegaStep(state: Facelets, colour = 0): Step | null {
  if (isSolved(state, true)) return null;
  const face = faceWithColour(state, colour);
  if (face < 0) throw new Error('Make the first face first');
  const { prefix, state: s } = frameForFace(state, face);

  if (!cornerFaceUniform(s, 0)) {
    const match = bruteForce(
      s,
      algsFor.ortegaOll(),
      (t) => cornerFaceUniform(t, 0) && cornerFaceUniform(t, 3),
    );
    return llStep('ortega-oll', 'OLL', prefix, match);
  }

  const auf = aufToSolve(s, true);
  if (auf) return { kind: 'auf', label: 'Final U turn', moves: [...prefix, ...auf] };

  // PBL: try pre-D adjustments and flipping the cube over (each case is listed once, with the worse layer on
  // top; D-085), and finish with U and D turns. A flip is only used when nothing shorter works without one.
  let best: Match | null = null;
  let bestCost = Infinity;
  for (const pre of FLIPS.flatMap((flip) => DS.map((d) => [...d, ...flip]))) {
    const start = applyMoves(s, pre);
    const match = bruteForce(
      start,
      [NO_ALG, ...algsFor.pbl()],
      () => true,
      (t) => {
        for (const d of DS) {
          const u = aufToSolve(applyMoves(t, d), true);
          if (u) return [...d, ...u];
        }
        return null;
      },
    );
    const cost = match ? pre.length + match.moves.length + (pre.some(isRotation) ? 0.5 : 0) : Infinity;
    if (match && cost < bestCost) {
      best = { entry: match.entry, moves: [...pre, ...match.moves] };
      bestCost = cost;
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
