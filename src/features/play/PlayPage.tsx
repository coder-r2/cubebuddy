import { useCallback, useEffect, useRef, useState } from 'react';
import { CubeView, type CubeViewHandle } from '../../components/CubeView/CubeView';
import { MovePad } from '../../components/MovePad';
import { Icon } from '../../components/ui/Icon';
import type { Puzzle } from '../../db/types';
import type { Analysis, EngineStep } from '../../engine/api';
import { useCubeKeys } from '../../lib/useCubeKeys';
import { COLOUR_NAMES } from '../../engine/colourSets';
import { useHelperEngine, useHelperOptions } from '../../lib/useHelperEngine';
import { useSettings } from '../../stores/settings';
import { nextScramble } from '../timer/scrambles';
import { HistoryPanel } from './HistoryPanel';
import { PlayOptionsDialog } from './PlayOptionsDialog';
import { allowedOn2x2, moveDuration, normalise, useFreePlay } from './useFreePlay';

const PUZZLE_KEY = 'cubebuddy:play:puzzle';

function storedPuzzle(): Puzzle {
  try {
    return localStorage.getItem(PUZZLE_KEY) === '2x2x2' ? '2x2x2' : '3x3x3';
  } catch {
    return '3x3x3';
  }
}

interface HelperButtons {
  status: string;
  find?: string;
  show?: string;
  solve?: string;
}

function helperButtons(analysis: Analysis | null, llMode: string): HelperButtons {
  if (!analysis) return { status: 'Analysing…' };
  const colour = COLOUR_NAMES[analysis.colour]!;
  if (analysis.puzzle === '2x2x2') {
    const r = analysis.report;
    switch (r.stage) {
      case 'face':
        return {
          status: `First face (${colour}) not made yet`,
          find: 'Find face pieces',
          solve: 'Solve face',
        };
      case 'oll':
        return { status: 'Face ✓ · top not oriented', show: 'Show OLL case', solve: 'Solve OLL' };
      case 'pbl':
        return { status: 'OLL ✓ · layers not permuted', show: 'Show PBL case', solve: 'Solve PBL' };
      case 'auf':
        return { status: 'Just a U turn left', solve: 'Solve (AUF)' };
      default:
        return { status: 'Solved!' };
    }
  }
  const r = analysis.report;
  const twoLook = llMode === '2-look';
  switch (r.stage) {
    case 'cross':
      return {
        status: `${colour[0]!.toUpperCase()}${colour.slice(1)} cross not solved`,
        find: 'Find cross',
        solve: 'Solve cross',
      };
    case 'f2l':
      return {
        status: `Cross ✓ · ${r.solvedPairs.length}/4 F2L pairs`,
        find: 'Find next F2L pair',
        solve: 'Solve next F2L pair',
      };
    case 'oll':
      return {
        status: 'F2L ✓ · last layer not oriented',
        show: 'Show OLL case',
        solve: twoLook ? (r.llEdgesOriented ? 'Orient corners' : 'Orient edges') : 'Solve OLL',
      };
    case 'pll':
      return {
        status: 'OLL ✓ · last layer not permuted',
        show: 'Show PLL case',
        solve: twoLook ? (r.llCornersPermuted ? 'Permute edges' : 'Permute corners') : 'Solve PLL',
      };
    case 'auf':
      return { status: 'Just a U turn left', solve: 'Solve (AUF)' };
    default:
      return { status: 'Solved!' };
  }
}

