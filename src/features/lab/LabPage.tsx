import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CubeView, type CubeViewHandle } from '../../components/CubeView/CubeView';
import { isWebGLAvailable } from '../../components/CubeView/webgl';

/**
 * Unlisted diagnostics page (/lab) for the P0 technical spikes. Open it on a phone/tablet to check
 * that click-to-turn, highlighting and cubing.js workers behave on real devices.
 */

type Status = 'pending' | 'pass' | 'fail';

function Badge({ status }: { status: Status }) {
  const style = {
    pending: 'bg-surface-2 text-muted',
    pass: 'bg-success/15 text-success',
    fail: 'bg-danger/15 text-danger',
  }[status];
  return (
    <span
      data-status={status}
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${style}`}
    >
      {status}
    </span>
  );
}

function Spike({
  id,
  title,
  status,
  children,
}: {
  id: string;
  title: string;
  status: Status;
  children: ReactNode;
}) {
  return (
    <section data-spike={id} className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        <Badge status={status} />
      </div>
      {children}
    </section>
  );
}

// Piece order follows cubing.js's 3x3x3 KPuzzle definition.
// EDGES: UF UR UB UL DF DR DB DL FR FL BR BL · CORNERS: UFR URB UBL ULF DRF DFL DLB DBR · CENTERS: U L F R B D
const CROSS_PLUS_FR_PAIR = 'EDGES:DDDD-----DDD,CORNERS:DDDD-DDD,CENTERS:------';
const MASKS = [
  { label: 'Cross + FR pair (per-piece)', orbits: CROSS_PLUS_FR_PAIR },
  { label: 'OLL preset', preset: 'OLL' },
  { label: 'PLL preset', preset: 'PLL' },
  { label: 'F2L preset', preset: 'F2L' },
  { label: 'Full', preset: 'full' },
];

const SUNE = "R U R' U R U2 R'";
const T_PERM = "R U R' U' R' F R2 U' R' U' R U R' F'";

function ClickToTurnSpike() {
  const [moves, setMoves] = useState<string[]>([]);
  const cube = useRef<CubeViewHandle>(null);
  return (
    <Spike id="move-press" title="a. Click / tap to turn" status={moves.length > 0 ? 'pass' : 'pending'}>
      <p className="text-sm text-muted">
        Tap or click a sticker to turn its face. cubing.js turns anticlockwise on a tap / left-click and
        clockwise on a right-click; Shift turns the slice, Ctrl/⌘ rotates the whole cube. Drag empty space to
        rotate the view.
      </p>
      <CubeView
        ref={cube}
        interactive
        onMove={(m) => setMoves((prev) => [...prev, m])}
        className="aspect-square max-w-xs"
      />
      <div className="flex items-center gap-2">
        <code
          data-testid="move-log"
          className="min-h-6 flex-1 rounded bg-surface-2 px-2 py-1 text-sm break-all"
        >
          {moves.join(' ') || '—'}
        </code>
        <button
          type="button"
          className="rounded-lg border border-border px-3 py-1 text-sm"
          onClick={() => {
            cube.current?.reset();
            setMoves([]);
          }}
        >
          Reset
        </button>
      </div>
    </Spike>
  );
}

function HighlightSpike() {
  const [index, setIndex] = useState(0);
  const mask = MASKS[index] ?? MASKS[0]!;
  return (
    <Spike id="highlight" title="b. Per-piece highlight & stickering presets" status="pending">
      <p className="text-sm text-muted">
        Check visually: the first option should show only the D-layer cross edges and the front-right
        corner/edge pair in full colour, everything else dimmed.
      </p>
      <div className="flex flex-wrap gap-2">
        {MASKS.map((m, i) => (
          <button
            key={m.label}
            type="button"
            onClick={() => setIndex(i)}
            className={`rounded-lg border px-3 py-1 text-sm ${i === index ? 'border-accent text-accent' : 'border-border'}`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <CubeView
        mask={mask.preset}
        maskOrbits={mask.orbits}
        setup={mask.preset === 'OLL' || mask.preset === 'PLL' ? `(${SUNE})'` : ''}
        className="aspect-square max-w-xs"
      />
    </Spike>
  );
}

