import { useState } from 'react';
import { CaseDiagram } from '../../components/CaseDiagram';
import type { AlgCase, AlgSet } from '../../data/algs/types';
import { useTrainerStore } from '../../stores/trainer';
import { diagramProps } from './caseView';
import { pickCase } from './srs';

interface Question {
  caseId: string;
  auf: number;
  options: string[];
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Recognition drill (D-028): name the case from its diagram (random AUF), 4 options. */
function makeQuestion(set: AlgSet, ids: string[], previous?: string): Question | null {
  if (ids.length === 0) return null;
  const caseId = pickCase(ids, useTrainerStore.getState().stats, Math.random, previous);
  // Distractors come from the whole set so even a small selection gets four choices.
  const others = shuffle(set.cases.map((c) => c.id).filter((id) => id !== caseId)).slice(0, 3);
  // F2L diagrams aren't AUF-rotated (the slot view would move), last-layer ones are.
  const auf = set.diagram === 'f2l' ? 0 : Math.floor(Math.random() * 4);
  return { caseId, auf, options: shuffle([caseId, ...others]) };
}

/** Recognition drill (D-028): name the case from its diagram (random AUF), 4 options. Remount to reset. */
export function RecognitionDrill({ set, cases }: { set: AlgSet; cases: AlgCase[] }) {
  const recordRecognition = useTrainerStore((s) => s.recordRecognition);
  const ids = cases.map((c) => c.id);
  const [question, setQuestion] = useState<Question | null>(() => makeQuestion(set, ids));
  const [answer, setAnswer] = useState<string | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });

  const next = (previous?: string) => {
    setQuestion(makeQuestion(set, ids, previous));
    setAnswer(null);
  };

  if (cases.length === 0) {
    return <p className="text-muted">Select at least one case on the Cases tab (the “Train” checkboxes).</p>;
  }
  if (!question) return null;

  const target = set.cases.find((c) => c.id === question.caseId)!;
  const choose = (id: string) => {
    if (answer) return;
    const correct = id === question.caseId;
    setAnswer(id);
    setScore((s) => ({ right: s.right + (correct ? 1 : 0), total: s.total + 1 }));
    void recordRecognition(question.caseId, correct);
  };

  return (
    <div className="mx-auto max-w-xl space-y-4 text-center">
      <p className="text-sm text-muted" data-testid="recognition-score">
        {score.right} / {score.total} correct
      </p>
      <CaseDiagram
        {...diagramProps(set, target)}
        auf={question.auf}
        title="Which case is this?"
        className="mx-auto h-48 w-48"
      />
      <div className="grid grid-cols-2 gap-2">
        {question.options.map((id) => {
          const c = set.cases.find((x) => x.id === id)!;
          const state = !answer
            ? ''
            : id === question.caseId
              ? 'border-success bg-success/10'
              : id === answer
                ? 'border-danger bg-danger/10'
                : 'opacity-60';
          return (
            <button
              key={id}
              type="button"
              onClick={() => choose(id)}
              className={`min-h-12 rounded-lg border border-border bg-surface px-3 text-sm font-medium ${state}`}
            >
              {c.name}
            </button>
          );
        })}
      </div>
      {answer && (
        <div className="space-y-2">
          <p role="status" className={answer === question.caseId ? 'text-success' : 'text-danger'}>
            {answer === question.caseId ? 'Correct!' : `It was ${target.name}.`}
          </p>
          <button
            type="button"
            onClick={() => next(question.caseId)}
            className="h-11 rounded-lg bg-accent px-5 font-medium text-accent-contrast"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
