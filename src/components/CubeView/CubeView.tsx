import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import type { TwistyPlayer } from 'cubing/twisty';
import type { Puzzle } from '../../db/types';
import { useSettings } from '../../stores/settings';
import { isWebGLAvailable } from './webgl';

export interface CubeViewHandle {
  play(): void;
  pause(): void;
  jumpToStart(): void;
  jumpToEnd(): void;
  /** Animate moves on top of the current state. Returns false if the cube hasn't loaded yet. */
  queueMoves(moves: readonly string[]): boolean;
  /** Snap (without animation) to `setup` applied to a solved cube, clearing the move list. */
  reset(setup?: string): void;
}

export interface CubeViewProps {
  puzzle?: Puzzle;
  /** Alg applied instantly before `alg` (e.g. the case state). */
  setup?: string;
  /** Moves to animate / scrub through. Leave undefined to drive the cube with `queueMoves`. */
  alg?: string;
  /** 'end' = `alg` finishes at the solved state (alg demos). */
  setupAnchor?: 'start' | 'end';
  /** cubing.js stickering preset, e.g. 'OLL', 'PLL', 'F2L', 'Cross', 'CLL', 'PBL'. */
  mask?: string;
  /** Serialized per-piece mask (`EDGES:----DDDD…,CORNERS:…,CENTERS:…`); overrides `mask`. */
  maskOrbits?: string;
  /** Click/tap a face to turn it (D-010). */
  interactive?: boolean;
  /** Temporarily ignore presses (e.g. during helper playback) without switching renderer. */
  locked?: boolean;
  /** Called with each user-generated move (click/tap-to-turn). */
  onMove?: (move: string) => void;
  /** What a tap / left-click does; right-click does the opposite (D-068). cubing.js's own default is anticlockwise. */
  pressDirection?: 'clockwise' | 'anticlockwise';
  /** Animation speed (tempoScale); defaults to the global setting. */
  speed?: number;
  view?: '3D' | '2D' | 'top';
  controls?: 'none' | 'playback';
  idle?: 'none' | 'hover';
  /** Allow dragging to orbit the camera. */
  orbit?: boolean;
  /** Show floating hint stickers for hidden faces. */
  hints?: boolean;
  className?: string;
  label?: string;
  ref?: Ref<CubeViewHandle>;
}

const VISUALIZATION = { '3D': '3D', '2D': '2D', top: 'experimental-2D-LL' } as const;

/** Count of top-level moves in an alg string (moves are whitespace-separated in our usage). */
const countMoves = (alg: string) => alg.split(/\s+/).filter(Boolean).length;

/**
 * Thin wrapper around cubing.js <twisty-player> (D-006). The rest of the app only talks to this
 * component, so the renderer can be swapped without touching pages.
 */