export default function PlayPage() {
  const settings = useSettings((s) => s.settings);
  const [puzzle, setPuzzle] = useState<Puzzle>(storedPuzzle);
  const cube = useRef<CubeViewHandle>(null);
  const play = useFreePlay(cube);
  const { sequence, addMoves, undo, redo, reset } = play;
  const { engine } = useHelperEngine();

  const [analysis, setAnalysis] = useState<{ sequence: string; puzzle: Puzzle; value: Analysis } | null>(
    null,
  );
  const [mask, setMask] = useState<string | undefined>();
  const [info, setInfo] = useState<{ title: string; detail?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const playback = useRef<{ timer: number; cancelled: boolean } | null>(null);
  const tempo = settings.animationSpeed;
  const { options: solveOptions } = useHelperOptions();

  // Re-analyse after every change (SPEC §5.3); stale answers are ignored.
  useEffect(() => {
    let cancelled = false;
    engine
      .analyse(sequence, puzzle, solveOptions)
      .then((value) => !cancelled && setAnalysis({ sequence, puzzle, value }))
      .catch((error: unknown) => console.error('[engine] analyse failed', error));
    return () => {
      cancelled = true;
    };
  }, [engine, sequence, puzzle, solveOptions]);

  const current =
    analysis && analysis.sequence === sequence && analysis.puzzle === puzzle ? analysis.value : null;
  // While a helper plays, intermediate states (an alg briefly breaking F2L) shouldn't flash other buttons.
  const buttons: HelperButtons = busy
    ? { status: info ? `Playing: ${info.title}…` : 'Working…' }
    : helperButtons(current, settings.llMode);

  /** Any new move clears highlights and case info. */
  const record = useCallback(
    (moves: string[], source: 'user' | 'helper', animate: boolean) => {
      setMask(undefined);
      if (source === 'user') setInfo(null);
      addMoves(moves, source, animate);
    },
    [addMoves],
  );

  const userMove = useCallback(
    (move: string) => {
      if (busy) return;
      if (puzzle === '2x2x2' && !allowedOn2x2(move)) return;
      record([move], 'user', true);
    },
    [busy, puzzle, record],
  );

  const cancelPlayback = useCallback(() => {
    if (playback.current) {
      playback.current.cancelled = true;
      clearTimeout(playback.current.timer);
      playback.current = null;
    }
    setBusy(false);
  }, []);

  const runHelper = useCallback(
    async (step: EngineStep) => {
      setInfo({
        title: step.caseName ? `${step.label}: ${step.caseName}` : step.label,
        detail: step.moves.join(' '),
      });
      setBusy(true);
      const state = { timer: 0, cancelled: false };
      playback.current = state;
      for (const move of step.moves) {
        if (state.cancelled) return;
        record([move], 'helper', true);
        await new Promise<void>((resolve) => {
          state.timer = window.setTimeout(resolve, moveDuration(move) / tempo + 60);
        });
      }
      if (!state.cancelled) {
        playback.current = null;
        setBusy(false);
      }
    },
    [record, tempo],
  );

  const onSolve = async () => {
    // Lock input straight away so no move sneaks in while the engine is thinking.
    setBusy(true);
    const step = await engine.nextStep(sequence, puzzle, solveOptions).catch(() => null);
    if (step) await runHelper(step);
    else setBusy(false);
  };

  const onFind = async () => {
    const hint = await engine.findPieces(sequence, puzzle, solveOptions);
    if (!hint) return;
    setMask(hint.mask);
    setInfo({ title: hint.label, detail: 'Highlighted pieces stay bright; make a move to clear.' });
  };

  const onShow = async () => {
    const step = await engine.nextStep(sequence, puzzle, solveOptions);
    if (!step) return;
    setInfo({
      title: step.caseName ? `${step.label}: ${step.caseName}` : step.label,
      detail: step.alg ? `Alg: ${step.alg}` : undefined,
    });
  };

  const onScramble = async () => {
    cancelPlayback();
    setInfo(null);
    setMask(undefined);
    reset(await nextScramble(puzzle));
  };

  const onReset = () => {
    cancelPlayback();
    setInfo(null);
    setMask(undefined);
    reset('');
  };

  const changePuzzle = (next: Puzzle) => {
    cancelPlayback();
    setInfo(null);
    setMask(undefined);
    setPuzzle(next);
    reset('');
    try {
      localStorage.setItem(PUZZLE_KEY, next);
    } catch {
      // Remembering the puzzle is a convenience only.
    }
  };

  const onEscape = useCallback(() => {
    if (busy) cancelPlayback();
    else {
      setMask(undefined);
      setInfo(null);
    }
  }, [busy, cancelPlayback]);
  useCubeKeys({
    keymap: settings.keymap,
    onMove: userMove,
    onUndo: undo,
    onRedo: redo,
    onEscape,
    locked: busy,
  });

  useEffect(() => cancelPlayback, [cancelPlayback]);

  const helperClass =
    'h-11 rounded-lg px-4 text-sm font-medium disabled:opacity-50 border border-border bg-surface hover:bg-surface-2';

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Free-play</h1>
        <div
          role="group"
          aria-label="Puzzle"
          className="inline-flex rounded-lg border border-border bg-surface p-0.5"
        >
          {(['3x3x3', '2x2x2'] as const).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={puzzle === p}
              onClick={() => changePuzzle(p)}
              className="h-9 rounded-md px-3 text-sm font-medium text-muted aria-pressed:bg-surface-2 aria-pressed:text-text"
            >
              {p === '3x3x3' ? '3x3' : '2x2'}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setOptionsOpen(true)}
          aria-label="Free-play options"
          title="Free-play options"
          className="ml-auto grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text"
        >
          <Icon name="sliders" />
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="space-y-3">
          <div className="relative rounded-2xl border border-border bg-surface">
            <CubeView
              ref={cube}
              puzzle={puzzle}
              interactive
              locked={busy}
              pressDirection={settings.tapDirection}
              onMove={(move) => {
                const normalised = normalise(move);
                if (normalised) record([normalised], 'user', false);
              }}
              maskOrbits={mask}
              speed={tempo}
              label={`${puzzle === '3x3x3' ? '3x3' : '2x2'} cube — tap a sticker to turn its face`}
              className="mx-auto aspect-square max-h-[45dvh] w-full lg:max-h-[34rem]"
            />
            {busy && (
              <button
                type="button"
                onClick={cancelPlayback}
                className="absolute right-3 bottom-3 h-10 rounded-lg border border-border bg-surface px-3 text-sm"
              >
                Stop (Esc)
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={undo}
              disabled={busy || play.log.length === 0}
              className={helperClass}
            >
              Undo
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={busy || play.redoStack.length === 0}
              className={helperClass}
            >
              Redo
            </button>
            <button type="button" onClick={onReset} className={helperClass}>
              Reset
            </button>
            <button type="button" onClick={() => void onScramble()} className={helperClass}>
              Scramble
            </button>
          </div>
        </div>

        {/* On phones the move pad comes straight after the cube (SPEC §5.3); on laptops helpers lead. */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border bg-surface p-3 sm:p-4">
            <h2 className="text-xs font-medium tracking-wide text-muted uppercase">Helpers</h2>
            <p className="mt-1 font-medium" data-testid="stage-status" aria-live="polite">
              {buttons.status}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {buttons.find && (
                <button type="button" disabled={busy} onClick={() => void onFind()} className={helperClass}>
                  {buttons.find}
                </button>
              )}
              {buttons.show && (
                <button type="button" disabled={busy} onClick={() => void onShow()} className={helperClass}>
                  {buttons.show}
                </button>
              )}
              {buttons.solve && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onSolve()}
                  className="h-11 rounded-lg bg-accent px-4 text-sm font-medium text-accent-contrast disabled:opacity-50"
                >
                  {buttons.solve}
                </button>
              )}
            </div>
            {info && (
              <div className="mt-3 rounded-lg bg-surface-2 p-3 text-sm" data-testid="helper-info">
                <p className="font-medium">{info.title}</p>
                {info.detail && <p className="mt-1 font-mono break-words text-muted">{info.detail}</p>}
              </div>
            )}
          </div>

          <div className="order-first rounded-2xl border border-border bg-surface p-3 sm:p-4 lg:order-none">
            <MovePad puzzle={puzzle} onMove={userMove} disabled={busy} />
          </div>

          <HistoryPanel base={play.base} log={play.log} />
        </div>
      </div>

      <PlayOptionsDialog open={optionsOpen} onClose={() => setOptionsOpen(false)} />
    </section>
  );
}
