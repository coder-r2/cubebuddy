import type { Puzzle } from '../../db/types';
import type { Analysis, EngineStep } from '../../engine/api';
import { formatMove, isRotation, parseMove } from '../../engine/notation';
import { allowedOn2x2 } from '../play/useFreePlay';

// Stage model for the CFOP and Ortega tutorials (SPEC §5.6–5.7): stepper stages, step titles, guides and
// the full-solution rows. Pure functions, so they're unit-tested without the UI.

export const STAGES: Record<Puzzle, string[]> = {
  '3x3x3': ['Cross', 'F2L 1', 'F2L 2', 'F2L 3', 'F2L 4', 'OLL', 'PLL', 'Solved'],
  '2x2x2': ['Face', 'OLL', 'PBL', 'Solved'],
};

/** Index into STAGES for the analysed cube; it moves backwards if solved parts get broken. */
export function stageIndex(analysis: Analysis): number {
  if (analysis.puzzle === '2x2x2') {
    return { face: 0, oll: 1, pbl: 2, auf: 2, solved: 3 }[analysis.report.stage];
  }
  const r = analysis.report;
  switch (r.stage) {
    case 'cross':
      return 0;
    case 'f2l':
      return 1 + r.solvedPairs.length;
    case 'oll':
      return 5;
    case 'pll':
    case 'auf':
      return 6;
    default:
      return 7;
  }
}

/** Colour names by home face (U R F D L B), for naming F2L pairs the way cubers do ("green–red"). */
export const COLOUR_NAMES = ['white', 'red', 'green', 'yellow', 'orange', 'blue'];

/** Headline for a step, e.g. "Pair up and insert the green–red pair" or "Orient the edges (look 1 of 2)". */
export function stepTitle(step: EngineStep, puzzle: Puzzle): string {
  switch (step.kind) {
    case 'cross':
      return 'Solve the white cross';
    case 'pair':
      return step.pairColours
        ? `Pair up and insert the ${step.pairColours.map((c) => COLOUR_NAMES[c]).join('–')} pair`
        : 'Pair up and insert the next pair';
    case 'eo':
      return 'Orient the edges (look 1 of 2)';
    case 'ocll':
      return 'Orient the corners (look 2 of 2)';
    case 'oll':
      return 'Orient the last layer';
    case 'cpll':
      return 'Place the corners (look 1 of 2)';
    case 'epll':
      return 'Place the edges (look 2 of 2)';
    case 'pll':
      return 'Permute the last layer';
    case 'face':
      return 'Make the white face';
    case 'ortega-oll':
      return 'Orient the top face';
    case 'pbl':
      return 'Solve both layers';
    case 'auf':
      return puzzle === '2x2x2' ? 'Line up the layers' : 'Turn the top layer to finish';
  }
}

/** Short static guide for each stage (D-035). */
export function stageGuide(puzzle: Puzzle, index: number): string {
  const stage = STAGES[puzzle][index];
  if (puzzle === '2x2x2') {
    switch (stage) {
      case 'Face':
        return 'Make one face all white. Only the white stickers matter for now: the sides don’t need to match yet. Then hold the cube with white on the bottom.';
      case 'OLL':
        return 'With white on the bottom, make the top face all yellow with one of 7 algs. Recognise the case by where the yellow stickers point.';
      case 'PBL':
        return 'Both faces are done; now put the corners of both layers in place. Look for “headlights” (two matching stickers on one side) in each layer. If only the bottom layer is wrong, flip the cube over first (x2).';
      default:
        return 'The cube is solved. Try another scramble, or time yourself on the Timer page.';
    }
  }
  switch (stage) {
    case 'Cross':
      return 'Solve the four white edges so they make a plus sign, with each edge’s side colour matching its centre. Plan it during inspection: it never needs more than 8 moves. Then hold the cross on the bottom.';
    case 'OLL':
      return 'F2L is done, so only the top layer is left. First make the whole top face yellow (orient the last layer). Recognise the case from the pattern of yellow stickers.';
    case 'PLL':
      return 'The top is all yellow; now move the last-layer pieces to their places (permute the last layer). Look at the side stickers for “headlights” and solid bars to recognise the case.';
    case 'Solved':
      return 'The cube is solved. Try another scramble, or practise the cases you met in the Trainer.';
    default:
      return 'Each F2L pair is a white corner and the edge that goes above it. Pair them up in the top layer, then insert them together into their slot. An empty slot is a handy place to park a piece while you set the pair up. Keep the cross and finished pairs intact.';
  }
}

/** Moves in the half-turn metric, not counting cube rotations. */
export const moveCount = (moves: readonly string[]) =>
  moves.filter((m) => {
    const parsed = parseMove(m);
    return parsed !== null && !isRotation(parsed);
  }).length;

export interface SolutionRow {
  label: string;
  moves: string[];
}

function rowLabel(step: EngineStep, puzzle: Puzzle, pair: number): string {
  switch (step.kind) {
    case 'cross':
      return 'Cross';
    case 'pair':
      return `F2L ${pair}`;
    case 'eo':
      return 'OLL (edges)';
    case 'ocll':
      return 'OLL (corners)';
    case 'cpll':
      return 'PLL (corners)';
    case 'epll':
      return 'PLL (edges)';
    case 'oll':
    case 'ortega-oll':
      return 'OLL';
    case 'pll':
      return 'PLL';
    case 'face':
      return 'Face';
    case 'pbl':
      return 'PBL';
    case 'auf':
      return puzzle === '2x2x2' ? 'Final turn' : 'AUF';
  }
}

/** One row per solver step, labelled by stage ("F2L 2", "OLL (corners)", …). */
export function solutionRows(steps: readonly EngineStep[], puzzle: Puzzle): SolutionRow[] {
  let pairs = 0;
  return steps.map((step) => {
    if (step.kind === 'pair') pairs++;
    return { label: rowLabel(step, puzzle, pairs), moves: step.moves };
  });
}

/** Plain-text solution for the clipboard. */
export function solutionText(scramble: string, rows: readonly SolutionRow[]): string {
  const total = rows.reduce((sum, row) => sum + moveCount(row.moves), 0);
  return [
    `Scramble: ${scramble}`,
    ...rows.map((row) => `${row.label}: ${row.moves.join(' ')} (${moveCount(row.moves)})`),
    `Total: ${total} moves`,
  ].join('\n');
}

export interface ScrambleToken {
  text: string;
  valid: boolean;
}

/**
 * Check a typed scramble token by token so invalid ones can be highlighted (SPEC §5.6). `moves` is the
 * scramble in our notation, or empty if any token is invalid. Phones often type ’ for ', so both work.
 */
export function checkScramble(input: string, puzzle: Puzzle): { tokens: ScrambleToken[]; moves: string[] } {
  const tokens = input.trim().split(/\s+/).filter(Boolean);
  const moves = tokens.map((text) => {
    const parsed = parseMove(text.replace(/[’‘`]/g, "'"));
    const move = parsed && formatMove(parsed);
    return move && (puzzle === '3x3x3' || allowedOn2x2(move)) ? move : null;
  });
  return {
    tokens: tokens.map((text, i) => ({ text, valid: moves[i] !== null })),
    moves: moves.length > 0 && moves.every(Boolean) ? (moves as string[]) : [],
  };
}
