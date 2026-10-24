import { describe, expect, it } from 'vitest';
import { applyMoves, solvedFacelets } from '../../engine/facelets';
import { parseAlg } from '../../engine/notation';
import { randomScramble, rng } from '../../engine/testUtils';
import { averageRgb, classify, rgbToLab, type RGB } from './classify';

// Typical sticker colours as a phone camera sees them indoors (U R F D L B: white red green yellow orange blue).
const STICKERS: RGB[] = [
  [215, 218, 212],
  [178, 32, 44],
  [24, 150, 72],
  [222, 200, 40],
  [232, 104, 34],
  [24, 72, 170],
];

/** A camera's view of a sticker: a per-face light level, a per-sticker variation, a colour cast and noise. */
function photograph(colour: RGB, face: number, random: () => number, cast: RGB): RGB {
  const faceLight = 0.75 + (0.3 * ((face * 7919) % 6)) / 6;
  const light = faceLight * (0.88 + 0.24 * random());
  return colour.map((c, i) =>
    Math.max(0, Math.min(255, c * light * cast[i]! + (random() - 0.5) * 20)),
  ) as never;
}

describe('rgbToLab', () => {
  it('matches reference values', () => {
    const near = (a: readonly number[], b: number[]) => a.every((v, i) => Math.abs(v - b[i]!) < 0.5);
    expect(near(rgbToLab([255, 255, 255]), [100, 0, 0])).toBe(true);
    expect(near(rgbToLab([0, 0, 0]), [0, 0, 0])).toBe(true);
    expect(near(rgbToLab([255, 0, 0]), [53.24, 80.09, 67.2])).toBe(true);
  });
});

describe('classify', () => {
  it.each([
    ['neutral light', [1, 1, 1]],
    ['warm light', [1.08, 0.97, 0.78]],
    ['cool light', [0.9, 1, 1.12]],
  ] as const)('reads scrambled cubes with at most a couple of mistakes (%s)', (_, cast) => {
    const random = rng(cast[2] * 100);
    let mistakes = 0;
    const scans = 40;
    for (let n = 0; n < scans; n++) {
      const state = applyMoves(solvedFacelets(), parseAlg(randomScramble(random)));
      const samples = Array.from(state, (colour, sticker) =>
        rgbToLab(photograph(STICKERS[colour]!, Math.floor(sticker / 9), random, cast)),
      );
      const { colours } = classify(samples);
      mistakes += colours.filter((c, i) => c !== state[i]).length;
      // Every colour is used exactly 9 times.
      for (let c = 0; c < 6; c++) expect(colours.filter((x) => x === c).length).toBe(9);
    }
    expect(mistakes / scans).toBeLessThanOrEqual(2);
  });

  it('flags stickers it is unsure about', () => {
    const samples = Array.from(solvedFacelets(), (colour) => rgbToLab(STICKERS[colour]!));
    // Sticker 10 (on the red face) looks halfway between red and orange.
    samples[10] = rgbToLab([205, 68, 39]);
    expect(classify(samples).doubtful).toContain(10);
    expect(classify(samples).doubtful).not.toContain(0);
  });
});

describe('averageRgb', () => {
  it('averages a square of pixels', () => {
    const width = 4;
    const data = new Uint8ClampedArray(width * 4 * 4);
    for (let i = 0; i < data.length; i += 4) data.set([100, 50, 200, 255], i);
    data.set([200, 150, 0, 255], (1 * width + 1) * 4);
    expect(averageRgb(data, width, 1, 1, 2)).toEqual([125, 75, 150]);
  });
});
