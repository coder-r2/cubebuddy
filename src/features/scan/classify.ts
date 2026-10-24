/*
 * Sticker colour classification for camera scans (D-019, D-097). Each scanned face's centre is the reference
 * for its colour, so the classifier adapts to the cube's stickers and the room's light. Colours are compared
 * in CIE Lab with lightness weighted down (shadows and glare change lightness far more than hue), and each
 * colour is limited to 9 stickers, assigned closest-first: when red and orange look alike, the stickers that
 * are most clearly one or the other are settled first and the doubtful ones take whatever is left.
 */

export type RGB = readonly [number, number, number];
export type Lab = readonly [number, number, number];

const linear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);

/** sRGB (0–255) → CIE Lab (D65). */
export function rgbToLab([r, g, b]: RGB): Lab {
  const [lr, lg, lb] = [linear(r), linear(g), linear(b)];
  const x = (0.4124 * lr + 0.3576 * lg + 0.1805 * lb) / 0.95047;
  const y = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
  const z = (0.0193 * lr + 0.1192 * lg + 0.9505 * lb) / 1.08883;
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const LIGHTNESS_WEIGHT = 0.5;

export function distance(a: Lab, b: Lab): number {
  return Math.hypot(LIGHTNESS_WEIGHT * (a[0] - b[0]), a[1] - b[1], a[2] - b[2]);
}

export interface Classified {
  /** Colour (home-face index) of each of the 54 stickers. */
  colours: number[];
  /** Stickers worth a second look: given a colour other than their nearest, or nearly tied between two. */
  doubtful: number[];
}

/** Classify 54 sticker samples (facelet order); sample `face * 9 + 4` is the centre of colour `face`. */
export function classify(samples: readonly Lab[]): Classified {
  const refs = [0, 1, 2, 3, 4, 5].map((face) => samples[face * 9 + 4]!);
  const colours = new Array<number>(54).fill(-1);
  const left = new Array<number>(6).fill(8);
  const pairs: { sticker: number; colour: number; d: number }[] = [];
  const doubtful: number[] = [];

  for (let sticker = 0; sticker < 54; sticker++) {
    if (sticker % 9 === 4) {
      colours[sticker] = Math.floor(sticker / 9);
      continue;
    }
    const ds = refs.map((ref) => distance(samples[sticker]!, ref));
    ds.forEach((d, colour) => pairs.push({ sticker, colour, d }));
    const [best, second] = [...ds].sort((a, b) => a - b);
    if (second! - best! < 0.25 * best! + 3) doubtful.push(sticker);
  }

  pairs.sort((a, b) => a.d - b.d);
  for (const { sticker, colour } of pairs) {
    if (colours[sticker] !== -1 || left[colour] === 0) continue;
    colours[sticker] = colour;
    left[colour]!--;
  }

  for (let sticker = 0; sticker < 54; sticker++) {
    if (sticker % 9 === 4 || doubtful.includes(sticker)) continue;
    const ds = refs.map((ref) => distance(samples[sticker]!, ref));
    if (ds[colours[sticker]!]! > Math.min(...ds)) doubtful.push(sticker);
  }
  return { colours, doubtful: doubtful.sort((a, b) => a - b) };
}

/** Average colour of a square region of RGBA pixel data. */
export function averageRgb(
  data: Uint8ClampedArray,
  width: number,
  x0: number,
  y0: number,
  size: number,
): RGB {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = Math.round(y0); y < Math.round(y0 + size); y++) {
    for (let x = Math.round(x0); x < Math.round(x0 + size); x++) {
      const i = (y * width + x) * 4;
      r += data[i]!;
      g += data[i + 1]!;
      b += data[i + 2]!;
      n++;
    }
  }
  return n ? [r / n, g / n, b / n] : [0, 0, 0];
}
