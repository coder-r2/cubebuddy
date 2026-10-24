import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { Puzzle } from '../db/types';
import { useSettings } from '../stores/settings';
import { CubeView, type CubeViewHandle, type PlaybackInfo } from './CubeView/CubeView';
import { Icon, type IconName } from './ui/Icon';

export interface AlgPlayerProps {
  puzzle: Puzzle;
  alg: string;
  setup?: string;
  setupAnchor?: 'start' | 'end';
  maskOrbits?: string;
  label: string;
  className?: string;
}

const RATES = [0.5, 1, 2] as const;
const START: PlaybackInfo = { timestamp: 0, duration: 0, playing: false, position: 0, moves: 0 };

/**
 * Alg demo with CubeBuddy's own playback controls (D-086): a 3D cube, the alg with the current move marked
 * (tap a move to jump there), a timeline, step / play buttons and a speed toggle. Arrow keys step, Space plays.
 */
export function AlgPlayer({
  puzzle,
  alg,
  setup,
  setupAnchor,
  maskOrbits,
  label,
  className = '',
}: AlgPlayerProps) {
  const cube = useRef<CubeViewHandle>(null);
  const [info, setInfo] = useState<PlaybackInfo>(START);
  const [rate, setRate] = useState<(typeof RATES)[number]>(1);
  const baseSpeed = useSettings((s) => s.settings.animationSpeed);
  const moves = alg.split(/\s+/).filter(Boolean);
  // Controls wait until cubing.js has loaded the alg.
  const loaded = info.moves > 0;
  const atStart = !loaded || info.timestamp <= 0;
  const atEnd = !loaded || info.timestamp >= info.duration;

  // Steps queue up: quick taps set a target move and the player keeps stepping until it gets there.
  const target = useRef<number | null>(null);
  // Set when a step is requested, until the player reports that it started (so it isn't requested twice).
  const starting = useRef(false);
  const startStep = (direction: 1 | -1) => {
    starting.current = true;
    cube.current?.step(direction);
  };
  const step = (direction: 1 | -1) => {
    const from = target.current ?? info.position;
    const to = Math.min(Math.max(from + direction, 0), info.moves);
    if (to === from) return;
    target.current = to;
    if (!info.playing && !starting.current) startStep(direction);
  };
  useEffect(() => {
    if (info.playing) starting.current = false;
    const goal = target.current;
    if (goal === null || info.playing || starting.current) return;
    if (goal === info.position) target.current = null;
    else startStep(goal > info.position ? 1 : -1);
  }, [info]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === ' ') {
      target.current = null;
      void cube.current?.togglePlay();
    } else return;
    e.preventDefault();
  };

  return (
    <div className={`space-y-3 ${className}`} onKeyDown={onKeyDown}>
      <div className="mx-auto aspect-square max-h-[40dvh] rounded-xl border border-border bg-bg sm:max-h-none">
        <CubeView
          ref={cube}
          puzzle={puzzle}
          setup={setup}
          setupAnchor={setupAnchor}
          alg={alg}
          maskOrbits={maskOrbits}
          hints={false}
          speed={baseSpeed * rate}
          onPlayback={setInfo}
          label={label}
          className="h-full w-full"
        />
      </div>

      <ol aria-label="Moves" className="flex flex-wrap justify-center gap-1 font-mono text-sm">
        {moves.map((move, i) => {
          const next = i === info.position && (!loaded || !atEnd);
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => {
                  target.current = null;
                  void cube.current?.seekToMove(i + 1);
                }}
                aria-label={`Show the cube after move ${i + 1} (${move})`}
                aria-current={next ? 'step' : undefined}
                disabled={!loaded}
                className={`min-w-8 rounded-md px-1.5 py-0.5 transition-colors ${
                  next
                    ? 'bg-accent text-accent-contrast'
                    : i < info.position
                      ? 'text-text hover:bg-surface-2'
                      : 'text-muted hover:bg-surface-2'
                }`}
              >
                {move}
              </button>
            </li>
          );
        })}
      </ol>

      <input
        type="range"
        disabled={!loaded}
        min={0}
        max={Math.max(info.duration, 1)}
        step="any"
        value={info.timestamp}
        onChange={(e) => {
          target.current = null;
          cube.current?.seek(Number(e.target.value));
        }}
        aria-label="Timeline"
        aria-valuetext={`Move ${info.position} of ${info.moves}`}
        className="block h-2 w-full cursor-pointer accent-accent"
      />

      <div className="flex items-center justify-center gap-2">
        <ControlButton
          icon="restart"
          label="Back to the start"
          onClick={() => {
            target.current = null;
            void cube.current?.seekToMove(0);
          }}
          disabled={atStart}
        />
        <ControlButton icon="step-back" label="Previous move" onClick={() => step(-1)} disabled={atStart} />
        <button
          type="button"
          onClick={() => {
            target.current = null;
            void cube.current?.togglePlay();
          }}
          disabled={!loaded}
          aria-label={info.playing ? 'Pause' : loaded && atEnd ? 'Replay' : 'Play'}
          className="grid h-12 w-12 place-items-center rounded-full bg-accent text-accent-contrast shadow-sm transition-transform active:scale-95"
        >
          <Icon name={info.playing ? 'pause' : 'play'} className="h-5 w-5" />
        </button>
        <ControlButton icon="step-forward" label="Next move" onClick={() => step(1)} disabled={atEnd} />
        <button
          type="button"
          onClick={() => setRate(RATES[(RATES.indexOf(rate) + 1) % RATES.length]!)}
          aria-label={`Speed ${rate}×, change`}
          className="h-10 w-12 rounded-full border border-border text-sm font-medium tabular-nums hover:bg-surface-2"
        >
          {rate}×
        </button>
      </div>
    </div>
  );
}

function ControlButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid h-10 w-10 place-items-center rounded-full text-text hover:bg-surface-2 disabled:opacity-35"
    >
      <Icon name={icon} />
    </button>
  );
}
