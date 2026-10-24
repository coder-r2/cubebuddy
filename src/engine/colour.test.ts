import { describe, expect, it } from 'vitest';
import { analyse3x3 } from './analyse';
import { engine } from './api';
import { chooseColour } from './colour';
import { COLOUR_SETS } from './colourSets';
import { applyMoves, isSolved, solvedFacelets } from './facelets';
import { parseAlg } from './notation';
import { crossDistance, faceDistance, solveCross } from './solvers';
import { randomScramble, rng } from './testUtils';

const apply = (alg: string, state = solvedFacelets()) => applyMoves(state, parseAlg(alg));
const MODES = ['white', 'white-yellow', 'neutral'] as const;

describe('chooseColour', () => {
  it('always uses white in white-only mode', () => {
    const random = rng(1);
    for (let i = 0; i < 20; i++) {
      expect(chooseColour(apply(randomScramble(random)), '3x3x3', COLOUR_SETS.white)).toBe(0);
    }
  });

  it.each(['white-yellow', 'neutral'] as const)('picks the shortest allowed cross (%s)', (mode) => {
    const random = rng(mode.length);
    const colours = COLOUR_SETS[mode];
    for (let i = 0; i < 100; i++) {
      const state = apply(randomScramble(random));
      const chosen = chooseColour(state, '3x3x3', colours);
      expect(colours).toContain(chosen);
      const shortest = Math.min(...colours.map((c) => crossDistance(state, c)));
      expect(crossDistance(state, chosen)).toBe(shortest);
      // Ties go to the earliest colour in the list.
      expect(colours.findIndex((c) => crossDistance(state, c) === shortest)).toBe(colours.indexOf(chosen));
    }
  });

  it('picks the shortest allowed first face on the 2x2', () => {
    const random = rng(7);
    const colours = COLOUR_SETS.neutral;
    for (let i = 0; i < 50; i++) {
      const state = apply(
        randomScramble(random, 12).replace(/[DLB]/g, (f) => ({ D: 'U', L: 'R', B: 'F' })[f]!),
      );
      const chosen = chooseColour(state, '2x2x2', colours);
      expect(faceDistance(state, chosen)).toBe(Math.min(...colours.map((c) => faceDistance(state, c))));
    }
  });

  it('prefers yellow when its cross is shorter, and white on a tie', () => {
    // Equal progress (both crosses solved): the first colour in the list wins.
    expect(chooseColour(solvedFacelets(), '3x3x3', COLOUR_SETS.neutral)).toBe(0);
    // Triggers like R U R' bring the bottom edges back, so the yellow cross survives and the white one doesn't.
    const state = apply("R U R' F U2 F' L U L'");
    expect(crossDistance(state, 3)).toBeLessThan(crossDistance(state, 0));
    expect(chooseColour(state, '3x3x3', COLOUR_SETS['white-yellow'])).toBe(3);
    expect(chooseColour(state, '3x3x3', COLOUR_SETS.white)).toBe(0);
  });

  it('keeps the colour of a solved cross even when another cross is shorter', () => {
    const random = rng(11);
    for (let i = 0; i < 30; i++) {
      const state = apply(randomScramble(random));
      const colour = chooseColour(state, '3x3x3', COLOUR_SETS.neutral);
      const afterCross = applyMoves(state, solveCross(state, colour).moves);
      expect(analyse3x3(afterCross, colour).crossSolved).toBe(true);
      expect(chooseColour(afterCross, '3x3x3', COLOUR_SETS.neutral)).toBe(colour);
    }
  });
});

describe('engine with cross colour modes', () => {
  it.each(MODES)('solves 3x3 scrambles to the end, one colour throughout (%s)', (mode) => {
    const random = rng(100 + mode.length);
    for (let i = 0; i < 15; i++) {
      const scramble = randomScramble(random);
      const options = { colours: COLOUR_SETS[mode], llMode: 'full' as const };
      const steps = engine.solveAll(scramble, '3x3x3', options);
      const colours = new Set(steps.map((s) => s.colour));
      expect(colours.size).toBe(1);
      expect(COLOUR_SETS[mode]).toContain(steps[0]!.colour);
      expect(steps[0]!.colour).toBe(engine.analyse(scramble, '3x3x3', options).colour);
      const moves = [scramble, ...steps.flatMap((s) => s.moves)].join(' ');
      expect(isSolved(apply(moves))).toBe(true);
    }
  });

  it('solves 3x3 step by step the way the tutorial does', () => {
    const random = rng(200);
    for (let i = 0; i < 10; i++) {
      let moves = randomScramble(random);
      const options = { colours: COLOUR_SETS.neutral };
      for (let n = 0; n < 20; n++) {
        const step = engine.nextStep(moves, '3x3x3', options);
        if (!step) break;
        moves = [moves, ...step.moves].join(' ');
      }
      expect(isSolved(apply(moves))).toBe(true);
    }
  });

  it('solves 2x2 scrambles in neutral mode', () => {
    const random = rng(300);
    for (let i = 0; i < 15; i++) {
      const scramble = randomScramble(random, 11).replace(/[DLB]/g, (f) => ({ D: 'U', L: 'R', B: 'F' })[f]!);
      const steps = engine.solveAll(scramble, '2x2x2', { colours: COLOUR_SETS.neutral });
      const moves = [scramble, ...steps.flatMap((s) => s.moves)].join(' ');
      expect(isSolved(apply(moves), true)).toBe(true);
    }
  });
});
