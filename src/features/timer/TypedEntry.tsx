import { useState } from 'react';
import type { Penalty } from '../../db/types';
import { PenaltyButtons } from './PenaltyButtons';
import { parseTypedTime, type TimedResult } from './time';

/** Typing mode (SPEC §5.4): `1234` → 12.34, `12.34`, `1:02.34`, `DNF`, `12.34+`. */
export function TypedEntry({ onSubmit }: { onSubmit: (result: TimedResult) => void }) {
  const [text, setText] = useState('');
  const [penalty, setPenalty] = useState<Penalty>(0);
  const [error, setError] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseTypedTime(text);
    if (!parsed) {
      setError(true);
      return;
    }
    onSubmit({ timeMs: parsed.timeMs, penalty: parsed.penalty || penalty });
    setText('');
    setPenalty(0);
    setError(false);
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-4 sm:p-6"
    >
      <label className="w-full max-w-xs">
        <span className="sr-only">Time</span>
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(false);
          }}
          inputMode="decimal"
          autoComplete="off"
          placeholder="e.g. 1234 or 12.34"
          aria-invalid={error}
          aria-describedby="typed-help"
          className="h-16 w-full rounded-xl border border-border bg-bg text-center font-mono text-3xl tabular-nums aria-invalid:border-danger"
        />
      </label>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <PenaltyButtons value={penalty} onChange={setPenalty} label="Penalty for this time" />
        <button type="submit" className="h-10 rounded-lg bg-accent px-5 font-medium text-accent-contrast">
          Add
        </button>
      </div>
      <p id="typed-help" className={`text-sm ${error ? 'text-danger' : 'text-muted'}`}>
        {error
          ? 'Couldn’t read that time. Try 1234, 12.34 or 1:02.34.'
          : 'Press Enter to add. Digits only: 1234 = 12.34.'}
      </p>
    </form>
  );
}
