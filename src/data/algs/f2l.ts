import type { AlgCase } from './types';

// F2L Basic: the 41 standard cases for the front-right slot (D-015); algs from widely used public references.

const GROUPS: [string, number[]][] = [
  ['Basic inserts', [1, 2, 3, 4]],
  ['Corner and edge in the top layer, separated', [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]],
  ['Corner and edge in the top layer, connected', [17, 18, 19, 20, 21, 22, 23, 24]],
  ['Corner in the slot, edge in the top layer', [25, 26, 27, 28, 29, 30]],
  ['Corner in the top layer, edge in the slot', [31, 32, 33, 34, 35, 36]],
  ['Corner and edge in the slot', [37, 38, 39, 40, 41]],
];

const ALGS: Record<number, [string, ...string[]]> = {
  1: ["U R U' R'"],
  2: ["U' F' U F", "y U' L' U L"],
  3: ["F' U' F", "y L' U' L"],
  4: ["R U R'"],
  5: ["U' R U R' U2 R U' R'"],
  6: ["U F' U' F U2 F' U F", "y U L' U' L U2 L' U L"],
  7: ["U' R U2 R' U2 R U' R'"],
  8: ["U F' U2 F U2 F' U F", "y U L' U2 L U2 L' U L"],
  9: ["U' R U' R' U F' U' F"],
  10: ["U' R U R' U R U R'"],
  11: ["U' R U2 R' U F' U' F"],
  12: ["R U' R' U R U' R' U2 R U' R'"],
  13: ["U F' U F U' F' U' F", "y U L' U L U' L' U' L"],
  14: ["U' R U' R' U R U R'"],
  15: ["F' U F U2 R U R'"],
  16: ["R U' R' U2 F' U' F"],
  17: ["R U2 R' U' R U R'"],
  18: ["F' U2 F U F' U' F", "y L' U2 L U L' U' L"],
  19: ["U R U2 R' U R U' R'"],
  20: ["U' F' U2 F U' F' U F", "y U' L' U2 L U' L' U L"],
  21: ["U2 R U R' U R U' R'"],
  22: ["U2 F' U' F U' F' U F", "r U' r' U2 r U r'"],
  23: ["U R U' R' U' R U' R' U R U' R'"],
  24: ["U' F' U F U F' U F U' F' U F"],
  25: ["U' R' F R F' R U R'"],
  26: ["U R U' R' F R' F' R"],
  27: ["R U' R' U R U' R'"],
  28: ["R U R' U' F R' F' R"],
  29: ["R U' R' F' U' F"],
  30: ["R U R' U' R U R'"],
  31: ["U' R' F R F' R U' R'"],
  32: ["U R U' R' U R U' R' U R U' R'"],
  33: ["U' R U' R' U2 R U' R'"],
  34: ["U R U R' U2 R U R'"],
  35: ["U' R U R' U F' U' F"],
  36: ["U F' U' F U' R U R'"],
  37: ["R2 U2 F R2 F' U2 R' U R'"],
  38: ["R U' R' U' R U R' U2 R U' R'"],
  39: ["R U' R' U R U2 R' U R U' R'"],
  40: ["r U' r' U2 r U r' R U R'"],
  41: ["R U' R' r U' r' U2 r U r'"],
};

/** Cases whose reference alg failed verification; their algs come from the engine's search (D-077). */
const GENERATED = new Set([15, 29]);

const groupOf = (n: number) => GROUPS.find(([, members]) => members.includes(n))?.[0];

export const F2L_CASES: AlgCase[] = Object.entries(ALGS).map(([key, algs]) => ({
  id: `f2l-${key}`,
  name: `F2L ${key}`,
  group: groupOf(Number(key)),
  algs,
  ...(GENERATED.has(Number(key)) ? { generated: true } : {}),
}));
