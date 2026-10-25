import { CORNER_FACELETS } from './cubies';
import { applyMoves, solvedFacelets, type Facelets } from './facelets';
import { joinMoves } from './lbl';
import { FACES, invertAlg, parseAlg, type Face, type Move } from './notation';
import { conjugate, solveAll } from './solvers';
import { solve2x2RUF } from './twoByTwo';

/*
 * A scanned or hand-entered cube becomes a move sequence from solved (D-097), because the tutorials and
 * free-play work from move sequences. The CFOP solver solves it, the solution is rewritten as outer face
 * turns only (wide moves, slices and rotations folded away, so the centres never move), and the inverse of
 * that is a "scramble" that makes exactly the entered cube, held white on top and green in front.
 */

const isFace = (move: Move) => FACES.includes(move.family as Face);

const ROTATIONS = ['', 'x', 'x2', "x'", 'z', "z'"].flatMap((a) =>
  ['', 'y', 'y2', "y'"].map((b) => parseAlg(`${a} ${b}`)),
);
const FACE_SETS: Move[][] = [
  [],
  ...FACES.flatMap((face) => ([1, 2, 3] as const).map((amount) => [{ family: face, amount }])),
  // Slices: two opposite face turns.
  ...(['U', 'R', 'F'] as const).flatMap((face) => {
    const other = FACES[(FACES.indexOf(face) + 3) % 6]!;
    return ([1, 2, 3] as const).flatMap((a) =>
      ([1, 2, 3] as const).map((b) => [
        { family: face, amount: a },
        { family: other, amount: b },
      ]),
    );
  }),
];

const same = (a: Facelets, b: Facelets) => a.every((v, i) => v === b[i]);
const decompositions = new Map<string, { faces: Move[]; rotation: Move[] }>();

/** A wide turn, slice or rotation as face turns followed by a whole-cube rotation. */
function decompose(move: Move): { faces: Move[]; rotation: Move[] } {
  const id = `${move.family}${move.amount}`;
  let found = decompositions.get(id);
  if (!found) {
    const target = applyMoves(solvedFacelets(), [move]);
    for (const faces of FACE_SETS) {
      const after = applyMoves(solvedFacelets(), faces);
      const rotation = ROTATIONS.find((r) => same(applyMoves(after, r), target));
      if (rotation) {
        found = { faces, rotation };
        break;
      }
    }
    if (!found) throw new Error(`Can't decompose ${id}`);
    decompositions.set(id, found);
  }
  return found;
}

/** The same turns as outer face turns on a cube that's never rotated. */
export function faceTurnsOnly(moves: readonly Move[]): Move[] {
  let rotation: Move[] = [];
  let out: Move[] = [];
  for (const move of moves) {
    const parts = isFace(move) ? { faces: [move], rotation: [] } : decompose(move);
    out = joinMoves(out, conjugate(parts.faces, rotation));
    rotation = [...rotation, ...parts.rotation];
  }
  return out;
}

/** Moves that take a solved cube (white top, green front) to `state`. The state must be valid (validate.ts). */
export function setupFor(state: Facelets): Move[] {
  const solution = solveAll(state, '3x3x3', { llMode: 'full' }).flatMap((step) => step.moves);
  return invertAlg(faceTurnsOnly(solution));
}

/** Position of the corner whose stickers are on D, L and B (it never moves under R, U and F). */
const DBL = CORNER_FACELETS.findIndex((st) => st.every((s) => [3, 4, 5].includes(Math.floor(s / 9))));

/**
 * The same for a 2x2 (D-098), from its corner stickers as the user holds it (any way up, since a 2x2 has no
 * centres). The cube is turned so the yellow–orange–blue corner is at home, solved optimally with R, U and F,
 * and the setup ends with the rotation back, so the cube on screen is held the same way as the real one.
 */
export function setupFor2x2(colours: readonly number[]): Move[] {
  const held = Uint8Array.from(colours, (c) => Math.max(c, 0));
  for (const rotation of ROTATIONS) {
    const turned = applyMoves(held, rotation);
    if (!CORNER_FACELETS[DBL]!.every((s) => turned[s] === Math.floor(s / 9))) continue;
    const framed = solvedFacelets();
    for (const s of CORNER_FACELETS.flat()) framed[s] = turned[s]!;
    return [...invertAlg(solve2x2RUF(framed)), ...invertAlg(rotation)];
  }
  throw new Error('No yellow–orange–blue corner');
}
