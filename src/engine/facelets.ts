import { FACES, type Face, type Family, type Move } from './notation';

/*
 * Sticker-level cube model (SPEC §6.1). 54 stickers, faces in U R F D L B order, 9 per face in reading
 * order as seen from outside (U viewed with B at the top, D with F at the top, side faces with U at the top).
 * A state stores, for each sticker position, the home face of the sticker there (0..5), so "colours" are
 * home faces: 0 = U (white in the default scheme), 1 = R (red), 2 = F (green), 3 = D (yellow), 4 = L (orange),
 * 5 = B (blue).
 *
 * Every move type (outer, wide, slice, rotation) is generated geometrically as a permutation of the 54
 * positions, so whole-cube orientation is tracked for free through the centres.
 */

export type Facelets = Uint8Array;
type Vec = readonly [number, number, number];

export const FACE_INDEX: Record<Face, number> = { U: 0, R: 1, F: 2, D: 3, L: 4, B: 5 };

/** For each face: outward normal, then the "right" and "down" directions as seen from outside. */
const FRAMES: Record<Face, [Vec, Vec, Vec]> = {
  U: [
    [0, 1, 0],
    [1, 0, 0],
    [0, 0, 1],
  ],
  R: [
    [1, 0, 0],
    [0, 0, -1],
    [0, -1, 0],
  ],
  F: [
    [0, 0, 1],
    [1, 0, 0],
    [0, -1, 0],
  ],
  D: [
    [0, -1, 0],
    [1, 0, 0],
    [0, 0, -1],
  ],
  L: [
    [-1, 0, 0],
    [0, 0, 1],
    [0, -1, 0],
  ],
  B: [
    [0, 0, -1],
    [-1, 0, 0],
    [0, -1, 0],
  ],
};

/** Cubie coordinate (each component −1, 0 or 1) and outward normal of every sticker position. */
export const STICKER_COORD: Vec[] = [];
export const STICKER_NORMAL: Vec[] = [];

const key = (coord: Vec, normal: Vec) =>
  (2 * coord[0] + normal[0] + 3) * 49 + (2 * coord[1] + normal[1] + 3) * 7 + (2 * coord[2] + normal[2] + 3);
const INDEX_BY_KEY = new Map<number, number>();

for (const face of FACES) {
  const [normal, right, down] = FRAMES[face];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const coord: Vec = [0, 1, 2].map(
        (axis) => normal[axis]! + right[axis]! * (col - 1) + down[axis]! * (row - 1),
      ) as unknown as Vec;
      INDEX_BY_KEY.set(key(coord, normal), STICKER_COORD.length);
      STICKER_COORD.push(coord);
      STICKER_NORMAL.push(normal);
    }
  }
}

/** Sticker index at a cubie coordinate facing `normal`. */
export function stickerAt(coord: Vec, normal: Vec): number {
  const index = INDEX_BY_KEY.get(key(coord, normal));
  if (index === undefined) throw new Error(`No sticker at ${coord.join(',')} facing ${normal.join(',')}`);
  return index;
}

const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** A clockwise quarter turn about `axis` as seen from the +axis side: v' = (a·v)a − a×v. */
function quarter(v: Vec, a: Vec): Vec {
  const d = dot(a, v);
  return [
    d * a[0] - (a[1] * v[2] - a[2] * v[1]),
    d * a[1] - (a[2] * v[0] - a[0] * v[2]),
    d * a[2] - (a[0] * v[1] - a[1] * v[0]),
  ];
}

interface FamilyDef {
  axis: Vec;
  /** Whether a cubie at depth `d = coord·axis` moves. */
  turns: (d: number) => boolean;
}

const AXES: Record<Face, Vec> = {
  U: [0, 1, 0],
  R: [1, 0, 0],
  F: [0, 0, 1],
  D: [0, -1, 0],
  L: [-1, 0, 0],
  B: [0, 0, -1],
};

const FAMILY_DEFS = {} as Record<Family, FamilyDef>;
for (const face of FACES) {
  FAMILY_DEFS[face] = { axis: AXES[face], turns: (d) => d === 1 };
  FAMILY_DEFS[`${face}w`] = { axis: AXES[face], turns: (d) => d >= 0 };
}
FAMILY_DEFS.M = { axis: AXES.L, turns: (d) => d === 0 };
FAMILY_DEFS.E = { axis: AXES.D, turns: (d) => d === 0 };
FAMILY_DEFS.S = { axis: AXES.F, turns: (d) => d === 0 };
FAMILY_DEFS.x = { axis: AXES.R, turns: () => true };
FAMILY_DEFS.y = { axis: AXES.U, turns: () => true };
FAMILY_DEFS.z = { axis: AXES.F, turns: () => true };

const permCache = new Map<string, Uint8Array>();

/** `dest[i]` = where the sticker at position i ends up after the move. */
export function moveDestinations({ family, amount }: Move): Uint8Array {
  const cacheKey = family + amount;
  const cached = permCache.get(cacheKey);
  if (cached) return cached;
  const { axis, turns } = FAMILY_DEFS[family];
  const dest = new Uint8Array(54);
  for (let i = 0; i < 54; i++) {
    let coord = STICKER_COORD[i]!;
    let normal = STICKER_NORMAL[i]!;
    if (turns(dot(coord, axis))) {
      for (let q = 0; q < amount; q++) {
        coord = quarter(coord, axis);
        normal = quarter(normal, axis);
      }
    }
    dest[i] = stickerAt(coord, normal);
  }
  permCache.set(cacheKey, dest);
  return dest;
}

export function solvedFacelets(): Facelets {
  const state = new Uint8Array(54);
  for (let i = 0; i < 54; i++) state[i] = Math.floor(i / 9);
  return state;
}

export function applyMove(state: Facelets, move: Move): Facelets {
  const dest = moveDestinations(move);
  const out = new Uint8Array(54);
  for (let i = 0; i < 54; i++) out[dest[i]!] = state[i]!;
  return out;
}

export function applyMoves(state: Facelets, moves: readonly Move[]): Facelets {
  let current = state;
  for (const move of moves) current = applyMove(current, move);
  return current;
}

/** Colour (home face) of the centre of `face`. */
export const centre = (state: Facelets, face: number) => state[face * 9 + 4]!;

/** Every face shows a single colour (orientation-independent). With `cornersOnly`, edges/centres are ignored (2x2). */
export function isSolved(state: Facelets, cornersOnly = false): boolean {
  for (let face = 0; face < 6; face++) {
    const first = state[face * 9]!;
    for (const i of cornersOnly ? [2, 6, 8] : [1, 2, 3, 4, 5, 6, 7, 8]) {
      if (state[face * 9 + i] !== first) return false;
    }
  }
  return true;
}
