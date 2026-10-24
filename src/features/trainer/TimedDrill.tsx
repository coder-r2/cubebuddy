import { useEffect, useRef, useState } from 'react';
import { CaseDiagram } from '../../components/CaseDiagram';
import type { AlgCase, AlgSet } from '../../data/algs/types';
import { useSettings } from '../../stores/settings';
import { chosenAlg, useTrainerStore } from '../../stores/trainer';
import { LiveTime } from '../timer/LiveTime';
import { isActive } from '../timer/machine';
import { formatTime } from '../timer/time';
import { useTimer } from '../timer/useTimer';
import { diagramProps } from './caseView';
import { pickCase, setAverage } from './srs';
import { caseSetup } from './setup';

interface Round {
  caseId: string;
  scramble: string | null;
  error?: boolean;
}

interface Result {
  caseId: string;
  timeMs: number;
}

/** Timed drill (D-028): scramble into a case, time the solve on a real cube, then reveal it. Remount to reset. */
export function TimedDrill({ set, cases }: { set: AlgSet; cases: AlgCase[] }) {
  const settings = useSettings((s) => s.settings);
  const stats = useTrainerStore((s) => s.stats);
  const choices = useTrainerStore((s) => s.choices);
  const recordTime = useTrainerStore((s) => s.recordTime);
  const setProgress = useTrainerStore((s) => s.setProgress);
  const ids = cases.map((c) => c.id);
  const firstPick = () =>
    ids.length
      ? { caseId: pickCase(ids, useTrainerStore.getState().stats, Math.random), scramble: null }
      : null;
  const [round, setRound] = useState<Round | null>(firstPick);
  const [last, setLast] = useState<Result | null>(null);
  const [count, setCount] = useState(0);
  const roundRef = useRef(round);
  useEffect(() => {
    roundRef.current = round;
  });

  // Build the setup scramble whenever a new case is drawn.
  const roundCase = round?.caseId;
  useEffect(() => {
    if (!roundCase) return;
    let cancelled = false;
    const algCase = set.cases.find((c) => c.id === roundCase)!;
    const custom = useTrainerStore.getState().choices[roundCase]?.customAlg;
    caseSetup(set, algCase, Math.random, custom)
      .then(({ scramble }) => !cancelled && setRound({ caseId: roundCase, scramble }))
      .catch((error: unknown) => {
        console.error('Setup scramble failed', error);
        if (!cancelled) setRound({ caseId: roundCase, scramble: null, error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [roundCase, set, count]);

  const nextRound = (previous: string) =>
    setRound({
      caseId: pickCase(ids, useTrainerStore.getState().stats, Math.random, previous),
      scramble: null,
    });

  const onSolve = ({ timeMs }: { timeMs: number }) => {
    const current = roundRef.current;
    if (!current?.scramble) return;
    const average = setAverage(cases.map((c) => stats[c.id]).filter((s) => s !== undefined));
    void recordTime(current.caseId, timeMs, average);
    setLast({ caseId: current.caseId, timeMs });
    setCount((n) => n + 1);
    nextRound(current.caseId);
  };

  const { state, onPointerDown } = useTimer({
    holdMs: settings.holdMs,
    inspection: false,
    inspectionAlerts: false,
    disabled: !round?.scramble,
    onSolve,
  });

  if (cases.length === 0) {
    return <p className="text-muted">Select at least one case on the Cases tab (the “Train” checkboxes).</p>;
  }

  const lastCase = last ? set.cases.find((c) => c.id === last.caseId) : undefined;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="text-xs font-medium tracking-wide text-muted uppercase">Setup scramble</h2>
          <p
            className="mt-1 font-mono text-lg break-words sm:text-xl"
            data-testid="drill-scramble"
            aria-live="polite"
          >
            {round?.scramble ?? (round?.error ? 'Couldn’t build a scramble.' : 'Generating…')}
          </p>
          <p className="mt-2 text-sm text-muted">
            {set.puzzle === '3x3x3'
              ? 'Hold the cube with the white cross on the bottom and green in front, then apply the scramble.'
              : 'Hold the cube with white on the bottom and green in front, then apply the scramble.'}
          </p>
        </div>
        <div
          onPointerDown={onPointerDown}
          data-testid="drill-timer"
          className="grid min-h-48 cursor-pointer touch-none place-items-center rounded-2xl border border-border bg-surface select-none"
        >
          <div className="text-center">
            <LiveTime
              state={state}
              last={last ? { timeMs: last.timeMs, penalty: 0 } : null}
              hideWhileRunning={false}
              className="text-6xl"
            />
            <p className="mt-2 text-sm text-muted">
              Hold space (or touch and hold) until green, let go to start, press to stop.
            </p>
          </div>
        </div>
        {isActive(state.phase) && (
          <div
            onPointerDown={onPointerDown}
            className="fixed inset-0 z-40 m-0 grid touch-none place-items-center bg-bg select-none"
          >
            <LiveTime
              state={state}
              last={null}
              hideWhileRunning={settings.hideTimeWhileRunning}
              className="text-7xl sm:text-8xl"
            />
          </div>
        )}
      </div>

      <div className="space-y-3 rounded-2xl border border-border bg-surface p-4" data-testid="drill-reveal">
        <h2 className="text-xs font-medium tracking-wide text-muted uppercase">Last case</h2>
        {lastCase && last ? (
          <>
            <div className="flex items-center gap-3">
              <CaseDiagram {...diagramProps(set, lastCase)} className="h-24 w-24 shrink-0" />
              <div>
                <p className="font-semibold">{lastCase.name}</p>
                <p className="font-mono text-2xl tabular-nums">{formatTime(last.timeMs)}</p>
              </div>
            </div>
            <p className="font-mono text-sm break-words">{chosenAlg(lastCase.id, choices)}</p>
            <button
              type="button"
              onClick={() => void setProgress(lastCase.id, 'learned')}
              className="h-10 rounded-lg border border-border px-3 text-sm font-medium hover:bg-surface-2"
            >
              Mark learned
            </button>
          </>
        ) : (
          <p className="text-sm text-muted">
            Solve the scramble; the case and its alg appear here afterwards.
          </p>
        )}
        <p className="text-sm text-muted" data-testid="drill-count">
          {count} solved this session
        </p>
      </div>
    </div>
  );
}
