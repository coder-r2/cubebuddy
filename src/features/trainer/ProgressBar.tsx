import type { ProgressState } from '../../db/types';

interface ProgressBarProps {
  total: number;
  learned: number;
  learning: number;
  className?: string;
}

/** Learned / learning / not started (D-017), with the counts as text so colour is never the only cue. */
export function ProgressBar({ total, learned, learning, className = '' }: ProgressBarProps) {
  const pct = (n: number) => `${(n / Math.max(total, 1)) * 100}%`;
  return (
    <div className={className}>
      <div className="flex h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <div className="bg-success" style={{ width: pct(learned) }} />
        <div className="bg-accent/60" style={{ width: pct(learning) }} />
      </div>
      <p className="mt-1 text-xs text-muted">
        {learned} learned · {learning} learning · {total - learned - learning} not started
      </p>
    </div>
  );
}

const STATES: { value: ProgressState; label: string; short: string }[] = [
  { value: 'none', label: 'Not started', short: 'New' },
  { value: 'learning', label: 'Learning', short: 'Learning' },
  { value: 'learned', label: 'Learned', short: 'Learned' },
];

export function ProgressControl({
  value,
  onChange,
  compact = false,
}: {
  value: ProgressState;
  onChange: (state: ProgressState) => void;
  compact?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label="Progress"
      className={`rounded-lg border border-border bg-surface p-0.5 ${compact ? 'grid w-full grid-cols-3' : 'inline-flex'}`}
    >
      {STATES.map((s) => (
        <button
          key={s.value}
          type="button"
          aria-pressed={value === s.value}
          aria-label={s.label}
          onClick={(e) => {
            e.stopPropagation();
            onChange(s.value);
          }}
          className={`rounded-md font-medium text-muted aria-pressed:bg-surface-2 aria-pressed:text-text ${
            compact ? 'h-8 px-1 text-[11px]' : 'h-9 px-3 text-sm'
          }`}
        >
          {compact ? s.short : s.label}
        </button>
      ))}
    </div>
  );
}
