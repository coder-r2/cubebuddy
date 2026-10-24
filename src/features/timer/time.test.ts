import { describe, expect, it } from 'vitest';
import { effectiveTime, formatResult, formatTime, parseTypedTime } from './time';

describe('formatTime', () => {
  it.each([
    [0, '0.00'],
    [9, '0.00'],
    [12_345, '12.34'],
    [12_349, '12.34'],
    [59_999, '59.99'],
    [60_000, '1:00.00'],
    [62_340, '1:02.34'],
    [3_723_450, '62:03.45'],
    [Infinity, 'DNF'],
  ])('%d ms → %s', (ms, text) => {
    expect(formatTime(ms)).toBe(text);
  });
});

describe('formatResult / effectiveTime', () => {
  it('adds two seconds for +2 and marks it', () => {
    expect(effectiveTime({ timeMs: 12_340, penalty: 2000 })).toBe(14_340);
    expect(formatResult({ timeMs: 12_340, penalty: 2000 })).toBe('14.34+');
  });

  it('treats DNF as infinitely slow', () => {
    expect(effectiveTime({ timeMs: 12_340, penalty: 'DNF' })).toBe(Infinity);
    expect(formatResult({ timeMs: 12_340, penalty: 'DNF' })).toBe('DNF');
  });
});

describe('parseTypedTime', () => {
  it.each([
    ['1234', 12_340],
    ['5', 50],
    ['99', 990],
    ['10234', 62_340],
    ['12.34', 12_340],
    ['12.3', 12_300],
    ['12', 120],
    ['1:02.34', 62_340],
    ['1:02', 62_000],
    ['  8.07 ', 8_070],
    ['12.345', 12_345],
  ])('%s → %d ms', (input, ms) => {
    expect(parseTypedTime(input)).toEqual({ timeMs: ms, penalty: 0 });
  });

  it('reads a trailing + as +2', () => {
    expect(parseTypedTime('12.34+')).toEqual({ timeMs: 12_340, penalty: 2000 });
    expect(parseTypedTime('1234+')).toEqual({ timeMs: 12_340, penalty: 2000 });
  });

  it('reads DNF in any case', () => {
    expect(parseTypedTime('dnf')).toEqual({ timeMs: 0, penalty: 'DNF' });
  });

  it.each(['', 'abc', '1:60.00', '16000', '0', '0.00', '12.34.5', '-5', '1::2'])('rejects %j', (input) => {
    expect(parseTypedTime(input)).toBeNull();
  });
});
