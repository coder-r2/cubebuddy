/*
 * Temporary inline algorithm lists for the free-play helpers (plan P2 task 5). P3 replaces these with the
 * alg database. Every alg is checked by the engine tests (it must keep F2L and reach its goal), and the sets
 * must cover every case.
 */

export interface LLAlg {
  name: string;
  alg: string;
}

export const EO_ALGS: LLAlg[] = [
  { name: 'Line', alg: "F R U R' U' F'" },
  { name: 'L shape', alg: "f R U R' U' f'" },
  { name: 'Dot', alg: "F R U R' U' F' f R U R' U' f'" },
];

export const OCLL_ALGS: LLAlg[] = [
  { name: 'Sune', alg: "R U R' U R U2 R'" },
  { name: 'Antisune', alg: "R U2 R' U' R U' R'" },
  { name: 'H', alg: "R U R' U R U' R' U R U2 R'" },
  { name: 'Pi', alg: "R U2 R2 U' R2 U' R2 U2 R" },
  { name: 'Headlights', alg: "R2 D R' U2 R D' R' U2 R'" },
  { name: 'Chameleon', alg: "r U R' U' r' F R F'" },
  { name: 'Bowtie', alg: "F' r U R' U' r' F R" },
];

export const CPLL_ALGS: LLAlg[] = [
  { name: 'Headlights (adjacent corner swap)', alg: "R U R' U' R' F R2 U' R' U' R U R' F'" },
  { name: 'Diagonal corner swap', alg: "F R U' R' U' R U R' F' R U R' U' R' F R F'" },
];

export const EPLL_ALGS: LLAlg[] = [
  { name: 'Ua', alg: "R U' R U R U R U' R' U' R2" },
  { name: 'Ub', alg: "R2 U R U R' U' R' U' R' U R'" },
  { name: 'H', alg: 'M2 U M2 U2 M2 U M2' },
  { name: 'Z', alg: "M' U M2 U M2 U M' U2 M2" },
];

export const PLL_ALGS: LLAlg[] = [
  { name: 'Aa', alg: "x R' U R' D2 R U' R' D2 R2 x'" },
  { name: 'Ab', alg: "x R2 D2 R U R' D2 R U' R x'" },
  { name: 'E', alg: "x' R U' R' D R U R' D' R U R' D R U' R' D' x" },
  { name: 'F', alg: "R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R" },
  { name: 'Ga', alg: "R2 U R' U R' U' R U' R2 U' D R' U R D'" },
  { name: 'Gb', alg: "R' U' R U D' R2 U R' U R U' R U' R2 D" },
  { name: 'Gc', alg: "R2 U' R U' R U R' U R2 U D' R U' R' D" },
  { name: 'Gd', alg: "R U R' U' D R2 U' R U' R' U R' U R2 D'" },
  { name: 'H', alg: 'M2 U M2 U2 M2 U M2' },
  { name: 'Ja', alg: "R' U L' U2 R U' R' U2 R L" },
  { name: 'Jb', alg: "R U R' F' R U R' U' R' F R2 U' R'" },
  { name: 'Na', alg: "R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'" },
  { name: 'Nb', alg: "R' U R U' R' F' U' F R U R' F R' F' R U' R" },
  { name: 'Ra', alg: "R U' R' U' R U R D R' U' R D' R' U2 R'" },
  { name: 'Rb', alg: "R2 F R U R U' R' F' R U2 R' U2 R" },
  { name: 'T', alg: "R U R' U' R' F R2 U' R' U' R U R' F'" },
  { name: 'Ua', alg: "R U' R U R U R U' R' U' R2" },
  { name: 'Ub', alg: "R2 U R U R' U' R' U' R' U R'" },
  { name: 'V', alg: "R' U R' U' y R' F' R2 U' R' U R' F R F" },
  { name: 'Y', alg: "F R U' R' U' R U R' F' R U R' U' R' F R F'" },
  { name: 'Z', alg: "M' U M2 U M2 U M' U2 M2" },
];

