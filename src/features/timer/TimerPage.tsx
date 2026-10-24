import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWakeLock } from '../../lib/useWakeLock';
import { useSettings } from '../../stores/settings';
import { useTimerStore } from '../../stores/timer';
import { DataDialog } from './DataDialog';
import { HistoryList } from './HistoryList';
import { LiveTime } from './LiveTime';
import { isActive } from './machine';
import { PenaltyButtons } from './PenaltyButtons';
import { ScramblePanel } from './ScramblePanel';
import { SessionBar } from './SessionBar';
import { SolveDialog } from './SolveDialog';
import { computeStats } from './stats';
import { StatsPanel } from './StatsPanel';
import { TimeGraph } from './TimeGraph';
import { TimerOptionsDialog } from './TimerOptionsDialog';
import type { TimedResult } from './time';
import { TypedEntry } from './TypedEntry';
import { useScramble } from './useScramble';
import { useTimer } from './useTimer';

export default function TimerPage() {
  const settings = useSettings((s) => s.settings);
  const { loaded, load, sessions, currentSessionId, solves, addSolve, updateSolve } = useTimerStore();
  const [dialog, setDialog] = useState<'options' | 'data' | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) load().catch((error: unknown) => console.error('Failed to load sessions', error));
  }, [loaded, load]);
  useWakeLock(true);

  const session = sessions.find((s) => s.id === currentSessionId);
  const puzzle = session?.puzzle ?? '3x3x3';
  const { scramble, error: scrambleError, next: nextScramble } = useScramble(puzzle);
  const scrambleRef = useRef(scramble);
  useEffect(() => {
    scrambleRef.current = scramble;
  });

  const record = useCallback(
    (result: TimedResult, source: 'timer' | 'typed') => {
      void addSolve({ ...result, scramble: scrambleRef.current ?? '', source });
      nextScramble();
    },
    [addSolve, nextScramble],
  );

  const typing = settings.timerInput === 'typing';
  const { state, onPointerDown, cancel } = useTimer({
    holdMs: settings.holdMs,
    inspection: settings.inspection,
    inspectionAlerts: settings.inspectionAlerts,
    disabled: typing || !loaded,
    onSolve: (result) => record(result, 'timer'),
  });

  const stats = useMemo(() => computeStats(solves), [solves]);
  const last = solves.at(-1) ?? null;
  const fullScreen = isActive(state.phase);
  const selectedIndex = solves.findIndex((s) => s.id === selectedId);

  return (
    <section className="space-y-4">
      <SessionBar onOpenOptions={() => setDialog('options')} onOpenData={() => setDialog('data')} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-4">
          <ScramblePanel puzzle={puzzle} scramble={scramble} error={scrambleError} onNext={nextScramble} />

          {typing ? (
            <TypedEntry onSubmit={(result) => record(result, 'typed')} />
          ) : (
            <div
              onPointerDown={onPointerDown}
              onContextMenu={(e) => e.preventDefault()}
              data-testid="timer-area"
              className="grid min-h-56 cursor-pointer touch-none place-items-center rounded-2xl border border-border bg-surface p-4 select-none [-webkit-touch-callout:none] sm:min-h-64"
            >
              <div className="text-center">
                <LiveTime
                  state={state}
                  last={last}
                  hideWhileRunning={settings.hideTimeWhileRunning}
                  className="text-6xl sm:text-7xl lg:text-8xl"
                />
                <p className="mt-3 text-sm text-muted">
                  {settings.inspection
                    ? 'Tap or press space to inspect, then hold until green and let go to start.'
                    : 'Hold space (or touch and hold here) until green, then let go to start.'}
                </p>
              </div>
            </div>
          )}

          {last && state.phase === 'idle' && (
            <div className="flex flex-wrap items-center justify-center gap-2" aria-label="Last solve">
              <PenaltyButtons
                value={last.penalty}
                onChange={(penalty) => void updateSolve(last.id, { penalty })}
                label="Penalty for the last solve"
              />
              <button
                type="button"
                onClick={() => setSelectedId(last.id)}
                className="h-10 rounded-lg border border-border px-3 text-sm font-medium hover:bg-surface-2"
              >
                Details
              </button>
            </div>
          )}

          <StatsPanel stats={stats} visible={settings.visibleStats} />
        </div>

        <div className="space-y-4">
          <TimeGraph solves={solves} ao5={stats.rolling[5]} ao12={stats.rolling[12]} />
          <HistoryList
            solves={solves}
            ao5={stats.rolling[5]}
            ao12={stats.rolling[12]}
            onSelect={(solve) => setSelectedId(solve.id)}
          />
        </div>
      </div>

      {fullScreen && (
        // While timing, the clock covers the whole screen so a tap anywhere stops it.
        <div
          onPointerDown={onPointerDown}
          onContextMenu={(e) => e.preventDefault()}
          data-testid="timer-overlay"
          className="fixed inset-0 z-40 m-0 grid touch-none place-items-center bg-bg select-none [-webkit-touch-callout:none]"
        >
          <div className="text-center">
            {state.phase.startsWith('inspect') && (
              <p className="mb-2 text-sm text-muted uppercase">Inspection</p>
            )}
            <LiveTime
              state={state}
              last={last}
              hideWhileRunning={settings.hideTimeWhileRunning}
              className="text-7xl sm:text-8xl lg:text-9xl"
            />
          </div>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={cancel}
            className="absolute right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] h-11 rounded-lg border border-border px-4 text-sm text-muted"
          >
            Cancel (Esc)
          </button>
        </div>
      )}

      <TimerOptionsDialog open={dialog === 'options'} onClose={() => setDialog(null)} />
      <DataDialog open={dialog === 'data'} onClose={() => setDialog(null)} />
      <SolveDialog solveId={selectedId} number={selectedIndex + 1} onClose={() => setSelectedId(null)} />
    </section>
  );
}
