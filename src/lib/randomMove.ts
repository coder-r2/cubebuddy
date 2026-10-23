const FACES = ['U', 'D', 'L', 'R', 'F', 'B'] as const;
const SUFFIXES = ['', "'", '2'] as const;

/**
 * A random outer-face turn that never turns the same face as `previous`, so consecutive
 * moves never cancel or merge (home-page idle cube, SPEC §5.1).
 */
export function randomMove(previous?: string, rng: () => number = Math.random): string {
  const previousFace = previous?.[0];
  const faces = FACES.filter((face) => face !== previousFace);
  const face = faces[Math.floor(rng() * faces.length)] ?? 'R';
  const suffix = SUFFIXES[Math.floor(rng() * SUFFIXES.length)] ?? '';
  return face + suffix;
}
