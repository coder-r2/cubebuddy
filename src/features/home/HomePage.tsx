import { useRef } from 'react';
import { Link } from 'react-router';
import { CubeView, type CubeViewHandle } from '../../components/CubeView/CubeView';
import { Icon, type IconName } from '../../components/ui/Icon';
import { useSettings } from '../../stores/settings';
import { useIdleMoves } from './useIdleMoves';

interface Feature {
  to: string;
  title: string;
  description: string;
  icon: IconName;
}

const FEATURES: Feature[] = [
  {
    to: '/timer',
    title: 'Timer',
    description: 'WCA scrambles, inspection, sessions and Ao5–Ao100 stats.',
    icon: 'timer',
  },
  {
    to: '/play',
    title: 'Free-play',
    description: 'A virtual 3x3 or 2x2 with hints for your next step.',
    icon: 'cube',
  },
  {
    to: '/trainer',
    title: 'Algorithm trainer',
    description: 'F2L, OLL, PLL, Ortega and CLL with demos and drills.',
    icon: 'target',
  },
  {
    to: '/tutorial/cfop',
    title: 'CFOP tutorial',
    description: 'Solve any scramble step by step: cross, F2L, OLL, PLL.',
    icon: 'route',
  },
  {
    to: '/learn',
    title: 'Learn notation',
    description: 'What R, U′, M2 and friends mean, with a live cube.',
    icon: 'book',
  },
];

/** First-visit prompt for the onboarding quiz (SPEC §5.1, §5.2); "No thanks" counts as skipping it. */
function QuizPrompt() {
  const hydrated = useSettings((s) => s.hydrated);
  const done = useSettings((s) => s.settings.onboardingDone);
  const update = useSettings((s) => s.update);
  if (!hydrated || done) return null;
  return (
    <section
      aria-label="Get started"
      className="flex flex-col gap-3 rounded-xl border border-accent/40 bg-accent/5 p-4 sm:flex-row sm:items-center"
    >
      <div className="flex-1">
        <p className="font-semibold">New here?</p>
        <p className="text-sm text-muted">
          Answer four quick questions and CubeBuddy sets itself up for your level: hints, speed and timer.
        </p>
      </div>
      <div className="flex gap-2">
        <Link
          to="/learn"
          className="inline-flex h-11 items-center rounded-lg bg-accent px-4 font-medium text-accent-contrast"
        >
          Take the quiz
        </Link>
        <button
          type="button"
          onClick={() => void update({ onboardingDone: true })}
          className="h-11 rounded-lg px-3 text-sm text-muted hover:bg-surface-2 hover:text-text"
        >
          No thanks
        </button>
      </div>
    </section>
  );
}

export default function HomePage() {
  const cube = useRef<CubeViewHandle>(null);
  const onboardingDone = useSettings((s) => s.settings.onboardingDone);
  useIdleMoves(cube);

  return (
    <div className="space-y-12">
      <QuizPrompt />
      <section className="grid items-center gap-8 md:grid-cols-2">
        <div className="order-2 space-y-4 md:order-1">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Your speedcubing buddy</h1>
          <p className="max-w-prose text-lg text-muted">
            Time your solves, learn algorithms and walk through CFOP on an interactive cube — free, in your
            browser, on any device.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/learn"
              className="rounded-lg bg-accent px-5 py-3 font-medium text-accent-contrast hover:opacity-90"
            >
              {onboardingDone ? 'Learn notation' : 'Take the quiz'}
            </Link>
            <Link
              to="/timer"
              className="rounded-lg border border-border px-5 py-3 font-medium hover:bg-surface-2"
            >
              Start timing
            </Link>
          </div>
        </div>
        <CubeView
          ref={cube}
          idle="hover"
          speed={0.6}
          orbit={false}
          hints={false}
          label="A 3D cube slowly making random moves"
          className="order-1 mx-auto aspect-square w-full max-w-sm md:order-2 md:max-w-md"
        />
      </section>

      <section aria-labelledby="features" className="space-y-4">
        <h2 id="features" className="text-xl font-semibold">
          What you can do
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <li key={feature.to}>
              <Link
                to={feature.to}
                className="flex h-full gap-3 rounded-xl border border-border bg-surface p-4 hover:border-accent"
              >
                <Icon name={feature.icon} className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                <span>
                  <span className="block font-medium">{feature.title}</span>
                  <span className="block text-sm text-muted">{feature.description}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
