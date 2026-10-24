import type { AlgCase } from './types';

// 2x2 Ortega: first face (intuitive), then OLL (7) and PBL (5) — SPEC §5.7. A PBL case that only differs by
// which layer is on top is the same case held upside down (x2), so each appears once with the worse layer on
// top (D-085).

export const ORTEGA_CASES: AlgCase[] = [
  { id: 'ortega-oll-sune', name: 'Sune', group: 'OLL', goal: 'ortega-oll', algs: ["R U R' U R U2 R'"] },
  {
    id: 'ortega-oll-antisune',
    name: 'Antisune',
    group: 'OLL',
    goal: 'ortega-oll',
    algs: ["R U2 R' U' R U' R'"],
  },
  { id: 'ortega-oll-h', name: 'H', group: 'OLL', goal: 'ortega-oll', algs: ['R2 U2 R U2 R2'] },
  { id: 'ortega-oll-pi', name: 'Pi', group: 'OLL', goal: 'ortega-oll', algs: ["F R U R' U' R U R' U' F'"] },
  { id: 'ortega-oll-u', name: 'U', group: 'OLL', goal: 'ortega-oll', algs: ["F R U R' U' F'"] },
  { id: 'ortega-oll-t', name: 'T', group: 'OLL', goal: 'ortega-oll', algs: ["R U R' U' R' F R F'"] },
  { id: 'ortega-oll-l', name: 'L', group: 'OLL', goal: 'ortega-oll', algs: ["F R' F' R U R U' R'"] },
  {
    id: 'pbl-adj-adj',
    name: 'Adjacent / adjacent',
    group: 'PBL',
    goal: 'pbl',
    algs: ["R2 U' B2 U2 R2 U' R2"],
  },
  { id: 'pbl-diag-diag', name: 'Diagonal / diagonal', group: 'PBL', goal: 'pbl', algs: ['R2 F2 R2'] },
  {
    id: 'pbl-adj-diag',
    name: 'Adjacent / diagonal',
    group: 'PBL',
    goal: 'pbl',
    algs: ["R U' R F2 R' U R'"],
  },
  {
    id: 'pbl-adj-top',
    name: 'Adjacent (one layer)',
    group: 'PBL',
    goal: 'pbl',
    algs: ["R U R' U' R' F R2 U' R' U' R U R' F'"],
  },
  {
    id: 'pbl-diag-top',
    name: 'Diagonal (one layer)',
    group: 'PBL',
    goal: 'pbl',
    algs: ["F R U' R' U' R U R' F' R U R' U' R' F R F'"],
  },
];
