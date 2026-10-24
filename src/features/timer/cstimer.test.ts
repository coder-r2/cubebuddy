import { describe, expect, it } from 'vitest';
import fixture from './__fixtures__/cstimer-export.txt?raw';
import { CstimerFormatError, parseCstimer, puzzleForScrType, serializeCstimer, solveKey } from './cstimer';

describe('parseCstimer', () => {
  const sessions = parseCstimer(fixture);

  it('reads every non-empty session with its name and puzzle', () => {
    expect(sessions.map((s) => [s.name, s.puzzle, s.solves.length])).toEqual([
      ['cstimer 1', '3x3x3', 5],
      ['One-handed', '3x3x3', 1],
      ['2x2', '2x2x2', 2],
      ['4x4', null, 1],
    ]);
  });

  it('maps penalties, comments and timestamps', () => {
    const [plain, plusTwo, dnf] = sessions[0]!.solves;
    expect(plain).toEqual({
      timeMs: 19_689,
      penalty: 0,
      scramble: "D2 B2 U L' B' D2 L' B' D R U2 D2 F2 U2 R L2 B2 L' D2 L2",
      comment: '',
      createdAt: 1_759_767_403_000,
    });
    expect(plusTwo!.penalty).toBe(2000);
    expect(plusTwo!.timeMs).toBe(16_086);
    expect(dnf!.penalty).toBe('DNF');
    expect(dnf!.comment).toBe('popped an edge');
  });

  it('ignores split times and extra fields', () => {
    expect(sessions[0]!.solves[3]!.timeMs).toBe(21_491);
  });

  it('rejects files that are not cstimer exports', () => {
    expect(() => parseCstimer('not json')).toThrow(CstimerFormatError);
    expect(() => parseCstimer('[]')).toThrow(CstimerFormatError);
    expect(() => parseCstimer('{"foo": 1}')).toThrow(CstimerFormatError);
  });

  it('falls back to numbered 3x3 sessions without metadata', () => {
    expect(parseCstimer('{"session2":[[[0,1000],"R","",1]]}')).toEqual([
      {
        name: 'cstimer 2',
        puzzle: '3x3x3',
        solves: [{ timeMs: 1000, penalty: 0, scramble: 'R', comment: '', createdAt: 1000 }],
      },
    ]);
  });
});

describe('puzzleForScrType', () => {
  it.each([
    [undefined, '3x3x3'],
    ['', '3x3x3'],
    ['333', '3x3x3'],
    ['333oh', '3x3x3'],
    ['222so', '2x2x2'],
    ['444wca', null],
    ['pyrso', null],
  ])('%j → %j', (scrType, puzzle) => {
    expect(puzzleForScrType(scrType)).toBe(puzzle);
  });
});

describe('serializeCstimer', () => {
  it('round-trips through parseCstimer', () => {
    const supported = parseCstimer(fixture).filter((s) => s.puzzle);
    const again = parseCstimer(serializeCstimer(supported));
    expect(again).toEqual(supported);
  });

  it('writes cstimer penalty codes and the 2x2 scramble type', () => {
    const text = serializeCstimer([
      {
        name: '2x2',
        puzzle: '2x2x2',
        solves: [
          { timeMs: 3210, penalty: 'DNF', scramble: 'R U', comment: '', createdAt: 1_700_000_000_000 },
        ],
      },
    ]);
    const data = JSON.parse(text) as { session1: unknown; properties: { sessionData: string } };
    expect(data.session1).toEqual([[[-1, 3210], 'R U', '', 1_700_000_000]]);
    expect(JSON.parse(data.properties.sessionData)).toEqual({
      1: { name: '2x2', opt: { scrType: '222so' }, rank: 1 },
    });
  });
});

describe('solveKey', () => {
  it('compares timestamps to the second', () => {
    const a = { createdAt: 1_700_000_000_400, timeMs: 1000, scramble: 'R U ' };
    const b = { createdAt: 1_700_000_000_000, timeMs: 1000, scramble: 'R U' };
    expect(solveKey(a)).toBe(solveKey(b));
  });
});
