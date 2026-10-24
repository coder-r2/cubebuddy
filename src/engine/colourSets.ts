import type { CrossColorMode } from '../db/types';

// Kept apart from colour.ts so the UI can use it without pulling the solver into the main bundle.

/** Allowed cross colours per mode (home-face indices: U0 white, R1 red, F2 green, D3 yellow, L4 orange, B5 blue). */
export const COLOUR_SETS: Record<CrossColorMode, readonly number[]> = {
  white: [0],
  'white-yellow': [0, 3],
  neutral: [0, 3, 2, 5, 1, 4],
};

/** Colour names by home face (U R F D L B). */
export const COLOUR_NAMES = ['white', 'red', 'green', 'yellow', 'orange', 'blue'];

/** The colour of the face opposite `colour` (the last layer when `colour` is the cross). */
export const opposite = (colour: number) => (colour + 3) % 6;
