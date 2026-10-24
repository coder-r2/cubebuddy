import { applyMoves, solvedFacelets, type Facelets } from './facelets';
import { joinMoves } from './lbl';
import { FACES, invertAlg, parseAlg, type Face, type Move } from './notation';
import { conjugate, solveAll } from './solvers';

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
