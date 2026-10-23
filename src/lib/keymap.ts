/**
 * Default virtual-cube key bindings, copied from cstimer's 3x3 virtual cube
 * (src/js/twisty/twistynnn.js → generateCubeKeyMapping, default slice settings) so experienced
 * cubers keep their muscle memory (D-031). Keys are KeyboardEvent.code values (physical key
 * positions), so the layout stays the same on non-QWERTY keyboards.
 */
export const CSTIMER_KEYMAP: Readonly<Record<string, string>> = {
  KeyI: 'R',
  KeyK: "R'",
  KeyW: 'B',
  KeyO: "B'",
  KeyS: 'D',
  KeyL: "D'",
  KeyD: 'L',
  KeyE: "L'",
  KeyJ: 'U',
  KeyF: "U'",
  KeyH: 'F',
  KeyG: "F'",
  Semicolon: 'y',
  KeyA: "y'",
  KeyU: 'r',
  KeyR: "l'",
  KeyM: "r'",
  KeyV: 'l',
  KeyT: 'x',
  KeyY: 'x',
  KeyN: "x'",
  KeyB: "x'",
  Period: "M'",
  KeyX: "M'",
  Digit5: 'M',
  Digit6: 'M',
  Digit1: "S'",
  Digit2: 'E',
  Digit9: "E'",
  Digit0: 'S',
  KeyP: 'z',
  KeyQ: "z'",
  KeyZ: 'd',
  KeyC: "u'",
  Comma: 'u',
  Slash: "d'",
};

/** Resolve a key press to a move, preferring the user's overrides (Settings, P5). */
export function moveForKey(
  code: string,
  overrides: Readonly<Record<string, string>> = {},
): string | undefined {
  return overrides[code] ?? CSTIMER_KEYMAP[code];
}
