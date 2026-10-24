import { useEffect, useState } from 'react';
import { INSPECTION_DNF_MS, INSPECTION_MS, type TimerState } from './machine';
import { formatResult, formatTime, type TimedResult } from './time';

interface LiveTimeProps {
  state: TimerState;
  /** Shown while idle: the latest solve of the session. */
  last: TimedResult | null;
  hideWhileRunning: boolean;
  className?: string;
}

const COLOUR: Partial<Record<TimerState['phase'], string>> = {
  holding: 'text-danger',
  'inspect-holding': 'text-danger',
  ready: 'text-success',
  'inspect-ready': 'text-success',
};

function inspectionText(elapsedMs: number) {
  if (elapsedMs > INSPECTION_DNF_MS) return 'DNF';
  if (elapsedMs > INSPECTION_MS) return '+2';
  return String(Math.ceil((INSPECTION_MS - elapsedMs) / 1000));
}

/** The big clock. Runs its own frame loop so only this element re-renders 60 times a second. */
export function LiveTime({ state, last, hideWhileRunning, className = '' }: LiveTimeProps) {
  const { phase } = state;
  const [now, setNow] = useState(() => performance.now());
  const animated = phase === 'running' || phase.startsWith('inspect');

  useEffect(() => {
    if (!animated) return;
    let frame = 0;
    const loop = () => {
      setNow(performance.now());
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [animated]);

  let text: string;
  if (phase === 'running') {
    text = hideWhileRunning ? 'Solving' : formatTime(Math.max(0, now - state.startedAt));
  } else if (phase === 'armed') {
    text = '15';
  } else if (phase.startsWith('inspect')) {
    text = inspectionText(now - state.inspectionStartedAt);
  } else if (phase === 'stopped' && state.result) {
    text = formatResult(state.result);
  } else if (phase === 'ready') {
    text = '0.00';
  } else {
    text = last ? formatResult(last) : '0.00';
  }

  const colour = COLOUR[phase] ?? (phase === 'idle' && state.falseStart ? 'text-danger' : '');
  return (
    <span
      role="timer"
      aria-live="off"
      data-phase={phase}
      className={`font-mono font-semibold tabular-nums transition-colors ${colour} ${className}`}
    >
      {text}
    </span>
  );
}
