import { describe, expect, it } from 'vitest';
import { applyMoves, isSolved, solvedFacelets } from './facelets';
import { analyseLbl, solveAllLbl } from './lbl';
import { parseAlg } from './notation';
import { randomScramble, rng } from './testUtils';

const apply = (alg: string, state = solvedFacelets()) => applyMoves(state, parseAlg(alg));
const ORDER = [
  'cross',
  'corners',
  'middle',
  'top-cross',
  'top-edges',
  'place-corners',
  'twist-corners',
  'auf',
  'solved',
];

describe('beginner layer-by-layer solver', () => {
  it('solves random scrambles, stage by stage in order', () => {
    const random = rng(42);
    const lengths: number[] = [];
    for (let i = 0; i < 200; i++) {
      let state = apply(randomScramble(random));
      let last = -1;
      let moves = 0;
      for (const step of solveAllLbl(state)) {
        const stage = ORDER.indexOf(analyseLbl(state).stage);
        expect(stage).toBeGreaterThanOrEqual(last);
        last = stage;
        state = applyMoves(state, step.moves);
        moves += step.moves.filter((m) => !'xyz'.includes(m.family)).length;
      }
      expect(isSolved(state)).toBe(true);
      lengths.push(moves);
    }
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    // Beginner solves are long (typically 100–150 moves), but never absurd.
    expect(mean).toBeGreaterThan(70);
    expect(Math.max(...lengths)).toBeLessThan(260);
  });

  it('reports stages', () => {
    // White starts on top; z2 puts it on the bottom, where the beginner algs expect it.
    const held = (alg: string) => apply(`z2 ${alg}`);
    expect(analyseLbl(solvedFacelets()).stage).toBe('solved');
    expect(analyseLbl(held('U')).stage).toBe('auf');
    expect(analyseLbl(held("F R U R' U' F'")).stage).toBe('top-cross');
    expect(analyseLbl(held("U R U' R' U' F' U F")).stage).toBe('middle');
    expect(analyseLbl(held("R U R' U'")).stage).toBe('corners');
    expect(analyseLbl(held("U R U' L' U R' U' L")).stage).toBe('place-corners');
    expect(analyseLbl(held("R' D' R D R' D' R D U R' D' R D R' D' R D R' D' R D R' D' R D U'")).stage).toBe(
      'twist-corners',
    );
    expect(analyseLbl(held("R U' R U R U R U' R' U' R2")).stage).toBe('top-edges');
    expect(analyseLbl(held('F')).stage).toBe('cross');
  });
});
