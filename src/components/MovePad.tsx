import { useState } from 'react';
import type { Puzzle } from '../db/types';

interface MovePadProps {
  puzzle: Puzzle;
  onMove: (move: string) => void;
  disabled?: boolean;
}

const FACES = ['U', 'D', 'R', 'L', 'F', 'B'];
const WIDE = ['r', 'l', 'u', 'd', 'f', 'b'];
const SLICES = ['M', 'E', 'S'];
const ROTATIONS = ['x', 'y', 'z'];
const VARIANTS = ['', "'", '2'];

function MoveGrid({
  families,
  onMove,
  disabled,
}: {
  families: string[];
  onMove: (m: string) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${families.length}, minmax(0, 1fr))` }}
    >
      {VARIANTS.map((variant) =>
        families.map((family) => {
          const move = family + variant;
          return (
            <button
              key={move}
              type="button"
              disabled={disabled}
              onClick={() => onMove(move)}
              className="h-11 rounded-lg border border-border bg-surface font-mono text-base font-medium hover:bg-surface-2 active:bg-surface-2 disabled:opacity-50"
            >
              {move}
            </button>
          );
        }),
      )}
    </div>
  );
}

/** On-screen move buttons (D-010): face turns always, wide/slice/rotation moves behind a toggle. */
export function MovePad({ puzzle, onMove, disabled }: MovePadProps) {
  const [more, setMore] = useState(false);

  return (
    <div className="space-y-2" role="group" aria-label="Move pad">
      <MoveGrid families={FACES} onMove={onMove} disabled={disabled} />
      <button
        type="button"
        onClick={() => setMore(!more)}
        aria-expanded={more}
        className="text-sm text-muted underline-offset-2 hover:text-text hover:underline"
      >
        {more ? 'Fewer moves' : puzzle === '3x3x3' ? 'Wide moves, slices and rotations' : 'Rotations'}
      </button>
      {more && (
        <div className="space-y-2">
          {puzzle === '3x3x3' && <MoveGrid families={WIDE} onMove={onMove} disabled={disabled} />}
          <MoveGrid
            families={puzzle === '3x3x3' ? [...SLICES, ...ROTATIONS] : ROTATIONS}
            onMove={onMove}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}
