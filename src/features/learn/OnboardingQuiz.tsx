import { useState } from 'react';
import { Link } from 'react-router';
import { SpeedPreview, SpeedSlider } from '../../components/SpeedControl';
import type { Level } from '../../db/types';
import { useSettings } from '../../stores/settings';
import {
  levelFor,
  LEVEL_NAMES,
  presetFor,
  SUGGESTED_START,
  type CanSolve,
  type LastLayer,
  type QuizAnswers,
  type TypicalTime,
} from './quiz';

type Step = 'solve' | 'lastLayer' | 'time' | 'speed' | 'done';

function Options<T extends string>({
  question,
  options,
  value,
  onPick,
}: {
  question: string;
  options: readonly (readonly [T, string])[];
  value?: T;
  onPick: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xl font-semibold">{question}</legend>
      <div className="mt-4 grid gap-2">
        {options.map(([option, label]) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            onClick={() => onPick(option)}
            className="min-h-12 rounded-xl border border-border bg-surface px-4 py-3 text-left font-medium hover:border-accent aria-pressed:border-accent aria-pressed:bg-surface-2"
          >
            {label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** First-visit quiz (SPEC §5.2, D-014): a few questions, then a preset bundle of settings. */
export function OnboardingQuiz({ onFinish }: { onFinish: () => void }) {
  const update = useSettings((s) => s.update);
  const [answers, setAnswers] = useState<Partial<QuizAnswers>>({});
  const [history, setHistory] = useState<Step[]>(['solve']);
  const [speed, setSpeed] = useState<number | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  const step = history.at(-1)!;
  const go = (next: Step) => setHistory((h) => [...h, next]);
  const back = () => setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
  const levelSoFar = answers.canSolve ? levelFor(answers as QuizAnswers) : 1;
  const chosenSpeed = speed ?? presetFor(levelSoFar).animationSpeed;

  const finish = async () => {
    const final = levelFor(answers as QuizAnswers);
    await update({ ...presetFor(final), animationSpeed: chosenSpeed, onboardingDone: true });
    setLevel(final);
    go('done');
  };

  const skip = async () => {
    await update({ onboardingDone: true });
    onFinish();
  };

  const total = answers.canSolve === 'no' ? 2 : answers.canSolve === 'cfop' ? 4 : 3;
  const number = Math.min(history.length, total);

  return (
    <section aria-label="Getting started quiz" className="mx-auto max-w-xl space-y-6">
      {step !== 'done' && (
        <div className="flex items-center justify-between gap-4 text-sm text-muted">
          <span>
            Question {number} of {total}
          </span>
          <div className="flex gap-1">
            {history.length > 1 && (
              <button type="button" onClick={back} className="h-10 rounded-lg px-3 hover:bg-surface-2">
                Back
              </button>
            )}
            <button type="button" onClick={skip} className="h-10 rounded-lg px-3 hover:bg-surface-2">
              Skip quiz
            </button>
          </div>
        </div>
      )}

      {step === 'solve' && (
        <Options<CanSolve>
          question="Can you solve a 3x3 Rubik’s cube?"
          value={answers.canSolve}
          options={[
            ['no', 'Not yet'],
            ['beginner', 'Yes, with a beginner method'],
            ['cfop', 'Yes, with CFOP'],
          ]}
          onPick={(canSolve) => {
            setAnswers({ canSolve });
            go(canSolve === 'cfop' ? 'lastLayer' : canSolve === 'beginner' ? 'time' : 'speed');
          }}
        />
      )}

      {step === 'lastLayer' && (
        <Options<LastLayer>
          question="How do you solve the last layer?"
          value={answers.lastLayer}
          options={[
            ['2-look', '2-look OLL and PLL'],
            ['some', 'Some full OLL / PLL cases'],
            ['full', 'Full OLL and PLL'],
          ]}
          onPick={(lastLayer) => {
            setAnswers((a) => ({ ...a, lastLayer }));
            go('time');
          }}
        />
      )}

      {step === 'time' && (
        <Options<TypicalTime>
          question="What’s your typical 3x3 time?"
          value={answers.time}
          options={[
            ['over-2m', 'Over 2 minutes'],
            ['1-2m', '1 to 2 minutes'],
            ['30-60s', '30 to 60 seconds'],
            ['under-30s', 'Under 30 seconds'],
          ]}
          onPick={(time) => {
            setAnswers((a) => ({ ...a, time }));
            go('speed');
          }}
        />
      )}

      {step === 'speed' && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Pick your animation speed</h2>
          <p className="text-muted">How fast the cube turns in demos, hints and tutorials.</p>
          <SpeedPreview speed={chosenSpeed} className="mx-auto h-44 w-44" />
          <SpeedSlider value={chosenSpeed} onChange={setSpeed} />
          <button
            type="button"
            onClick={() => void finish()}
            className="h-12 w-full rounded-xl bg-accent px-4 font-medium text-accent-contrast"
          >
            Finish
          </button>
        </div>
      )}

      {step === 'done' && level && (
        <div className="space-y-5" role="status">
          <div>
            <p className="text-sm text-muted">You’re set up as</p>
            <h2 className="text-2xl font-semibold" data-testid="quiz-level">
              {LEVEL_NAMES[level]}
            </h2>
          </div>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted">
            <li>
              Last-layer helpers: {presetFor(level).llMode === 'full' ? 'full OLL / PLL' : '2-look OLL / PLL'}
            </li>
            <li>
              F2L hints:{' '}
              {presetFor(level).f2lStyle === 'rotationless'
                ? 'no cube rotations'
                : 'rotate the pair to the front'}
            </li>
            <li>Timer inspection: {presetFor(level).inspection ? 'on' : 'off'}</li>
          </ul>
          <p className="text-sm text-muted">
            Change any of these in{' '}
            <Link to="/settings" className="text-accent underline">
              Settings
            </Link>
            .
          </p>
          <Link
            to={SUGGESTED_START[level].to}
            onClick={onFinish}
            className="block rounded-xl border border-accent bg-surface p-4 hover:bg-surface-2"
          >
            <span className="block text-sm text-muted">Suggested next step</span>
            <span className="block text-lg font-semibold">{SUGGESTED_START[level].title}</span>
            <span className="block text-sm text-muted">{SUGGESTED_START[level].text}</span>
          </Link>
          <button
            type="button"
            onClick={onFinish}
            className="h-10 text-sm text-muted underline hover:text-text"
          >
            Show me the notation course
          </button>
        </div>
      )}
    </section>
  );
}
