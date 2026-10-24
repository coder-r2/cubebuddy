import { memo, useMemo } from 'react';
import type { DiagramKind, Slot } from '../data/algs/types';
import { readPieces } from '../engine/cubies';
import { applyMoves, STICKER_COORD, STICKER_NORMAL, type Facelets } from '../engine/facelets';
import { parseAlg } from '../engine/notation';

/*
 * SVG case diagrams (D-007): last-layer top views with side stickers (OLL / PLL / CLL / 2x2), PLL arrows,
 * a 3D-style F2L view, and PBL top + bottom views. Input is a case state in the case frame (yellow on top).
 */

// Home face → sticker colour (default scheme: white top, green front).
const COLOURS = ['#ffffff', '#d1213a', '#00a35a', '#ffd500', '#ff6a13', '#0f55c4'];
const GREY = '#8d939e';
const FAINT = '#d6d9de';
const STROKE = '#1f2329';
const YELLOW = 3;

export type ArrowMode = 'none' | 'all' | 'corners' | 'edges';

export interface CaseDiagramProps {
  state: Facelets;
  kind: DiagramKind;
  /** OLL views: colour only the edges (2-look edge orientation). */
  edgesOnly?: boolean;
  arrows?: ArrowMode;
  /** F2L: slot of the target pair (default FR). */
  slot?: Slot;
  /** F2L: also draw the back view (pieces stuck in back slots). */
  backView?: boolean;
  /** Turn the top layer before drawing (recognition drill AUF). */
  auf?: number;
  title?: string;
  className?: string;
}

// ---- last-layer top view geometry (viewBox 0 0 100 100) ----
const GRID = { start: 16, size: 68 };
const BAR = 7;

/** Top-face sticker index → [row, col] in the top view (U face read with B at the top). */
const cell = (index: number, n: 3 | 2): [number, number] => {
  const row = Math.floor(index / 3);
  const col = index % 3;
  return n === 3 ? [row, col] : [row === 0 ? 0 : 1, col === 0 ? 0 : 1];
};

// Side stickers of the top layer, as seen from above: [sticker, side, position along the side].
const SIDE_STICKERS_3: [number, 'top' | 'right' | 'bottom' | 'left', number][] = [
  [47, 'top', 0],
  [46, 'top', 1],
  [45, 'top', 2],
  [11, 'right', 0],
  [10, 'right', 1],
  [9, 'right', 2],
  [18, 'bottom', 0],
  [19, 'bottom', 1],
  [20, 'bottom', 2],
  [36, 'left', 0],
  [37, 'left', 1],
  [38, 'left', 2],
];
const SIDE_STICKERS_2: [number, 'top' | 'right' | 'bottom' | 'left', number][] = [
  [47, 'top', 0],
  [45, 'top', 1],
  [11, 'right', 0],
  [9, 'right', 1],
  [18, 'bottom', 0],
  [20, 'bottom', 1],
  [36, 'left', 0],
  [38, 'left', 1],
];
const TOP_STICKERS_3 = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const TOP_STICKERS_2 = [0, 2, 6, 8];

// Bottom (D) face for PBL, viewed from below with F at the top.
const BOTTOM_STICKERS_2: [number, number, number][] = [
  [27, 0, 0],
  [29, 0, 1],
  [33, 1, 0],
  [35, 1, 1],
];
const BOTTOM_SIDES_2: [number, 'top' | 'right' | 'bottom' | 'left', number][] = [
  [24, 'top', 0],
  [26, 'top', 1],
  [15, 'right', 0],
  [17, 'right', 1],
  [53, 'bottom', 0],
  [51, 'bottom', 1],
  [44, 'left', 0],
  [42, 'left', 1],
];

/** Top-face index of each last-layer piece position, for PLL arrows. */
const CORNER_CELL = [8, 6, 0, 2]; // URF UFL ULB UBR
const EDGE_CELL = [5, 7, 3, 1]; // UR UF UL UB

interface LLViewProps {
  stickers: { colour: string; row: number; col: number }[];
  sides: { colour: string; side: 'top' | 'right' | 'bottom' | 'left'; at: number }[];
  n: 3 | 2;
  arrows?: [number, number][]; // pairs of top-face indices
  x?: number;
}

