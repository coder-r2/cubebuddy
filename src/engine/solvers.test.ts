import { describe, expect, it } from 'vitest';
import {
  analyse2x2,
  analyse3x3,
  crossSolved,
  f2lSolved,
  frameForCentre,
  llOriented,
  SLOTS,
  slotSolved,
} from './analyse';
import { CORNER_FACELETS, EDGE_FACELETS, FACE_MOVES } from './cubies';
import { applyMoves, isSolved, solvedFacelets, type Facelets } from './facelets';
import { algsFor } from './algSource';

const EO_ALGS = algsFor.eo();
const OCLL_ALGS = algsFor.ocll();
const OLL_ALGS = algsFor.oll();
const CPLL_ALGS = algsFor.cpll();
const EPLL_ALGS = algsFor.epll();
const PLL_ALGS = algsFor.pll();
const ORTEGA_OLL_ALGS = algsFor.ortegaOll();
const PBL_ALGS = algsFor.pbl();
import { formatAlg, invertAlg, parseAlg, type Move } from './notation';
import { nextStep, solveAll, solveCross, solveLastLayerStep, solveNextPair } from './solvers';
import { randomScramble, rng } from './testUtils';

const apply = (alg: string, state = solvedFacelets()) => applyMoves(state, parseAlg(alg));
const inverse = (alg: string) => invertAlg(parseAlg(alg));

describe('analyse3x3', () => {
  it('reports a solved cube in any orientation', () => {
    expect(analyse3x3(apply('x y')).stage).toBe('solved');
  });

  it('finds the cross stage after a scramble', () => {
    expect(analyse3x3(apply("R U F'")).stage).toBe('cross');
  });

  it('recognises an F2L state with one pair out (white cross on the bottom)', () => {
    // z2 puts white on the bottom; R U R' takes the FR pair out without touching the cross.
    const report = analyse3x3(apply("z2 R U R'"));
    expect(report.crossSolved).toBe(true);
    expect(report.solvedPairs).toEqual(['FL', 'BL', 'BR']);
    expect(report.stage).toBe('f2l');
  });

  it('recognises OLL, PLL and AUF stages', () => {
    const sune = applyMoves(apply('z2'), inverse("R U R' U R U2 R'"));
    expect(analyse3x3(sune)).toMatchObject({ stage: 'oll', f2lSolved: true, llOriented: false });
    const tPerm = applyMoves(apply('z2'), inverse("R U R' U' R' F R2 U' R' U' R U R' F'"));
    expect(analyse3x3(tPerm)).toMatchObject({ stage: 'pll', llOriented: true, llCornersPermuted: false });
    const uPerm = applyMoves(apply('z2'), inverse("R U' R U R U R U' R' U' R2"));
    expect(analyse3x3(uPerm)).toMatchObject({ stage: 'pll', llCornersPermuted: true });
    expect(analyse3x3(apply("z2 U'")).stage).toBe('auf');
  });

  it('is independent of how the cube is held', () => {
    const state = apply("z2 R U R'");
    // Slot names follow the current front face, so compare everything except which slots they are.
    const summary = ({ solvedPairs, ...rest }: ReturnType<typeof analyse3x3>) => ({
      ...rest,
      pairs: solvedPairs.length,
    });
    for (const rotation of ['x', 'y2', "z x'"]) {
      expect(summary(analyse3x3(apply(rotation, state)))).toEqual(summary(analyse3x3(state)));
    }
  });
});

describe('cross solver', () => {
  it('is optimal on short reference scrambles', () => {
    const random = rng(1);
    for (let i = 0; i < 40; i++) {
      const length = 1 + (i % 4);
      // Scrambles built on the white-on-bottom cube: the cross is at most `length` moves away.
      const state = apply(`z2 ${randomScramble(random, length)}`);
      const step = solveCross(state);
      expect(step.moves.length).toBeLessThanOrEqual(length);
      expect(crossSolved(frameForCentre(applyMoves(state, step.moves), 0).state)).toBe(true);
      // Nothing shorter exists: brute force every sequence one move shorter.
      const shorter = step.moves.length - 1;
      expect(existsCrossSolution(state, shorter)).toBe(false);
    }
  });

  it('solves random scrambles in at most 8 moves (plus a rotation)', () => {
    const random = rng(2);
    for (let i = 0; i < 200; i++) {
      const state = apply(randomScramble(random));
      const step = solveCross(state);
      const turns = step.moves.filter((m) => !'xyz'.includes(m.family));
      expect(turns.length).toBeLessThanOrEqual(8);
      expect(analyse3x3(applyMoves(state, step.moves)).crossSolved).toBe(true);
    }
  });
});

