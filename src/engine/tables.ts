import { SLOT_PIECES, SLOTS, type Slot } from './analyse';
import { CORNER_MOVE, EDGE_MOVE } from './cubies';

/*
 * Pruning tables (SPEC §6.3), built by breadth-first search from the goal over the 18 face turns.
 * A tracked piece tuple is encoded in base 24 (each piece value is 0..23), so a table entry is the exact
 * number of moves needed to bring just those pieces home. Tables are built lazily and cached per worker.
 */

type Kind = 'corner' | 'edge';

function buildTable(kinds: readonly Kind[], goal: readonly number[]): Int8Array {
  const n = kinds.length;
  const size = 24 ** n;
  const table = new Int8Array(size).fill(-1);
  const queue = new Uint32Array(size);
  const digits = new Uint8Array(n);
  const encode = (values: ArrayLike<number>) => {
    let index = 0;
    for (let i = 0; i < n; i++) index = index * 24 + values[i]!;
    return index;
  };

  let head = 0;
  let tail = 0;
  const start = encode(goal);
  table[start] = 0;
  queue[tail++] = start;
  const next = new Uint8Array(n);

  while (head < tail) {
    const index = queue[head++]!;
    const depth = table[index]!;
    let rest = index;
    for (let i = n - 1; i >= 0; i--) {
      digits[i] = rest % 24;
      rest = Math.floor(rest / 24);
    }
    for (let m = 0; m < 18; m++) {
      const cornerMove = CORNER_MOVE[m]!;
      const edgeMove = EDGE_MOVE[m]!;
      for (let i = 0; i < n; i++)
        next[i] = kinds[i] === 'corner' ? cornerMove[digits[i]!]! : edgeMove[digits[i]!]!;
      const target = encode(next);
      if (table[target] === -1) {
        table[target] = depth + 1;
        queue[tail++] = target;
      }
    }
  }
  return table;
}

let crossTable: Int8Array | null = null;
let pairTable: Int8Array | null = null;
const slotTables = new Map<Slot, Int8Array>();
let faceTable: Int8Array | null = null;

/** Cross edges DR, DF, DL, DB (edge values). 190,080 reachable states. */
export function getCrossTable(): Int8Array {
  return (crossTable ??= buildTable(['edge', 'edge', 'edge', 'edge'], [8, 10, 12, 14]));
}

/** FR pair (corner DFR, edge FR) plus the two adjacent cross edges DF and DR. */
export function getPairTable(): Int8Array {
  return (pairTable ??= buildTable(['corner', 'edge', 'edge', 'edge'], [12, 16, 10, 8]));
}

/** A single slot's corner + edge (576 entries), used to keep already-solved pairs intact. */
export function getSlotTable(slot: Slot): Int8Array {
  let table = slotTables.get(slot);
  if (!table) {
    const { corner, edge } = SLOT_PIECES[slot];
    table = buildTable(['corner', 'edge'], [corner * 3, edge * 2]);
    slotTables.set(slot, table);
  }
  return table;
}

/**
 * 2x2 first face: for each of the 8 corner positions, 0 = no face-colour sticker there, 1..3 = the
 * face-colour sticker is at index ori 0..2. The four face pieces are interchangeable, so this pattern is the
 * whole problem and the table gives exact distances to "face colour on all four bottom stickers".
 */
export function getFaceTable(): Int8Array {
  if (faceTable) return faceTable;
  const size = 4 ** 8;
  const table = new Int8Array(size).fill(-1);
  const queue = new Uint32Array(size);
  const goal = 0b01010101 << 8; // positions 4..7 (bottom) = 1, positions 0..3 = 0
  table[goal] = 0;
  let head = 0;
  let tail = 0;
  queue[tail++] = goal;
  while (head < tail) {
    const index = queue[head++]!;
    for (let m = 0; m < 18; m++) {
      const target = moveFacePattern(index, m);
      if (table[target] === -1) {
        table[target] = table[index]! + 1;
        queue[tail++] = target;
      }
    }
  }
  return (faceTable = table);
}

/** Apply face move m to a 2x2 face pattern (2 bits per corner position). */
export function moveFacePattern(pattern: number, m: number): number {
  const cornerMove = CORNER_MOVE[m]!;
  let out = 0;
  for (let pos = 0; pos < 8; pos++) {
    const cell = (pattern >> (pos * 2)) & 3;
    if (cell === 0) continue;
    const value = cornerMove[pos * 3 + cell - 1]!;
    out |= ((value % 3) + 1) << (Math.floor(value / 3) * 2);
  }
  return out;
}

/** Build every table now (worker start-up), returning the time taken per table for the performance log. */
export function warmUp(): Record<string, number> {
  const timings: Record<string, number> = {};
  const time = (name: string, build: () => unknown) => {
    const start = performance.now();
    build();
    timings[name] = Math.round(performance.now() - start);
  };
  time('cross', getCrossTable);
  time('pair', getPairTable);
  time('slots', () => SLOTS.forEach(getSlotTable));
  time('face2x2', getFaceTable);
  return timings;
}
