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
