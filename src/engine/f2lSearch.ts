import { SLOT_PIECES, SLOTS, type Slot } from './analyse';
import { CORNER_MOVE, EDGE_MOVE, FACE_MOVES } from './cubies';
import { mergeMoves, type Move } from './notation';

/*
 * F2L pair search with human moves only (D-084). The moves are U turns plus slot triggers X U^k X': a side
 * turn that lifts one slot into the top layer, a U turn, and the side turn undone. A trigger leaves the
 * cross and the other three slots where they were, so every solution is the familiar "pair up, then insert"
 * kind and never breaks the cross. Triggers are only allowed on slots that aren't solved yet (the target
 * slot, and empty slots used to hide a piece while pairing), so solved slots stay solved without tracking
 * them. What's left is the target corner and edge: 24 × 24 states, solved exactly by a cost-weighted search
 * (U turn = 1 move, trigger = 3 moves). Everything is in the target-slot frame: cross on the bottom, the
 * slot being solved at front-right.
 */

const U_FACE = 0;
const B_FACE = 5;
const SIDE_FACES = [1, 2, 4, 5]; // R F L B
const SOLVED = SLOT_PIECES.FR.corner * 3 * 24 + SLOT_PIECES.FR.edge * 2;

interface Macro {
  moves: Move[];
  /** Face-move indices (face * 3 + amount − 1). */
  indices: number[];
  cost: number;
  /** Slot the trigger lifts; undefined for U turns. */
  slot?: Slot;
  face: number;
}

const index = (face: number, amount: number) => face * 3 + amount - 1;

function macro(indices: number[], slot?: Slot): Macro {
  return {
    moves: indices.map((m) => FACE_MOVES[m]!),
    indices,
    cost: indices.length,
    slot,
    face: Math.floor(indices[0]! / 3),
  };
}

/** The slot whose corner a side turn takes into the top layer. */
function liftedSlot(m: number): Slot {
  const slot = SLOTS.find((s) => Math.floor(CORNER_MOVE[m]![SLOT_PIECES[s].corner * 3]! / 3) < 4);
  if (!slot) throw new Error('Side turn lifts no slot');
  return slot;
}

const U_TURNS = [1, 2, 3].map((amount) => macro([index(U_FACE, amount)]));
const TRIGGERS: Macro[] = SIDE_FACES.flatMap((face) =>
  [1, 3].flatMap((amount) => {
    const lift = index(face, amount);
    const undo = index(face, 4 - amount);
    const slot = liftedSlot(lift);
    return [1, 2, 3].map((u) => macro([lift, index(U_FACE, u), undo], slot));
  }),
);

/** Preference among equally short solutions: U turns, then the target slot (R before F), then hiding slots. */
const ORDER = [
  ...U_TURNS,
  ...TRIGGERS.filter((t) => t.slot === 'FR').sort((a, b) => a.face - b.face),
  ...TRIGGERS.filter((t) => t.slot !== 'FR'),
];

const applyMacro = (state: number, m: Macro) => {
  let corner = Math.floor(state / 24);
  let edge = state % 24;
  for (const i of m.indices) {
    corner = CORNER_MOVE[i]![corner]!;
    edge = EDGE_MOVE[i]![edge]!;
  }
  return corner * 24 + edge;
};

export interface TriggerOptions {
  /** Unsolved slots other than the target that may be used to hide pieces (target-slot frame). */
  free: Slot[];
  /** Front-right style rotates instead of turning the back face, so B triggers aren't used. */
  noBack: boolean;
}

const allowedMacros = ({ free, noBack }: TriggerOptions) =>
  ORDER.filter(
    (m) => !m.slot || ((m.slot === 'FR' || free.includes(m.slot)) && !(noBack && m.face === B_FACE)),
  );

const tables = new Map<string, Uint8Array>();
const UNREACHABLE = 255;

/** Exact cost to solve each (corner, edge) state with the allowed moves (Dijkstra; costs are 1 or 3). */
function distances(options: TriggerOptions): Uint8Array {
  const key = `${[...options.free].sort().join()}|${options.noBack}`;
  let table = tables.get(key);
  if (table) return table;
  const macros = allowedMacros(options);
  table = new Uint8Array(576).fill(UNREACHABLE);
  table[SOLVED] = 0;
  // Every allowed move's inverse is also allowed, so distances from solved equal distances to solved.
  const buckets: number[][] = [[SOLVED]];
  for (let d = 0; d < buckets.length; d++) {
    for (const state of buckets[d] ?? []) {
      if (table[state] !== d) continue;
      for (const m of macros) {
        const next = applyMacro(state, m);
        const cost = d + m.cost;
        if (cost < table[next]!) {
          table[next] = cost;
          (buckets[cost] ??= []).push(next);
        }
      }
    }
  }
  tables.set(key, table);
  return table;
}

/** Cost of the best human-move solution for the target pair (corner value, edge value), or Infinity. */
export function pairCost(corner: number, edge: number, options: TriggerOptions): number {
  const d = distances(options)[corner * 24 + edge]!;
  return d === UNREACHABLE ? Infinity : d;
}

/** The best human-move solution for the target pair, in the target-slot frame. */
export function solvePair(corner: number, edge: number, options: TriggerOptions): Move[] {
  const table = distances(options);
  const macros = allowedMacros(options);
  let state = corner * 24 + edge;
  if (table[state] === UNREACHABLE) throw new Error('F2L pair unreachable with triggers');
  const moves: Move[] = [];
  while (table[state]! > 0) {
    const d = table[state]!;
    const m = macros.find((x) => table[applyMacro(state, x)] === d - x.cost)!;
    moves.push(...m.moves);
    state = applyMacro(state, m);
  }
  // Neighbouring triggers on the same face join up, e.g. R U R' + R' U R → R U R2 U R.
  return mergeMoves(moves);
}
