import { centre, moveDestinations, stickerAt, type Facelets } from './facelets';
import { FACES, type Move } from './notation';

/*
 * Piece (cubie) view of the sticker model, used by the searches. A piece's value is `pos * 3 + ori`
 * (corners) or `pos * 2 + ori` (edges), where `ori` says which of the position's stickers holds the
 * piece's reference sticker (its U/D colour; for middle-layer edges without one, its F/B colour).
 * Pieces are identified by their home position, so "solved" means value = home * 3 (or * 2).
 */

type Vec = readonly [number, number, number];

export const CORNER_NAMES = ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB'] as const;
export const EDGE_NAMES = ['UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'FL', 'BL', 'BR'] as const;

const CORNER_COORDS: Vec[] = [
  [1, 1, 1],
  [-1, 1, 1],
  [-1, 1, -1],
  [1, 1, -1],
  [1, -1, 1],
  [-1, -1, 1],
  [-1, -1, -1],
  [1, -1, -1],
];
const EDGE_COORDS: Vec[] = [
  [1, 1, 0],
  [0, 1, 1],
  [-1, 1, 0],
  [0, 1, -1],
  [1, -1, 0],
  [0, -1, 1],
  [-1, -1, 0],
  [0, -1, -1],
  [1, 0, 1],
  [-1, 0, 1],
  [-1, 0, -1],
  [1, 0, -1],
];

/** Sticker positions of a cubie: the y-facing one first, then z, then x. */
function stickersOf(coord: Vec): number[] {
  const out: number[] = [];
  for (const axis of [1, 2, 0]) {
    const c = coord[axis]!;
    if (c === 0) continue;
    const normal: [number, number, number] = [0, 0, 0];
    normal[axis] = c;
    out.push(stickerAt(coord, normal));
  }
  return out;
}

export const CORNER_FACELETS = CORNER_COORDS.map(stickersOf);
export const EDGE_FACELETS = EDGE_COORDS.map(stickersOf);

const CORNER_AT = new Map<number, number>(); // sticker → pos * 3 + ori
const EDGE_AT = new Map<number, number>(); // sticker → pos * 2 + ori
CORNER_FACELETS.forEach((stickers, pos) => stickers.forEach((s, ori) => CORNER_AT.set(s, pos * 3 + ori)));
EDGE_FACELETS.forEach((stickers, pos) => stickers.forEach((s, ori) => EDGE_AT.set(s, pos * 2 + ori)));

/** The 18 outer face turns used by the searches, index = face * 3 + (amount − 1). */
export const FACE_MOVES: Move[] = FACES.flatMap((family) =>
  ([1, 2, 3] as const).map((amount) => ({ family, amount })),
);

/** Piece move tables: `CORNER_MOVE[m][value]` / `EDGE_MOVE[m][value]` for face move m. */
export const CORNER_MOVE: Uint8Array[] = FACE_MOVES.map((move) => {
  const dest = moveDestinations(move);
  const table = new Uint8Array(24);
  for (let value = 0; value < 24; value++) {
    const sticker = CORNER_FACELETS[Math.floor(value / 3)]![value % 3]!;
    table[value] = CORNER_AT.get(dest[sticker]!)!;
  }
  return table;
});

export const EDGE_MOVE: Uint8Array[] = FACE_MOVES.map((move) => {
  const dest = moveDestinations(move);
  const table = new Uint8Array(24);
  for (let value = 0; value < 24; value++) {
    const sticker = EDGE_FACELETS[value >> 1]![value & 1]!;
    table[value] = EDGE_AT.get(dest[sticker]!)!;
  }
  return table;
});

export interface Pieces {
  /** Value (pos * 3 + ori) of each corner, indexed by its home position. */
  corners: Uint8Array;
  /** Value (pos * 2 + ori) of each edge, indexed by its home position. */
  edges: Uint8Array;
}

const pieceKey = (faces: number[]) => [...faces].sort().join('');
const CORNER_BY_FACES = new Map(
  CORNER_FACELETS.map((stickers, home) => [pieceKey(stickers.map((s) => Math.floor(s / 9))), home]),
);
const EDGE_BY_FACES = new Map(
  EDGE_FACELETS.map((stickers, home) => [pieceKey(stickers.map((s) => Math.floor(s / 9))), home]),
);

/**
 * Read piece positions relative to the current centres (so the result is orientation-independent:
 * the face a sticker "belongs to" is the face whose centre has its colour). 3x3 only.
 */
export function readPieces(state: Facelets): Pieces {
  const faceOfColour = new Uint8Array(6);
  for (let face = 0; face < 6; face++) faceOfColour[centre(state, face)] = face;

  const corners = new Uint8Array(8);
  CORNER_FACELETS.forEach((stickers, pos) => {
    const faces = stickers.map((s) => faceOfColour[state[s]!]!);
    const home = CORNER_BY_FACES.get(pieceKey(faces));
    if (home === undefined) throw new Error('Invalid cube state (corner)');
    // Reference sticker: the one belonging to U or D.
    const ori = faces.findIndex((f) => f === 0 || f === 3);
    corners[home] = pos * 3 + ori;
  });

  const edges = new Uint8Array(12);
  EDGE_FACELETS.forEach((stickers, pos) => {
    const faces = stickers.map((s) => faceOfColour[state[s]!]!);
    const home = EDGE_BY_FACES.get(pieceKey(faces));
    if (home === undefined) throw new Error('Invalid cube state (edge)');
    let ori = faces.findIndex((f) => f === 0 || f === 3);
    if (ori < 0) ori = faces.findIndex((f) => f === 2 || f === 5);
    edges[home] = pos * 2 + ori;
  });
  return { corners, edges };
}
