import type { Puzzle } from '../../db/types';
import type { Analysis, EngineStep, LblAnalysis } from '../../engine/api';
import { COLOUR_NAMES, opposite } from '../../engine/colourSets';
import { formatMove, isRotation, parseMove } from '../../engine/notation';
import { allowedOn2x2 } from '../play/useFreePlay';

// Stage model for the CFOP, Ortega and beginner tutorials (SPEC §5.6–5.7, D-096): stepper stages, step titles,
// guides and the full-solution rows. Pure functions, so they're unit-tested without the UI.

export type Method = 'cfop' | 'ortega' | 'lbl';

export const PUZZLE_OF: Record<Method, Puzzle> = { cfop: '3x3x3', ortega: '2x2x2', lbl: '3x3x3' };

export const STAGES: Record<Method, string[]> = {
  cfop: ['Cross', 'F2L 1', 'F2L 2', 'F2L 3', 'F2L 4', 'OLL', 'PLL', 'Solved'],
  ortega: ['Face', 'OLL', 'PBL', 'Solved'],
  lbl: [
    'Cross',
    'First layer',
    'Middle layer',
    'Top cross',
    'Top edges',
    'Place corners',
    'Twist corners',
    'Solved',
  ],
};

const LBL_STAGE_INDEX: Record<LblAnalysis['report']['stage'], number> = {
  cross: 0,
  corners: 1,
  middle: 2,
  'top-cross': 3,
  'top-edges': 4,
  'place-corners': 5,
  'twist-corners': 6,
  auf: 6,
  solved: 7,
};

