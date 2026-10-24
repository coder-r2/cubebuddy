import { caseBase } from './cases';
import { readPieces } from './cubies';
import { applyMoves, type Facelets } from './facelets';
import { parseAlg } from './notation';

/*
 * Enumerates F2L situations for the front-right pair in the case frame (white cross on the bottom), by
 * breadth-first search over slot-insert triggers. Used to prove the F2L sets are complete and to generate the
 * advanced cases (D-077).
 */

const FR_CORNER = 4; // DFR
const FR_EDGE = 8; // FR

const key = (s: Facelets) => {
  const { corners, edges } = readPieces(s);
  return `${corners[FR_CORNER]}:${edges[FR_EDGE]}`;
};

/** Representative state for every (FR corner, FR edge) placement reachable with `triggers`. */
function explore(triggers: string[]): Map<string, Facelets> {
  const moves = ['U', ...triggers].map(parseAlg);
  const seen = new Map<string, Facelets>([[key(caseBase()), caseBase()]]);
  const queue = [caseBase()];
  while (queue.length) {
    const state = queue.shift()!;
    for (const m of moves) {
      const next = applyMoves(state, m);
      const k = key(next);
      if (!seen.has(k)) {
        seen.set(k, next);
        queue.push(next);
      }
    }
  }
  return seen;
}

const FR_TRIGGERS = ["R U R'", "R U' R'", "R U2 R'", "F' U F", "F' U' F", "F' U2 F"];
const ALL_TRIGGERS = [
  ...FR_TRIGGERS,
  ...[
    "L' U L",
    "L' U' L",
    "L U L'",
    "L U' L'",
    "B U B'",
    "B U' B'",
    "B' U B",
    "B' U' B",
    "R' U R",
    "R' U' R",
    "F U F'",
    "F U' F'",
  ],
];

/** One state per F2L case modulo AUF, keyed by "corner:edge" values. */
function byAufOrbit(
  states: Map<string, Facelets>,
  keep: (corner: number, edge: number) => boolean,
): Facelets[] {
  const out: Facelets[] = [];
  const done = new Set<string>();
  const U = parseAlg('U');
  for (const [k, state] of states) {
    if (done.has(k)) continue;
    const [corner, edge] = k.split(':').map(Number) as [number, number];
    let s = state;
    for (let i = 0; i < 4; i++) {
      done.add(key(s));
      s = applyMoves(s, U);
    }
    if (keep(corner, edge)) out.push(state);
  }
  return out;
}

const cornerPos = (value: number) => Math.floor(value / 3);
const edgePos = (value: number) => value >> 1;
const solvedKey = `${FR_CORNER * 3}:${FR_EDGE * 2}`;

/** The 41 basic cases: FR pieces in the top layer or the FR slot. */
export function basicF2LStates(): Facelets[] {
  const states = explore(FR_TRIGGERS);
  states.delete(solvedKey);
  return byAufOrbit(
    states,
    (c, e) => (cornerPos(c) < 4 || cornerPos(c) === FR_CORNER) && (edgePos(e) < 4 || edgePos(e) === FR_EDGE),
  );
}

/** "Stuck" cases: one FR piece trapped in another slot, the other in the top layer. */
export function stuckF2LStates(): Facelets[] {
  const states = explore(ALL_TRIGGERS);
  return byAufOrbit(states, (c, e) => {
    const cornerStuck = cornerPos(c) >= 5; // DLF, DBL, DRB
    const edgeStuck = edgePos(e) >= 9; // FL, BL, BR
    return (cornerStuck && edgePos(e) < 4) || (edgeStuck && cornerPos(c) < 4);
  });
}
