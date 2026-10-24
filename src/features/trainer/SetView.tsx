import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { CaseDiagram } from '../../components/CaseDiagram';
import type { ProgressState } from '../../db/types';
import type { AlgCase, AlgSet } from '../../data/algs/types';
import { chosenAlg, useTrainerStore } from '../../stores/trainer';
import { CasePopup } from './CasePopup';
import { diagramProps } from './caseView';
import { ProgressBar, ProgressControl } from './ProgressBar';
import { RecognitionDrill } from './RecognitionDrill';
import { TimedDrill } from './TimedDrill';
import { useTrainSelection } from './useTrainSelection';

type Tab = 'cases' | 'timed' | 'recognition';
type Filter = 'all' | ProgressState;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'none', label: 'Not started' },
  { value: 'learning', label: 'Learning' },
  { value: 'learned', label: 'Learned' },
];

function CaseCard({
  set,
  algCase,
  selected,
  onToggle,
  onOpen,
}: {
  set: AlgSet;
  algCase: AlgCase;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const choices = useTrainerStore((s) => s.choices);
  const progress = useTrainerStore((s) => s.progress[algCase.id] ?? 'none');
  const setProgress = useTrainerStore((s) => s.setProgress);
  const alg = chosenAlg(algCase.id, choices);

  return (
    <li
      className={`flex flex-col rounded-xl border bg-surface p-3 ${
        progress === 'learned'
          ? 'border-success/60'
          : progress === 'learning'
            ? 'border-accent/60'
            : 'border-border'
      }`}
      data-testid="case-card"
    >
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={onOpen} className="text-left font-medium hover:underline">
          {algCase.name}
        </button>
        <label className="flex items-center gap-1 text-xs text-muted">
          <input type="checkbox" checked={selected} onChange={onToggle} className="h-4 w-4 accent-accent" />
          Train
        </label>
      </div>
      <button type="button" onClick={onOpen} aria-label={`Open ${algCase.name}`} className="mx-auto my-2">
        <CaseDiagram
          {...diagramProps(set, algCase)}
          className={
            diagramProps(set, algCase).kind === 'pbl' || diagramProps(set, algCase).backView
              ? 'h-24 w-48'
              : 'h-24 w-24'
          }
        />
      </button>
      <p className="font-mono text-sm break-words" data-testid="case-alg">
        {alg}
      </p>
      <div className="mt-auto pt-2">
        <ProgressControl value={progress} onChange={(state) => void setProgress(algCase.id, state)} compact />
      </div>
    </li>
  );
}

export function SetView({ set }: { set: AlgSet }) {
  const progress = useTrainerStore((s) => s.progress);
  const [tab, setTab] = useState<Tab>('cases');
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const { selected, toggle, setAll } = useTrainSelection(set, progress);

  const learned = set.cases.filter((c) => progress[c.id] === 'learned').length;
  const learning = set.cases.filter((c) => progress[c.id] === 'learning').length;
  const visible = set.cases.filter((c) => filter === 'all' || (progress[c.id] ?? 'none') === filter);
  const groups = useMemo(() => {
    const map = new Map<string, AlgCase[]>();
    for (const c of visible) map.set(c.group ?? '', [...(map.get(c.group ?? '') ?? []), c]);
    return [...map];
  }, [visible]);
  const trainCases = set.cases.filter((c) => selected.has(c.id));
  // Drills restart when the selection changes.
  const trainKey = trainCases.map((c) => c.id).join();

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/trainer" className="text-sm text-muted hover:text-text">
            ← All sets
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{set.name}</h1>
          <p className="text-muted">{set.description}</p>
        </div>
        <Link
          to={`/trainer/${set.id}/print`}
          className="h-10 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-surface-2"
        >
          Print sheet
        </Link>
      </div>
      <ProgressBar total={set.cases.length} learned={learned} learning={learning} className="max-w-md" />

      <div role="tablist" aria-label="Trainer mode" className="flex gap-1 border-b border-border">
        {(
          [
            ['cases', 'Cases'],
            ['timed', 'Timed drill'],
            ['recognition', 'Recognition drill'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className="-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted aria-selected:border-accent aria-selected:text-text"
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'cases' && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                aria-pressed={filter === f.value}
                onClick={() => setFilter(f.value)}
                className="h-8 rounded-full border border-border px-3 text-sm text-muted aria-pressed:border-accent aria-pressed:text-text"
              >
                {f.label}
              </button>
            ))}
            <span className="ml-auto text-sm text-muted">
              {trainCases.length} selected for drills ·{' '}
              <button type="button" className="underline" onClick={() => setAll(set.cases.map((c) => c.id))}>
                all
              </button>{' '}
              ·{' '}
              <button type="button" className="underline" onClick={() => setAll([])}>
                none
              </button>
            </span>
          </div>
          {visible.length === 0 && <p className="text-muted">No cases match this filter.</p>}
          {groups.map(([group, cases]) => (
            <div key={group} className="space-y-2">
              {group && <h2 className="text-xs font-medium tracking-wide text-muted uppercase">{group}</h2>}
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {cases.map((c) => (
                  <CaseCard
                    key={c.id}
                    set={set}
                    algCase={c}
                    selected={selected.has(c.id)}
                    onToggle={() => toggle(c.id)}
                    onOpen={() => setOpenId(c.id)}
                  />
                ))}
              </ul>
            </div>
          ))}
        </>
      )}
      {tab === 'timed' && <TimedDrill key={trainKey} set={set} cases={trainCases} />}
      {tab === 'recognition' && <RecognitionDrill key={trainKey} set={set} cases={trainCases} />}

      <CasePopup set={set} caseId={openId} onClose={() => setOpenId(null)} />
    </section>
  );
}
