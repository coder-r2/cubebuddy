import { Link } from 'react-router';
import { CaseDiagram } from '../../components/CaseDiagram';
import { ALG_SETS } from '../../data/algs/sets';
import type { AlgSet } from '../../data/algs/types';
import { useTrainerStore } from '../../stores/trainer';
import { diagramProps } from './caseView';
import { ProgressBar } from './ProgressBar';

// A representative case for each set's card.
const PREVIEW: Record<string, string> = {
  'oll-2look': '2lo-sune',
  'pll-2look': '2lp-ua',
  f2l: 'f2l-10',
  oll: 'oll-45',
  pll: 'pll-t',
  'f2l-advanced': 'f2l-adv-bl-1',
  ortega: 'ortega-oll-sune',
  cll: 'cll-sune-1',
};

function SetCard({ set }: { set: AlgSet }) {
  const progress = useTrainerStore((s) => s.progress);
  const learned = set.cases.filter((c) => progress[c.id] === 'learned').length;
  const learning = set.cases.filter((c) => progress[c.id] === 'learning').length;
  const preview = set.cases.find((c) => c.id === PREVIEW[set.id]) ?? set.cases[0]!;

  return (
    <Link
      to={`/trainer/${set.id}`}
      className="flex gap-4 rounded-2xl border border-border bg-surface p-4 hover:border-accent"
    >
      <CaseDiagram
        {...diagramProps(set, preview)}
        title={`${set.name} example`}
        className="h-20 w-20 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold">{set.name}</h2>
        <p className="mt-0.5 text-sm text-muted">{set.description}</p>
        <ProgressBar total={set.cases.length} learned={learned} learning={learning} className="mt-3" />
      </div>
    </Link>
  );
}

export function SetPicker() {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Algorithm trainer</h1>
        <p className="mt-1 text-muted">
          Pick a set to browse its cases, choose your algs, track what you’ve learned and drill them.{' '}
          <Link to="/about#algorithms" className="text-accent hover:underline">
            Where the algorithms come from
          </Link>
        </p>
      </div>
      {(['3x3x3', '2x2x2'] as const).map((puzzle) => (
        <div key={puzzle} className="space-y-3">
          <h2 className="text-xs font-medium tracking-wide text-muted uppercase">
            {puzzle === '3x3x3' ? '3x3' : '2x2'}
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {ALG_SETS.filter((s) => s.puzzle === puzzle).map((set) => (
              <SetCard key={set.id} set={set} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
