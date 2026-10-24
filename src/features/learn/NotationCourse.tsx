import { useCallback, useRef, useState } from 'react';
import { CubeView, type CubeViewHandle } from '../../components/CubeView/CubeView';
import { MovePad } from '../../components/MovePad';
import { Icon } from '../../components/ui/Icon';
import { useCubeKeys } from '../../lib/useCubeKeys';
import { useSettings } from '../../stores/settings';
import { normalise } from '../play/useFreePlay';
import { MoveDiagram } from './MoveDiagram';
import { NOTATION_GROUPS, pretty, QUIZ_TASKS, sameState, variantsOf, type MoveCard } from './notation';

const VARIANT_HINT = ['clockwise', 'anticlockwise (prime)', 'half turn'];

/** Move cards and one shared 3D cube (D-020): tapping a move animates it from solved. */
function MoveCards() {
  const cube = useRef<CubeViewHandle>(null);
  const [variant, setVariant] = useState<Record<string, number>>({});
  const [current, setCurrent] = useState<{ card: MoveCard; move: string; variant: number }>({
    card: NOTATION_GROUPS[0]!.cards[0]!,
    move: 'R',
    variant: 0,
  });

  const show = (card: MoveCard, index: number) => {
    const move = variantsOf(card.move)[index]!;
    setVariant((v) => ({ ...v, [card.move]: index }));
    setCurrent({ card, move, variant: index });
    cube.current?.reset();
    cube.current?.queueMoves([move]);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <aside className="sticky top-14 z-10 -mx-4 border-b border-border bg-bg/95 px-4 py-2 backdrop-blur lg:top-20 lg:order-2 lg:mx-0 lg:self-start lg:rounded-xl lg:border lg:bg-surface lg:p-4">
        <div className="flex items-center gap-4 lg:flex-col lg:items-stretch">
          <CubeView
            ref={cube}
            hints={false}
            label="Cube showing the selected move"
            className="h-32 w-32 shrink-0 sm:h-40 sm:w-40 lg:mx-auto lg:h-56 lg:w-56"
          />
          <div className="min-w-0" aria-live="polite">
            <p className="font-mono text-3xl font-bold" data-testid="notation-move">
              {pretty(current.move)}
            </p>
            <p className="text-sm text-muted">
              {current.card.title}, {VARIANT_HINT[current.variant]}
            </p>
            <button
              type="button"
              onClick={() => show(current.card, current.variant)}
              className="mt-2 inline-flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-surface-2"
            >
              <Icon name="restart" className="h-4 w-4" />
              Play again
            </button>
          </div>
        </div>
      </aside>

      <div className="space-y-8 lg:order-1">
        {NOTATION_GROUPS.map((group) => (
          <section key={group.id} aria-labelledby={`notation-${group.id}`}>
            <h3 id={`notation-${group.id}`} className="text-lg font-semibold">
              {group.title}
            </h3>
            <p className="mt-1 max-w-prose text-sm text-muted">{group.intro}</p>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {group.cards.map((card) => {
                const index = variant[card.move] ?? 0;
                return (
                  <li key={card.move} className="flex gap-3 rounded-xl border border-border bg-surface p-3">
                    <MoveDiagram move={variantsOf(card.move)[index]!} className="h-20 w-20 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        <span className="font-mono">{card.move}</span>
                        {card.alias && <span className="font-mono text-muted"> / {card.alias}</span>} ·{' '}
                        {card.title}
                      </p>
                      <p className="mt-0.5 text-sm text-muted">{card.text}</p>
                      <div className="mt-2 flex gap-1.5">
                        {variantsOf(card.move).map((move, i) => (
                          <button
                            key={move}
                            type="button"
                            aria-pressed={current.move === move}
                            aria-label={`Show ${move}`}
                            onClick={() => show(card, i)}
                            className="h-10 min-w-11 rounded-lg border border-border px-2 font-mono font-medium hover:bg-surface-2 aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-accent-contrast"
                          >
                            {pretty(move)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

/** "Perform R′ U2" on the interactive cube; the app checks the resulting state (SPEC §5.2). */
function MiniQuiz() {
  const cube = useRef<CubeViewHandle>(null);
  const settings = useSettings((s) => s.settings);
  const [task, setTask] = useState(0);
  const [moves, setMoves] = useState<string[]>([]);
  const [shown, setShown] = useState(false);
  const target = QUIZ_TASKS[task];
  const correct = target !== undefined && moves.length > 0 && sameState(moves, target);

  const record = useCallback(
    (move: string, animate: boolean) => {
      const m = normalise(move);
      if (!m || correct) return;
      if (animate) cube.current?.queueMoves([m]);
      setMoves((list) => [...list, m]);
    },
    [correct],
  );

  const restart = () => {
    cube.current?.reset();
    setMoves([]);
    setShown(false);
  };
  const next = () => {
    restart();
    setTask((t) => t + 1);
  };
  const showMe = () => {
    if (!target) return;
    cube.current?.reset();
    cube.current?.queueMoves(target.split(' '));
    setShown(true);
  };

  const userMove = useCallback((m: string) => record(m, true), [record]);
  const undo = useCallback(() => {
    if (!moves.length) return;
    const rest = moves.slice(0, -1);
    cube.current?.reset(rest.join(' '));
    setMoves(rest);
  }, [moves]);
  useCubeKeys({
    keymap: settings.keymap,
    onMove: userMove,
    onUndo: undo,
    onRedo: () => undefined,
    onEscape: restart,
    locked: correct || shown,
  });

  if (target === undefined) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5 text-center" role="status">
        <p className="text-lg font-semibold">You know the notation!</p>
        <p className="mt-1 text-muted">Every algorithm in CubeBuddy is written this way.</p>
        <button
          type="button"
          onClick={() => setTask(0)}
          className="mt-3 h-10 rounded-lg border border-border px-4 text-sm font-medium hover:bg-surface-2"
        >
          Try the quiz again
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 rounded-xl border border-border bg-surface p-4 md:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="space-y-3">
        <p className="text-sm text-muted">
          Question {task + 1} of {QUIZ_TASKS.length}
        </p>
        <p className="text-xl font-semibold">
          Do{' '}
          <span className="font-mono" data-testid="quiz-task">
            {pretty(target)}
          </span>{' '}
          on the cube
        </p>
        <p className="min-h-6 font-mono text-muted" aria-label="Your moves">
          {moves.length ? pretty(moves.join(' ')) : 'Tap the cube or use the buttons.'}
        </p>
        {correct ? (
          <div className="flex flex-wrap items-center gap-3" role="status">
            <p className="flex items-center gap-1.5 font-medium text-success">
              <Icon name="check" /> Correct!
            </p>
            <button
              type="button"
              onClick={next}
              className="h-11 rounded-lg bg-accent px-5 font-medium text-accent-contrast"
            >
              Next
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={restart}
              className="h-10 rounded-lg border border-border px-3 text-sm font-medium hover:bg-surface-2"
            >
              Start again
            </button>
            <button
              type="button"
              onClick={showMe}
              className="h-10 rounded-lg border border-border px-3 text-sm font-medium hover:bg-surface-2"
            >
              Show me
            </button>
            {shown && (
              <button
                type="button"
                onClick={next}
                className="h-10 rounded-lg border border-border px-3 text-sm font-medium hover:bg-surface-2"
              >
                Skip
              </button>
            )}
          </div>
        )}
        {moves.length > target.split(' ').length + 2 && !correct && (
          <p className="text-sm text-muted">
            Not quite. Press “Start again” and try once more, or “Show me”.
          </p>
        )}
        <MovePad puzzle="3x3x3" onMove={userMove} disabled={correct || shown} />
      </div>
      <CubeView
        ref={cube}
        interactive
        locked={correct || shown}
        pressDirection={settings.tapDirection}
        onMove={(m) => record(m, false)}
        label="Quiz cube: tap a face to turn it"
        className="order-first mx-auto aspect-square w-full max-w-64 md:order-none"
      />
    </div>
  );
}

export function NotationCourse() {
  return (
    <div className="space-y-10">
      <MoveCards />
      <section aria-labelledby="notation-quiz" className="space-y-3">
        <h3 id="notation-quiz" className="text-lg font-semibold">
          Quick quiz
        </h3>
        <MiniQuiz />
      </section>
    </div>
  );
}