function existsCrossSolution(state: Facelets, depth: number): boolean {
  const framed = frameForCentre(state, 0).state;
  const search = (s: Facelets, d: number): boolean => {
    if (crossSolved(s)) return true;
    if (d === 0) return false;
    return FACE_MOVES.some((m) => search(applyMoves(s, [m]), d - 1));
  };
  return depth >= 0 && search(framed, depth);
}

describe('F2L solver', () => {
  for (const style of ['front-right', 'rotationless'] as const) {
    it(`keeps the cross and solved pairs (${style})`, () => {
      const random = rng(style === 'front-right' ? 3 : 4);
      for (let i = 0; i < 15; i++) {
        let state = apply(randomScramble(random));
        state = applyMoves(state, solveCross(state).moves);
        for (let step = solveNextPair(state, 0, style); step; step = solveNextPair(state, 0, style)) {
          const before = solvedPairColours(state);
          if (style === 'rotationless') expect(step.moves.some((m) => m.family === 'y')).toBe(false);
          expectHumanPairMoves(step.moves, style);
          state = applyMoves(state, step.moves);
          const after = solvedPairColours(state);
          expect(analyse3x3(state).crossSolved).toBe(true);
          // Every pair solved before is still solved, plus at least the new one.
          expect(before.every((pair) => after.includes(pair))).toBe(true);
          expect(after.length).toBeGreaterThan(before.length);
        }
        expect(analyse3x3(state).f2lSolved).toBe(true);
      }
    });
  }
});

/**
 * Pair solutions are U turns plus slot triggers (D-084): no D or slice turns, every side turn undone, and no B
 * turns when rotating to the front-right slot.
 */
function expectHumanPairMoves(moves: Move[], style: 'front-right' | 'rotationless') {
  const turns = moves.filter((m) => !['x', 'y', 'z'].includes(m.family));
  expect(turns.every((m) => ['U', 'R', 'F', 'L', 'B'].includes(m.family))).toBe(true);
  if (style === 'front-right') expect(turns.some((m) => m.family === 'B')).toBe(false);
  for (const face of ['R', 'F', 'L', 'B']) {
    const net = turns.filter((m) => m.family === face).reduce((sum, m) => sum + m.amount, 0);
    expect(net % 4, `${formatAlg(moves)}: ${face} turns not undone`).toBe(0);
  }
}

/** Solved pairs, identified by the colours of their two side faces so rotations don't matter. */
function solvedPairColours(state: Facelets) {
  const framed = frameForCentre(state, 0).state;
  const SIDES = { FR: [2, 1], FL: [2, 4], BL: [5, 4], BR: [5, 1] } as const;
  return SLOTS.filter((slot) => slotSolved(framed, slot)).map((slot) =>
    SIDES[slot]
      .map((face) => framed[face * 9 + 4])
      .sort()
      .join(''),
  );
}

// ---- Last layer: every case × 4 AUFs, and full coverage of orientation / permutation states. ----

/** White on the bottom, F2L solved, with `alg`'s case set up on top after an AUF. */
const llCase = (alg: string, auf: string) => applyMoves(apply(`z2 ${auf}`), inverse(alg));
const AUFS = ['', 'U', 'U2', "U'"];

