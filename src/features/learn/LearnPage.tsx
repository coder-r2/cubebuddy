import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useSettings } from '../../stores/settings';
import { NotationCourse } from './NotationCourse';
import { OnboardingQuiz } from './OnboardingQuiz';
import { LEVEL_NAMES, SUGGESTED_START } from './quiz';

function LearnContent({ startWithQuiz }: { startWithQuiz: boolean }) {
  const [quiz, setQuiz] = useState(startWithQuiz);
  const level = useSettings((s) => s.settings.level);

  if (quiz) return <OnboardingQuiz onFinish={() => setQuiz(false)} />;

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Welcome to speedcubing</h1>
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <p className="text-sm text-muted">Your level</p>
            <p className="text-lg font-semibold">{level ? LEVEL_NAMES[level] : 'Not set yet'}</p>
            {level && (
              <p className="text-sm text-muted">
                Suggested next step:{' '}
                <Link to={SUGGESTED_START[level].to} className="text-accent underline">
                  {SUGGESTED_START[level].title}
                </Link>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setQuiz(true)}
            className="h-11 shrink-0 rounded-lg border border-border px-4 font-medium hover:bg-surface-2"
          >
            {level ? 'Retake the quiz' : 'Take the quiz'}
          </button>
        </div>
        {(level === 1 || level === null) && (
          <div className="rounded-xl border border-accent/40 bg-accent/5 p-4">
            <p className="font-medium">Never solved a cube?</p>
            <p className="mt-1 text-sm text-muted">
              Learn the notation below, then solve your first cube with the{' '}
              <Link to="/tutorial/beginner" className="text-accent underline">
                beginner tutorial
              </Link>
              . Once you can, the CFOP tutorial takes you further.
            </p>
          </div>
        )}
      </header>

      <section id="notation" aria-labelledby="notation-title" className="scroll-mt-20 space-y-4">
        <div>
          <h2 id="notation-title" className="text-2xl font-semibold">
            Notation
          </h2>
          <p className="mt-1 max-w-prose text-muted">
            Cubers write moves as letters. Hold the cube with white on top and green in front, tap a move to
            see it on the cube, then try the quick quiz.
          </p>
        </div>
        <NotationCourse />
      </section>
    </div>
  );
}

export default function LearnPage() {
  const hydrated = useSettings((s) => s.hydrated);
  const onboardingDone = useSettings((s) => s.settings.onboardingDone);
  const [params] = useSearchParams();
  if (!hydrated) return null;
  const quiz = params.has('quiz') || !onboardingDone;
  return <LearnContent key={params.has('quiz') ? 'quiz' : 'learn'} startWithQuiz={quiz} />;
}
