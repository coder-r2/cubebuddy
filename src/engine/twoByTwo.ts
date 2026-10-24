import { CORNER_MOVE, FACE_MOVES, readPieces } from './cubies';
import type { Facelets } from './facelets';
import type { Move } from './notation';

/*
 * Optimal ⟨R, U, F⟩ solver for 2x2 corner states (DBL never moves), used offline to generate the CLL set
 * (D-077). IDA* with two exact projection tables: corner permutation (8! ranks) and orientation (3^8).
 */

const MOVES = [3, 4, 5, 0, 1, 2, 6, 7, 8]; // R, U, F (indices into FACE_MOVES), R and U first
const FACTORIAL = [1, 1, 2, 6, 24, 120, 720, 5040, 40320];

/** Rank of the corner permutation (position of each corner, by identity). */
function permRank(corners: ArrayLike<number>): number {
  const pos = Array.from({ length: 8 }, (_, i) => Math.floor(corners[i]! / 3));
  let rank = 0;
  for (let i = 0; i < 8; i++) {
    let smaller = 0;
    for (let j = i + 1; j < 8; j++) if (pos[j]! < pos[i]!) smaller++;
    rank += smaller * FACTORIAL[7 - i]!;
  }
  return rank;
}

/** Orientation at each position (a move's twist depends only on positions, so this projection is exact). */
function oriIndex(corners: ArrayLike<number>): number {
  const byPosition = new Uint8Array(8);
  for (let i = 0; i < 8; i++) byPosition[Math.floor(corners[i]! / 3)] = corners[i]! % 3;
  let index = 0;
  for (let p = 0; p < 8; p++) index = index * 3 + byPosition[p]!;
  return index;
}

let permTable: Int8Array | null = null;
let oriTable: Int8Array | null = null;

/** Exact distance tables for the permutation and orientation projections (BFS over each projection). */
function exactTables() {
  const perm = new Int8Array(40320).fill(-1);
  const ori = new Int8Array(6561).fill(-1);
  const solved = Uint8Array.from({ length: 8 }, (_, i) => i * 3);
  const bfs = (table: Int8Array, index: (c: Uint8Array) => number) => {
    let frontier: Uint8Array[] = [solved];
    table[index(solved)] = 0;
    for (let depth = 1; frontier.length; depth++) {
      const next: Uint8Array[] = [];
      for (const state of frontier) {
        for (const m of MOVES) {
          const t = CORNER_MOVE[m]!;
          const moved = state.map((v) => t[v]!);
          const i = index(moved);
          if (table[i] === -1) {
            table[i] = depth;
            next.push(moved);
          }
        }
      }
      frontier = next;
    }
  };
  bfs(perm, permRank);
  bfs(ori, oriIndex);
  permTable = perm;
  oriTable = ori;
}

export function solve2x2RUF(state: Facelets): Move[] {
  if (!permTable || !oriTable) exactTables();
  const perm = permTable!;
  const ori = oriTable!;
  const start = readPieces(state).corners;
  const h = (c: ArrayLike<number>) => Math.max(perm[permRank(c)]!, ori[oriIndex(c)]!);
  const path: number[] = [];
  const dfs = (c: Uint8Array, depth: number, bound: number, previous: number): boolean => {
    const estimate = h(c);
    if (estimate === 0) return true;
    if (depth + estimate > bound) return false;
    for (const m of MOVES) {
      const face = Math.floor(m / 3);
      if (face === previous) continue;
      const t = CORNER_MOVE[m]!;
      path.push(m);
      if (
        dfs(
          c.map((v) => t[v]!),
          depth + 1,
          bound,
          face,
        )
      )
        return true;
      path.pop();
    }
    return false;
  };
  for (let bound = h(start); bound <= 14; bound++) {
    if (dfs(Uint8Array.from(start), 0, bound, -1)) return path.map((m) => FACE_MOVES[m]!);
  }
  throw new Error('2x2 search failed');
}
