import { describe, expect, it } from 'vitest';
import { ALG_SETS } from '../data/algs/sets';
import { caseState, contextFor, isCaseState, othersSolved, recognise, solvesWith, verifyAlg } from './cases';
import { parseAlg } from './notation';

// SPEC §6.5 / plan P3 exit criterion: every alg in the database is verified in CI.
describe.each(ALG_SETS.map((set) => [set.name, set] as const))('%s', (_, set) => {
  it('has unique case ids and at most 3 algs per case', () => {
    expect(new Set(set.cases.map((c) => c.id)).size).toBe(set.cases.length);
    for (const c of set.cases) expect(c.algs.length).toBeLessThanOrEqual(3);
  });

  it.each(set.cases.map((c) => [c.name, c] as const))('%s: main alg sets up a genuine case', (_, algCase) => {
    const context = contextFor(set, algCase);
    expect(isCaseState(caseState(algCase.algs[0]), context, othersSolved(algCase))).toBe(true);
  });

  it.each(set.cases.flatMap((c) => c.algs.map((alg, i) => [`${c.name} #${i}`, c, alg] as const)))(
    '%s solves its case',
    (_, algCase, alg) => {
      expect(verifyAlg(set, algCase, alg)).toEqual({ ok: true });
    },
  );

  it('cases are distinct (each case is recognised as itself)', () => {
    for (const algCase of set.cases) {
      expect(recognise(caseState(algCase.algs[0]), set)?.caseId).toBe(algCase.id);
    }
  });

  it('no alg solves another case of the set', () => {
    for (const a of set.cases) {
      const state = caseState(a.algs[0]);
      for (const b of set.cases) {
        if (a === b) continue;
        const context = contextFor(set, b);
        const sameGoal = (b.goal ?? set.goal) === (a.goal ?? set.goal);
        if (sameGoal) expect(solvesWith(state, parseAlg(b.algs[0]), context, othersSolved(b))).toBeNull();
      }
    }
  });
});

describe('set sizes (SPEC §5.5)', () => {
  it.each([
    ['oll-2look', 10],
    ['pll-2look', 6],
    ['f2l', 41],
    ['oll', 57],
    ['pll', 21],
    ['f2l-advanced', 159],
    ['ortega', 15],
    ['cll', 42],
  ])('%s has %d cases', (id, size) => {
    expect(ALG_SETS.find((s) => s.id === id)?.cases).toHaveLength(size);
  });
});

describe('verifyAlg', () => {
  const oll = ALG_SETS.find((s) => s.id === 'oll')!;
  const sune = oll.cases.find((c) => c.id === 'oll-27')!;

  it('accepts an alternative that needs a pre-AUF', () => {
    expect(verifyAlg(oll, sune, "U2 R U R' U R U2 R'").ok).toBe(true);
  });

  it('rejects bad notation, empty input and algs for another case', () => {
    expect(verifyAlg(oll, sune, 'R K')).toEqual({ ok: false, reason: 'Invalid move: K' });
    expect(verifyAlg(oll, sune, '  ').ok).toBe(false);
    expect(verifyAlg(oll, sune, "R U2 R' U' R U' R'")).toEqual({
      ok: false,
      reason: 'This alg doesn’t solve this case.',
    });
  });
});

describe('helpers use the chosen algs', () => {
  it('solves with a custom alg once chosen, and the main alg again after reset', async () => {
    const { setAlgChoices } = await import('./algSource');
    const { solveLastLayerStep } = await import('./solvers');
    const sune = caseState("R U R' U R U2 R'");
    const custom = "U R U R' U R U2 R'";
    setAlgChoices({ 'oll-27': custom });
    expect(solveLastLayerStep(sune, 0, 'full')?.alg).toBe(custom);
    setAlgChoices({});
    expect(solveLastLayerStep(sune, 0, 'full')?.alg).toBe("R U R' U R U2 R'");
  });
});
