import { useId, useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import type { Puzzle } from '../../db/types';
import { ScanDialog } from '../scan/ScanDialog';
import { checkScramble } from './stages';

interface ScrambleFormProps {
  puzzle: Puzzle;
  /** Called with a validated scramble in our notation, or with null for a random one. */
  onStart: (scramble: string | null) => void;
  busy: boolean;
}

/** Start screen: a random scramble, a typed one (checked token by token, SPEC §5.6) or a copy of the user's
 * own cube from the camera or the net editor (D-097, D-098). */
export function ScrambleForm({ puzzle, onStart, busy }: ScrambleFormProps) {
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const id = useId();
  const { tokens, moves } = checkScramble(text, puzzle);
  const invalid = tokens.filter((t) => !t.valid);
  const showErrors = invalid.length > 0 && (submitted || tokens.length > 1);
  const [scan, setScan] = useState<'camera' | 'edit' | null>(null);

  return (
    <div className="space-y-4">
      <button
        type="button"
        disabled={busy}
        onClick={() => onStart(null)}
        className="h-12 w-full rounded-xl bg-accent px-4 font-medium text-accent-contrast disabled:opacity-50"
      >
        {busy ? 'Scrambling…' : 'Random scramble'}
      </button>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(true);
          if (moves.length > 0) onStart(moves.join(' '));
        }}
        className="space-y-2"
      >
        <label htmlFor={id} className="block text-sm font-medium">
          Or type the scramble of your own cube
        </label>
        <div className="flex gap-2">
          <input
            id={id}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setSubmitted(false);
            }}
            placeholder={puzzle === '3x3x3' ? "e.g. R U R' F2 D' L2 …" : "e.g. R U' F2 R' U2 …"}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-invalid={showErrors || undefined}
            aria-describedby={`${id}-help`}
            className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 font-mono text-base aria-invalid:border-danger"
          />
          <button
            type="submit"
            disabled={busy}
            className="h-11 shrink-0 rounded-lg border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2 disabled:opacity-50"
          >
            Start
          </button>
        </div>
        <div id={`${id}-help`} className="min-h-5 text-sm" aria-live="polite">
          {showErrors ? (
            <>
              <p className="flex flex-wrap gap-1 font-mono" aria-hidden>
                {tokens.map((t, i) => (
                  <span
                    key={i}
                    className={
                      t.valid
                        ? 'text-muted'
                        : 'rounded bg-danger/15 px-1 text-danger underline decoration-wavy'
                    }
                  >
                    {t.text}
                  </span>
                ))}
              </p>
              <p className="mt-1 text-danger">
                {invalid.length === 1 ? 'Not a valid move' : 'Not valid moves'}
                {puzzle === '2x2x2' ? ' on a 2x2' : ''}: {invalid.map((t) => t.text).join(', ')}
              </p>
            </>
          ) : submitted && tokens.length === 0 ? (
            <p className="text-danger">Type a scramble first.</p>
          ) : (
            <p className="text-muted">
              Hold the cube with white on top and green in front, as for a WCA scramble.
            </p>
          )}
        </div>
      </form>

      <div className="space-y-2">
        <p className="text-sm font-medium">Or copy the colours of your own cube</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => setScan('camera')}
            className="flex h-11 items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-surface-2 disabled:opacity-50"
          >
            <Icon name="camera" className="h-4 w-4" />
            Scan with camera
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setScan('edit')}
            className="flex h-11 items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-surface-2 disabled:opacity-50"
          >
            <Icon name="grid" className="h-4 w-4" />
            Enter by hand
          </button>
        </div>
        <ScanDialog
          puzzle={puzzle}
          open={scan !== null}
          start={scan ?? 'edit'}
          onClose={() => setScan(null)}
          onUse={(setup) => {
            setScan(null);
            onStart(setup);
          }}
        />
      </div>
    </div>
  );
}
