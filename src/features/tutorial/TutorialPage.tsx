import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { CubeView, type CubeViewHandle } from '../../components/CubeView/CubeView';
import { MovePad } from '../../components/MovePad';
import { Icon, type IconName } from '../../components/ui/Icon';
import type { Analysis, EngineStep, LblAnalysis } from '../../engine/api';
import { useCubeKeys } from '../../lib/useCubeKeys';
import { useHelperEngine, useHelperOptions } from '../../lib/useHelperEngine';
import { useSettings } from '../../stores/settings';
import { PlayOptionsDialog } from '../play/PlayOptionsDialog';
import { allowedOn2x2, moveDuration, normalise, useFreePlay } from '../play/useFreePlay';
import { nextScramble } from '../timer/scrambles';
import { CaseDialog } from './CaseDialog';
import { ScrambleForm } from './ScrambleForm';
import { SolutionPanel } from './SolutionPanel';
import { StageStepper } from './StageStepper';
import {
  COLOUR_NAMES,
  moveCount,
  PUZZLE_OF,
  solutionRows,
  stageGuide,
  stageIndex,
  STAGES,
  stepTitle,
  type Method,
} from './stages';

/*
 * Guided CFOP (3x3), Ortega (2x2) and beginner layer-by-layer (3x3) tutorials (SPEC §5.6–5.7, D-090, D-096). The cube is free to turn at any time;
 * after every change the engine works out the stage and the next step from the cube as it is. A step's
 * solution is a "plan": while the cube follows it move by move (by Play, Step or the user's own matching
 * moves) the plan stays; any other move drops it and a fresh one is computed, so the stepper also goes
 * backwards if solved parts get broken.
 */

interface Plan {
  /** Move sequence (from solved) the step starts from. */
  base: string;
  /** Settings the plan was made with; it's stale once they change. */
  key: string;
  analysis: Analysis | LblAnalysis;
  /** Null when solved. */
  step: EngineStep | null;
}

const join = (a: string, b: string) => (a && b ? `${a} ${b}` : a || b);

/** How many of the plan's moves the cube has made, or null if it has left the plan. */
function planPosition(plan: Plan, sequence: string): number | null {
  let s = plan.base;
  if (s === sequence) return 0;
  const moves = plan.step?.moves ?? [];
  for (let i = 0; i < moves.length; i++) {
    s = join(s, moves[i]!);
    if (s === sequence) return i + 1;
  }
  return null;
}

/** Steps whose case gets a popup with its diagram and alg. */
const CASE_KINDS = new Set<EngineStep['kind']>([
  'eo',
  'ocll',
  'oll',
  'cpll',
  'epll',
  'pll',
  'ortega-oll',
  'pbl',
]);

const COPY: Record<Method, { title: string; intro: string; next: { to: string; label: string } }> = {
  lbl: {
    title: 'Beginner tutorial',
    intro:
      'Learn to solve the cube layer by layer, the way most people learn first: the cross, the rest of the first layer, the middle layer, then the top in four short steps. Each step uses one short alg. At each stage you can ask for a hint, see the solution, or play it on the cube. You can also turn the cube yourself at any time.',
    next: { to: '/tutorial/cfop', label: 'Next: the CFOP tutorial' },
  },
  cfop: {
    title: 'CFOP tutorial',
    intro:
      'Learn CFOP by solving a real scramble one stage at a time: the cross, four F2L pairs, OLL and PLL. At each stage you can ask for a hint, see the solution, or play it on the cube. You can also turn the cube yourself at any time.',
    next: { to: '/trainer', label: 'Practise cases in the Trainer' },
  },
  ortega: {
    title: 'Ortega tutorial (2x2)',
    intro:
      'Learn the Ortega method by solving a real 2x2 scramble one stage at a time: one face, then OLL, then PBL. At each stage you can ask for a hint, see the solution, or play it on the cube. You can also turn the cube yourself at any time.',
    next: { to: '/trainer/ortega', label: 'Practise cases in the Trainer' },
  },
};

