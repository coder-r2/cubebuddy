import { CLL_CASES } from './cll';
import { F2L_CASES } from './f2l';
import { F2L_ADVANCED_CASES } from './f2lAdvanced';
import { OLL_CASES } from './oll';
import { ORTEGA_CASES } from './ortega';
import { PLL_CASES } from './pll';
import { OLL_2LOOK_CASES, PLL_2LOOK_CASES } from './twoLook';
import type { AlgCase, AlgSet } from './types';

// The alg sets of SPEC §5.5, in display order.
export const ALG_SETS: AlgSet[] = [
  {
    id: 'oll-2look',
    puzzle: '3x3x3',
    name: '2-look OLL',
    description: 'Orient the last layer in two steps: 3 edge cases, then 7 corner cases.',
    goal: 'oll',
    diagram: 'oll',
    stickering: 'OLL',
    cases: OLL_2LOOK_CASES,
  },
  {
    id: 'pll-2look',
    puzzle: '3x3x3',
    name: '2-look PLL',
    description: 'Permute the last layer in two steps: 2 corner cases, then 4 edge cases.',
    goal: 'pll',
    diagram: 'pll',
    stickering: 'PLL',
    cases: PLL_2LOOK_CASES,
  },
  {
    id: 'f2l',
    puzzle: '3x3x3',
    name: 'F2L Basic',
    description: 'The 41 standard cases for pairing up and inserting into the front-right slot.',
    goal: 'f2l-pair',
    diagram: 'f2l',
    stickering: 'F2L',
    cases: F2L_CASES,
  },
  {
    id: 'oll',
    puzzle: '3x3x3',
    name: 'Full OLL',
    description: 'All 57 cases to orient the last layer in one step.',
    goal: 'oll',
    diagram: 'oll',
    stickering: 'OLL',
    cases: OLL_CASES,
  },
  {
    id: 'pll',
    puzzle: '3x3x3',
    name: 'Full PLL',
    description: 'All 21 cases to permute the last layer in one step.',
    goal: 'pll',
    diagram: 'pll',
    stickering: 'PLL',
    cases: PLL_CASES,
  },
  {
    id: 'f2l-advanced',
    puzzle: '3x3x3',
    name: 'F2L Advanced',
    description:
      'The 41 cases in the other three slots without rotations, plus pieces stuck in the wrong slot.',
    goal: 'f2l-pair',
    diagram: 'f2l',
    stickering: 'F2L',
    cases: F2L_ADVANCED_CASES,
  },
  {
    id: 'ortega',
    puzzle: '2x2x2',
    name: 'Ortega (2x2)',
    description: 'After the first face: 7 OLL cases, then 8 PBL cases.',
    goal: 'pbl',
    diagram: 'cll',
    stickering: 'full',
    cases: ORTEGA_CASES.map((c) => ({ ...c, diagram: c.goal === 'ortega-oll' ? 'oll-2x2' : 'pbl' })),
  },
  {
    id: 'cll',
    puzzle: '2x2x2',
    name: 'CLL (2x2)',
    description: 'Solve the whole top layer in one step once the first layer is done.',
    goal: 'cll',
    diagram: 'cll',
    stickering: 'full',
    cases: CLL_CASES,
  },
];

export const getSet = (id: string): AlgSet | undefined => ALG_SETS.find((s) => s.id === id);

export function findCase(caseId: string): { set: AlgSet; algCase: AlgCase } | undefined {
  for (const set of ALG_SETS) {
    const algCase = set.cases.find((c) => c.id === caseId);
    if (algCase) return { set, algCase };
  }
  return undefined;
}
