import { useCallback, useEffect, useId, useRef } from 'react';
import { SPEEDS } from '../lib/speeds';
import { CubeView, type CubeViewHandle, type PlaybackInfo } from './CubeView/CubeView';

const nearestIndex = (speed: number) =>
  SPEEDS.reduce(
    (best, s, i) => (Math.abs(s.value - speed) < Math.abs(SPEEDS[best]!.value - speed) ? i : best),
    0,
  );

/** Animation speed slider (SPEC §5.2 Q4, §5.8), stepping through the same speeds as the options dialogs. */
export function SpeedSlider({ value, onChange }: { value: number; onChange: (speed: number) => void }) {
  const id = useId();
  const index = nearestIndex(value);
  return (
    <div>
      <label htmlFor={id} className="sr-only">
        Animation speed
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={SPEEDS.length - 1}
        step={1}
        value={index}
        aria-valuetext={SPEEDS[index]!.label}
        onChange={(e) => onChange(SPEEDS[Number(e.target.value)]!.value)}
        className="h-11 w-full accent-accent"
      />
      <div className="flex justify-between text-xs text-muted" aria-hidden>
        {SPEEDS.map((s, i) => (
          <span key={s.value} className={i === index ? 'font-semibold text-text' : ''}>
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

const PREVIEW_ALG = "R U R' U'";

/** A small cube looping a short alg at `speed`, so the slider's effect is visible straight away. */
export function SpeedPreview({ speed, className = 'h-40 w-40' }: { speed: number; className?: string }) {
  const cube = useRef<CubeViewHandle>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const onPlayback = useCallback((info: PlaybackInfo) => {
    if (info.playing || info.moves === 0) return;
    clearTimeout(timer.current);
    // Pause briefly at each end: rewind after finishing, then play again.
    timer.current = setTimeout(() => {
      if (info.position >= info.moves) cube.current?.jumpToStart();
      else cube.current?.play();
    }, 600);
  }, []);

  return (
    <CubeView
      ref={cube}
      alg={PREVIEW_ALG}
      speed={speed}
      orbit={false}
      hints={false}
      onPlayback={onPlayback}
      label={`Preview cube turning ${PREVIEW_ALG} at the chosen speed`}
      className={className}
    />
  );
}