/** Index into STAGES for the analysed cube; it moves backwards if solved parts get broken. */
export function stageIndex(analysis: Analysis | LblAnalysis): number {
  if (!('puzzle' in analysis)) return LBL_STAGE_INDEX[analysis.report.stage];
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

export { COLOUR_NAMES };

/** Headline for a step, e.g. "Pair up and insert the green–red pair" or "Orient the edges (look 1 of 2)". */
export function stepTitle(step: EngineStep, puzzle: Puzzle): string {
  const last = COLOUR_NAMES[opposite(step.colour)];
  const pair = step.pairColours?.map((c) => COLOUR_NAMES[c]).join('–');
  switch (step.kind) {
    case 'lbl-corner':
      return pair ? `Put in the ${COLOUR_NAMES[step.colour]}–${pair} corner` : 'Put in the next corner';
    case 'lbl-edge':
      return pair ? `Put in the ${pair} edge` : 'Put in the next edge';
    case 'lbl-eo':
      return `Make the ${last} cross`;
    case 'lbl-ep':
      return `Match up the ${last} edges`;
    case 'lbl-cp':
      return `Move the ${last} corners to their places`;
    case 'lbl-co':
      return `Twist the ${last} corners`;
    case 'cross':
      return `Solve the ${COLOUR_NAMES[step.colour]} cross`;
    case 'pair':
      return pair ? `Pair up and insert the ${pair} pair` : 'Pair up and insert the next pair';
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
      return `Make the ${COLOUR_NAMES[step.colour]} face`;
    case 'ortega-oll':
      return 'Orient the top face';
    case 'pbl':
      return 'Solve both layers';
    case 'auf':
      return puzzle === '2x2x2' ? 'Line up the layers' : 'Turn the top layer to finish';
  }
}

/** Short static guide for each stage (D-035), for the cross (2x2: first-face) colour in use. */
export function stageGuide(method: Method, index: number, colour = 0): string {
  const stage = STAGES[method][index];
  const first = COLOUR_NAMES[colour]!;
  const last = COLOUR_NAMES[opposite(colour)]!;
  if (method === 'lbl') {
    switch (stage) {
      case 'Cross':
        return `Make a plus sign of ${first} edges, with each edge’s other colour matching the centre next to it. A handy way in: first gather the four ${first} edges around the ${last} centre (a “daisy”), then turn each one down when its side colour matches a centre. Then hold the cross on the bottom.`;
      case 'First layer':
        return `Find a ${first} corner in the top layer and turn the top until it sits right above the place it belongs. Hold that place at the front-right and repeat R U R’ U’ until the corner drops in the right way round (1, 3 or 5 times). A corner stuck in the wrong place on the bottom comes out with one R U R’ U’.`;
      case 'Middle layer':
        return `Find a top-layer edge without ${last}. Turn the top until its front colour matches the centre below it. If its top colour matches the right centre, do U R U’ R’ U’ F’ U F; if it matches the left centre, do U’ L’ U L U F U’ F’. An edge stuck in the middle layer the wrong way comes out by putting any top edge in its place.`;
      case 'Top cross':
        return `Now only the top layer is left. To make a ${last} cross, look at the ${last} edges on top: a dot, an L shape or a line. Hold an L at the back-left, or a line from left to right, and do F R U R’ U’ F’. From a dot, do it once to get an L.`;
      case 'Top edges':
        return `Turn the top until two edges match their centres. If the matching ones are next to each other, hold them at the back and the right and do R U R’ U R U2 R’, then line the top up. If they’re opposite, do the alg once from any side to get the first case.`;
      case 'Place corners':
        return `Look for a ${last} corner that’s in its place (any way round). Hold it at the front-right and do U R U’ L’ U R’ U’ L, once or twice, until all four corners are in their places. If none is in place, do the alg once from anywhere first.`;
      case 'Twist corners':
        return `Hold a corner that needs twisting at the front-right. Repeat R’ D’ R D until its ${last} sticker faces up (the bottom looks messy for a while: that’s fine). Then turn only the top layer (U) to bring the next corner to the front-right, and repeat. When all four are done, the bottom fixes itself; turn the top to finish.`;
      default:
        return 'The cube is solved! When you can do this without help, the CFOP tutorial shows the faster method speedcubers use.';
    }
  }
  if (method === 'ortega') {
    switch (stage) {
      case 'Face':
        return `Make one face all ${first}. Only the ${first} stickers matter for now: the sides don’t need to match yet. Then hold the cube with ${first} on the bottom.`;
      case 'OLL':
        return `With ${first} on the bottom, make the top face all ${last} with one of 7 algs. Recognise the case by where the ${last} stickers point.`;
      case 'PBL':
        return 'Both faces are done; now put the corners of both layers in place. Look for “headlights” (two matching stickers on one side) in each layer. If only the bottom layer is wrong, flip the cube over first (x2).';
      default:
        return 'The cube is solved. Try another scramble, or time yourself on the Timer page.';
    }
  }
  switch (stage) {
    case 'Cross':
      return `Solve the four ${first} edges so they make a plus sign, with each edge’s side colour matching its centre. Plan it during inspection: it never needs more than 8 moves. Then hold the cross on the bottom.`;
    case 'OLL':
      return `F2L is done, so only the top layer is left. First make the whole top face ${last} (orient the last layer). Recognise the case from the pattern of ${last} stickers.`;
    case 'PLL':
      return `The top is all ${last}; now move the last-layer pieces to their places (permute the last layer). Look at the side stickers for “headlights” and solid bars to recognise the case.`;
    case 'Solved':
      return 'The cube is solved. Try another scramble, or practise the cases you met in the Trainer.';
    default:
      return `Each F2L pair is a ${first} corner and the edge that goes above it. Pair them up in the top layer, then insert them together into their slot. An empty slot is a handy place to park a piece while you set the pair up. Keep the cross and finished pairs intact.`;
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
    case 'lbl-corner':
      return `Corner ${pair}`;
    case 'lbl-edge':
      return `Edge ${pair}`;
    case 'lbl-eo':
      return 'Top cross';
    case 'lbl-ep':
      return 'Top edges';
    case 'lbl-cp':
      return 'Place corners';
    case 'lbl-co':
      return 'Twist corners';
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

/** One row per solver step, labelled by stage ("F2L 2", "OLL (corners)", "Edge 3", …). */
export function solutionRows(steps: readonly EngineStep[], puzzle: Puzzle): SolutionRow[] {
  const counts = new Map<EngineStep['kind'], number>();
  return steps.map((step) => {
    const n = (counts.get(step.kind) ?? 0) + 1;
    counts.set(step.kind, n);
    return { label: rowLabel(step, puzzle, n), moves: step.moves };
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
