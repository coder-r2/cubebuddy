import { Dialog } from '../../components/ui/Dialog';
import type { Solve } from '../../db/types';
import { useTimerStore } from '../../stores/timer';
import { PenaltyButtons } from './PenaltyButtons';
import { formatResult, formatTime } from './time';

const SOURCE_LABEL: Record<Solve['source'], string> = {
  timer: 'Timer',
  typed: 'Typed',
  cstimer: 'cstimer import',
};

interface SolveDialogProps {
  /** The solve to show; the live copy from the store is used so edits appear immediately. */
  solveId: string | null;
  number: number;
  onClose: () => void;
}

/** Solve detail sheet: scramble, date, penalty, comment and delete (SPEC §5.4). */
export function SolveDialog({ solveId, number, onClose }: SolveDialogProps) {
  const solve = useTimerStore((s) => s.solves.find((x) => x.id === solveId) ?? null);
  const updateSolve = useTimerStore((s) => s.updateSolve);
  const deleteSolve = useTimerStore((s) => s.deleteSolve);

  const onDelete = () => {
    if (!solve) return;
    if (window.confirm('Delete this solve?')) {
      void deleteSolve(solve.id);
      onClose();
    }
  };

  return (
    <Dialog open={solve !== null} onClose={onClose} title={`Solve ${number}`}>
      {solve && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-4xl font-semibold tabular-nums" data-testid="solve-detail-time">
              {formatResult(solve)}
            </p>
            <PenaltyButtons
              value={solve.penalty}
              onChange={(penalty) => void updateSolve(solve.id, { penalty })}
            />
          </div>
          {solve.penalty !== 0 && (
            <p className="text-sm text-muted">Recorded time without penalty: {formatTime(solve.timeMs)}</p>
          )}
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted">Scramble</dt>
            <dd className="font-mono break-words">{solve.scramble || '—'}</dd>
            <dt className="text-muted">Date</dt>
            <dd>{solve.createdAt ? new Date(solve.createdAt).toLocaleString() : 'Unknown'}</dd>
            <dt className="text-muted">Source</dt>
            <dd>{SOURCE_LABEL[solve.source]}</dd>
          </dl>
          <label className="block">
            <span className="text-sm font-medium">Comment</span>
            <textarea
              key={solve.id}
              defaultValue={solve.comment}
              maxLength={500}
              rows={2}
              // Saved as you type: closing with Esc unmounts the field without a reliable blur.
              onChange={(e) => void updateSolve(solve.id, { comment: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2"
            />
          </label>
          <button
            type="button"
            onClick={onDelete}
            className="h-11 w-full rounded-lg border border-border font-medium text-danger hover:bg-surface-2"
          >
            Delete solve
          </button>
        </div>
      )}
    </Dialog>
  );
}
