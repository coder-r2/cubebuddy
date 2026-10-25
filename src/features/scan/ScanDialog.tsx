import { useState } from 'react';
import { Dialog } from '../../components/ui/Dialog';
import { Icon } from '../../components/ui/Icon';
import type { Puzzle } from '../../db/types';
import { checkState } from '../../engine/validate';
import { useHelperEngine } from '../../lib/useHelperEngine';
import { CameraScanner } from './CameraScanner';
import { classify, classify2x2 } from './classify';
import { NetEditor } from './NetEditor';

/*
 * Copy a real cube into the tutorial (D-019, D-097): scan it with the camera or enter the colours by hand,
 * review and fix them in the net editor, then the engine turns the colours into setup moves. Works for the
 * 3x3 and, without centres, the 2x2 (D-098).
 */

type Mode = 'camera' | 'edit';

/** 3x3: centres at home, everything else not set. 2x2: nothing set. */
const blank = (puzzle: Puzzle) =>
  Array.from({ length: 54 }, (_, i) => (puzzle === '3x3x3' && i % 9 === 4 ? Math.floor(i / 9) : -1));

interface ScanDialogProps {
  puzzle: Puzzle;
  open: boolean;
  /** How to start: with the camera, or straight in the editor. */
  start: Mode;
  onClose: () => void;
  /** Setup moves that make the entered cube from solved. */
  onUse: (setup: string) => void;
}

export function ScanDialog({ puzzle, open, start, onClose, onUse }: ScanDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title="Copy your cube" className="sm:max-w-xl">
      {open && <ScanFlow puzzle={puzzle} start={start} onUse={onUse} />}
    </Dialog>
  );
}

function ScanFlow({ puzzle, start, onUse }: { puzzle: Puzzle; start: Mode; onUse: (setup: string) => void }) {
  const { engine } = useHelperEngine();
  const small = puzzle === '2x2x2';
  const [mode, setMode] = useState<Mode>(start);
  const [colours, setColours] = useState<number[]>(() => blank(puzzle));
  const [doubtful, setDoubtful] = useState<number[]>([]);
  const [scanned, setScanned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const problem = checkState(colours, puzzle);
  // Missing stickers are only an error once the user tries to continue; until then they're just to-do.
  const [tried, setTried] = useState(false);
  const showProblem = problem && (tried || problem.kind !== 'unset');

  if (mode === 'camera') {
    return (
      <CameraScanner
        size={small ? 2 : 3}
        onDone={(samples) => {
          const result = small ? classify2x2(samples) : classify(samples);
          setColours(result.colours);
          setDoubtful(result.doubtful);
          setScanned(true);
          setMode('edit');
        }}
        onManual={() => setMode('edit')}
      />
    );
  }

  const use = async () => {
    setTried(true);
    if (problem) return;
    setBusy(true);
    setFailed(false);
    try {
      onUse(await engine.setupFor(colours, puzzle));
    } catch (error) {
      console.error('[scan] setup failed', error);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        {scanned
          ? 'Check the colours against your cube and fix any that are wrong. Stickers with a dot were hard to read.'
          : small
            ? 'Hold your cube any way you like and keep it that way. Tap each sticker, then pick its colour.'
            : 'Hold your cube with white on top and green in front. Tap each sticker, then pick its colour.'}
      </p>
      <NetEditor
        size={small ? 2 : 3}
        colours={colours}
        onChange={(next) => {
          setColours(next);
          setFailed(false);
        }}
        doubtful={doubtful}
        problem={showProblem ? problem.stickers : []}
      />
      <div aria-live="polite" className="min-h-5 text-sm">
        {showProblem ? (
          <p className="text-danger" data-testid="scan-problem">
            {problem.message}
          </p>
        ) : failed ? (
          <p className="text-danger">Something went wrong working out the moves. Please try again.</p>
        ) : !problem ? (
          <p className="text-success">This cube is valid.</p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void use()}
          disabled={busy}
          className="h-11 flex-1 rounded-lg bg-accent px-4 font-medium text-accent-contrast disabled:opacity-50"
        >
          {busy ? 'Working it out…' : 'Use this cube'}
        </button>
        <button
          type="button"
          onClick={() => setMode('camera')}
          className="flex h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-surface-2"
        >
          <Icon name="camera" className="h-4 w-4" />
          {scanned ? 'Scan again' : 'Use the camera'}
        </button>
        <button
          type="button"
          onClick={() => {
            setColours(blank(puzzle));
            setDoubtful([]);
            setScanned(false);
            setTried(false);
          }}
          className="h-11 rounded-lg border border-border px-3 text-sm font-medium hover:bg-surface-2"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
