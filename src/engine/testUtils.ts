import { FACES, formatAlg, type Move } from './notation';

/** Deterministic RNG (mulberry32) so property tests are reproducible. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random face-turn scramble (never the same face twice in a row). */
export function randomScramble(random: () => number, length = 25): string {
  const moves: Move[] = [];
  let previous = -1;
  while (moves.length < length) {
    const face = Math.floor(random() * 6);
    if (face === previous) continue;
    previous = face;
    moves.push({ family: FACES[face]!, amount: (1 + Math.floor(random() * 3)) as 1 | 2 | 3 });
  }
  return formatAlg(moves);
}
