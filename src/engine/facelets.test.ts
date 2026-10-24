import { describe, expect, it } from 'vitest';
import { readPieces } from './cubies';
import { applyMoves, isSolved, solvedFacelets } from './facelets';
import { invertAlg, parseAlg } from './notation';

const apply = (alg: string) => applyMoves(solvedFacelets(), parseAlg(alg));
const same = (a: string, b: string) => expect(Array.from(apply(a))).toEqual(Array.from(apply(b)));
const stickers = (state: Uint8Array, indices: number[]) => indices.map((i) => state[i]);

// Colours are home faces: U0 R1 F2 D3 L4 B5.
describe('move directions match WCA notation', () => {
  it.each([
    ['R', [2, 5, 8], 2], // F → U on the right column
    ['U', [18, 19, 20], 1], // R → F on the top row
    ['F', [6, 7, 8], 4], // L → U on the bottom row of U
    ['M', [1, 4, 7], 5], // like L: B → U
    ['E', [12, 13, 14], 2], // like D: F → R
    ['S', [3, 4, 5], 4], // like F: L → U
    ['x', [0, 4, 8], 2], // like R: F → U
    ['y', [18, 22, 26], 1], // like U: R → F
    ['z', [0, 4, 8], 4], // like F: L → U
  ])('%s', (alg, indices, colour) => {
    expect(stickers(apply(alg), indices)).toEqual(indices.map(() => colour));
  });
});

describe('move algebra', () => {
  const ALL = 'U R F D L B Uw Rw Fw Dw Lw Bw M E S x y z'.split(' ');

  it.each(ALL)('%s has order 4 and is undone by its inverse', (move) => {
    same(`${move} ${move} ${move} ${move}`, '');
    same(`${move} ${move}'`, '');
    same(`${move}2`, `${move} ${move}`);
  });

  it('relates slices, wide moves and rotations', () => {
    same('M', "x' R L'");
    same('E', "y' U D'");
    same('S', "z F' B");
    same('Rw', "R M'");
    same('x', "R M' L'");
    same('y', "U E' D'");
    same('z', "F S B'");
  });

  it("(R U R' U') has order 6", () => {
    same("R U R' U' ".repeat(6), '');
    expect(isSolved(apply("R U R' U' ".repeat(3)))).toBe(false);
  });

  it('treats rotations as solved (orientation-independent)', () => {
    expect(isSolved(apply("x y2 z'"))).toBe(true);
    expect(isSolved(apply('R'))).toBe(false);
  });

  it('applies an alg and its inverse back to solved', () => {
    const alg = parseAlg("R U2 Fw' M E2 S' x D L' B y z2 r' l u d' f b2");
    expect(isSolved(applyMoves(applyMoves(solvedFacelets(), alg), invertAlg(alg)))).toBe(true);
  });
});

describe('readPieces', () => {
  it('reads a solved cube as all pieces home, in any orientation', () => {
    for (const alg of ['', 'x', "y z'", 'x2 y']) {
      const { corners, edges } = readPieces(apply(alg));
      expect(Array.from(corners)).toEqual([0, 3, 6, 9, 12, 15, 18, 21]);
      expect(Array.from(edges)).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]);
    }
  });

  it('tracks a U turn', () => {
    const { corners } = readPieces(apply('U'));
    // U clockwise: the piece at URF moves to UFL (pos 1), keeping its U sticker up.
    expect(corners[0]).toBe(1 * 3);
  });
});
