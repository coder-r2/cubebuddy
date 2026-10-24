import { useState } from 'react';
import { CubeView } from '../../components/CubeView/CubeView';
import { Dialog } from '../../components/ui/Dialog';
import { Icon } from '../../components/ui/Icon';
import type { Puzzle } from '../../db/types';

interface ScramblePanelProps {
  puzzle: Puzzle;
  scramble: string | null;
  error: boolean;
  onNext: () => void;
}

/** Scramble text with a 2D preview; tapping the preview opens a 3D view (SPEC §5.4). */
export function ScramblePanel({ puzzle, scramble, error, onNext }: ScramblePanelProps) {
  const [enlarged, setEnlarged] = useState(false);

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-3 sm:p-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-medium tracking-wide text-muted uppercase">Scramble</h2>
          <button
            type="button"
            onClick={onNext}
            className="flex h-9 items-center gap-1 rounded-lg px-2 text-sm text-muted hover:bg-surface-2 hover:text-text"
          >
            <Icon name="refresh" className="h-4 w-4" />
            New
          </button>
        </div>
        <p
          data-testid="scramble"
          className="mt-1 font-mono text-lg leading-relaxed break-words sm:text-xl"
          aria-live="polite"
        >
          {scramble ?? (error ? 'Couldn’t generate a scramble. Tap New to try again.' : 'Generating…')}
        </p>
      </div>

      {scramble && (
        <button
          type="button"
          onClick={() => setEnlarged(true)}
          aria-label="Show the scrambled cube in 3D"
          className="shrink-0 rounded-lg hover:bg-surface-2"
        >
          <CubeView
            puzzle={puzzle}
            setup={scramble}
            view="2D"
            hints={false}
            orbit={false}
            label="Scramble preview"
            className="pointer-events-none h-24 w-28 sm:h-28 sm:w-36"
          />
        </button>
      )}

      <Dialog open={enlarged && !!scramble} onClose={() => setEnlarged(false)} title="Scrambled cube">
        <p className="mb-2 font-mono text-sm break-words text-muted">{scramble}</p>
        <CubeView
          puzzle={puzzle}
          setup={scramble ?? ''}
          label="Scrambled cube in 3D"
          className="aspect-square w-full"
        />
        <p className="mt-2 text-sm text-muted">
          Drag to look around. Hold the cube with white on top, green in front.
        </p>
      </Dialog>
    </div>
  );
}
