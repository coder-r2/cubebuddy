import { crossSolved, frameForCentre, SLOT_PIECES, SLOTS, type Slot } from './analyse';
import { CORNER_FACELETS, EDGE_FACELETS, readPieces } from './cubies';
import { applyMoves, centre, isSolved, type Facelets } from './facelets';
import { parseAlg, type Move } from './notation';
import { solveCross, type Step } from './solvers';

/*
 * Beginner layer-by-layer method (D-034, D-096): cross → first-layer corners → middle-layer edges → top cross
 * → top edges → place top corners → twist top corners. Every step uses the handful of algs a beginner
 * learns and holds the cube the way beginner tutorials say to (a y rotation to bring the slot to the front),
 * so the moves are what a person would actually do. Like the CFOP helpers, each step is worked out from the
 * cube as it is, with the cross colour on the bottom.
 */

export type LblStage =
  | 'cross'
  | 'corners'
  | 'middle'
  | 'top-cross'
  | 'top-edges'
  | 'place-corners'
  | 'twist-corners'
  | 'auf'
  | 'solved';

export interface LblReport {
  stage: LblStage;
  /** First-layer corners in place (slots relative to the cross on the bottom). */
  solvedCorners: Slot[];
  /** Middle-layer edges in place. */
  solvedEdges: Slot[];
  solved: boolean;
}

export const LBL_ALGS = {
  corner: "R U R' U'",
  right: "U R U' R' U' F' U F",
  left: "U' L' U L U F U' F'",
  cross: "F R U R' U' F'",
  edges: "R U R' U R U2 R'",
  corners: "U R U' L' U R' U' L",
  twist: "R' D' R D",
} as const;

const ALG = Object.fromEntries(Object.entries(LBL_ALGS).map(([k, v]) => [k, parseAlg(v)])) as Record<
  keyof typeof LBL_ALGS,
  Move[]
>;
const AUFS = ['', 'U', "U'", 'U2'].map(parseAlg);
const HOLDS = ['', 'y', "y'", 'y2'].map(parseAlg);

// ---- Checks on a state with the cross colour on the bottom. ----

const fits = (s: Facelets, sticker: number) => s[sticker] === centre(s, Math.floor(sticker / 9));
const allFit = (s: Facelets, stickers: readonly number[]) => stickers.every((i) => fits(s, i));

const cornerIn = (s: Facelets, slot: Slot) => allFit(s, CORNER_FACELETS[SLOT_PIECES[slot].corner]!);
const edgeIn = (s: Facelets, slot: Slot) => allFit(s, EDGE_FACELETS[SLOT_PIECES[slot].edge]!);
const firstLayer = (s: Facelets) => crossSolved(s) && SLOTS.every((slot) => cornerIn(s, slot));
const twoLayers = (s: Facelets) => firstLayer(s) && SLOTS.every((slot) => edgeIn(s, slot));

const TOP_EDGE_STICKERS = [1, 3, 5, 7];
const topEdgesUp = (s: Facelets) => TOP_EDGE_STICKERS.filter((i) => fits(s, i)).length;
const topCross = (s: Facelets) => topEdgesUp(s) === 4;
/** Top edges matching their side centres. */
const edgesMatching = (s: Facelets) => [0, 1, 2, 3].filter((e) => allFit(s, EDGE_FACELETS[e]!)).length;
/** The U turn that lines the top edges up with their centres, if there is one. */
const edgeAuf = (s: Facelets) => AUFS.find((u) => edgesMatching(applyMoves(s, u)) === 4) ?? null;
/** Top corners in their places (any twist), with the edges lined up. */
const cornersPlaced = (s: Facelets) => {
  const { corners } = readPieces(s);
  return [0, 1, 2, 3].filter((c) => Math.floor(corners[c]! / 3) === c).length;
};
const solvedUpToAuf = (s: Facelets) => AUFS.some((u) => isSolved(applyMoves(s, u)));

/** Side faces (F R B L) around each slot, by the slot's position. */
const SLOT_FACES: Record<Slot, readonly [number, number]> = {
  FR: [2, 1],
  FL: [2, 4],
  BL: [5, 4],
  BR: [5, 1],
};

/** A slot is named by the colours of its two side centres, which stay put when the cube is rotated. */
type Pair = readonly [number, number];
const pairOf = (s: Facelets, slot: Slot): Pair => [
  centre(s, SLOT_FACES[slot][0]),
  centre(s, SLOT_FACES[slot][1]),
];
const slotOf = (s: Facelets, pair: Pair): Slot =>
  SLOTS.find((slot) => {
    const [a, b] = pairOf(s, slot);
    return (a === pair[0] && b === pair[1]) || (a === pair[1] && b === pair[0]);
  })!;

/** The y rotation (possibly none) that brings the slot to front-right (or front-left). */
const hold = (s: Facelets, pair: Pair, at: Slot = 'FR') =>
  HOLDS.find((y) => slotOf(applyMoves(s, y), pair) === at)!;

