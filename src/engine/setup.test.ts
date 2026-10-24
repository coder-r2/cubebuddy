import { describe, expect, it } from 'vitest';
import { applyMoves, solvedFacelets, type Facelets } from './facelets';
import { FACES, parseAlg } from './notation';
import { faceTurnsOnly, setupFor } from './setup';
import { randomScramble, rng } from './testUtils';
import { checkState } from './validate';

const apply = (alg: string, state = solvedFacelets()) => applyMoves(state, parseAlg(alg));
const colours = (state: Facelets) => Array.from(state);
const onlyFaces = (alg: string) =>
  faceTurnsOnly(parseAlg(alg)).every((m) => FACES.includes(m.family as never));

describe('checkState', () => {
  it('accepts every scrambled cube', () => {
    const random = rng(3);
    for (let i = 0; i < 300; i++) expect(checkState(colours(apply(randomScramble(random))))).toBeNull();
    expect(checkState(colours(solvedFacelets()))).toBeNull();
  });

  it('asks for missing stickers first', () => {
    const c = colours(apply("R U R'"));
    c[0] = -1;
    c[10] = -1;
    expect(checkState(c)).toEqual({
      kind: 'unset',
      message: '2 stickers still need a colour.',
      stickers: [0, 10],
    });
  });

  it('rejects wrong colour counts', () => {
    const c = colours(solvedFacelets());
    c[0] = 3; // a yellow sticker on the white face
    expect(checkState(c)?.message).toBe(
      'There are 10 yellow and 8 white stickers; each colour needs exactly 9.',
    );
  });

  it('rejects pieces that do not exist and duplicate pieces', () => {
    const c = colours(solvedFacelets());
    const swap = (a: number, b: number) => ([c[a], c[b]] = [c[b]!, c[a]!]);
    // Two stickers of one corner swapped: a mirror-image corner.
    swap(8, 20); // URF: U and F stickers
    expect(checkState(c)?.message).toBe(
      'A corner’s colours (green–white–red) are in an order no real corner has.',
    );
    swap(8, 20);
    // A corner's white sticker swapped with an edge's green one: a green–red–green corner.
    swap(8, 19);
    expect(checkState(c)?.message).toBe('A corner shows green–green–red: there’s no such corner.');
  });

  it('rejects a twisted corner, a flipped edge and a single swap', () => {
    // Twist the URF corner in place: rotate its three stickers.
    const twisted = colours(solvedFacelets());
    const urf = [8, 9, 20]; // U9, R1, F3
    [twisted[urf[0]!], twisted[urf[1]!], twisted[urf[2]!]] = [
      twisted[urf[2]!]!,
      twisted[urf[0]!]!,
      twisted[urf[1]!]!,
    ];
    expect(checkState(twisted)?.message).toMatch(/twisted/);

    const flipped = colours(solvedFacelets());
    const uf = [7, 19]; // U8, F2
    [flipped[uf[0]!], flipped[uf[1]!]] = [flipped[uf[1]!]!, flipped[uf[0]!]!];
    expect(checkState(flipped)?.message).toMatch(/flipped/);

    // Swap the UF and UR edges.
    const swapped = colours(solvedFacelets());
    const ur = [5, 10]; // U6, R2
    [swapped[uf[0]!], swapped[ur[0]!]] = [swapped[ur[0]!]!, swapped[uf[0]!]!];
    [swapped[uf[1]!], swapped[ur[1]!]] = [swapped[ur[1]!]!, swapped[uf[1]!]!];
    expect(checkState(swapped)?.message).toMatch(/swapped/);
  });
});

describe('setupFor', () => {
  it('rewrites wide turns, slices and rotations as face turns', () => {
    for (const alg of ["r U r'", 'M2 U M2 U2 M2 U M2', 'x y R z2 U', "S' E2 Fw Bw' Dw2", 'x2 y z']) {
      expect(onlyFaces(alg)).toBe(true);
      // Same cube up to a whole-cube rotation: compare by solving from both.
      const direct = apply(alg);
      const faces = applyMoves(solvedFacelets(), faceTurnsOnly(parseAlg(alg)));
      const sameUpToRotation = ['', 'x', 'x2', "x'", 'z', "z'"]
        .flatMap((a) => ['', 'y', 'y2', "y'"].map((b) => `${a} ${b}`))
        .some((r) => apply(r, faces).every((v, i) => v === direct[i]));
      expect(sameUpToRotation).toBe(true);
    }
  });

  it('gives moves that make exactly the entered cube', () => {
    const random = rng(9);
    for (let i = 0; i < 50; i++) {
      const state = apply(randomScramble(random));
      const setup = setupFor(state);
      expect(setup.every((m) => FACES.includes(m.family as never))).toBe(true);
      expect(colours(applyMoves(solvedFacelets(), setup))).toEqual(colours(state));
    }
    expect(setupFor(solvedFacelets())).toEqual([]);
  });
});
