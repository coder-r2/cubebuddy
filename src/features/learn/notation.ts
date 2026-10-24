import { applyMoves, solvedFacelets } from '../../engine/facelets';
import { parseAlg } from '../../engine/notation';

// Content of the notation course (SPEC §5.2, D-020).

export interface MoveCard {
  /** Base move, e.g. 'R', 'r', 'M', 'x'. */
  move: string;
  title: string;
  text: string;
  /** Another way people write it, e.g. Rw for r. */
  alias?: string;
}

export interface CardGroup {
  id: string;
  title: string;
  intro: string;
  cards: MoveCard[];
}

export const NOTATION_GROUPS: CardGroup[] = [
  {
    id: 'faces',
    title: 'Face turns',
    intro:
      'Each letter turns one face a quarter turn clockwise, as if you were looking straight at that face. A prime (′) means anticlockwise, and a 2 means a half turn.',
    cards: [
      { move: 'R', title: 'Right', text: 'The right face. Clockwise pushes the front stickers up.' },
      { move: 'L', title: 'Left', text: 'The left face. Clockwise pulls the front stickers down.' },
      { move: 'U', title: 'Up', text: 'The top face. Clockwise moves the front stickers to the left.' },
      { move: 'D', title: 'Down', text: 'The bottom face. Clockwise moves the front stickers to the right.' },
      { move: 'F', title: 'Front', text: 'The face towards you, clockwise like a clock hand.' },
      {
        move: 'B',
        title: 'Back',
        text: 'The face away from you. Clockwise is judged from behind, so from the front it looks anticlockwise.',
      },
    ],
  },
  {
    id: 'wide',
    title: 'Wide moves',
    intro: 'A lowercase letter (or a w) turns two layers together: the face and the slice next to it.',
    cards: [
      { move: 'r', alias: 'Rw', title: 'Right two layers', text: 'R and the middle slice together.' },
      { move: 'l', alias: 'Lw', title: 'Left two layers', text: 'L and the middle slice together.' },
      { move: 'u', alias: 'Uw', title: 'Top two layers', text: 'U and the layer below it together.' },
      { move: 'd', alias: 'Dw', title: 'Bottom two layers', text: 'D and the layer above it together.' },
      { move: 'f', alias: 'Fw', title: 'Front two layers', text: 'F and the slice behind it together.' },
      { move: 'b', alias: 'Bw', title: 'Back two layers', text: 'B and the slice in front of it together.' },
    ],
  },
  {
    id: 'slices',
    title: 'Slice moves',
    intro: 'The middle layers. Each one turns the same way as one of the outer faces.',
    cards: [
      { move: 'M', title: 'Middle', text: 'The slice between L and R. It turns the same way as L.' },
      { move: 'E', title: 'Equator', text: 'The slice between U and D. It turns the same way as D.' },
      { move: 'S', title: 'Standing', text: 'The slice between F and B. It turns the same way as F.' },
    ],
  },
  {
    id: 'rotations',
    title: 'Cube rotations',
    intro:
      'Turn the whole cube in your hands. Nothing gets scrambled; you just look at it from another side.',
    cards: [
      { move: 'x', title: 'x', text: 'The whole cube turns like R: the front goes to the top.' },
      { move: 'y', title: 'y', text: 'The whole cube turns like U: the front goes to the left.' },
      { move: 'z', title: 'z', text: 'The whole cube turns like F: the top goes to the right.' },
    ],
  },
];

export const variantsOf = (move: string) => [move, `${move}'`, `${move}2`];

/** Mini-quiz tasks, easiest first: face turns, then primes and doubles, then wide/slice moves. */
export const QUIZ_TASKS = ['R U', "R' U2", "F' L", 'D2 B', "r U'", 'M2 U'];

/** True when `moves` leave the cube exactly as `target` does (orientation included). */
export function sameState(moves: readonly string[], target: string): boolean {
  const a = applyMoves(solvedFacelets(), parseAlg(moves.join(' ')));
  const b = applyMoves(solvedFacelets(), parseAlg(target));
  return a.every((v, i) => v === b[i]);
}

/** Display a move with a real prime sign, e.g. R′. */
export const pretty = (alg: string) => alg.replace(/'/g, '′');
