import type { Penalty } from '../../db/types';

/*
 * Timer state machine (SPEC §5.4), kept pure so it can be unit-tested with fake timestamps.
 *
 * Without inspection: idle ─press→ holding ─(held ≥ holdMs)→ ready ─release→ running ─press→ stopped ─release→ idle
 * With inspection:    idle ─press→ armed ─release→ inspecting ─press→ inspect-holding ─(≥ holdMs)→ inspect-ready
 *                     ─release→ running …
 * Releasing before holdMs goes back (idle / inspecting) and flags a false start. Cancel returns to idle from anywhere.
 */

export type Phase =
  | 'idle'
  | 'holding'
  | 'ready'
  | 'armed'
  | 'inspecting'
  | 'inspect-holding'
  | 'inspect-ready'
  | 'running'
  | 'stopped';

export interface TimerConfig {
  holdMs: number;
  inspection: boolean;
}

export interface TimerState {
  phase: Phase;
  /** When the current press began (hold phases). */
  pressedAt: number;
  inspectionStartedAt: number;
  startedAt: number;
  /** Penalty earned during inspection, applied to the solve. */
  inspectionPenalty: Penalty;
  /** Set on the transition into `stopped`. */
  result: { timeMs: number; penalty: Penalty } | null;
  /** True right after a press released too early (UI flashes red). */
  falseStart: boolean;
}

export type TimerEvent =
  | { type: 'press'; at: number }
  | { type: 'release'; at: number }
  | { type: 'tick'; at: number }
  | { type: 'cancel' };

export const INSPECTION_MS = 15_000;
/** WCA A3/10e: starting after 15 s is +2, after 17 s is DNF. */
export const INSPECTION_DNF_MS = 17_000;

export const initialTimerState: TimerState = {
  phase: 'idle',
  pressedAt: 0,
  inspectionStartedAt: 0,
  startedAt: 0,
  inspectionPenalty: 0,
  result: null,
  falseStart: false,
};

export function inspectionPenalty(elapsedMs: number): Penalty {
  if (elapsedMs > INSPECTION_DNF_MS) return 'DNF';
  if (elapsedMs > INSPECTION_MS) return 2000;
  return 0;
}

/** Phases in which the timer takes over the screen. */
export const isActive = (phase: Phase) =>
  phase !== 'idle' && phase !== 'holding' && phase !== 'armed' && phase !== 'stopped';

export function timerReducer(state: TimerState, event: TimerEvent, config: TimerConfig): TimerState {
  if (event.type === 'cancel') return initialTimerState;
  const { phase } = state;
  const at = 'at' in event ? event.at : 0;

  switch (event.type) {
    case 'press':
      if (phase === 'idle') {
        if (config.inspection) return { ...initialTimerState, phase: 'armed' };
        return { ...initialTimerState, phase: config.holdMs <= 0 ? 'ready' : 'holding', pressedAt: at };
      }
      if (phase === 'inspecting') {
        return { ...state, phase: config.holdMs <= 0 ? 'inspect-ready' : 'inspect-holding', pressedAt: at };
      }
      if (phase === 'running') {
        const timeMs = Math.max(0, Math.round(at - state.startedAt));
        return { ...state, phase: 'stopped', result: { timeMs, penalty: state.inspectionPenalty } };
      }
      return state;

    case 'tick':
      if (phase === 'holding' && at - state.pressedAt >= config.holdMs) return { ...state, phase: 'ready' };
      if (phase === 'inspect-holding' && at - state.pressedAt >= config.holdMs) {
        return { ...state, phase: 'inspect-ready' };
      }
      return state;

    case 'release':
      switch (phase) {
        case 'holding':
          return { ...initialTimerState, falseStart: true };
        case 'armed':
          return { ...state, phase: 'inspecting', inspectionStartedAt: at };
        case 'inspect-holding':
          return { ...state, phase: 'inspecting', falseStart: true };
        case 'ready':
          return { ...state, phase: 'running', startedAt: at, inspectionPenalty: 0 };
        case 'inspect-ready':
          return {
            ...state,
            phase: 'running',
            startedAt: at,
            inspectionPenalty: inspectionPenalty(at - state.inspectionStartedAt),
          };
        case 'stopped':
          return { ...initialTimerState };
        default:
          return state;
      }
  }
}