const buttonClass =
  'flex h-11 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm font-medium hover:bg-surface-2 disabled:opacity-50';

export function TutorialPage({ method }: { method: Method }) {
  const puzzle = PUZZLE_OF[method];
  const settings = useSettings((s) => s.settings);
  const tempo = settings.animationSpeed;
  const { engine, version } = useHelperEngine();
  const cube = useRef<CubeViewHandle>(null);
  const play = useFreePlay(cube);
  const { sequence, addMoves, undo, redo, reset } = play;

  const [scramble, setScramble] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [scrambleError, setScrambleError] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [hint, setHint] = useState<{ sequence: string; mask: string; label: string } | null>(null);
  const [revealedFor, setRevealedFor] = useState<Plan | null>(null);
  const [playing, setPlaying] = useState(false);
  const [caseOpen, setCaseOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [solution, setSolution] = useState<{
    key: string;
    from: 'scramble' | 'here';
    start: string;
    at: string;
    steps: EngineStep[];
  } | null>(null);
  const playback = useRef<{ timer: number; cancelled: boolean } | null>(null);

  const { options: helperOptions, key: helperKey } = useHelperOptions();
  const solveOptions = useMemo(
    () => ({ ...helperOptions, method: method === 'lbl' ? ('lbl' as const) : undefined }),
    [helperOptions, method],
  );
  const optionsKey = `${helperKey}|${version}`;

  const position = plan && plan.key === optionsKey ? planPosition(plan, sequence) : null;
  const step = plan?.step ?? null;
  const total = step?.moves.length ?? 0;
  const ready = scramble !== null && position !== null && (step ? position < total : true);
  const stage = scramble !== null && plan ? stageIndex(plan.analysis) : null;
  const solved = stage === STAGES[method].length - 1 && ready;
  const revealed = revealedFor !== null && revealedFor === plan;
  const mask = hint && hint.sequence === sequence ? hint : null;

  // Work out the stage and next step whenever the cube leaves the current plan (or finishes it).
  useEffect(() => {
    if (scramble === null || ready) return;
    let cancelled = false;
    const base = sequence;
    Promise.all([
      method === 'lbl' ? engine.analyseLbl(base, solveOptions) : engine.analyse(base, puzzle, solveOptions),
      engine.nextStep(base, puzzle, solveOptions),
    ])
      .then(([analysis, next]) => {
        if (!cancelled) setPlan({ base, key: optionsKey, analysis, step: next });
      })
      .catch((error: unknown) => console.error('[engine] tutorial step failed', error));
    return () => {
      cancelled = true;
    };
  }, [engine, method, puzzle, scramble, ready, sequence, solveOptions, optionsKey]);

  // The full solution for the scramble (recomputed if the settings change).
  const solutionKey = `${scramble}|${optionsKey}`;
  useEffect(() => {
    if (scramble === null) return;
    let cancelled = false;
    engine
      .solveAll(scramble, puzzle, solveOptions)
      .then((steps) => {
        if (!cancelled)
          setSolution({ key: solutionKey, from: 'scramble', start: scramble, at: scramble, steps });
      })
      .catch((error: unknown) => console.error('[engine] full solution failed', error));
    return () => {
      cancelled = true;
    };
  }, [engine, puzzle, scramble, solveOptions, solutionKey]);
  const currentSolution = solution?.key === solutionKey ? solution : null;

  const solveFromHere = async () => {
    const at = sequence;
    const steps = await engine.solveAll(at, puzzle, solveOptions);
    setSolution({ key: solutionKey, from: 'here', start: at, at, steps });
  };

  const stopPlay = useCallback(() => {
    if (playback.current) {
      playback.current.cancelled = true;
      clearTimeout(playback.current.timer);
      playback.current = null;
    }
    setPlaying(false);
  }, []);
  useEffect(() => stopPlay, [stopPlay]);

  const start = async (typed: string | null) => {
    stopPlay();
    setStarting(true);
    setScrambleError(false);
    try {
      const next = typed ?? (await nextScramble(puzzle));
      reset(next);
      setPlan(null);
      setHint(null);
      setScramble(next);
    } catch (error) {
      console.error('Scramble failed', error);
      setScrambleError(true);
    } finally {
      setStarting(false);
    }
  };

  const restart = () => {
    if (scramble === null) return;
    stopPlay();
    reset(scramble);
    setHint(null);
  };

  const newScramble = () => {
    stopPlay();
    reset('');
    setScramble(null);
    setPlan(null);
    setSolution(null);
    setHint(null);
  };

  const userMove = useCallback(
    (move: string) => {
      if (playing || scramble === null) return;
      if (puzzle === '2x2x2' && !allowedOn2x2(move)) return;
      addMoves([move], 'user', true);
    },
    [playing, scramble, puzzle, addMoves],
  );

  const stepForward = useCallback(() => {
    if (!ready || playing || !step || position === null) return;
    setRevealedFor(plan);
    addMoves([step.moves[position]!], 'helper', true);
  }, [ready, playing, step, position, plan, addMoves]);

  const stepBack = useCallback(() => {
    if (ready && !playing && position !== null && position > 0) undo();
  }, [ready, playing, position, undo]);

  const playStep = async () => {
    if (!ready || !step || position === null) return;
    setRevealedFor(plan);
    setPlaying(true);
    const state = { timer: 0, cancelled: false };
    playback.current = state;
    for (const move of step.moves.slice(position)) {
      if (state.cancelled) return;
      addMoves([move], 'helper', true);
      await new Promise<void>((resolve) => {
        state.timer = window.setTimeout(resolve, moveDuration(move) / tempo + 60);
      });
    }
    if (!state.cancelled) {
      playback.current = null;
      setPlaying(false);
    }
  };

  const showHint = async () => {
    const at = sequence;
    const result = await engine.findPieces(at, puzzle, solveOptions);
    // Pairs are named by colour in the tutorial ("The green–red pair") rather than by slot.
    const label =
      step?.kind === 'pair' && step.pairColours
        ? `The ${step.pairColours.map((c) => COLOUR_NAMES[c]).join('–')} pair`
        : result?.label;
    setHint(result ? { sequence: at, mask: result.mask, label: label ?? result.label } : null);
  };

  const onEscape = useCallback(() => (playing ? stopPlay() : setHint(null)), [playing, stopPlay]);
  const extraKeys = useMemo(
    () => ({ ArrowRight: stepForward, ArrowLeft: stepBack }),
    [stepForward, stepBack],
  );
  useCubeKeys({
    keymap: settings.keymap,
    onMove: userMove,
    onUndo: undo,
    onRedo: redo,
    onEscape,
    locked: playing || scramble === null,
    extra: extraKeys,
  });

  const { title, intro, next } = COPY[method];
  const hasHint = stage !== null && !solved && !(method === 'ortega' && stage >= 2);
  const ownMoves = play.log.some((e) => e.source === 'user');

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <div className="ml-auto flex items-center gap-1">
          {scramble !== null && (
            <button type="button" onClick={newScramble} className={buttonClass}>
              <Icon name="refresh" className="h-4 w-4" />
              New scramble
            </button>
          )}
          <button
            type="button"
            onClick={() => setOptionsOpen(true)}
            aria-label="Tutorial options"
            title="Tutorial options"
            className="grid h-11 w-11 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text"
          >
            <Icon name="sliders" />
          </button>
        </div>
      </div>

      {scramble !== null && <StageStepper stages={STAGES[method]} current={stage} />}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="space-y-3">
          <div className="relative rounded-2xl border border-border bg-surface">
            <CubeView
              ref={cube}
              puzzle={puzzle}
              interactive
              locked={playing || scramble === null}
              pressDirection={settings.tapDirection}
              onMove={(move) => {
                const normalised = normalise(move);
                if (normalised) addMoves([normalised], 'user', false);
              }}
              maskOrbits={mask?.mask}
              speed={tempo}
              label={`${puzzle === '3x3x3' ? '3x3' : '2x2'} cube — tap a sticker to turn its face`}
              className="mx-auto aspect-square max-h-[42dvh] w-full lg:max-h-[34rem]"
            />
            {playing && (
              <button
                type="button"
                onClick={stopPlay}
                className="absolute right-3 bottom-3 h-10 rounded-lg border border-border bg-surface px-3 text-sm"
              >
                Stop (Esc)
              </button>
            )}
          </div>
          {scramble !== null && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={undo}
                disabled={playing || play.log.length === 0}
                className={buttonClass}
              >
                Undo
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={playing || play.redoStack.length === 0}
                className={buttonClass}
              >
                Redo
              </button>
              <button type="button" onClick={restart} disabled={playing} className={buttonClass}>
                Restart scramble
              </button>
              <p
                data-testid="tutorial-scramble"
                className="w-full font-mono text-sm break-words text-muted sm:w-auto sm:flex-1 sm:text-right"
              >
                <span className="sr-only">Scramble: </span>
                {scramble}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {scramble === null ? (
            <div className="rounded-2xl border border-border bg-surface p-3 sm:p-4">
              <p className="text-sm text-muted">{intro}</p>
              <div className="mt-4">
                <ScrambleForm puzzle={puzzle} onStart={(s) => void start(s)} busy={starting} />
                {scrambleError && (
                  <p className="mt-2 text-sm text-danger">Couldn’t generate a scramble. Please try again.</p>
                )}
              </div>
            </div>
          ) : (
            <div
              className="rounded-2xl border border-border bg-surface p-3 sm:p-4"
              aria-busy={!ready}
              data-testid="stage-card"
            >
              {!plan || stage === null ? (
                <p className="text-muted">Working out the first step…</p>
              ) : solved ? (
                <SolvedCard moves={moveCount(play.log.map((e) => e.move))} next={next} onNew={newScramble} />
              ) : (
                <>
                  <p className="text-xs font-medium tracking-wide text-muted uppercase">
                    Stage {stage + 1} of {STAGES[method].length - 1} · {STAGES[method][stage]}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold" data-testid="step-title">
                    {step ? stepTitle(step, puzzle) : '…'}
                  </h2>
                  {step?.caseName && (
                    <p className="mt-1 text-sm">
                      <span className="text-muted">Case: </span>
                      <span className="font-medium" data-testid="case-name">
                        {step.caseName}
                      </span>
                    </p>
                  )}
                  {method === 'lbl' && step?.alg && (
                    <p className="mt-1 text-sm">
                      <span className="text-muted">Alg: </span>
                      <span className="font-mono font-medium" data-testid="step-alg">
                        {step.alg}
                      </span>
                    </p>
                  )}
                  <p className="mt-2 text-sm text-muted">
                    {stageGuide(method, stage, plan?.analysis.colour)}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {hasHint && (
                      <button
                        type="button"
                        onClick={() => void showHint()}
                        disabled={!ready || playing}
                        aria-pressed={!!mask}
                        className={`${buttonClass} aria-pressed:border-accent`}
                      >
                        <Icon name="lightbulb" className="h-4 w-4" />
                        Hint
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setRevealedFor(revealed ? null : plan)}
                      disabled={!ready || !step}
                      aria-pressed={revealed}
                      className={`${buttonClass} aria-pressed:border-accent`}
                    >
                      <Icon name="eye" className="h-4 w-4" />
                      {revealed ? 'Hide solution' : 'Show solution'}
                    </button>
                    {step?.caseId && CASE_KINDS.has(step.kind) && (
                      <button
                        type="button"
                        onClick={() => setCaseOpen(true)}
                        disabled={!ready || playing}
                        className={buttonClass}
                      >
                        Show case
                      </button>
                    )}
                  </div>
                  {mask && (
                    <p className="mt-2 text-sm" role="status">
                      <span className="font-medium">{mask.label}</span>
                      <span className="text-muted"> stay bright; the rest is greyed out until you move.</span>
                    </p>
                  )}

                  {step && (
                    <div className="mt-4 rounded-xl bg-surface-2 p-3">
                      {revealed ? (
                        <ol
                          aria-label="Solution moves"
                          data-testid="step-moves"
                          className="flex flex-wrap gap-1 font-mono text-sm"
                        >
                          {step.moves.map((move, i) => (
                            <li
                              key={i}
                              aria-current={i === position ? 'step' : undefined}
                              className={`min-w-8 rounded-md px-1.5 py-0.5 text-center ${
                                i === position
                                  ? 'bg-accent text-accent-contrast'
                                  : position !== null && i < position
                                    ? 'text-text'
                                    : 'text-muted'
                              }`}
                            >
                              {move}
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="text-sm text-muted">
                          Try it yourself, or reveal the solution ({moveCount(step.moves)}{' '}
                          {moveCount(step.moves) === 1 ? 'move' : 'moves'}).
                        </p>
                      )}
                      <div className="mt-3 flex items-center justify-center gap-2">
                        <RoundButton
                          icon="step-back"
                          label="Previous move"
                          onClick={stepBack}
                          disabled={!ready || playing || !position}
                        />
                        <button
                          type="button"
                          data-testid="play-step"
                          onClick={playing ? stopPlay : () => void playStep()}
                          disabled={!playing && !ready}
                          aria-label={playing ? 'Pause' : 'Play this step'}
                          className="grid h-12 w-12 place-items-center rounded-full bg-accent text-accent-contrast shadow-sm transition-transform active:scale-95 disabled:opacity-50"
                        >
                          <Icon name={playing ? 'pause' : 'play'} className="h-5 w-5" />
                        </button>
                        <RoundButton
                          icon="step-forward"
                          label="Next move"
                          onClick={stepForward}
                          disabled={!ready || playing}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {scramble !== null && (
            <div className="rounded-2xl border border-border bg-surface p-3 sm:p-4">
              <MovePad puzzle={puzzle} onMove={userMove} disabled={playing} />
            </div>
          )}

          {scramble !== null && (
            <SolutionPanel
              scramble={currentSolution?.start ?? scramble}
              rows={currentSolution && solutionRows(currentSolution.steps, puzzle)}
              from={currentSolution?.from ?? 'scramble'}
              onSolveFromHere={
                ownMoves && currentSolution && currentSolution.at !== sequence
                  ? () => void solveFromHere()
                  : undefined
              }
            />
          )}
        </div>
      </div>

      <CaseDialog
        step={caseOpen ? step : null}
        onClose={() => setCaseOpen(false)}
        onPlay={() => {
          setCaseOpen(false);
          void playStep();
        }}
      />
      <PlayOptionsDialog open={optionsOpen} onClose={() => setOptionsOpen(false)} title="Tutorial options" />
    </section>
  );
}

function SolvedCard({
  moves,
  next,
  onNew,
}: {
  moves: number;
  next: { to: string; label: string };
  onNew: () => void;
}) {
  return (
    <div className="space-y-3 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-success/15 text-success">
        <Icon name="check" className="h-6 w-6" />
      </div>
      <h2 className="text-xl font-semibold">Solved!</h2>
      <p className="text-sm text-muted">
        {moves} {moves === 1 ? 'move' : 'moves'} from the scramble, not counting cube rotations.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={onNew}
          className="h-11 rounded-lg bg-accent px-4 font-medium text-accent-contrast"
        >
          New scramble
        </button>
        <Link to={next.to} className={buttonClass}>
          {next.label}
        </Link>
      </div>
    </div>
  );
}

function RoundButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid h-10 w-10 place-items-center rounded-full text-text hover:bg-surface disabled:opacity-35"
    >
      <Icon name={icon} />
    </button>
  );
}
