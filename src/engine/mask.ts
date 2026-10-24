import { FACES } from './notation';

/*
 * cubing.js per-piece sticker masks (D-057 spike b). Pieces are listed by identity, i.e. by their home
 * position in cubing.js's default orientation, which matches our colour numbering (colour = home face).
 * '-' = normal, 'D' = dimmed.
 */

const CUBING_EDGES = ['UF', 'UR', 'UB', 'UL', 'DF', 'DR', 'DB', 'DL', 'FR', 'FL', 'BR', 'BL'];
const CUBING_CORNERS = ['UFR', 'URB', 'UBL', 'ULF', 'DRF', 'DFL', 'DLB', 'DBR'];

const sortedKey = (letters: string) => [...letters].sort().join('');
const keyFor = (colours: readonly number[]) => sortedKey(colours.map((c) => FACES[c]).join(''));

export interface Highlight {
  /** Pieces kept bright, each given by its colours (home faces). */
  edges?: number[][];
  corners?: number[][];
}

/** Mask string that dims every piece except the highlighted ones (centres stay normal). */
export function highlightMask(puzzle: '3x3x3' | '2x2x2', { edges = [], corners = [] }: Highlight): string {
  const brightCorners = new Set(corners.map(keyFor));
  const cornerMask = CUBING_CORNERS.map((name) => (brightCorners.has(sortedKey(name)) ? '-' : 'I')).join('');
  if (puzzle === '2x2x2') return `CORNERS:${cornerMask}`;
  const brightEdges = new Set(edges.map(keyFor));
  const edgeMask = CUBING_EDGES.map((name) => (brightEdges.has(sortedKey(name)) ? '-' : 'I')).join('');
  return `EDGES:${edgeMask},CORNERS:${cornerMask},CENTERS:------`;
}

export type PieceMark = '-' | 'D' | 'I';

/** Mask built from a rule on each piece's colours (home faces), e.g. "last-layer pieces normal, rest dimmed". */
export function pieceMask(puzzle: '3x3x3' | '2x2x2', mark: (colours: number[]) => PieceMark): string {
  const coloursOf = (name: string) => [...name].map((letter) => FACES.indexOf(letter as never));
  const cornerMask = CUBING_CORNERS.map((name) => mark(coloursOf(name))).join('');
  if (puzzle === '2x2x2') return `CORNERS:${cornerMask}`;
  const edgeMask = CUBING_EDGES.map((name) => mark(coloursOf(name))).join('');
  return `EDGES:${edgeMask},CORNERS:${cornerMask},CENTERS:------`;
}