function LLView({ stickers, sides, n, arrows = [], x = 0 }: LLViewProps) {
  const size = GRID.size / n;
  const pad = 1.2;
  const centre = (index: number) => {
    const [row, col] = cell(index, n);
    return [x + GRID.start + (col + 0.5) * size, GRID.start + (row + 0.5) * size] as const;
  };
  return (
    <g>
      {stickers.map((s, i) => (
        <rect
          key={i}
          x={x + GRID.start + s.col * size + pad}
          y={GRID.start + s.row * size + pad}
          width={size - 2 * pad}
          height={size - 2 * pad}
          rx={2}
          fill={s.colour}
          stroke={STROKE}
          strokeWidth={1}
        />
      ))}
      {sides.map((s, i) => {
        if (s.colour === 'transparent') return null;
        const along = GRID.start + s.at * size + pad;
        const long = size - 2 * pad;
        const geometry =
          s.side === 'top'
            ? { x: along, y: GRID.start - BAR - 2, width: long, height: BAR }
            : s.side === 'bottom'
              ? { x: along, y: GRID.start + GRID.size + 2, width: long, height: BAR }
              : s.side === 'left'
                ? { x: GRID.start - BAR - 2, y: along, width: BAR, height: long }
                : { x: GRID.start + GRID.size + 2, y: along, width: BAR, height: long };
        return (
          <rect
            key={`s${i}`}
            {...geometry}
            x={geometry.x + x}
            rx={1.5}
            fill={s.colour}
            stroke={STROKE}
            strokeWidth={0.8}
          />
        );
      })}
      {arrows.map(([from, to], i) => {
        const [x1, y1] = centre(from);
        const [x2, y2] = centre(to);
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.hypot(dx, dy);
        // Shorten both ends so arrows don't cover the sticker centres completely.
        const trim = 6 / length;
        return (
          <line
            key={`a${i}`}
            x1={x1 + dx * trim}
            y1={y1 + dy * trim}
            x2={x2 - dx * trim}
            y2={y2 - dy * trim}
            stroke={STROKE}
            strokeWidth={2}
            markerEnd="url(#cb-arrow)"
          />
        );
      })}
    </g>
  );
}

function llProps(state: Facelets, kind: DiagramKind, edgesOnly: boolean, arrows: ArrowMode): LLViewProps {
  const n = kind === 'oll' || kind === 'pll' ? 3 : 2;
  const orientationOnly = kind === 'oll' || kind === 'oll-2x2';
  const isEdge = (sticker: number) => (sticker % 9) % 2 === 1;
  const colourOf = (sticker: number, onTop: boolean) => {
    const c = state[sticker]!;
    if (!orientationOnly) return COLOURS[c]!;
    if (edgesOnly && !isEdge(sticker) && sticker % 9 !== 4) return onTop ? GREY : FAINT;
    return c === YELLOW ? COLOURS[YELLOW]! : onTop ? GREY : FAINT;
  };
  const top = n === 3 ? TOP_STICKERS_3 : TOP_STICKERS_2;
  const sides = n === 3 ? SIDE_STICKERS_3 : SIDE_STICKERS_2;

  const pairs: [number, number][] = [];
  if (arrows !== 'none') {
    const { corners, edges } = readPieces(state);
    const withCorners = arrows === 'all' || arrows === 'corners';
    const withEdges = n === 3 && (arrows === 'all' || arrows === 'edges');
    // Arrows are relative to the final U turn that leaves the fewest pieces to move (D-087), as on PLL
    // sheets: a U turn moves top-layer position p to p + 1, so before a final U^k a piece belongs at home − k.
    const targetsFor = (k: number) => {
      const moves: [number, number][] = [];
      for (let home = 0; home < 4; home++) {
        const target = (home - k + 4) % 4;
        const cornerPos = Math.floor(corners[home]! / 3);
        if (withCorners && cornerPos < 4 && cornerPos !== target) {
          moves.push([CORNER_CELL[cornerPos]!, CORNER_CELL[target]!]);
        }
        const edgePos = edges[home]! >> 1;
        if (withEdges && edgePos < 4 && edgePos !== target)
          moves.push([EDGE_CELL[edgePos]!, EDGE_CELL[target]!]);
      }
      return moves;
    };
    const best = [0, 1, 2, 3].map(targetsFor).reduce((a, b) => (b.length < a.length ? b : a));
    pairs.push(...best);
  }

  return {
    n,
    stickers: top.map((i) => {
      const [row, col] = cell(i, n);
      return { colour: colourOf(i, true), row, col };
    }),
    sides: sides.map(([sticker, side, at]) => ({
      colour: !orientationOnly
        ? colourOf(sticker, false)
        : state[sticker] === YELLOW && (!edgesOnly || isEdge(sticker))
          ? COLOURS[YELLOW]!
          : 'transparent',
      side,
      at,
    })),
    arrows: pairs,
  };
}

// ---- F2L: 3D-style view of the U, F and R faces ----
const COS30 = Math.cos(Math.PI / 6);
const project = ([x, y, z]: readonly number[]): [number, number] => [
  50 + (x! - z!) * COS30 * 13,
  50 + (x! + z!) * 0.5 * 13 - y! * 13,
];

