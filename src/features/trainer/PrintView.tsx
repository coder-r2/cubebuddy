import { useState } from 'react';
import { Link } from 'react-router';
import { CaseDiagram } from '../../components/CaseDiagram';
import type { AlgSet } from '../../data/algs/types';
import { chosenAlg, useTrainerStore } from '../../stores/trainer';
import { diagramProps } from './caseView';

/** Print sheet (D-027): diagrams, names and the user's chosen algs; the browser prints or saves as PDF. */
export function PrintView({ set }: { set: AlgSet }) {
  const choices = useTrainerStore((s) => s.choices);
  const progress = useTrainerStore((s) => s.progress);
  const [learningOnly, setLearningOnly] = useState(false);
  const cases = set.cases.filter((c) => !learningOnly || progress[c.id] === 'learning');
  const wide = set.diagram === 'pbl' || set.cases.some((c) => c.id.includes('-stuck-'));

  return (
    <section className="print-sheet space-y-4">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Link to={`/trainer/${set.id}`} className="text-sm text-muted hover:text-text">
          ← Back to {set.name}
        </Link>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <input type="checkbox" checked={learningOnly} onChange={(e) => setLearningOnly(e.target.checked)} />
          Learning only
        </label>
        <button
          type="button"
          onClick={() => window.print()}
          className="h-10 rounded-lg bg-accent px-4 text-sm font-medium text-accent-contrast"
        >
          Print / save as PDF
        </button>
      </div>
      <h1 className="text-xl font-semibold">
        {set.name}
        <span className="ml-2 text-sm font-normal text-muted">CubeBuddy · coder-r2.github.io/cubebuddy</span>
      </h1>
      {cases.length === 0 && <p className="text-muted">No cases are marked “Learning” in this set.</p>}
      <ul
        className={`grid gap-x-3 gap-y-2 ${wide ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-3 sm:grid-cols-4'}`}
        data-testid="print-grid"
      >
        {cases.map((c) => (
          <li key={c.id} className="flex break-inside-avoid items-center gap-2 border-b border-border py-1.5">
            <CaseDiagram
              {...diagramProps(set, c)}
              className={wide ? 'h-14 w-28 shrink-0' : 'h-14 w-14 shrink-0'}
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold">{c.name}</p>
              <p className="font-mono text-[11px] leading-snug break-words">{chosenAlg(c.id, choices)}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