export function analyseLbl(state: Facelets, colour = 0): LblReport {
  const { state: s } = frameForCentre(state, colour);
  const cross = crossSolved(s);
  const solvedCorners = cross ? SLOTS.filter((slot) => cornerIn(s, slot)) : [];
  const layer1 = cross && solvedCorners.length === 4;
  const solvedEdges = layer1 ? SLOTS.filter((slot) => edgeIn(s, slot)) : [];
  const solved = isSolved(state);
  const aligned = (() => {
    const u = edgeAuf(s);
    return u && applyMoves(s, u);
  })();

  let stage: LblStage;
  if (solved) stage = 'solved';
  else if (!cross) stage = 'cross';
  else if (!layer1) stage = 'corners';
  else if (solvedEdges.length < 4) stage = 'middle';
  else if (!topCross(s)) stage = 'top-cross';
  else if (!aligned) stage = 'top-edges';
  else if (cornersPlaced(aligned) < 4) stage = 'place-corners';
  else if (!solvedUpToAuf(s)) stage = 'twist-corners';
  else stage = 'auf';
  return { stage, solvedCorners, solvedEdges, solved };
}

/** `a` then `b`, with turns of the same layer where they meet merged ("U" + "U R" → "U2 R"; "U'" + "U" → ""). */
export function joinMoves(a: readonly Move[], b: readonly Move[]): Move[] {
  const out = [...a];
  for (const move of b) {
    const last = out.at(-1);
    if (last && last.family === move.family) {
      const amount = (last.amount + move.amount) % 4;
      out.pop();
      if (amount) out.push({ family: move.family, amount: amount as Move['amount'] });
    } else out.push(move);
  }
  return out;
}

/** Moves applied one batch at a time to a running state. */
class Builder {
  moves: Move[] = [];
  constructor(public state: Facelets) {}
  push(moves: readonly Move[]) {
    this.moves = joinMoves(this.moves, moves);
    this.state = applyMoves(this.state, moves);
  }
}

// ---- First-layer corners: bring the corner above its slot, then R U R' U' until it's in (1, 3 or 5 times).

function cornerMoves(start: Facelets, pair: Pair): Move[] {
  const b = new Builder(start);
  for (let round = 0; round < 3 && !cornerIn(b.state, slotOf(b.state, pair)); round++) {
    const slot = slotOf(b.state, pair);
    const where = Math.floor(readPieces(b.state).corners[SLOT_PIECES[slot].corner]! / 3);
    const stuckIn = SLOTS.find((s) => SLOT_PIECES[s].corner === where && s !== slot);
    if (stuckIn) {
      // In another slot: hold that slot at front-right and take the corner out with one R U R' U'.
      b.push(hold(b.state, pairOf(b.state, stuckIn)));
      b.push(ALG.corner);
      continue;
    }
    b.push(hold(b.state, pair));
    if (where < 4)
      b.push(AUFS.find((u) => Math.floor(readPieces(applyMoves(b.state, u)).corners[4]! / 3) === 0)!);
    for (let i = 0; i < 5 && !cornerIn(b.state, 'FR'); i++) b.push(ALG.corner);
  }
  return b.moves;
}

// ---- Middle-layer edges: line the edge up with its centre, then the right or left insert.

function edgeMoves(start: Facelets, pair: Pair): Move[] {
  const b = new Builder(start);
  const keep = SLOTS.filter((slot) => edgeIn(start, slot)).map((slot) => pairOf(start, slot));
  const intact = (s: Facelets) => firstLayer(s) && keep.every((p) => edgeIn(s, slotOf(s, p)));

  for (let round = 0; round < 3 && !edgeIn(b.state, slotOf(b.state, pair)); round++) {
    let best: Move[] | null = null;
    for (const [at, alg] of [
      ['FR', ALG.right],
      ['FL', ALG.left],
    ] as const) {
      const y = hold(b.state, pair, at);
      for (const u of AUFS) {
        const moves = joinMoves([...y, ...u], alg);
        const after = applyMoves(b.state, moves);
        if (edgeIn(after, slotOf(after, pair)) && intact(after) && (!best || moves.length < best.length)) {
          best = moves;
        }
      }
    }
    if (best) {
      b.push(best);
      break;
    }
    // Stuck in the middle layer (in another slot, or flipped in its own): insert any top edge there to take it out.
    const slot = slotOf(b.state, pair);
    const where = readPieces(b.state).edges[SLOT_PIECES[slot].edge]! >> 1;
    const stuckIn = SLOTS.find((s) => SLOT_PIECES[s].edge === where);
    if (!stuckIn) break;
    b.push(hold(b.state, pairOf(b.state, stuckIn)));
    b.push(ALG.right);
  }
  return b.moves;
}

// ---- Last layer.

/** Top-face edge shape: 0 dot, 1 L, 2 line, 3 cross. */
function crossShape(s: Facelets): number {
  const up = TOP_EDGE_STICKERS.map((i) => fits(s, i));
  const count = up.filter(Boolean).length;
  if (count === 4) return 3;
  if (count < 2) return 0;
  // Stickers 1/7 (back/front) and 3/5 (left/right) are opposite pairs.
  return (up[0] && up[3]) || (up[1] && up[2]) ? 2 : 1;
}
const SHAPE_NAMES = ['Dot', 'L shape', 'Line', 'Cross'];

