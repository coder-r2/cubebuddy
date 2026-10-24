import type { AlgCase } from './types';

// Full PLL (21); algs from widely used public references (SPEC §7.1).

const pll = (id: string, group: string, algs: [string, ...string[]]): AlgCase => ({
  id: `pll-${id.toLowerCase()}`,
  name: `${id}-perm`,
  group,
  algs,
});

export const PLL_CASES: AlgCase[] = [
  pll('Ua', 'Edges only', ["R U' R U R U R U' R' U' R2", "M2 U M U2 M' U M2"]),
  pll('Ub', 'Edges only', ["R2 U R U R' U' R' U' R' U R'", "M2 U' M U2 M' U' M2"]),
  pll('H', 'Edges only', ['M2 U M2 U2 M2 U M2']),
  pll('Z', 'Edges only', ["M' U M2 U M2 U M' U2 M2", "M2 U M2 U M' U2 M2 U2 M'"]),
  pll('Aa', 'Corners only', ["x R' U R' D2 R U' R' D2 R2 x'", "R' F R' B2 R F' R' B2 R2"]),
  pll('Ab', 'Corners only', ["x R2 D2 R U R' D2 R U' R x'", "R B' R F2 R' B R F2 R2"]),
  pll('E', 'Corners only', ["x' R U' R' D R U R' D' R U R' D R U' R' D' x"]),
  pll('T', 'Adjacent swap', ["R U R' U' R' F R2 U' R' U' R U R' F'"]),
  pll('F', 'Adjacent swap', ["R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R"]),
  pll('Ja', 'Adjacent swap', ["R' U L' U2 R U' R' U2 R L", "x R2 F R F' R U2 r' U r U2"]),
  pll('Jb', 'Adjacent swap', ["R U R' F' R U R' U' R' F R2 U' R'", "R U2 R' U' R U2 L' U R' U' L"]),
  pll('Ra', 'Adjacent swap', [
    "R U' R' U' R U R D R' U' R D' R' U2 R'",
    "R U R' F' R U2 R' U2 R' F R U R U2 R'",
  ]),
  pll('Rb', 'Adjacent swap', ["R2 F R U R U' R' F' R U2 R' U2 R", "R' U2 R U2 R' F R U R' U' R' F' R2"]),
  pll('Ga', 'G perms', ["R2 U R' U R' U' R U' R2 U' D R' U R D'"]),
  pll('Gb', 'G perms', ["R' U' R U D' R2 U R' U R U' R U' R2 D"]),
  pll('Gc', 'G perms', ["R2 U' R U' R U R' U R2 U D' R U' R' D"]),
  pll('Gd', 'G perms', ["R U R' U' D R2 U' R U' R' U R' U R2 D'"]),
  pll('Na', 'Diagonal swap', ["R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'"]),
  pll('Nb', 'Diagonal swap', ["R' U R U' R' F' U' F R U R' F R' F' R U' R"]),
  pll('V', 'Diagonal swap', [
    "R' U R' U' y R' F' R2 U' R' U R' F R F",
    "R' U R' d' R' F' R2 U' R' U R' F R F",
  ]),
  pll('Y', 'Diagonal swap', ["F R U' R' U' R U R' F' R U R' U' R' F R F'"]),
];
