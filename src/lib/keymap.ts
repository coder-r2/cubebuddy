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

/**
 * Resolve a key press to a move. The user's overrides (Settings → keyboard map) win; an override of ''
 * unbinds a default key.
 */
export function moveForKey(
  code: string,
  overrides: Readonly<Record<string, string>> = {},
): string | undefined {
  return (code in overrides ? overrides[code] : CSTIMER_KEYMAP[code]) || undefined;
}

/** Every bound key → move after applying the overrides. */
export function effectiveKeymap(overrides: Readonly<Record<string, string>> = {}): Record<string, string> {
  const map: Record<string, string> = {};
  for (const code of new Set([...Object.keys(CSTIMER_KEYMAP), ...Object.keys(overrides)])) {
    const move = moveForKey(code, overrides);
    if (move) map[code] = move;
  }
  return map;
}

/** Keys that can be bound to moves: letters, digits and punctuation (not Space, Esc, arrows, …). */
export const isBindableKey = (code: string) =>
  /^(Key[A-Z]|Digit[0-9]|Semicolon|Comma|Period|Slash|Quote|BracketLeft|BracketRight|Backslash|Minus|Equal|Backquote)$/.test(
    code,
  );

const KEY_LABELS: Record<string, string> = {
  Semicolon: ';',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Quote: "'",
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Minus: '-',
  Equal: '=',
  Backquote: '`',
};

/** Short label for a key code (KeyI → I, Semicolon → ;). */
export const keyLabel = (code: string) => KEY_LABELS[code] ?? code.replace(/^(Key|Digit)/, '');

/**
 * Bind `code` to `move`. The key is taken from whatever it did before; the overrides stay minimal, so a
 * binding that matches the cstimer default isn't stored.
 */
export function bindKey(overrides: Readonly<Record<string, string>>, code: string, move: string) {
  const next = { ...overrides, [code]: move };
  if (CSTIMER_KEYMAP[code] === move) delete next[code];
  return next;
}

export function unbindKey(overrides: Readonly<Record<string, string>>, code: string) {
  const next = { ...overrides };
  if (CSTIMER_KEYMAP[code]) next[code] = '';
  else delete next[code];
  return next;
}
