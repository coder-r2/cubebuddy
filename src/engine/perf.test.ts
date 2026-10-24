import { describe, expect, it } from 'vitest';
import { applyMoves, solvedFacelets } from './facelets';
import { parseAlg } from './notation';
import { solveAll, solveCross, solveNextPair } from './solvers';
import { warmUp } from './tables';
import { randomScramble, rng } from './testUtils';

const p95 = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length * 0.95)]!;

/*
 * Performance log for the SPEC §6.3 targets (mid-range phone: cross < 50 ms, F2L pair < 500 ms p95,
 * full CFOP < 2 s p95). CI machines are several times faster than a phone, so the assertions use a
 * fifth of each budget to leave headroom for slow devices.
 */
describe('engine performance', () => {
  it('meets the timing targets with a 5× margin', () => {
    const tables = warmUp();
    const random = rng(7);
    const cross: number[] = [];
    const pair: number[] = [];
    const chain: number[] = [];

    for (let i = 0; i < 100; i++) {
      let state = applyMoves(solvedFacelets(), parseAlg(randomScramble(random)));
      const chainStart = performance.now();
      solveAll(state, '3x3x3', { f2lStyle: i % 2 ? 'rotationless' : 'front-right' });
      chain.push(performance.now() - chainStart);

      let t = performance.now();
      const crossStep = solveCross(state);
      cross.push(performance.now() - t);
      state = applyMoves(state, crossStep.moves);
      for (let step = 0; step < 4; step++) {
        t = performance.now();
        const next = solveNextPair(state, 0, i % 2 ? 'rotationless' : 'front-right');
        pair.push(performance.now() - t);
        if (!next) break;
        state = applyMoves(state, next.moves);
      }
    }

    const report = {
      tablesMs: tables,
      crossP95: +p95(cross).toFixed(2),
      pairP95: +p95(pair).toFixed(2),
      pairMax: +Math.max(...pair).toFixed(2),
      chainP95: +p95(chain).toFixed(2),
    };
    console.info('Engine performance', report);
    expect(report.crossP95).toBeLessThan(10);
    expect(report.pairP95).toBeLessThan(100);
    expect(report.chainP95).toBeLessThan(400);
  }, 120_000);
});