/** Try each candidate and keep the best-scoring one (fewest moves on a tie). */
function best(
  state: Facelets,
  candidates: Move[][],
  score: (s: Facelets) => number,
): { moves: Move[]; score: number } {
  let top: { moves: Move[]; score: number } | null = null;
  for (const moves of candidates) {
    const value = score(applyMoves(state, moves));
    if (!top || value > top.score || (value === top.score && moves.length < top.moves.length)) {
      top = { moves, score: value };
    }
  }
  return top!;
}

function twistMoves(start: Facelets): Move[] {
  const b = new Builder(start);
  const top = centre(start, 0);
  const twisted = (s: Facelets, corner: number) => s[CORNER_FACELETS[corner]![0]!] !== top;
  // Hold a twisted corner at front-right; from then on only the top layer turns.
  b.push(HOLDS.find((y) => twisted(applyMoves(b.state, y), 0))!);
  for (let corner = 0; corner < 4; corner++) {
    const u = AUFS.find((a) => twisted(applyMoves(b.state, a), 0));
    if (!u) break;
    b.push(u);
    for (let i = 0; i < 2 && twisted(b.state, 0); i++) b.push([...ALG.twist, ...ALG.twist]);
  }
  return b.moves;
}

/** The next beginner step, or null when solved. */
export function nextLblStep(state: Facelets, colour = 0): Step | null {
  const { prefix, state: s } = frameForCentre(state, colour);
  const report = analyseLbl(state, colour);
  const step = (kind: Step['kind'], label: string, moves: Move[], extra: Partial<Step> = {}): Step => ({
    kind,
    label,
    moves: [...prefix, ...moves],
    ...extra,
  });

  switch (report.stage) {
    case 'solved':
      return null;
    case 'cross':
      return solveCross(state, colour);
    case 'corners':
    case 'middle': {
      const corners = report.stage === 'corners';
      const options = SLOTS.filter((slot) => !(corners ? cornerIn(s, slot) : edgeIn(s, slot))).map(
        (slot) => ({
          slot,
          moves: (corners ? cornerMoves : edgeMoves)(s, pairOf(s, slot)),
        }),
      );
      const pick = options.reduce((a, b) => (b.moves.length < a.moves.length ? b : a));
      return corners
        ? step('lbl-corner', `First-layer corner (${pick.slot})`, pick.moves, { slot: pick.slot })
        : step('lbl-edge', `Middle-layer edge (${pick.slot})`, pick.moves, { slot: pick.slot });
    }
    case 'top-cross': {
      const shape = crossShape(s);
      const pick = best(
        s,
        AUFS.map((u) => joinMoves(u, ALG.cross)),
        (t) => (twoLayers(t) ? crossShape(t) : -1),
      );
      return step('lbl-eo', 'Top cross', pick.moves, { caseName: SHAPE_NAMES[shape], alg: LBL_ALGS.cross });
    }
    case 'top-edges': {
      const matched = (t: Facelets) =>
        twoLayers(t) && topCross(t) ? Math.max(...AUFS.map((u) => edgesMatching(applyMoves(t, u)))) : -1;
      const pick = best(
        s,
        AUFS.map((u) => joinMoves(u, ALG.edges)),
        matched,
      );
      const after = applyMoves(s, pick.moves);
      const finish = pick.score === 4 ? edgeAuf(after)! : [];
      return step('lbl-ep', 'Top edges', joinMoves(pick.moves, finish), { alg: LBL_ALGS.edges });
    }
    case 'place-corners': {
      const align = edgeAuf(s)!;
      const aligned = applyMoves(s, align);
      const pick = best(
        aligned,
        HOLDS.flatMap((y) => [joinMoves(y, ALG.corners), joinMoves(joinMoves(y, ALG.corners), ALG.corners)]),
        (t) => (twoLayers(t) && edgesMatching(t) === 4 ? cornersPlaced(t) : -1),
      );
      return step('lbl-cp', 'Place top corners', joinMoves(align, pick.moves), { alg: LBL_ALGS.corners });
    }
    case 'twist-corners':
      return step('lbl-co', 'Twist top corners', twistMoves(s), { alg: LBL_ALGS.twist });
    case 'auf':
      return step(
        'auf',
        'Final U turn',
        AUFS.find((u) => isSolved(applyMoves(s, u)))!,
      );
  }
}

/** Every remaining beginner step. */
export function solveAllLbl(state: Facelets, colour = 0): Step[] {
  const steps: Step[] = [];
  let current = state;
  for (let i = 0; i < 40; i++) {
    const step = nextLblStep(current, colour);
    if (!step) return steps;
    steps.push(step);
    current = applyMoves(current, step.moves);
  }
  throw new Error('Beginner solver did not converge');
}
