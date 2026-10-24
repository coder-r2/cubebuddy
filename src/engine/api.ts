import { analyse2x2, analyse3x3, type StageReport, type StageReport2x2 } from './analyse';
import { applyMoves, solvedFacelets, type Facelets } from './facelets';
import { highlightMask } from './mask';
import { formatAlg, parseAlg } from './notation';
import { nextStep, solveAll, slotColours, solveNextPair, type SolveOptions, type Step } from './solvers';
import { warmUp } from './tables';
import { setAlgChoices } from './algSource';
import { chooseColour } from './colour';
import { analyseLbl, nextLblStep, solveAllLbl, type LblReport } from './lbl';
import { setupFor } from './setup';
import { checkState } from './validate';

/*
 * Engine API (SPEC §6.6). Plain functions so the worker and the tests share them; states are passed as
 * move sequences from solved. Results are plain JSON so they cross the worker boundary cheaply.
 */

export type Puzzle = '3x3x3' | '2x2x2';

/** Solver settings plus the allowed cross colours; the engine picks one of them for each cube (D-095). */
export interface HelperOptions extends SolveOptions {
  colours?: readonly number[];
  /** 3x3 method: CFOP (default) or the beginner layer-by-layer method (D-096). */
  method?: 'cfop' | 'lbl';
}

export interface LblAnalysis {
  colour: number;
  report: LblReport;
}

export interface EngineStep {
  kind: Step['kind'];
  /** The cross (2x2: first-face) colour the step solves with. */
  colour: number;
  label: string;
  caseName?: string;
  alg?: string;
  caseId?: string;
  slot?: Step['slot'];
  /** F2L pair steps: the pair's edge colours (home faces), e.g. [2, 1] for the green–red pair. */
  pairColours?: number[];
  moves: string[];
}

export type Analysis = (
  { puzzle: '3x3x3'; report: StageReport } | { puzzle: '2x2x2'; report: StageReport2x2 }
) & {
  /** The cross (2x2: first-face) colour the report is for. */
  colour: number;
};

export interface PieceHint {
  label: string;
  /** cubing.js `experimentalStickeringMaskOrbits` value. */
  mask: string;
}

const stateOf = (moves: string): Facelets => applyMoves(solvedFacelets(), parseAlg(moves));

/** The options with the colour picked for this cube. */
function resolve(state: Facelets, puzzle: Puzzle, options: HelperOptions): SolveOptions & { colour: number } {
  const { colours, method: _method, ...rest } = options;
  return { ...rest, colour: colours ? chooseColour(state, puzzle, colours) : (options.colour ?? 0) };
}

/** `state` is the cube the step starts from. */
const toEngineStep = (step: Step, state: Facelets, colour: number): EngineStep => ({
  kind: step.kind,
  colour,
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

  analyse(moves: string, puzzle: Puzzle, options: HelperOptions = {}): Analysis {
    const state = stateOf(moves);
    const { colour } = resolve(state, puzzle, options);
    return puzzle === '2x2x2'
      ? { puzzle, colour, report: analyse2x2(state, colour) }
      : { puzzle, colour, report: analyse3x3(state, colour) };
  },

  /** The next helper step (solve cross / next pair / LL step / AUF; 2x2: face / OLL / PBL), or null. */
  nextStep(moves: string, puzzle: Puzzle, options: HelperOptions = {}): EngineStep | null {
    const state = stateOf(moves);
    const resolved = resolve(state, puzzle, options);
    const step = lbl(puzzle, options)
      ? nextLblStep(state, resolved.colour)
      : nextStep(state, puzzle, resolved);
    return step ? toEngineStep(step, state, resolved.colour) : null;
  },

  /** Every remaining step (full CFOP / Ortega), all with the colour picked for the starting cube. */
  solveAll(moves: string, puzzle: Puzzle, options: HelperOptions = {}): EngineStep[] {
    let state = stateOf(moves);
    const resolved = resolve(state, puzzle, options);
    const steps = lbl(puzzle, options)
      ? solveAllLbl(state, resolved.colour)
      : solveAll(state, puzzle, resolved);
    return steps.map((step) => {
      const result = toEngineStep(step, state, resolved.colour);
      state = applyMoves(state, step.moves);
      return result;
    });
  },

  /**
   * Moves from solved that make a scanned or hand-entered 3x3 (colours per sticker, white top, green front;
   * D-097). Throws if the cube isn't valid.
   */
  setupFor(colours: number[]): string {
    const problem = checkState(colours);
    if (problem) throw new Error(problem.message);
    return formatAlg(setupFor(Uint8Array.from(colours)));
  },

  /** Stage analysis for the beginner method (3x3). */
  analyseLbl(moves: string, options: HelperOptions = {}): LblAnalysis {
    const state = stateOf(moves);
    const { colour } = resolve(state, '3x3x3', options);
    return { colour, report: analyseLbl(state, colour) };
  },

  /** Highlight for "Find cross" / "Find next F2L pair" / "Find face", and the tutorial's last-layer hints. */
  findPieces(moves: string, puzzle: Puzzle, options: HelperOptions = {}): PieceHint | null {
    const state = stateOf(moves);
    const { colour } = resolve(state, puzzle, options);
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
    if (lbl(puzzle, options)) {
      const { stage } = analyseLbl(state, colour);
      if (stage === 'corners' || stage === 'middle') {
        const step = nextLblStep(state, colour);
        if (!step?.slot) return null;
        const { corner, edge } = slotColours(state, colour, step.slot);
        return stage === 'corners'
          ? { label: 'The next corner', mask: highlightMask(puzzle, { corners: [corner] }) }
          : { label: 'The next edge', mask: highlightMask(puzzle, { edges: [edge] }) };
      }
      if (stage === 'cross') {
        const edges = EDGE_HOMES.filter((e) => e.includes(colour));
        return { label: 'Cross pieces', mask: highlightMask(puzzle, { edges }) };
      }
      if (stage === 'solved' || stage === 'auf') return null;
      const corners = CORNER_HOMES.filter((c) => c.includes(top));
      const edges = EDGE_HOMES.filter((e) => e.includes(top));
      return { label: 'Last-layer pieces', mask: highlightMask(puzzle, { corners, edges }) };
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

const lbl = (puzzle: Puzzle, options: HelperOptions) => puzzle === '3x3x3' && options.method === 'lbl';

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
