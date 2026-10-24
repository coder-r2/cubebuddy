import { useCallback, useEffect, useRef, useState } from 'react';
import type { Penalty } from '../../db/types';
import { announceInspection } from './inspectionAlerts';
import {
  initialTimerState,
  timerReducer,
  type Phase,
  type TimerConfig,
  type TimerEvent,
  type TimerState,
} from './machine';

interface UseTimerOptions extends TimerConfig {
  inspectionAlerts: boolean;
  /** Ignore keyboard and touch input (typing mode, open dialogs). */
  disabled: boolean;
  onSolve: (result: { timeMs: number; penalty: Penalty }) => void;
}

/** Phases that need a frame loop: hold detection and inspection alerts. */
const ANIMATED: ReadonlySet<Phase> = new Set(['holding', 'inspecting', 'inspect-holding', 'inspect-ready']);

function isEditable(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

const dialogOpen = () => document.querySelector('dialog[open]') !== null;

/**
 * Drives the timer state machine from the spacebar and touch/pointer input (SPEC §5.4).
 * Returns the state and a pointer handler for the timer area; the live clock renders itself (LiveTime).
 */
export function useTimer({ holdMs, inspection, inspectionAlerts, disabled, onSolve }: UseTimerOptions) {
  const [state, setState] = useState<TimerState>(initialTimerState);
  const stateRef = useRef(state);
  const configRef = useRef<TimerConfig>({ holdMs, inspection });
  const onSolveRef = useRef(onSolve);
  const pointerDown = useRef(false);
  const alerted = useRef(new Set<number>());

  useEffect(() => {
    configRef.current = { holdMs, inspection };
    onSolveRef.current = onSolve;
  });

  const dispatch = useCallback((event: TimerEvent) => {
    const previous = stateRef.current;
    const next = timerReducer(previous, event, configRef.current);
    if (next === previous) return;
    stateRef.current = next;
    setState(next);
    if (previous.phase === 'running' && next.phase === 'stopped' && next.result) {
      onSolveRef.current(next.result);
    }
    if (next.phase === 'inspecting' && previous.phase === 'armed') alerted.current.clear();
  }, []);

  const press = useCallback(() => {
    // Keep a focused button from also reacting to the spacebar.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    dispatch({ type: 'press', at: performance.now() });
  }, [dispatch]);

  const release = useCallback(() => dispatch({ type: 'release', at: performance.now() }), [dispatch]);

  // Frame loop for hold detection and inspection alerts (state only changes on transitions).
  useEffect(() => {
    if (!ANIMATED.has(state.phase)) return;
    let frame = 0;
    const loop = () => {
      const at = performance.now();
      dispatch({ type: 'tick', at });
      const current = stateRef.current;
      if (inspectionAlerts && current.phase.startsWith('inspect')) {
        const elapsed = at - current.inspectionStartedAt;
        for (const mark of [8, 12] as const) {
          if (elapsed >= mark * 1000 && !alerted.current.has(mark)) {
            alerted.current.add(mark);
            announceInspection(mark);
          }
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [state.phase, inspectionAlerts, dispatch]);

  // Keyboard: space holds/starts, any key stops, Esc cancels.
  useEffect(() => {
    if (disabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditable(e.target) || dialogOpen()) return;
      const { phase } = stateRef.current;
      if (e.key === 'Escape') {
        if (phase !== 'idle') dispatch({ type: 'cancel' });
        return;
      }
      if (phase === 'running') {
        if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
        e.preventDefault();
        press();
        return;
      }
      if (e.code !== 'Space') return;
      e.preventDefault();
      if (!e.repeat) press();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [disabled, dispatch, press]);

  // Releases are always handled, even while disabled: the solve that just stopped may disable the timer
  // (e.g. while the next scramble loads) before the stopping key comes back up.
  useEffect(() => {
    const onKeyUp = (e: KeyboardEvent) => {
      if (isEditable(e.target)) return;
      const { phase } = stateRef.current;
      // The key that stopped the timer may be any key; releasing it re-arms the timer.
      if ((e.code === 'Space' && phase !== 'idle') || phase === 'stopped') {
        e.preventDefault();
        release();
      }
    };
    window.addEventListener('keyup', onKeyUp);
    return () => window.removeEventListener('keyup', onKeyUp);
  }, [release]);

  // The finger may lift over a different element (the full-screen overlay), so releases are global.
  useEffect(() => {
    const onUp = () => {
      if (!pointerDown.current) return;
      pointerDown.current = false;
      release();
    };
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [release]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
      e.preventDefault();
      pointerDown.current = true;
      press();
    },
    [disabled, press],
  );

  const cancel = useCallback(() => dispatch({ type: 'cancel' }), [dispatch]);

  return { state, onPointerDown, cancel };
}