function SetupScrambleSpike() {
  const [result, setResult] = useState<{ status: Status; detail: string }>({
    status: 'pending',
    detail: 'Running…',
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const started = performance.now();
      const [{ Alg }, { cube3x3x3 }, { experimentalSolve3x3x3IgnoringCenters }] = await Promise.all([
        import('cubing/alg'),
        import('cubing/puzzles'),
        import('cubing/search'),
      ]);
      const kpuzzle = await cube3x3x3.kpuzzle();
      const solved = kpuzzle.defaultPattern();
      // Solving the bare case state gives back the inverse alg (it's optimal), revealing the answer.
      // Randomising what OLL doesn't care about (LL permutation) forces an unrelated-looking setup (D-055).
      const llPermutation = T_PERM;
      const casePattern = solved.applyAlg(llPermutation).applyAlg(new Alg(SUNE).invert());
      const setup = (await experimentalSolve3x3x3IgnoringCenters(casePattern)).invert();
      const reachesCase = solved.applyAlg(setup).isIdentical(casePattern);
      // After the setup, Sune must orient the LL and leave F2L intact (only the LL permutation remains).
      const sunesItOut = solved.applyAlg(setup).applyAlg(SUNE).isIdentical(solved.applyAlg(llPermutation));
      const revealsAlg = setup.toString() === new Alg(SUNE).invert().toString();
      const ms = Math.round(performance.now() - started);
      const ok = reachesCase && sunesItOut && !revealsAlg;
      if (!cancelled)
        setResult({
          status: ok ? 'pass' : 'fail',
          detail: `Setup for the Sune case (${ms} ms): ${setup.toString()} — reaches case: ${reachesCase}, Sune orients LL: ${sunesItOut}, reveals alg: ${revealsAlg}`,
        });
    })().catch((error: unknown) => !cancelled && setResult({ status: 'fail', detail: String(error) }));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Spike id="setup-scramble" title="c. Case setup scramble (cubing/search)" status={result.status}>
      <p data-testid="setup-detail" className="font-mono text-sm break-words">
        {result.detail}
      </p>
    </Spike>
  );
}

function ScrambleWorkerSpike() {
  const [result, setResult] = useState<{ status: Status; s333?: string; s222?: string; detail: string }>({
    status: 'pending',
    detail: 'Generating…',
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { randomScrambleForEvent } = await import('cubing/scramble');
      const t0 = performance.now();
      const s333 = (await randomScrambleForEvent('333')).toString();
      const t1 = performance.now();
      const s222 = (await randomScrambleForEvent('222')).toString();
      const t2 = performance.now();
      if (!cancelled)
        setResult({
          status: s333.length > 0 && s222.length > 0 ? 'pass' : 'fail',
          s333,
          s222,
          detail: `3x3 in ${Math.round(t1 - t0)} ms, 2x2 in ${Math.round(t2 - t1)} ms`,
        });
    })().catch((error: unknown) => !cancelled && setResult({ status: 'fail', detail: String(error) }));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Spike id="scramble-worker" title="d. Random-state scrambles (cubing.js workers)" status={result.status}>
      <p className="text-sm text-muted">{result.detail}</p>
      {result.s333 && (
        <>
          <p data-testid="scramble-333" className="font-mono text-sm">
            3x3: {result.s333}
          </p>
          <p className="font-mono text-sm">2x2: {result.s222}</p>
          <CubeView
            view="2D"
            setup={result.s333}
            className="h-48 max-w-xs"
            label="2D preview of the 3x3 scramble"
          />
        </>
      )}
    </Spike>
  );
}

function EnvironmentInfo() {
  const rows: [string, string][] = [
    ['WebGL', isWebGLAvailable() ? 'yes' : 'no'],
    ['Touch points', String(navigator.maxTouchPoints)],
    ['Viewport', `${window.innerWidth} × ${window.innerHeight} @${window.devicePixelRatio}x`],
    ['Base URL', import.meta.env.BASE_URL],
    ['User agent', navigator.userAgent],
  ];
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-2 font-semibold">Environment</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="break-all">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function LabPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Lab · P0 spikes</h1>
      <div className="grid gap-4 lg:grid-cols-2">
        <ClickToTurnSpike />
        <HighlightSpike />
        <SetupScrambleSpike />
        <ScrambleWorkerSpike />
      </div>
      <EnvironmentInfo />
    </div>
  );
}
