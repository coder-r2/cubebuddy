import { Link } from 'react-router';
import { CaseDiagram } from '../../components/CaseDiagram';
import { Dialog } from '../../components/ui/Dialog';
import { ALG_SETS } from '../../data/algs/sets';
import type { EngineStep } from '../../engine/api';
import { diagramProps } from '../trainer/caseView';

interface CaseDialogProps {
  step: EngineStep | null;
  onClose: () => void;
  /** Close the popup and play the step on the main cube. */
  onPlay: () => void;
}

/** The current last-layer case: diagram, name and the user's chosen alg (SPEC §5.6). */
export function CaseDialog({ step, onClose, onPlay }: CaseDialogProps) {
  const set = step?.caseId ? ALG_SETS.find((s) => s.cases.some((c) => c.id === step.caseId)) : undefined;
  const algCase = set?.cases.find((c) => c.id === step?.caseId);

  return (
    <Dialog open={!!algCase} onClose={onClose} title={algCase?.name ?? ''}>
      {set && algCase && step && (
        <div className="space-y-4">
          <CaseDiagram {...diagramProps(set, algCase)} className="mx-auto h-44 w-44" />
          <p className="text-center text-sm text-muted">
            {set.name} · {algCase.group}
          </p>
          <div className="rounded-lg bg-surface-2 p-3">
            <p className="text-xs font-medium tracking-wide text-muted uppercase">Alg</p>
            <p className="mt-1 font-mono text-lg break-words">{step.alg}</p>
            <p className="mt-2 text-sm text-muted">
              This is the alg chosen for this case in the{' '}
              <Link to={`/trainer/${set.id}`} className="text-accent underline">
                trainer
              </Link>
              ; the cube may need a U turn first so the case matches the picture.
            </p>
          </div>
          <button
            type="button"
            onClick={onPlay}
            className="h-11 w-full rounded-lg bg-accent px-4 font-medium text-accent-contrast"
          >
            Play it on the cube
          </button>
        </div>
      )}
    </Dialog>
  );
}
