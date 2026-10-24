import { getSet } from '../data/algs/sets';
import type { AlgCase, AlgSetId } from '../data/algs/types';

/*
 * The algs the helpers use, taken from the alg database (replacing the P2 inline lists) with the user's
 * choices applied: a chosen alternative or verified custom alg replaces the main alg (D-016, D-071).
 */

export interface LLAlg {
  name: string;
  alg: string;
}

let choices: Record<string, string> = {};

/** caseId → alg string; cases without an entry use their main alg. */
export function setAlgChoices(next: Record<string, string>) {
  choices = { ...next };
}

const list = (setId: AlgSetId, keep: (c: AlgCase) => boolean = () => true): LLAlg[] =>
  getSet(setId)!
    .cases.filter(keep)
    .map((c) => ({ name: c.name, alg: choices[c.id] ?? c.algs[0] }));

export const algsFor = {
  eo: () => list('oll-2look', (c) => c.goal === 'eo'),
  ocll: () => list('oll-2look', (c) => c.goal !== 'eo'),
  cpll: () => list('pll-2look', (c) => c.goal === 'cpll'),
  epll: () => list('pll-2look', (c) => c.goal !== 'cpll'),
  oll: () => list('oll'),
  pll: () => list('pll'),
  ortegaOll: () => list('ortega', (c) => c.goal === 'ortega-oll'),
  pbl: () => list('ortega', (c) => c.goal === 'pbl'),
};
