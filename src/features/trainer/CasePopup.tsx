import { useState } from 'react';
import { CubeView } from '../../components/CubeView/CubeView';
import { CaseDiagram } from '../../components/CaseDiagram';
import { Dialog } from '../../components/ui/Dialog';
import type { AlgSet } from '../../data/algs/types';
import { verifyAlg } from '../../engine/cases';
import { formatAlg, parseAlg } from '../../engine/notation';
import { chosenAlg, useTrainerStore } from '../../stores/trainer';
import { demoMask, diagramProps } from './caseView';
import { ProgressControl } from './ProgressBar';

interface CasePopupProps {
  set: AlgSet;
  caseId: string | null;
  onClose: () => void;
}

/** Case popup (SPEC §5.5): 3D demo ending solved, alg choice, custom alg with verification, progress. */
export function CasePopup({ set, caseId, onClose }: CasePopupProps) {
  const algCase = set.cases.find((c) => c.id === caseId) ?? null;
  return (
    <Dialog open={algCase !== null} onClose={onClose} title={algCase?.name ?? ''} className="sm:max-w-2xl">
      {algCase && <CaseDetails key={algCase.id} set={set} caseId={algCase.id} />}
    </Dialog>
  );
}

function CaseDetails({ set, caseId }: { set: AlgSet; caseId: string }) {
  const algCase = set.cases.find((c) => c.id === caseId)!;
  const choices = useTrainerStore((s) => s.choices);
  const progress = useTrainerStore((s) => s.progress[caseId] ?? 'none');
  const setChoice = useTrainerStore((s) => s.setChoice);
  const setProgress = useTrainerStore((s) => s.setProgress);
  const choice = choices[caseId];
  const alg = chosenAlg(caseId, choices);
  const [custom, setCustom] = useState(choice?.customAlg ?? '');
  const [error, setError] = useState<string | null>(null);

  const saveCustom = () => {
    const result = verifyAlg(set, algCase, custom);
    if (!result.ok) {
      setError(result.reason ?? 'Invalid alg');
      return;
    }
    setError(null);
    void setChoice(caseId, 'custom', formatAlg(parseAlg(custom)));
  };

  const selected = choice?.selected ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <div className="rounded-xl border border-border bg-bg">
          <CubeView
            puzzle={set.puzzle}
            // Anchor "end": the demo ends at the case frame (yellow on top) and starts from the case.
            setup="z2"
            setupAnchor="end"
            alg={alg}
            maskOrbits={demoMask(set, algCase)}
            controls="playback"
            hints={false}
            label={`3D demo of ${algCase.name}`}
            className="aspect-square w-full"
          />
        </div>
        <div className="space-y-3">
          <CaseDiagram {...diagramProps(set, algCase)} className="mx-auto h-32 w-32" />
          {algCase.group && <p className="text-center text-sm text-muted">{algCase.group}</p>}
          <ProgressControl value={progress} onChange={(state) => void setProgress(caseId, state)} compact />
        </div>
      </div>

      <fieldset>
        <legend className="font-medium">Your alg</legend>
        <div className="mt-2 space-y-2">
          {algCase.algs.map((a, i) => (
            <label
              key={a}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 has-checked:border-accent has-checked:bg-surface-2"
            >
              <input
                type="radio"
                name="alg-choice"
                checked={selected === i}
                onChange={() => void setChoice(caseId, i as 0 | 1 | 2)}
              />
              <span className="font-mono text-sm break-words">{a}</span>
              <span className="ml-auto shrink-0 text-xs text-muted">
                {i === 0 ? 'Main' : `Alternative ${i}`}
              </span>
            </label>
          ))}
          <div className="rounded-lg border border-border px-3 py-2 has-checked:border-accent has-checked:bg-surface-2">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="radio"
                name="alg-choice"
                checked={selected === 'custom'}
                disabled={!choice?.customAlg}
                onChange={() => void setChoice(caseId, 'custom', choice?.customAlg)}
              />
              <span className="text-sm font-medium">My own alg</span>
            </label>
            <div className="mt-2 flex gap-2">
              <input
                value={custom}
                onChange={(e) => {
                  setCustom(e.target.value);
                  setError(null);
                }}
                placeholder="e.g. R U R' U R U2 R'"
                aria-label="Custom alg"
                aria-invalid={!!error}
                className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 font-mono text-sm aria-invalid:border-danger"
              />
              <button
                type="button"
                onClick={saveCustom}
                disabled={!custom.trim()}
                className="h-10 rounded-lg bg-accent px-3 text-sm font-medium text-accent-contrast disabled:opacity-50"
              >
                Check and use
              </button>
            </div>
            {error && (
              <p role="alert" className="mt-1 text-sm text-danger">
                {error}
              </p>
            )}
          </div>
        </div>
      </fieldset>
      {algCase.generated && (
        <p className="text-xs text-muted">
          This alg was found by CubeBuddy’s solver (shortest possible). You can type a different one above.
        </p>
      )}
    </div>
  );
}