const BY_COORD = new Map<string, number[]>();
STICKER_COORD.forEach((coord, i) => {
  const key = coord.join();
  BY_COORD.set(key, [...(BY_COORD.get(key) ?? []), i]);
});

const SLOT_COLOURS: Record<Slot, [number, number]> = { FR: [2, 4], FL: [2, 1], BL: [5, 1], BR: [5, 4] };
const VIEW_FOR_SLOT: Record<Slot, string> = { FR: '', FL: "y'", BL: 'y2', BR: 'y' };

function F2LView({ state, slot }: { state: Facelets; slot: Slot }) {
  const [a, b] = SLOT_COLOURS[slot];
  const cornerKey = [0, a, b].sort().join();
  const edgeKey = [a, b].sort().join();
  const polygons: { points: string; fill: string }[] = [];
  for (let i = 0; i < 54; i++) {
    const n = STICKER_NORMAL[i]!;
    if (!(n[1] === 1 || n[2] === 1 || n[0] === 1)) continue; // U, F, R faces only
    const coord = STICKER_COORD[i]!;
    const cubie = BY_COORD.get(coord.join())!;
    const colours = cubie
      .map((s) => state[s]!)
      .sort()
      .join();
    const isCentre = cubie.length === 1;
    const bright = isCentre || colours === cornerKey || colours === edgeKey;
    const centre = coord.map((c, k) => c + n[k]! * 0.5);
    const axes = [0, 1, 2].filter((k) => n[k] === 0);
    const corners = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([s, t]) => {
      const p = [...centre];
      p[axes[0]!]! += s! * 0.44;
      p[axes[1]!]! += t! * 0.44;
      return project(p).join(',');
    });
    polygons.push({ points: corners.join(' '), fill: bright ? COLOURS[state[i]!]! : GREY });
  }
  return (
    <g>
      {polygons.map((p, i) => (
        <polygon
          key={i}
          points={p.points}
          fill={p.fill}
          stroke={STROKE}
          strokeWidth={1}
          strokeLinejoin="round"
        />
      ))}
    </g>
  );
}

function CaseDiagramImpl({
  state,
  kind,
  edgesOnly = false,
  arrows = 'none',
  slot = 'FR',
  backView = false,
  auf = 0,
  title,
  className = '',
}: CaseDiagramProps) {
  const shown = useMemo(
    () => (auf ? applyMoves(state, parseAlg(`U${auf === 2 ? '2' : auf === 3 ? "'" : ''}`)) : state),
    [state, auf],
  );
  const label = title ?? 'Case diagram';

  if (kind === 'f2l') {
    const front = applyMoves(shown, parseAlg(VIEW_FOR_SLOT[slot]));
    const back = applyMoves(front, parseAlg('y2'));
    return (
      <svg
        viewBox={backView ? '0 0 200 100' : '0 0 100 100'}
        role="img"
        aria-label={label}
        className={className}
      >
        <F2LView state={front} slot={slot} />
        {backView && (
          <g transform="translate(100 0)">
            <F2LView state={back} slot={slot} />
          </g>
        )}
      </svg>
    );
  }

  if (kind === 'pbl') {
    const top = llProps(shown, 'cll', false, 'none');
    const bottom: LLViewProps = {
      n: 2,
      stickers: BOTTOM_STICKERS_2.map(([s, row, col]) => ({ colour: COLOURS[shown[s]!]!, row, col })),
      sides: BOTTOM_SIDES_2.map(([s, side, at]) => ({ colour: COLOURS[shown[s]!]!, side, at })),
    };
    return (
      <svg viewBox="0 0 200 108" role="img" aria-label={label} className={className}>
        <LLView {...top} />
        <LLView {...bottom} x={100} />
        <text x={50} y={106} textAnchor="middle" fontSize={8} fill="currentColor">
          Top
        </text>
        <text x={150} y={106} textAnchor="middle" fontSize={8} fill="currentColor">
          Bottom
        </text>
      </svg>
    );
  }

  const props = llProps(shown, kind, edgesOnly, arrows);
  return (
    <svg viewBox="0 0 100 100" role="img" aria-label={label} className={className}>
      <defs>
        <marker
          id="cb-arrow"
          viewBox="0 0 10 10"
          refX="7"
          refY="5"
          markerWidth="4"
          markerHeight="4"
          orient="auto"
        >
          <path d="M0 0 L10 5 L0 10 z" fill={STROKE} />
        </marker>
      </defs>
      <LLView {...props} />
    </svg>
  );
}

export const CaseDiagram = memo(CaseDiagramImpl);
