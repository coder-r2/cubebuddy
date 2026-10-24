// Move notation (SPEC §6.1): outer turns, wide turns, slices and rotations with ' / 2 modifiers.

export const FACES = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
export type Face = (typeof FACES)[number];
export type WideFamily = `${Face}w`;
export type Family = Face | WideFamily | 'M' | 'E' | 'S' | 'x' | 'y' | 'z';

export interface Move {
  family: Family;
  /** Clockwise quarter turns: 1, 2 or 3 (3 = prime). */
  amount: 1 | 2 | 3;
}

const SLICE_FOR_INNER_LAYER: Record<Face, [Family, 1 | -1]> = {
  // cubing.js reports Shift+click presses as second-layer moves ("2R").
  R: ['M', -1],
  L: ['M', 1],
  U: ['E', -1],
  D: ['E', 1],
  F: ['S', 1],
  B: ['S', -1],
};

const ROTATION_FOR_FACE: Record<Face, [Family, 1 | -1]> = {
  // cubing.js reports Ctrl+click presses as rotation families ("Rv").
  R: ['x', 1],
  L: ['x', -1],
  U: ['y', 1],
  D: ['y', -1],
  F: ['z', 1],
  B: ['z', -1],
};

const TOKEN = /^(\d?)([URFDLBurfdlbMESxyz])(w?)(v?)(\d*)('?)$/;

function normaliseAmount(quarterTurns: number): 0 | 1 | 2 | 3 {
  return (((quarterTurns % 4) + 4) % 4) as 0 | 1 | 2 | 3;
}

/** Parse one move token (`R`, `U'`, `F2`, `Rw`, `r`, `M'`, `x2`, `2R`, `Rv`). Returns null if invalid or a no-op. */
export function parseMove(token: string): Move | null {
  const match = TOKEN.exec(token.trim());
  if (!match) return null;
  const [, layer = '', letter = '', wide, rotation, digits, prime] = match;
  let quarterTurns = (digits ? Number(digits) : 1) * (prime ? -1 : 1);
  let family: Family;
  const isFace = (FACES as readonly string[]).includes(letter);
  const lowerFace =
    (FACES as readonly string[]).includes(letter.toUpperCase()) && letter !== letter.toUpperCase();

  if (rotation) {
    if (!isFace || wide || layer) return null;
    const [rot, sign] = ROTATION_FOR_FACE[letter as Face];
    family = rot;
    quarterTurns *= sign;
  } else if (layer === '2' && isFace && !wide) {
    const [slice, sign] = SLICE_FOR_INNER_LAYER[letter as Face];
    family = slice;
    quarterTurns *= sign;
  } else if (layer) {
    return null;
  } else if (isFace) {
    family = wide ? (`${letter}w` as WideFamily) : (letter as Face);
  } else if (lowerFace) {
    if (wide) return null;
    family = `${letter.toUpperCase()}w` as WideFamily;
  } else {
    if (wide) return null;
    family = letter as Family;
  }

  const amount = normaliseAmount(quarterTurns);
  return amount === 0 ? null : { family, amount };
}

/** Parse a whitespace-separated move sequence; throws on an invalid token. Parentheses are ignored. */
export function parseAlg(alg: string): Move[] {
  const moves: Move[] = [];
  for (const token of alg.replace(/[()]/g, ' ').split(/\s+/)) {
    if (!token) continue;
    const move = parseMove(token);
    if (move) moves.push(move);
    else if (!TOKEN.test(token)) throw new Error(`Invalid move: ${token}`);
  }
  return moves;
}

/** `Rw` families are written as lowercase `r`, as in most alg sheets. */
export function formatMove({ family, amount }: Move): string {
  const name = family.endsWith('w') ? family[0]!.toLowerCase() : family;
  return name + (amount === 2 ? '2' : amount === 3 ? "'" : '');
}

export const formatAlg = (moves: readonly Move[]) => moves.map(formatMove).join(' ');

export const invertMove = ({ family, amount }: Move): Move => ({ family, amount: (4 - amount) as 1 | 2 | 3 });

export const invertAlg = (moves: readonly Move[]) => moves.map(invertMove).reverse();

export const isRotation = (move: Move) => move.family === 'x' || move.family === 'y' || move.family === 'z';

/**
 * Merge consecutive turns of the same layer (`R R` → `R2`, `R R'` → nothing), as shown in the free-play
 * history (D-032). Only adjacent same-family moves merge.
 */
export function mergeMoves(moves: readonly Move[]): Move[] {
  const out: Move[] = [];
  for (const move of moves) {
    const last = out.at(-1);
    if (last && last.family === move.family) {
      const amount = normaliseAmount(last.amount + move.amount);
      if (amount === 0) out.pop();
      else out[out.length - 1] = { family: move.family, amount };
    } else {
      out.push(move);
    }
  }
  return out;
}
