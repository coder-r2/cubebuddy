import { CORNER_FACELETS, EDGE_FACELETS } from './cubies';
import { applyMoves, centre, isSolved, type Facelets } from './facelets';
import { parseAlg, type Move } from './notation';

/** F2L slots relative to the cross on the bottom. */
export const SLOTS = ['FR', 'FL', 'BL', 'BR'] as const;
export type Slot = (typeof SLOTS)[number];

/** Corner and middle edge (home positions) making up each slot. */
export const SLOT_PIECES: Record<Slot, { corner: number; edge: number }> = {
  FR: { corner: 4, edge: 8 }, // DFR, FR
  FL: { corner: 5, edge: 9 }, // DLF, FL
  BL: { corner: 6, edge: 10 }, // DBL, BL
  BR: { corner: 7, edge: 11 }, // DRB, BR
};

/** Whole-cube rotation that brings the given face to the bottom (index = U R F D L B). */
const TO_BOTTOM = ['z2', 'z', "x'", '', "z'", 'x'].map(parseAlg);

export interface Frame {
  /** Rotation applied first (empty if the colour is already on the bottom). */
  prefix: Move[];
  /** The state after the rotation. */
  state: Facelets;
}

/** Rotate so the face whose centre is `colour` is on the bottom (3x3). */
export function frameForCentre(state: Facelets, colour: number): Frame {
  let face = 0;
  while (centre(state, face) !== colour) face++;
  const prefix = TO_BOTTOM[face]!;
  return { prefix, state: applyMoves(state, prefix) };
}

/** Rotate so `face` is on the bottom. */
export function frameForFace(state: Facelets, face: number): Frame {
  const prefix = TO_BOTTOM[face]!;
  return { prefix, state: applyMoves(state, prefix) };
}

/** Sticker i shows the colour of its own face's centre. */
const fits = (state: Facelets, sticker: number) => state[sticker] === centre(state, Math.floor(sticker / 9));
const allFit = (state: Facelets, stickers: readonly number[]) => stickers.every((s) => fits(state, s));

const CROSS_EDGES = [4, 5, 6, 7]; // DR DF DL DB
const U_LAYER_CORNERS = [0, 1, 2, 3];
const U_EDGE_STICKERS = [1, 3, 5, 7];
const U_STICKERS = [0, 1, 2, 3, 5, 6, 7, 8];
const U_MOVES = (['', 'U', 'U2', "U'"] as const).map(parseAlg);

// Checks below work on a framed state (cross colour on the bottom).
export const crossSolved = (s: Facelets) => CROSS_EDGES.every((e) => allFit(s, EDGE_FACELETS[e]!));

export const slotSolved = (s: Facelets, slot: Slot) =>
  allFit(s, CORNER_FACELETS[SLOT_PIECES[slot].corner]!) && allFit(s, EDGE_FACELETS[SLOT_PIECES[slot].edge]!);

export const f2lSolved = (s: Facelets) => crossSolved(s) && SLOTS.every((slot) => slotSolved(s, slot));
export const llEdgesOriented = (s: Facelets) => U_EDGE_STICKERS.every((i) => fits(s, i));
export const llOriented = (s: Facelets) => U_STICKERS.every((i) => fits(s, i));

/** Last-layer corners are in the right places relative to each other (assumes an oriented LL). */
export const llCornersPermuted = (s: Facelets) =>
  U_MOVES.some((auf) => {
    const t = applyMoves(s, auf);
    return U_LAYER_CORNERS.every((c) => allFit(t, CORNER_FACELETS[c]!));
  });

export const solvedUpToAuf = (s: Facelets) => U_MOVES.some((auf) => isSolved(applyMoves(s, auf)));

export type Stage3 = 'cross' | 'f2l' | 'oll' | 'pll' | 'auf' | 'solved';

export interface StageReport {
  crossSolved: boolean;
  solvedPairs: Slot[];
  f2lSolved: boolean;
  llEdgesOriented: boolean;
  llOriented: boolean;
  llCornersPermuted: boolean;
  solvedUpToAuf: boolean;
  solved: boolean;
  stage: Stage3;
}

/** Stage analysis for a 3x3 (SPEC §6.2), orientation-independent. */
export function analyse3x3(state: Facelets, crossColour = 0): StageReport {
  const { state: s } = frameForCentre(state, crossColour);
  const cross = crossSolved(s);
  const solvedPairs = cross ? SLOTS.filter((slot) => slotSolved(s, slot)) : [];
  const f2l = cross && solvedPairs.length === 4;
  const edgesOriented = f2l && llEdgesOriented(s);
  const oriented = edgesOriented && llOriented(s);
  const cornersPermuted = oriented && llCornersPermuted(s);
  const upToAuf = oriented && solvedUpToAuf(s);
  const solved = isSolved(state);

  let stage: Stage3;
  if (solved) stage = 'solved';
  else if (!cross) stage = 'cross';
  else if (!f2l) stage = 'f2l';
  else if (!oriented) stage = 'oll';
  else if (!upToAuf) stage = 'pll';
  else stage = 'auf';

  return {
    crossSolved: cross,
    solvedPairs,
    f2lSolved: f2l,
    llEdgesOriented: edgesOriented,
    llOriented: oriented,
    llCornersPermuted: cornersPermuted,
    solvedUpToAuf: upToAuf,
    solved,
    stage,
  };
}

// ---- 2x2 (Ortega). Only corner stickers matter; there are no centres to compare against. ----

const FACE_CORNERS = [0, 2, 6, 8];

const faceUniform = (s: Facelets, face: number, colour = s[face * 9]!) =>
  FACE_CORNERS.every((i) => s[face * 9 + i] === colour);

/** The face (U R F D L B index) showing four stickers of `colour`, or −1. */
export function faceWithColour(s: Facelets, colour: number): number {
  for (let face = 0; face < 6; face++) if (faceUniform(s, face, colour)) return face;
  return -1;
}

export const solvedUpToAuf2x2 = (s: Facelets) => U_MOVES.some((auf) => isSolved(applyMoves(s, auf), true));

export type Stage2 = 'face' | 'oll' | 'pbl' | 'auf' | 'solved';

export interface StageReport2x2 {
  faceSolved: boolean;
  llOriented: boolean;
  solvedUpToAuf: boolean;
  solved: boolean;
  stage: Stage2;
}

/** Stage analysis for a 2x2 (Ortega: face → OLL → PBL). */
export function analyse2x2(state: Facelets, faceColour = 0): StageReport2x2 {
  const solved = isSolved(state, true);
  const face = faceWithColour(state, faceColour);
  if (face < 0) return { faceSolved: false, llOriented: false, solvedUpToAuf: false, solved, stage: 'face' };
  const { state: s } = frameForFace(state, face);
  const oriented = faceUniform(s, 0);
  const upToAuf = oriented && solvedUpToAuf2x2(s);
  const stage: Stage2 = solved ? 'solved' : !oriented ? 'oll' : !upToAuf ? 'pbl' : 'auf';
  return { faceSolved: true, llOriented: oriented, solvedUpToAuf: upToAuf, solved, stage };
}
