import { describe, expect, it } from 'vitest';
import { getSet } from '../data/algs/sets';
import { engine } from './api';
import { caseState } from './cases';
import { applyMoves, solvedFacelets } from './facelets';
import { isRotation, parseAlg } from './notation';
import { solveAll, solveLastLayerStep, solveNextPair, solveOrtegaStep, STUCK } from './solvers';
import { randomScramble, rng } from './testUtils';

// What the tutorials (SPEC §5.6–5.7, plan P4) need from the engine beyond the free-play helpers.

describe('case names for tutorial steps', () => {
  it('names every standard F2L case, under any pre-AUF', () => {
    for (const algCase of getSet('f2l')!.cases) {
      for (const auf of ['', 'U', "U'", 'U2']) {
        const step = solveNextPair(caseState(algCase.algs[0], parseAlg(auf)), 0, 'front-right', 'FR');
        expect(step?.caseId, `${algCase.name} ${auf}`).toBe(algCase.id);
        expect(step?.caseName).toBe(algCase.name);
      }
    }
  });

  it('calls a pair with a piece in another slot stuck', () => {
    const stuck = getSet('f2l-advanced')!.cases.filter((c) => c.id.includes('-stuck-'));
    expect(stuck.length).toBeGreaterThan(0);
    for (const algCase of stuck) {
      const step = solveNextPair(caseState(algCase.algs[0]), 0, 'front-right', 'FR');
      expect(step?.caseName, algCase.name).toBe(STUCK);
      expect(step?.caseId).toBeUndefined();
    }
  });

  it('last-layer and PBL steps carry their case id', () => {
    expect(solveLastLayerStep(caseState("R U R' U R U2 R'"), 0, '2-look')?.caseId).toBe('2lo-sune');
    expect(solveLastLayerStep(caseState("R U R' U R U2 R'"), 0, 'full')?.caseId).toBe('oll-27');
    expect(solveOrtegaStep(caseState('R2 F2 R2'))?.caseId).toBe('pbl-diag-diag');
  });
});

describe('tutorial hints', () => {
  it('highlights the last-layer pieces during OLL and PLL', () => {
    for (const moves of ["z2 R U R' U R U2 R'", "z2 R U R' U' R' F R2 U' R' U' R U R' F'"]) {
      expect(engine.findPieces(moves, '3x3x3')?.label).toBe('Last-layer pieces');
    }
    expect(engine.findPieces("z2 R U R' U R U2 R'", '2x2x2')?.label).toBe('Top-layer pieces');
    expect(engine.findPieces('z2 R2 F2 R2', '2x2x2')).toBeNull();
  });
});

describe('CFOP solutions are human CFOP (plan P4 exit criterion)', () => {
  const htm = (moves: { family: string }[]) => moves.filter((m) => !isRotation(m as never)).length;

  it.each(['full', '2-look'] as const)('100 random scrambles, %s last layer', (llMode) => {
    const random = rng(41);
    const counts: number[] = [];
    for (let i = 0; i < 100; i++) {
      const state = applyMoves(solvedFacelets(), parseAlg(randomScramble(random)));
      const steps = solveAll(state, '3x3x3', { llMode, f2lStyle: i % 2 ? 'rotationless' : 'front-right' });
      expect(steps.filter((s) => s.kind === 'pair').length).toBeLessThanOrEqual(4); // fewer if a pair comes free
      counts.push(htm(steps.flatMap((s) => s.moves)));
    }
    const average = counts.reduce((a, b) => a + b, 0) / counts.length;
    console.info(`CFOP (${llMode} LL): average ${average.toFixed(1)}, min ${Math.min(...counts)}`);
    // Never a 20-move computer solution; full CFOP lands around 50–65 moves.
    expect(Math.min(...counts)).toBeGreaterThan(30);
    if (llMode === 'full') {
      expect(average).toBeGreaterThan(50);
      expect(average).toBeLessThan(65);
    } else {
      expect(average).toBeLessThan(80);
    }
  });
});
