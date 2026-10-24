import { describe, expect, it } from 'vitest';
import { engine } from '../../engine/api';
import {
  checkScramble,
  moveCount,
  solutionRows,
  solutionText,
  stageIndex,
  STAGES,
  stepTitle,
} from './stages';

describe('stageIndex', () => {
  it('follows the CFOP stages and goes back when solved parts break', () => {
    const at = (moves: string) => STAGES['3x3x3'][stageIndex(engine.analyse(moves, '3x3x3'))];
    expect(at("R U R' U' F2 D")).toBe('Cross');
    expect(at("z2 R U R'")).toBe('F2L 4');
    expect(at("z2 R U R' L' U' L")).toBe('F2L 3');
    expect(at("z2 R U R' U R U2 R'")).toBe('OLL');
    expect(at("z2 R U R' U' R' F R2 U' R' U' R U R' F'")).toBe('PLL');
    expect(at('z2 U')).toBe('PLL');
    expect(at('')).toBe('Solved');
  });

  it('follows the Ortega stages', () => {
    const at = (moves: string) => STAGES['2x2x2'][stageIndex(engine.analyse(moves, '2x2x2'))];
    expect(at("R U R' F2")).toBe('Face');
    expect(at("z2 R U R' U R U2 R'")).toBe('OLL');
    expect(at('z2 R2 F2 R2')).toBe('PBL');
    expect(at('x')).toBe('Solved');
  });
});

describe('solution rows', () => {
  it('labels every step of a full CFOP solution and counts moves without rotations', () => {
    const scramble = "D2 F' R2 U' B2 L2 U' F2 R2 D' B2 U R' B' L D2 R F U' B2 R'";
    const steps = engine.solveAll(scramble, '3x3x3', { llMode: '2-look', f2lStyle: 'front-right' });
    const rows = solutionRows(steps, '3x3x3');
    expect(rows[0]!.label).toBe('Cross');
    expect(rows.filter((r) => r.label.startsWith('F2L')).map((r) => r.label)).toEqual(
      ['F2L 1', 'F2L 2', 'F2L 3', 'F2L 4'].slice(0, steps.filter((s) => s.kind === 'pair').length),
    );
    const text = solutionText(scramble, rows);
    expect(text.split('\n')[0]).toBe(`Scramble: ${scramble}`);
    const total = rows.reduce((n, r) => n + moveCount(r.moves), 0);
    expect(text).toContain(`Total: ${total} moves`);
    expect(moveCount(['y', 'R', "U'", 'x2', 'M2'])).toBe(3);
  });

  it('titles pair steps by their colours', () => {
    const step = engine.nextStep("z2 R U R'", '3x3x3', {});
    expect(step?.kind).toBe('pair');
    expect(stepTitle(step!, '3x3x3')).toMatch(/^Pair up and insert the \w+–\w+ pair$/);
  });
});

describe('checkScramble', () => {
  it('accepts valid moves (and curly apostrophes) and normalises them', () => {
    expect(checkScramble(" R U’  F2 Rw x' ", '3x3x3').moves).toEqual(['R', "U'", 'F2', 'r', "x'"]);
  });

  it('flags each invalid token', () => {
    const { tokens, moves } = checkScramble('R K U3 Q', '3x3x3');
    expect(tokens.map((t) => t.valid)).toEqual([true, false, true, false]);
    expect(moves).toEqual([]);
    expect(checkScramble('', '3x3x3').moves).toEqual([]);
  });

  it('rejects slices and wide moves on a 2x2', () => {
    expect(checkScramble("R U' F2", '2x2x2').moves).toEqual(['R', "U'", 'F2']);
    expect(checkScramble('R M r', '2x2x2').tokens.map((t) => t.valid)).toEqual([true, false, false]);
  });
});
