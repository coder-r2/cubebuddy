import type { AlgCase, AlgSet, Goal, Slot } from '../data/algs/types';
import {
  crossSolved,
  f2lSolved,
  faceWithColour,
  frameForCentre,
  frameForFace,
  llCornersPermuted,
  llEdgesOriented,
  llOriented,
  slotSolved,
  SLOTS,
  solvedUpToAuf,
} from './analyse';
import { applyMoves, isSolved, solvedFacelets, type Facelets } from './facelets';
import { invertAlg, parseAlg, type Move } from './notation';

/*
 * Case states, goals and verification for the alg database (SPEC §6.5, D-037/D-071).
 *
 * Cases live in a fixed frame: white (cross / first face) on the bottom, green in front — i.e. the solved
 * cube rotated by z2. A case's state is its main alg inverted, applied to that frame; an alg is valid for a
 * case if, after some pre-AUF, it reaches the case's goal. All checks are orientation-independent, so algs
 * may contain rotations.
 */

const WHITE = 0;
const BASE = applyMoves(solvedFacelets(), parseAlg('z2'));
export const caseBase = () => BASE;

/** Side-face colours of each slot in the case frame (front green = 2, right orange = 4 after z2). */
const SLOT_COLOURS: Record<Slot, [number, number]> = { FR: [2, 4], FL: [2, 1], BL: [5, 1], BR: [5, 4] };

const AUFS = ['', 'U', "U'", 'U2'].map(parseAlg);
const DS = ['', 'D', "D'", 'D2'].map(parseAlg);

/** The slot (in the current hold) whose side centres have these colours. */
function slotWithColours(framed: Facelets, colours: [number, number]): Slot {
  const SIDES: Record<Slot, [number, number]> = { FR: [2, 1], FL: [2, 4], BL: [5, 4], BR: [5, 1] };
  const wanted = [...colours].sort().join();
  return SLOTS.find(
    (slot) =>
      SIDES[slot]
        .map((f) => framed[f * 9 + 4]!)
        .sort()
        .join() === wanted,
  )!;
}

// ---- 2x2 helpers (corner stickers only) ----
const cornerFaceUniform = (s: Facelets, face: number) =>
  [2, 6, 8].every((i) => s[face * 9 + i] === s[face * 9]);
/** Bottom layer complete: white face down and each side's bottom row matching. */
const bottomLayerSolved = (s: Facelets) =>
  cornerFaceUniform(s, 3) && [1, 2, 4, 5].every((face) => s[face * 9 + 6] === s[face * 9 + 8]);
const solved2x2UpToAuf = (s: Facelets) => AUFS.some((auf) => isSolved(applyMoves(s, auf), true));
const solved2x2UpToUD = (s: Facelets) =>
  DS.some((d) => AUFS.some((u) => isSolved(applyMoves(s, [...d, ...u]), true)));

function framed3x3(state: Facelets) {
  return frameForCentre(state, WHITE).state;
}

function framed2x2(state: Facelets): Facelets | null {
  const face = faceWithColour(state, WHITE);
  return face < 0 ? null : frameForFace(state, face).state;
}

export interface CaseContext {
  goal: Goal;
  puzzle: '3x3x3' | '2x2x2';
  slot?: Slot;
}

/**
 * The case's goal has been reached. For F2L, `strict` also requires every other slot to be solved (they all
 * start solved, except in "stuck piece" cases where only the cross and the target pair count).
 */
export function reachesGoal(state: Facelets, { goal, slot = 'FR' }: CaseContext, strict = true): boolean {
  if (goal === 'ortega-oll' || goal === 'pbl' || goal === 'cll') {
    const s = framed2x2(state);
    if (!s) return false;
    if (goal === 'ortega-oll') return cornerFaceUniform(s, 0) && cornerFaceUniform(s, 3);
    if (goal === 'cll') return bottomLayerSolved(s) && solved2x2UpToAuf(s);
    return solved2x2UpToUD(s);
  }
  const s = framed3x3(state);
  switch (goal) {
    case 'f2l-pair': {
      if (!crossSolved(s)) return false;
      const target = slotWithColours(s, SLOT_COLOURS[slot]);
      return slotSolved(s, target) && (!strict || SLOTS.every((other) => slotSolved(s, other)));
    }
    case 'eo':
      return f2lSolved(s) && llEdgesOriented(s);
    case 'oll':
      return f2lSolved(s) && llOriented(s);
    case 'cpll':
      return f2lSolved(s) && llOriented(s) && llCornersPermuted(s);
    case 'pll':
      return f2lSolved(s) && solvedUpToAuf(s);
  }
}

