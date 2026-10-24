import { describe, expect, it } from 'vitest';
import { ALG_SETS } from '../../data/algs/sets';
import { caseBase, recognise } from '../../engine/cases';
import { applyMoves } from '../../engine/facelets';
import { formatAlg, invertAlg, mergeMoves, parseAlg } from '../../engine/notation';
import { rng } from '../../engine/testUtils';
import { caseSetup } from './setup';

const normalise = (alg: string) => formatAlg(mergeMoves(parseAlg(alg)));

// Plan P3 exit criterion: setups never equal the inverse of the alg, and they produce the right case.
describe.each(ALG_SETS.map((s) => [s.name, s] as const))('setup scrambles: %s', (_, set) => {
  const random = rng(set.id.length * 97);
  // Every case for the small sets; a spread of cases for the big ones.
  const cases = set.cases.length <= 21 ? set.cases : set.cases.filter((_, i) => i % 7 === 0);

  it.each(cases.map((c) => [c.name, c] as const))(
    '%s',
    async (_, algCase) => {
      const { scramble } = await caseSetup(set, algCase, random);
      const state = applyMoves(caseBase(), parseAlg(scramble));
      expect(recognise(state, set)?.caseId).toBe(algCase.id);
      for (const alg of algCase.algs) {
        expect(normalise(scramble)).not.toBe(normalise(formatAlg(invertAlg(parseAlg(alg)))));
      }
    },
    30_000,
  );
});
