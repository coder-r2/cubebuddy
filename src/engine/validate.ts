import { COLOUR_NAMES } from './colourSets';
import { CORNER_FACELETS, EDGE_FACELETS } from './cubies';
import { STICKER_NORMAL } from './facelets';

/*
 * Validity check for a cube entered sticker by sticker (camera scan or net editor, D-019, D-097). Colours are
 * home-face indices (0 white … 5 blue), −1 = not set yet, in the facelet order of facelets.ts, with the cube
 * held white on top and green in front, so every centre is at home. A cube passes only if it can be reached
 * by turning: 9 stickers of each colour, real and distinct pieces, corner twists summing to 0 (mod 3), edge
 * flips to 0 (mod 2), and corner and edge permutations of the same parity.
 */

export interface StateProblem {
  /** 'unset' while stickers are missing; anything else means the colours entered are impossible. */
  kind: 'unset' | 'centres' | 'counts' | 'piece' | 'twist' | 'flip' | 'parity';
  message: string;
  /** Stickers to point at (empty when the problem can't be pinned to particular pieces). */
  stickers: number[];
}

const key = (colours: number[]) => [...colours].sort().join('');
const CORNER_HOME = new Map(CORNER_FACELETS.map((st, home) => [key(st.map((s) => Math.floor(s / 9))), home]));
const EDGE_HOME = new Map(EDGE_FACELETS.map((st, home) => [key(st.map((s) => Math.floor(s / 9))), home]));

/** True when a corner's sticker list (U/D facet first) runs anticlockwise round the corner. */
const MIRRORED = CORNER_FACELETS.map((st) => {
  const [a, b, c] = st.map((s) => STICKER_NORMAL[s]!);
  const det =
    a![0] * (b![1] * c![2] - b![2] * c![1]) -
    a![1] * (b![0] * c![2] - b![2] * c![0]) +
    a![2] * (b![0] * c![1] - b![1] * c![0]);
  return det < 0;
});

/** A corner's colours going clockwise round it, starting with its U/D colour. */
function clockwise(pos: number, colours: number[]): number[] {
  const cw = MIRRORED[pos] ? [colours[0]!, colours[2]!, colours[1]!] : colours;
  const start = cw.findIndex((c) => c === 0 || c === 3);
  return [...cw.slice(start), ...cw.slice(0, start)];
}
const HOME_CLOCKWISE = CORNER_FACELETS.map((st, home) =>
  clockwise(
    home,
    st.map((s) => Math.floor(s / 9)),
  ),
);

const isUD = (c: number) => c === 0 || c === 3;
const isFB = (c: number) => c === 2 || c === 5;
const names = (colours: number[]) => colours.map((c) => COLOUR_NAMES[c]).join('–');

function parity(perm: number[]): number {
  const seen = new Array<boolean>(perm.length).fill(false);
  let swaps = 0;
  for (let i = 0; i < perm.length; i++) {
    for (let j = i, length = 0; !seen[j]; j = perm[j]!, length++) {
      seen[j] = true;
      if (length > 0) swaps++;
    }
  }
  return swaps % 2;
}

/** The first problem found, or null if the cube is valid. */
export function checkState(colours: readonly number[]): StateProblem | null {
  const unset = colours.flatMap((c, i) => (c < 0 ? [i] : []));
  if (unset.length > 0) {
    return {
      kind: 'unset',
      message: `${unset.length} ${unset.length === 1 ? 'sticker still needs' : 'stickers still need'} a colour.`,
      stickers: unset,
    };
  }
  for (let face = 0; face < 6; face++) {
    if (colours[face * 9 + 4] !== face) {
      return {
        kind: 'centres',
        message: 'Hold the cube with white on top and green in front.',
        stickers: [face * 9 + 4],
      };
    }
  }

  const counts = [0, 1, 2, 3, 4, 5].map((c) => colours.filter((x) => x === c).length);
  const over = counts.flatMap((n, c) => (n > 9 ? [c] : []));
  if (over.length > 0) {
    const describe = (list: number[]) => list.map((c) => `${counts[c]} ${COLOUR_NAMES[c]}`).join(' and ');
    const under = counts.flatMap((n, c) => (n < 9 ? [c] : []));
    return {
      kind: 'counts',
      message: `There are ${describe(over)} and ${describe(under)} stickers; each colour needs exactly 9.`,
      stickers: [],
    };
  }

  const cornerAt: number[] = [];
  const cornerTwist: number[] = [];
  for (let pos = 0; pos < 8; pos++) {
    const stickers = CORNER_FACELETS[pos]!;
    const c = stickers.map((s) => colours[s]!);
    const home = CORNER_HOME.get(key(c));
    if (home === undefined) {
      return { kind: 'piece', message: `A corner shows ${names(c)}: there’s no such corner.`, stickers };
    }
    const twin = cornerAt.indexOf(home);
    if (twin >= 0) {
      return {
        kind: 'piece',
        message: `Two corners are both ${names(c)}.`,
        stickers: [...CORNER_FACELETS[twin]!, ...stickers],
      };
    }
    if (clockwise(pos, c)[1] !== HOME_CLOCKWISE[home]![1]) {
      return {
        kind: 'piece',
        message: `A corner’s colours (${names(c)}) are in an order no real corner has.`,
        stickers,
      };
    }
    cornerAt.push(home);
    const ref = c.findIndex(isUD);
    cornerTwist.push(MIRRORED[pos] ? (3 - ref) % 3 : ref);
  }

  const edgeAt: number[] = [];
  const edgeFlip: number[] = [];
  for (let pos = 0; pos < 12; pos++) {
    const stickers = EDGE_FACELETS[pos]!;
    const c = stickers.map((s) => colours[s]!);
    const home = EDGE_HOME.get(key(c));
    if (home === undefined)
      return { kind: 'piece', message: `An edge shows ${names(c)}: there’s no such edge.`, stickers };
    const twin = edgeAt.indexOf(home);
    if (twin >= 0) {
      return {
        kind: 'piece',
        message: `Two edges are both ${names(c)}.`,
        stickers: [...EDGE_FACELETS[twin]!, ...stickers],
      };
    }
    edgeAt.push(home);
    const ref = c.some(isUD) ? c.findIndex(isUD) : c.findIndex(isFB);
    edgeFlip.push(ref);
  }

  if (cornerTwist.reduce((a, b) => a + b, 0) % 3 !== 0) {
    return {
      kind: 'twist',
      message:
        'One corner is twisted the wrong way, so this cube can’t be solved. Check the corner stickers.',
      stickers: [],
    };
  }
  if (edgeFlip.reduce((a, b) => a + b, 0) % 2 !== 0) {
    return {
      kind: 'flip',
      message: 'One edge is flipped, so this cube can’t be solved. Check the edge stickers.',
      stickers: [],
    };
  }
  if (parity(cornerAt) !== parity(edgeAt)) {
    return {
      kind: 'parity',
      message:
        'Two pieces look swapped, so this cube can’t be solved. Check for two stickers entered the wrong way round.',
      stickers: [],
    };
  }
  return null;
}
