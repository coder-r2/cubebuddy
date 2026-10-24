import { analyse2x2, analyse3x3, type StageReport, type StageReport2x2 } from './analyse';
import { applyMoves, solvedFacelets, type Facelets } from './facelets';
import { highlightMask } from './mask';
import { formatAlg, parseAlg } from './notation';
import { nextStep, solveAll, slotColours, solveNextPair, type SolveOptions, type Step } from './solvers';
import { warmUp } from './tables';
import { setAlgChoices } from './algSource';

/*
 * Engine API (SPEC §6.6). Plain functions so the worker and the tests share them; states are passed as
 * move sequences from solved. Results are plain JSON so they cross the worker boundary cheaply.
 */

export type Puzzle = '3x3x3' | '2x2x2';

export interface EngineStep {
  kind: Step['kind'];
  label: string;
  caseName?: string;
  alg?: string;
  caseId?: string;
  slot?: Step['slot'];
  /** F2L pair steps: the pair's edge colours (home faces), e.g. [2, 1] for the green–red pair. */
  pairColours?: number[];
  moves: string[];
}

export type Analysis = { puzzle: '3x3x3'; report: StageReport } | { puzzle: '2x2x2'; report: StageReport2x2 };

export interface PieceHint {
  label: string;
  /** cubing.js `experimentalStickeringMaskOrbits` value. */
  mask: string;
}

const stateOf = (moves: string): Facelets => applyMoves(solvedFacelets(), parseAlg(moves));

/** `state` is the cube the step starts from. */
const toEngineStep = (step: Step, state: Facelets, colour = 0): EngineStep => ({
  kind: step.kind,
  label: step.label,
  caseName: step.caseName,
  alg: step.alg,
  caseId: step.caseId,
  slot: step.slot,
  pairColours: step.slot && slotColours(state, colour, step.slot).edge,
  moves: formatAlg(step.moves).split(' ').filter(Boolean),
});

export const engine = {
  /** Build the search tables; returns build times in ms. */
  init(): Record<string, number> {
    return warmUp();
  },

  /** Use the user's chosen algs (caseId → alg) in the helpers (D-016). */
  setAlgChoices(choices: Record<string, string>): void {
    setAlgChoices(choices);
  },

  analyse(moves: string, puzzle: Puzzle, options: SolveOptions = {}): Analysis {
    const state = stateOf(moves);
    return puzzle === '2x2x2'
      ? { puzzle, report: analyse2x2(state, options.colour) }
      : { puzzle, report: analyse3x3(state, options.colour) };
  },

  /** The next helper step (solve cross / next pair / LL step / AUF; 2x2: face / OLL / PBL), or null. */
  nextStep(moves: string, puzzle: Puzzle, options: SolveOptions = {}): EngineStep | null {
    const state = stateOf(moves);
    const step = nextStep(state, puzzle, options);
    return step ? toEngineStep(step, state, options.colour) : null;
  },

  /** Every remaining step (full CFOP / Ortega). */
  solveAll(moves: string, puzzle: Puzzle, options: SolveOptions = {}): EngineStep[] {
    let state = stateOf(moves);
    return solveAll(state, puzzle, options).map((step) => {
      const result = toEngineStep(step, state, options.colour);
      state = applyMoves(state, step.moves);
      return result;
    });
  },

  /** Highlight for "Find cross" / "Find next F2L pair" / "Find face", and the tutorial's last-layer hints. */
  findPieces(moves: string, puzzle: Puzzle, options: SolveOptions = {}): PieceHint | null {
    const state = stateOf(moves);
    const colour = options.colour ?? 0;
    const top = (colour + 3) % 6; // the opposite face's colour
    if (puzzle === '2x2x2') {
      const stage = analyse2x2(state, colour).stage;
      if (stage === 'oll') {
        const corners = CORNER_HOMES.filter((c) => c.includes(top));
        return { label: 'Top-layer pieces', mask: highlightMask(puzzle, { corners }) };
      }
      if (stage !== 'face') return null;
      const corners = CORNER_HOMES.filter((c) => c.includes(colour));
      return { label: 'First-face pieces', mask: highlightMask(puzzle, { corners }) };
    }
    const report = analyse3x3(state, colour);
    if (report.stage === 'cross') {
      const edges = EDGE_HOMES.filter((e) => e.includes(colour));
      return { label: 'Cross pieces', mask: highlightMask(puzzle, { edges }) };
    }
    if (report.stage === 'f2l') {
      const step = solveNextPair(state, colour, options.f2lStyle);
      if (!step?.slot) return null;
      const { corner, edge } = slotColours(state, colour, step.slot);
      return {
        label: `Next pair: ${step.slot} slot`,
        mask: highlightMask(puzzle, { corners: [corner], edges: [edge] }),
      };
    }
    if (report.stage === 'oll' || report.stage === 'pll') {
      const corners = CORNER_HOMES.filter((c) => c.includes(top));
      const edges = EDGE_HOMES.filter((e) => e.includes(top));
      return { label: 'Last-layer pieces', mask: highlightMask(puzzle, { corners, edges }) };
    }
    return null;
  },
};

export type EngineAPI = typeof engine;

// Piece identities as home-face colour lists (U0 R1 F2 D3 L4 B5).
const EDGE_HOMES = [
  [0, 1],
  [0, 2],
  [0, 4],
  [0, 5],
  [3, 1],
  [3, 2],
  [3, 4],
  [3, 5],
  [2, 1],
  [2, 4],
  [5, 4],
  [5, 1],
];
const CORNER_HOMES = [
  [0, 1, 2],
  [0, 2, 4],
  [0, 4, 5],
  [0, 5, 1],
  [3, 2, 1],
  [3, 4, 2],
  [3, 5, 4],
  [3, 1, 5],
];