describe('last-layer algs', () => {
  const sets = { EO_ALGS, OCLL_ALGS, OLL_ALGS, CPLL_ALGS, EPLL_ALGS, PLL_ALGS };
  for (const [setName, algs] of Object.entries(sets)) {
    it.each(algs.map((a) => [a.name, a.alg]))(`${setName}: %s keeps F2L`, (_, alg) => {
      const state = applyMoves(apply('z2'), parseAlg(alg));
      expect(f2lSolved(frameForCentre(state, 0).state)).toBe(true);
    });
  }

  it('OLL algs are 57 distinct cases', () => {
    const signatures = new Set(OLL_ALGS.map((a) => orientationSignature(llCase(a.alg, ''))));
    expect(signatures.size).toBe(57);
    expect(signatures.has(orientationSignature(apply('z2')))).toBe(false);
  });

  it('PLL algs are 21 distinct cases', () => {
    const signatures = new Set(PLL_ALGS.map((a) => permutationSignature(llCase(a.alg, ''))));
    expect(signatures.size).toBe(21);
  });

  it.each(OLL_ALGS.flatMap((a) => AUFS.map((auf) => [a.name, auf, a.alg])))(
    'recognises %s after AUF %j',
    (_, auf, alg) => {
      const state = llCase(alg, auf);
      const step = solveLastLayerStep(state, 0, 'full')!;
      expect(step.kind).toBe('oll');
      expect(llOriented(frameForCentre(applyMoves(state, step.moves), 0).state)).toBe(true);
    },
  );

  it.each(PLL_ALGS.flatMap((a) => AUFS.map((auf) => [a.name, auf, a.alg])))(
    'recognises PLL %s after AUF %j',
    (_, auf, alg) => {
      const state = llCase(alg, auf);
      const step = solveLastLayerStep(state, 0, 'full')!;
      expect(step.kind).toBe('pll');
      expect(isSolved(applyMoves(state, step.moves))).toBe(true);
    },
  );

  it('orients every legal last-layer orientation (full and 2-look)', () => {
    const states = allOrientationStates();
    expect(states).toHaveLength(216);
    for (const state of states) {
      for (const mode of ['full', '2-look'] as const) {
        let current = state;
        for (let i = 0; i < 2 && !llOriented(frameForCentre(current, 0).state); i++) {
          current = applyMoves(current, solveLastLayerStep(current, 0, mode)!.moves);
        }
        expect(llOriented(frameForCentre(current, 0).state)).toBe(true);
      }
    }
  });

  it('solves every last-layer permutation (full and 2-look)', () => {
    const states = allPermutationStates();
    expect(states).toHaveLength(288);
    for (const state of states) {
      for (const mode of ['full', '2-look'] as const) {
        let current = state;
        for (let i = 0; i < 4 && !isSolved(current); i++) {
          current = applyMoves(current, solveLastLayerStep(current, 0, mode)!.moves);
        }
        expect(isSolved(current)).toBe(true);
      }
    }
  });
});

const U_LAYER_STICKERS = [
  ...[0, 1, 2, 3, 5, 6, 7, 8],
  ...[9, 10, 11],
  ...[18, 19, 20],
  ...[36, 37, 38],
  ...[45, 46, 47],
];

/** Which top-layer stickers show the top colour, minimised over AUF (framed state). */
function orientationSignature(state: Facelets): string {
  return Math.min(
    ...AUFS.map((auf) => {
      const s = frameForCentre(apply(auf, state), 0).state;
      return parseInt(U_LAYER_STICKERS.map((i) => (s[i] === s[4] ? '1' : '0')).join(''), 2);
    }),
  ).toString();
}

/** Side-sticker colours of the top layer, minimised over pre- and post-AUF. */
function permutationSignature(state: Facelets): string {
  const options: string[] = [];
  for (const pre of AUFS) {
    for (const post of AUFS) {
      const s = applyMoves(applyMoves(apply(pre, state), []), parseAlg(post));
      const framed = frameForCentre(s, 0).state;
      // Relative colours: compare each side sticker to the centre of the face it is on.
      options.push(
        U_LAYER_STICKERS.slice(8)
          .map((i) => (framed[i]! - framed[Math.floor(i / 9) * 9 + 4]! + 6) % 6)
          .join(''),
      );
    }
  }
  return options.sort()[0]!;
}

/** All 216 orientation-only states of the top layer (white on the bottom). */
function allOrientationStates(): Facelets[] {
  const base = apply('z2');
  const corners = [0, 1, 2, 3];
  const edges = [0, 1, 2, 3];
  const states: Facelets[] = [];
  // Corner twist direction depends on the handedness of the position's sticker order.
  const handed = [1, -1, 1, -1];
  for (let twist = 0; twist < 81; twist++) {
    const twists = corners.map((_, i) => Math.floor(twist / 3 ** i) % 3);
    if (twists.reduce((sum, t, i) => sum + t * handed[i]!, 0) % 3 !== 0) continue;
    for (let flip = 0; flip < 16; flip++) {
      const flips = edges.map((_, i) => (flip >> i) & 1);
      if (flips.reduce((a, b) => a + b, 0) % 2 !== 0) continue;
      const s = new Uint8Array(base);
      corners.forEach((c, i) => {
        const st = CORNER_FACELETS[c]!;
        const colours = st.map((x) => base[x]!);
        st.forEach((x, k) => (s[x] = colours[(k + twists[i]!) % 3]!));
      });
      edges.forEach((e, i) => {
        if (!flips[i]) return;
        const [a, b] = EDGE_FACELETS[e]!;
        s[a!] = base[b!]!;
        s[b!] = base[a!]!;
      });
      states.push(s);
    }
  }
  return states;
}

