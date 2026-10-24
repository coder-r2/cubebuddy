import type { AlgCase } from './types';

// Beginner 2-look last layer: OLL in two steps (edges, then corners) and PLL in two steps (corners, then edges).

export const OLL_2LOOK_CASES: AlgCase[] = [
  { id: '2lo-eo-line', name: 'Line', group: 'Orient edges', goal: 'eo', algs: ["F R U R' U' F'"] },
  { id: '2lo-eo-l', name: 'L shape', group: 'Orient edges', goal: 'eo', algs: ["f R U R' U' f'"] },
  {
    id: '2lo-eo-dot',
    name: 'Dot',
    group: 'Orient edges',
    goal: 'eo',
    algs: ["F R U R' U' F' f R U R' U' f'", "f R U R' U' f' U' F R U R' U' F'"],
  },
  { id: '2lo-sune', name: 'Sune', group: 'Orient corners', algs: ["R U R' U R U2 R'"] },
  { id: '2lo-antisune', name: 'Antisune', group: 'Orient corners', algs: ["R U2 R' U' R U' R'"] },
  {
    id: '2lo-h',
    name: 'H',
    group: 'Orient corners',
    algs: ["R U R' U R U' R' U R U2 R'", "R U2 R' U' R U R' U' R U' R'"],
  },
  { id: '2lo-pi', name: 'Pi', group: 'Orient corners', algs: ["R U2 R2 U' R2 U' R2 U2 R"] },
  { id: '2lo-headlights', name: 'Headlights', group: 'Orient corners', algs: ["R2 D R' U2 R D' R' U2 R'"] },
  { id: '2lo-chameleon', name: 'Chameleon', group: 'Orient corners', algs: ["r U R' U' r' F R F'"] },
  { id: '2lo-bowtie', name: 'Bowtie', group: 'Orient corners', algs: ["F' r U R' U' r' F R"] },
];

export const PLL_2LOOK_CASES: AlgCase[] = [
  {
    id: '2lp-adjacent',
    name: 'Adjacent corner swap',
    group: 'Permute corners',
    goal: 'cpll',
    algs: ["R U R' U' R' F R2 U' R' U' R U R' F'", "x R' U R' D2 R U' R' D2 R2 x'"],
  },
  {
    id: '2lp-diagonal',
    name: 'Diagonal corner swap',
    group: 'Permute corners',
    goal: 'cpll',
    algs: ["F R U' R' U' R U R' F' R U R' U' R' F R F'"],
  },
  {
    id: '2lp-ua',
    name: 'Ua-perm',
    group: 'Permute edges',
    algs: ["R U' R U R U R U' R' U' R2", "M2 U M U2 M' U M2"],
  },
  {
    id: '2lp-ub',
    name: 'Ub-perm',
    group: 'Permute edges',
    algs: ["R2 U R U R' U' R' U' R' U R'", "M2 U' M U2 M' U' M2"],
  },
  { id: '2lp-h', name: 'H-perm', group: 'Permute edges', algs: ['M2 U M2 U2 M2 U M2'] },
  { id: '2lp-z', name: 'Z-perm', group: 'Permute edges', algs: ["M' U M2 U M2 U M' U2 M2"] },
];
