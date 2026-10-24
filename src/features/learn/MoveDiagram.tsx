import { parseMove } from '../../engine/notation';

// 2D isometric diagram of a move (D-020): the cube seen from the front-right-top, with the turning layers
// in colour, the rest faded, and arrows on the two visible faces that show which way the layers go.

type Vec = [number, number, number];
type Axis = 0 | 1 | 2; // x (R), y (U), z (F)

const add = (a: Vec, b: Vec, k = 1): Vec => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (axis: Axis): Vec => [axis === 0 ? 1 : 0, axis === 1 ? 1 : 0, axis === 2 ? 1 : 0];

const COS30 = Math.sqrt(3) / 2;
const project = ([x, y, z]: Vec): [number, number] => [(x - z) * COS30, -y + (x + z) / 2];

/** Turning layers and direction of each move family; sign −1 = clockwise seen from the +axis face. */
const FAMILIES: Record<string, { axis: Axis; layers: number[]; sign: 1 | -1 }> = {
  R: { axis: 0, layers: [1], sign: -1 },
  L: { axis: 0, layers: [-1], sign: 1 },
  M: { axis: 0, layers: [0], sign: 1 },
  Rw: { axis: 0, layers: [1, 0], sign: -1 },
  Lw: { axis: 0, layers: [-1, 0], sign: 1 },
  x: { axis: 0, layers: [-1, 0, 1], sign: -1 },
  U: { axis: 1, layers: [1], sign: -1 },
  D: { axis: 1, layers: [-1], sign: 1 },
  E: { axis: 1, layers: [0], sign: 1 },
  Uw: { axis: 1, layers: [1, 0], sign: -1 },
  Dw: { axis: 1, layers: [-1, 0], sign: 1 },
  y: { axis: 1, layers: [-1, 0, 1], sign: -1 },
  F: { axis: 2, layers: [1], sign: -1 },
  B: { axis: 2, layers: [-1], sign: 1 },
  S: { axis: 2, layers: [0], sign: -1 },
  Fw: { axis: 2, layers: [1, 0], sign: -1 },
  Bw: { axis: 2, layers: [-1, 0], sign: 1 },
  z: { axis: 2, layers: [-1, 0, 1], sign: -1 },
};

/** The three visible faces: outward normal and the two in-plane directions of the sticker grid. */
const FACES: { normal: Vec; a: Vec; b: Vec; colour: string }[] = [
  { normal: [0, 1, 0], a: [1, 0, 0], b: [0, 0, 1], colour: '#ffffff' },
  { normal: [0, 0, 1], a: [1, 0, 0], b: [0, 1, 0], colour: '#16a34a' },
  { normal: [1, 0, 0], a: [0, 0, 1], b: [0, 1, 0], colour: '#dc2626' },
];

const S = 22; // px per cubie
const pts = (corners: Vec[]) =>
  corners
    .map((c) =>
      project(c)
        .map((v) => (v * S).toFixed(1))
        .join(','),
    )
    .join(' ');

export function MoveDiagram({ move, className = 'h-24 w-24' }: { move: string; className?: string }) {
  const parsed = parseMove(move);
  const family = parsed && FAMILIES[parsed.family];
  if (!parsed || !family) return null;
  const sign = family.sign * (parsed.amount === 3 ? -1 : 1);
  const axisVec = unit(family.axis);
  const moving = (p: Vec) => family.layers.includes(Math.round(p[family.axis]));

  const stickers = FACES.flatMap((face) =>
    [-1, 0, 1].flatMap((i) =>
      [-1, 0, 1].map((j) => {
        const centre = add(add(add([0, 0, 0], face.normal, 1.5), face.a, i), face.b, j);
        const cubie = add(add(face.normal, face.a, i), face.b, j);
        const corners = [
          add(add(centre, face.a, -0.44), face.b, -0.44),
          add(add(centre, face.a, 0.44), face.b, -0.44),
          add(add(centre, face.a, 0.44), face.b, 0.44),
          add(add(centre, face.a, -0.44), face.b, 0.44),
        ];
        return {
          key: `${face.colour}${i}${j}`,
          points: pts(corners),
          colour: face.colour,
          on: moving(cubie),
        };
      }),
    ),
  );

  // Arrows on the faces that the turning axis runs along, through the middle of the turning layers.
  const layerMid = family.layers.reduce((a, b) => a + b, 0) / family.layers.length;
  const arrows = FACES.filter((f) => f.normal[family.axis] === 0).map((face) => {
    const dir = cross(axisVec, face.normal).map((v) => v * sign) as Vec;
    const base = add(add([0, 0, 0], face.normal, 1.52), axisVec, layerMid);
    const [x1, y1] = project(add(base, dir, -1.15));
    const [x2, y2] = project(add(base, dir, 1.15));
    return { key: face.colour, x1: x1 * S, y1: y1 * S, x2: x2 * S, y2: y2 * S };
  });
  const id = `arrow-${move.replace(/\W/g, '_')}`;

  return (
    <svg viewBox="-62 -70 124 140" className={className} aria-hidden>
      <defs>
        <marker id={id} viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto">
          <path d="M0 0 10 5 0 10z" fill="var(--color-text)" />
        </marker>
      </defs>
      {stickers.map((s) => (
        <polygon
          key={s.key}
          points={s.points}
          fill={s.on ? s.colour : 'var(--color-surface-2)'}
          stroke="var(--color-border)"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      ))}
      {arrows.map((a) => (
        <g key={a.key}>
          <line {...a} stroke="var(--color-surface)" strokeWidth="6" strokeLinecap="round" />
          <line
            {...a}
            stroke="var(--color-text)"
            strokeWidth="3"
            strokeLinecap="round"
            markerEnd={`url(#${id})`}
          />
        </g>
      ))}
      {parsed.amount === 2 && (
        <text x="50" y="62" textAnchor="middle" fontSize="18" fontWeight="700" fill="var(--color-text)">
          ×2
        </text>
      )}
    </svg>
  );
}