const OLL_LIST: string[] = [
  "R U2 R2 F R F' U2 R' F R F'",
  "r U r' U2 r U2 R' U2 R U' r'",
  "r' R2 U R' U r U2 r' U M'",
  "M U' r U2 r' U' R U' R' M'",
  "l' U2 L U L' U l",
  "r U2 R' U' R U' r'",
  "r U R' U R U2 r'",
  "l' U' L U' L' U2 l",
  "R U R' U' R' F R2 U R' U' F'",
  "R U R' U R' F R F' R U2 R'",
  "r U R' U R' F R F' R U2 r'",
  "M' R' U' R U' R' U2 R U' R r'",
  "F U R U' R2 F' R U R U' R'",
  "R' F R U R' F' R F U' F'",
  "l' U' l L' U' L U l' U l",
  "r U r' R U R' U' r U' r'",
  "F R' F' R2 r' U R U' R' U' M'",
  "r U R' U R U2 r2 U' R U' R' U2 r",
  "r' R U R U R' U' M' R' F R F'",
  "r U R' U' M2 U R U' R' U' M'",
  "R U2 R' U' R U R' U' R U' R'",
  "R U2 R2 U' R2 U' R2 U2 R",
  "R2 D' R U2 R' D R U2 R",
  "r U R' U' r' F R F'",
  "F' r U R' U' r' F R",
  "R U2 R' U' R U' R'",
  "R U R' U R U2 R'",
  "r U R' U' r' R U R U' R'",
  "R U R' U' R U' R' F' U' F R U R'",
  "F R' F R2 U' R' U' R U R' F2",
  "R' U' F U R U' R' F' R",
  "L U F' U' L' U L F L'",
  "R U R' U' R' F R F'",
  "R U R2 U' R' F R U R U' F'",
  "R U2 R2 F R F' R U2 R'",
  "L' U' L U' L' U L U L F' L' F",
  "F R' F' R U R U' R'",
  "R U R' U R U' R' U' R' F R F'",
  "L F' L' U' L U F U' L'",
  "R' F R U R' U' F' U R",
  "R U R' U R U2 R' F R U R' U' F'",
  "R' U' R U' R' U2 R F R U R' U' F'",
  "F' U' L' U L F",
  "F U R U' R' F'",
  "F R U R' U' F'",
  "R' U' R' F R F' U R",
  "R' U' R' F R F' R' F R F' U R",
  "F R U R' U' R U R' U' F'",
  "r U' r2 U r2 U r2 U' r",
  "r' U r2 U' r2 U' r2 U r'",
  "F U R U' R' U R U' R' F'",
  "R U R' U R U' B U' B' R'",
  "l' U2 L U L' U' L U L' U l",
  "r U2 R' U' R U R' U' R U' r'",
  "R' F R U R U' R2 F' R2 U' R' U R U R'",
  "r' U' r U' R' U R U' R' U R r' U r",
  "R U R' U' M' U R U' r'",
];

const OLL_NICKNAMES: Record<number, string> = {
  21: 'H',
  22: 'Pi',
  23: 'Headlights',
  24: 'Chameleon',
  25: 'Bowtie',
  26: 'Antisune',
  27: 'Sune',
  45: 'T',
  44: 'P',
  33: 'Key',
  57: 'H (edges)',
};

export const OLL_ALGS: LLAlg[] = OLL_LIST.map((alg, i) => ({
  name: `OLL ${i + 1}${OLL_NICKNAMES[i + 1] ? ` (${OLL_NICKNAMES[i + 1]})` : ''}`,
  alg,
}));

/** Ortega OLL for 2x2 (corners only). */
export const ORTEGA_OLL_ALGS: LLAlg[] = [
  { name: 'Sune', alg: "R U R' U R U2 R'" },
  { name: 'Antisune', alg: "R U2 R' U' R U' R'" },
  { name: 'H', alg: 'R2 U2 R U2 R2' },
  { name: 'Pi', alg: "F R U R' U' R U R' U' F'" },
  { name: 'U', alg: "F R U R' U' F'" },
  { name: 'T', alg: "R U R' U' R' F R F'" },
  { name: 'L', alg: "F R' F' R U R U' R'" },
];

/** Ortega PBL for 2x2: permute top and bottom layers together. */
export const PBL_ALGS: LLAlg[] = [
  { name: 'Adjacent / adjacent', alg: "R2 U' B2 U2 R2 U' R2" },
  { name: 'Diagonal / diagonal', alg: 'R2 F2 R2' },
  { name: 'Adjacent top / diagonal bottom', alg: "R U' R F2 R' U R'" },
  { name: 'Diagonal top / adjacent bottom', alg: "R D' R B2 R' D R'" },
  { name: 'Adjacent top', alg: "R U R' U' R' F R2 U' R' U' R U R' F'" },
  { name: 'Diagonal top', alg: "F R U' R' U' R U R' F' R U R' U' R' F R F'" },
  { name: 'Adjacent bottom', alg: "R D R' D' R' B R2 D' R' D' R D R' B'" },
  { name: 'Diagonal bottom', alg: "B R D' R' D' R D R' B' R D R' D' R' B R B'" },
];
