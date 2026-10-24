import { useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';

const ext = (href: string, children: ReactNode) => (
  <a href={href} target="_blank" rel="noreferrer" className="text-accent underline-offset-2 hover:underline">
    {children}
  </a>
);

const SOFTWARE: [string, string, string][] = [
  [
    'cubing.js',
    'https://js.cubing.net/cubing/',
    '3D cube, scrambles and the 3x3 random-state solver · MPL-2.0 or GPL-3.0',
  ],
  ['React', 'https://react.dev', 'User interface · MIT'],
  ['React Router', 'https://reactrouter.com', 'Pages · MIT'],
  ['Tailwind CSS', 'https://tailwindcss.com', 'Styling · MIT'],
  ['Zustand', 'https://github.com/pmndrs/zustand', 'App state · MIT'],
  ['Dexie.js', 'https://dexie.org', 'On-device storage · Apache-2.0'],
  ['uPlot', 'https://github.com/leeoniya/uPlot', 'Timer graph · MIT'],
  ['TanStack Virtual', 'https://tanstack.com/virtual', 'Long solve lists · MIT'],
  ['Comlink', 'https://github.com/GoogleChromeLabs/comlink', 'Background solver thread · Apache-2.0'],
];

/** About & credits (D-088): where the algorithms come from, and the open-source software CubeBuddy uses. */
export default function AboutPage() {
  // Links like /about#algorithms jump to their section.
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">About &amp; credits</h1>
        <p className="mt-1 text-muted">
          CubeBuddy is a free speedcubing companion for the 3x3 and 2x2: a timer, an algorithm trainer,
          free-play with solving hints and step-by-step tutorials. It runs entirely in your browser.
        </p>
      </header>

      <section id="algorithms" className="space-y-3">
        <h2 className="text-lg font-semibold">Where the algorithms come from</h2>
        <p>
          The algorithms are the ones speedcubers commonly use and teach, collected from public community
          resources. Every algorithm, including the ones you type in, is checked by CubeBuddy’s own cube model
          before it’s shown or accepted.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Full OLL and PLL:</strong> case numbers and names follow{' '}
            {ext('https://jperm.net/algs', 'J Perm’s algorithm sheets')}, and every case was checked to match
            the case of the same name there. All 57 main OLL algorithms and 17 of the 21 main PLL algorithms
            are the ones J Perm lists; the other four are widely used variants.
          </li>
          <li>
            <strong>2-look OLL and PLL, F2L Basic and Ortega:</strong> the standard algorithms found in common
            beginner and intermediate tutorials, such as {ext('https://jperm.net', 'jperm.net')} and the{' '}
            {ext('https://www.speedsolving.com/wiki/', 'SpeedSolving.com wiki')}. F2L case numbers are
            CubeBuddy’s own order, as F2L numbering differs between sources.
          </li>
          <li>
            <strong>CLL, F2L Advanced and two F2L Basic cases:</strong> found by CubeBuddy’s solver and marked
            as such in the trainer. F2L algorithms only use “pair up, then insert” moves, so they never break
            the cross. You can replace any algorithm with your own.
          </li>
        </ul>
        <p className="text-sm text-muted">
          Spotted an algorithm you think is wrong or know a better one? Use “My own alg” in the case popup;
          it’s checked before it’s saved.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Other credits</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Timer import and export use the session format of {ext('https://cstimer.net', 'csTimer')}, so you
            can move your solves between the two.
          </li>
          <li>
            Inspection penalties follow the WCA Regulations (over 15 seconds: +2; over 17 seconds: DNF).
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Open-source software</h2>
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {SOFTWARE.map(([name, href, what]) => (
            <li
              key={name}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-4 py-2.5"
            >
              {ext(href, name)}
              <span className="text-sm text-muted">{what}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-sm text-muted">
        <Link to="/" className="text-accent hover:underline">
          ← Home
        </Link>
      </p>
    </article>
  );
}