/** All 288 permutation states of an oriented top layer, by closure under AUF, A-perm, U-perm and T-perm. */
function allPermutationStates(): Facelets[] {
  const generators = [
    'U',
    "x R' U R' D2 R U' R' D2 R2 x'",
    "R U' R U R U R U' R' U' R2",
    "R U R' U' R' F R2 U' R' U' R U R' F'",
  ].map(parseAlg);
  const start = apply('z2');
  const seen = new Map<string, Facelets>([[start.join(','), start]]);
  const queue = [start];
  while (queue.length) {
    const state = queue.shift()!;
    for (const g of generators) {
      const next = applyMoves(state, g);
      const key = next.join(',');
      if (!seen.has(key)) {
        seen.set(key, next);
        queue.push(next);
      }
    }
  }
  return [...seen.values()];
}

// ---- 2x2 ----

describe('2x2 Ortega', () => {
  it('Ortega OLL and PBL algs keep the first face', () => {
    for (const { alg } of [...ORTEGA_OLL_ALGS, ...PBL_ALGS]) {
      const state = applyMoves(apply('z2'), parseAlg(alg));
      expect(analyse2x2(state).faceSolved).toBe(true);
    }
  });

  it('solves every PBL state (both layers permuted, faces oriented)', () => {
    const generators = [
      'U',
      'D',
      "R U R' U' R' F R2 U' R' U' R U R' F'",
      "R D R' D' R' B R2 D' R' D' R D R' B'",
    ].map(parseAlg);
    const start = apply('z2');
    const seen = new Map<string, Facelets>();
    const queue = [start];
    while (queue.length) {
      const state = queue.shift()!;
      for (const g of generators) {
        const next = applyMoves(state, g);
        // Corner stickers only: edges and centres don't exist on a 2x2.
        const key = CORNER_FACELETS.flat()
          .map((i) => next[i])
          .join(',');
        if (!seen.has(key)) {
          seen.set(key, next);
          queue.push(next);
        }
      }
    }
    expect(seen.size).toBe(576); // 4! top × 4! bottom
    for (const state of seen.values()) {
      const steps = solveAll(state, '2x2x2');
      expect(
        isSolved(
          applyMoves(
            state,
            steps.flatMap((s) => s.moves),
          ),
          true,
        ),
      ).toBe(true);
    }
  }, 60_000);

  it('solves random scrambles: face → OLL → PBL', () => {
    const random = rng(5);
    for (let i = 0; i < 300; i++) {
      const state = apply(randomScramble(random, 12));
      const steps = solveAll(state, '2x2x2');
      expect(
        isSolved(
          applyMoves(
            state,
            steps.flatMap((s) => s.moves),
          ),
          true,
        ),
      ).toBe(true);
      const face = steps.find((s) => s.kind === 'face');
      if (face) expect(face.moves.filter((m) => !'xyz'.includes(m.family)).length).toBeLessThanOrEqual(7);
    }
  });
});

// ---- Property test (plan P2 exit criterion) ----

// Tests run in Node; the app tsconfig has no Node types, so read the env var defensively.
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const PROPERTY_SCRAMBLES = Number(env.CUBEBUDDY_PROPERTY_SCRAMBLES ?? 1000);

describe('CFOP chain', () => {
  it(`solves ${PROPERTY_SCRAMBLES} random scrambles with chained helpers`, () => {
    const random = rng(6);
    const options = [
      { f2lStyle: 'front-right', llMode: '2-look' },
      { f2lStyle: 'rotationless', llMode: 'full' },
    ] as const;
    for (let i = 0; i < PROPERTY_SCRAMBLES; i++) {
      const state = apply(randomScramble(random));
      const steps = solveAll(state, '3x3x3', options[i % 2]);
      expect(
        isSolved(
          applyMoves(
            state,
            steps.flatMap((s) => s.moves),
          ),
        ),
      ).toBe(true);
    }
  }, 600_000);

  it('nextStep returns null for a solved cube', () => {
    expect(nextStep(apply('y'), '3x3x3')).toBeNull();
    expect(nextStep(apply('x'), '2x2x2')).toBeNull();
  });
});
