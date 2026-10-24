import { describe, expect, it } from 'vitest';
import { formatAlg, formatMove, invertAlg, mergeMoves, parseAlg, parseMove } from './notation';

describe('parseMove', () => {
  it.each([
    ['R', 'R'],
    ["U'", "U'"],
    ['F2', 'F2'],
    ["F2'", 'F2'],
    ['R3', "R'"],
    ['Rw', 'r'],
    ["r'", "r'"],
    ['M', 'M'],
    ["x'", "x'"],
    ['y2', 'y2'],
    // cubing.js press notation: Shift = second slice, Ctrl = rotation
    ['2R', "M'"],
    ["2L'", "M'"],
    ['2U', "E'"],
    ['2F', 'S'],
    ['Rv', 'x'],
    ["Uv'", "y'"],
    ['Lv', "x'"],
  ])('%s → %s', (input, output) => {
    expect(formatMove(parseMove(input)!)).toBe(output);
  });

  it('rejects invalid tokens and no-ops', () => {
    expect(parseMove('Q')).toBeNull();
    expect(parseMove('R4')).toBeNull();
    expect(parseMove('Mw')).toBeNull();
    expect(parseMove('3R')).toBeNull();
  });
});

describe('algs', () => {
  it('parses, ignores parentheses and throws on bad tokens', () => {
    expect(formatAlg(parseAlg("(R U R' U')  y  M2"))).toBe("R U R' U' y M2");
    expect(() => parseAlg('R K')).toThrow('Invalid move: K');
  });

  it('inverts', () => {
    expect(formatAlg(invertAlg(parseAlg("R U2 F' x")))).toBe("x' F U2 R'");
  });

  it('merges adjacent turns of the same layer', () => {
    expect(formatAlg(mergeMoves(parseAlg("R R U U' F F F x x'")))).toBe("R2 F'");
    expect(formatAlg(mergeMoves(parseAlg("R L R'")))).toBe("R L R'");
    expect(formatAlg(mergeMoves(parseAlg("R U U' R'")))).toBe('');
  });
});