/** The state is a genuine instance of the case's situation (preconditions hold, goal not yet reached). */
export function isCaseState(state: Facelets, context: CaseContext, otherSlotsSolved = true): boolean {
  const { goal } = context;
  if (goal === 'ortega-oll' || goal === 'pbl' || goal === 'cll') {
    const s = framed2x2(state);
    if (!s || reachesGoal(state, context)) return false;
    if (goal === 'ortega-oll') return cornerFaceUniform(s, 3);
    if (goal === 'pbl') return cornerFaceUniform(s, 0) && cornerFaceUniform(s, 3);
    return bottomLayerSolved(s);
  }
  const s = framed3x3(state);
  if (goal === 'f2l-pair') {
    if (!crossSolved(s)) return false;
    const target = slotWithColours(s, SLOT_COLOURS[context.slot ?? 'FR']);
    if (slotSolved(s, target)) return false;
    return !otherSlotsSolved || SLOTS.every((other) => other === target || slotSolved(s, other));
  }
  if (!f2lSolved(s) || reachesGoal(state, context)) return false;
  if (goal === 'eo' || goal === 'oll') return true;
  return llOriented(s);
}

/** The state an alg sets up when inverted onto the case frame (with an optional AUF first). */
export function caseState(alg: string, auf: Move[] = []): Facelets {
  return applyMoves(applyMoves(BASE, auf), invertAlg(parseAlg(alg)));
}

/** Pre-AUF (or null) with which `alg` takes `state` to the goal. */
export function solvesWith(state: Facelets, alg: Move[], context: CaseContext, strict = true): Move[] | null {
  return AUFS.find((auf) => reachesGoal(applyMoves(state, [...auf, ...alg]), context, strict)) ?? null;
}

export const contextFor = (set: AlgSet, algCase: AlgCase): CaseContext => ({
  goal: algCase.goal ?? set.goal,
  puzzle: set.puzzle,
  slot: algCase.slot,
});

/** Whether the case expects the other F2L slots to be solved (false for "stuck piece" cases). */
export const othersSolved = (algCase: AlgCase) => !algCase.id.includes('-stuck-');

export interface VerifyResult {
  ok: boolean;
  reason?: string;
}

/** Runtime/CI verification of an alg for a case (SPEC §6.5): valid notation, solves the main alg's case. */
export function verifyAlg(set: AlgSet, algCase: AlgCase, alg: string): VerifyResult {
  let moves: Move[];
  try {
    moves = parseAlg(alg);
  } catch (error) {
    return { ok: false, reason: (error as Error).message };
  }
  if (moves.length === 0) return { ok: false, reason: 'Enter some moves.' };
  const context = contextFor(set, algCase);
  const state = caseState(algCase.algs[0]);
  if (!solvesWith(state, moves, context, othersSolved(algCase))) {
    return { ok: false, reason: 'This alg doesn’t solve this case.' };
  }
  return { ok: true };
}

export interface CaseMatch {
  caseId: string;
  /** Pre-AUF that the chosen alg needs. */
  auf: Move[];
}

/** Which case of `set` the state is, trying the user's chosen alg for each case (D-071). */
export function recognise(
  state: Facelets,
  set: AlgSet,
  chosenAlg: (algCase: AlgCase) => string = (c) => c.algs[0],
): CaseMatch | null {
  for (const algCase of set.cases) {
    const context = contextFor(set, algCase);
    const auf = solvesWith(state, parseAlg(chosenAlg(algCase)), context, othersSolved(algCase));
    if (auf && isCaseState(state, context, othersSolved(algCase))) return { caseId: algCase.id, auf };
  }
  return null;
}
