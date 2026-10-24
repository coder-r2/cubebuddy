import { describe, expect, it } from 'vitest';
import { levelFor, presetFor } from './quiz';

describe('onboarding quiz', () => {
  it('maps answers to levels, never more than one above the method', () => {
    expect(levelFor({ canSolve: 'no' })).toBe(1);
    expect(levelFor({ canSolve: 'beginner', time: 'over-2m' })).toBe(2);
    expect(levelFor({ canSolve: 'beginner', time: '1-2m' })).toBe(2);
    expect(levelFor({ canSolve: 'beginner', time: 'under-30s' })).toBe(3);
    expect(levelFor({ canSolve: 'cfop', lastLayer: '2-look', time: 'over-2m' })).toBe(3);
    expect(levelFor({ canSolve: 'cfop', lastLayer: 'some', time: 'under-30s' })).toBe(4);
    expect(levelFor({ canSolve: 'cfop', lastLayer: 'full', time: '1-2m' })).toBe(4);
  });

  it('gives each level its preset bundle (SPEC §5.2)', () => {
    expect(presetFor(1)).toEqual({
      level: 1,
      animationSpeed: 1,
      llMode: '2-look',
      f2lStyle: 'front-right',
      inspection: false,
      visibleStats: ['pb', 'ao5'],
    });
    expect(presetFor(2).visibleStats).toEqual(['pb', 'ao5', 'ao12']);
    expect(presetFor(3)).toMatchObject({ inspection: true, llMode: '2-look', animationSpeed: 3 });
    expect(presetFor(4)).toMatchObject({ llMode: 'full', f2lStyle: 'rotationless', animationSpeed: 5 });
  });
});