export function CubeView({
  puzzle = '3x3x3',
  setup = '',
  alg,
  setupAnchor = 'start',
  mask,
  maskOrbits,
  interactive = false,
  locked = false,
  onMove,
  pressDirection = 'anticlockwise',
  speed,
  view = '3D',
  controls = 'none',
  idle = 'none',
  orbit = true,
  hints = true,
  className = '',
  label = 'Cube',
  ref,
}: CubeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // The element lives in a ref (it is mutated imperatively); `ready` re-runs the prop effects once it exists.
  const playerRef = useRef<TwistyPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(() => !isWebGLAvailable() && view === '3D');
  const globalSpeed = useSettings((s) => s.settings.animationSpeed);

  // Number of moves in the player's alg that we put there ourselves; anything beyond came from the user.
  const ownMoveCount = useRef(0);
  const onMoveRef = useRef(onMove);
  useEffect(() => {
    onMoveRef.current = onMove;
  });

  useEffect(() => {
    if (failed) return;
    let cancelled = false;
    let element: TwistyPlayer | null = null;

    import('cubing/twisty')
      .then(({ TwistyPlayer }) => {
        if (cancelled || !containerRef.current) return;
        element = new TwistyPlayer({
          background: 'none',
          backView: 'none',
          // Never merge user presses with previous moves; the app owns history merging (D-032).
          experimentalMovePressCancelOptions: { directional: 'none' },
        });
        element.style.width = '100%';
        element.style.height = '100%';
        containerRef.current.appendChild(element);

        element.experimentalModel.alg.addFreshListener(({ alg: current }) => {
          const nodes = Array.from(current.childAlgNodes());
          if (nodes.length <= ownMoveCount.current) return;
          const userMoves = nodes.slice(ownMoveCount.current).map((node) => node.toString());
          ownMoveCount.current = nodes.length;
          for (const move of userMoves) onMoveRef.current?.(move);
        });
        playerRef.current = element;
        setReady(true);
      })
      .catch((error: unknown) => {
        console.error('CubeView failed to load', error);
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      element?.remove();
      playerRef.current = null;
      setReady(false);
    };
  }, [failed]);

  useEffect(() => {
    const player = playerRef.current;
    if (player) player.puzzle = puzzle;
  }, [ready, puzzle]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    player.experimentalSetupAnchor = setupAnchor;
    player.experimentalSetupAlg = setup;
  }, [ready, setup, setupAnchor]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || alg === undefined) return;
    ownMoveCount.current = countMoves(alg);
    player.alg = alg;
  }, [ready, alg]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    if (maskOrbits) {
      player.experimentalStickeringMaskOrbits = maskOrbits;
    } else {
      // A null request clears any per-piece mask so the preset applies again.
      player.experimentalStickeringMaskOrbits = null as unknown as string;
      player.experimentalStickering = mask ?? 'full';
    }
  }, [ready, mask, maskOrbits]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    player.experimentalMovePressInput = interactive && !locked ? 'basic' : 'none';
    player.experimentalDragInput = orbit ? 'auto' : 'none';
    player.hintFacelets = hints ? 'floating' : 'none';
    // cubing.js only raycasts presses with its PG3D renderer; the default 3x3 renderer ignores clicks.
    player.visualization = interactive && view === '3D' ? 'PG3D' : VISUALIZATION[view];
    player.controlPanel = controls === 'playback' ? 'bottom-row' : 'none';
  }, [ready, interactive, locked, orbit, hints, view, controls]);

  useEffect(() => {
    const player = playerRef.current;
    if (player) player.tempoScale = speed ?? globalSpeed;
  }, [ready, speed, globalSpeed]);

  // cubing.js turns a face clockwise only for a right-click (it reads `button` on pointerup), which touch
  // screens can't do. For clockwise taps, swap the reported button before cubing.js sees the event: the
  // listener runs in the capture phase on an ancestor, and an own property shadows the prototype getter.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !interactive || pressDirection === 'anticlockwise') return;
    const flip = (e: PointerEvent) => {
      Object.defineProperty(e, 'button', { value: e.button === 2 ? 0 : 2 });
    };
    container.addEventListener('pointerup', flip, { capture: true });
    return () => container.removeEventListener('pointerup', flip, { capture: true });
  }, [interactive, pressDirection]);

  useImperativeHandle(
    ref,
    () => ({
      play: () => playerRef.current?.play(),
      pause: () => playerRef.current?.pause(),
      jumpToStart: () => playerRef.current?.jumpToStart(),
      jumpToEnd: () => playerRef.current?.jumpToEnd(),
      queueMoves(moves) {
        const player = playerRef.current;
        if (!player) return false;
        for (const move of moves) {
          ownMoveCount.current += 1;
          player.experimentalAddMove(move, { cancel: false });
        }
        return true;
      },
      reset(newSetup = '') {
        const player = playerRef.current;
        if (!player) return;
        ownMoveCount.current = 0;
        player.experimentalSetupAlg = newSetup;
        player.alg = '';
      },
    }),
    [],
  );

  if (failed) {
    return (
      <div
        role="img"
        aria-label={`${label} (3D view unavailable)`}
        className={`grid place-items-center rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted ${className}`}
      >
        3D view unavailable: this browser or device doesn’t support WebGL.
      </div>
    );
  }

  return (
    <div className={`relative ${idle === 'hover' ? 'cube-hover' : ''} ${className}`}>
      <div ref={containerRef} role="img" aria-label={label} className="h-full w-full" />
      {!ready && (
        <div className="absolute inset-0 grid place-items-center" aria-hidden>
          <div className="h-1/3 w-1/3 animate-pulse rounded-2xl bg-surface-2" />
        </div>
      )}
    </div>
  );
}
