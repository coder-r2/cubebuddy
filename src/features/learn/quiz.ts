import type { Level, Settings, StatKey } from '../../db/types';
import { SPEEDS } from '../../lib/speeds';

// Onboarding quiz (SPEC §5.2, D-014): answers → level → preset bundle of settings.

export type CanSolve = 'no' | 'beginner' | 'cfop';
export type LastLayer = '2-look' | 'some' | 'full';
export type TypicalTime = 'over-2m' | '1-2m' | '30-60s' | 'under-30s';

export interface QuizAnswers {
  canSolve: CanSolve;
  /** Only asked for CFOP solvers. */
  lastLayer?: LastLayer;
  /** Not asked if the user can't solve a cube yet. */
  time?: TypicalTime;
}

const TIME_LEVEL: Record<TypicalTime, Level> = { 'over-2m': 1, '1-2m': 2, '30-60s': 3, 'under-30s': 4 };

/** Level implied by the method questions alone (Q1/Q2). */
function methodLevel({ canSolve, lastLayer }: QuizAnswers): Level {
  if (canSolve === 'no') return 1;
  if (canSolve === 'beginner') return 2;
  return lastLayer === 'full' ? 4 : 3;
}

/**
 * The higher of the method level and the time level, but at most one level above the method level:
 * a fast beginner-method solver is "learning CFOP", not "full CFOP".
 */
export function levelFor(answers: QuizAnswers): Level {
  const method = methodLevel(answers);
  if (!answers.time || answers.canSolve === 'no') return method;
  return Math.max(method, Math.min(TIME_LEVEL[answers.time], method + 1)) as Level;
}

const ALL_STATS: StatKey[] = ['pb', 'ao5', 'ao12', 'ao50', 'ao100', 'mean'];

export type Preset = Pick<
  Settings,
  'level' | 'animationSpeed' | 'llMode' | 'f2lStyle' | 'inspection' | 'visibleStats'
>;

export function presetFor(level: Level): Preset {
  return {
    level,
    animationSpeed: SPEEDS[level - 1]!.value,
    llMode: level === 4 ? 'full' : '2-look',
    f2lStyle: level === 4 ? 'rotationless' : 'front-right',
    inspection: level >= 3,
    visibleStats: level === 1 ? ['pb', 'ao5'] : level === 2 ? ['pb', 'ao5', 'ao12'] : ALL_STATS,
  };
}

export const LEVEL_NAMES: Record<Level, string> = {
  1: 'New to cubing',
  2: 'Beginner method',
  3: 'Learning CFOP',
  4: 'Full CFOP',
};

export interface Suggestion {
  to: string;
  title: string;
  text: string;
}

export const SUGGESTED_START: Record<Level, Suggestion> = {
  1: {
    to: '/learn#notation',
    title: 'Learn the notation',
    text: 'Start with what R, U′ and friends mean. Then the beginner tutorial walks you through your first solve.',
  },
  2: {
    to: '/tutorial/cfop',
    title: 'Try the CFOP tutorial',
    text: 'Walk through a real solve with the method the fastest cubers use, one step at a time.',
  },
  3: {
    to: '/trainer/oll-2look',
    title: 'Drill 2-look OLL and PLL',
    text: 'Learn the 16 last-layer algorithms that finish every solve, with demos and timed drills.',
  },
  4: {
    to: '/timer',
    title: 'Start timing',
    text: 'WCA scrambles, inspection and averages. Then train the OLL and PLL cases that slow you down.',
  },
};
