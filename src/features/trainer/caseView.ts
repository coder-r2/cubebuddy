import type { ArrowMode, CaseDiagramProps } from '../../components/CaseDiagram';
import type { AlgCase, AlgSet, DiagramKind, Slot } from '../../data/algs/types';
import { caseState } from '../../engine/cases';
import { pieceMask } from '../../engine/mask';

// Shared helpers for showing a case: diagram props and the 3D demo's sticker mask.

const YELLOW = 3; // last-layer colour in the case frame (white cross on the bottom)
const SLOT_COLOURS: Record<Slot, [number, number]> = { FR: [2, 4], FL: [2, 1], BL: [5, 1], BR: [5, 4] };

/** PLL views show arrows; the 2-look corner step shows only corner arrows. */
function arrowsFor(kind: DiagramKind, goal: string | undefined): ArrowMode {
  if (kind !== 'pll') return 'none';
  return goal === 'cpll' ? 'corners' : 'all';
}

const stateCache = new Map<string, ReturnType<typeof caseState>>();

/** Diagram props for a case (state from its main alg, cached). */
export function diagramProps(set: AlgSet, algCase: AlgCase): Omit<CaseDiagramProps, 'className'> {
  let state = stateCache.get(algCase.id);
  if (!state) stateCache.set(algCase.id, (state = caseState(algCase.algs[0])));
  const kind = algCase.diagram ?? set.diagram;
  const goal = algCase.goal ?? set.goal;
  return {
    state,
    kind,
    edgesOnly: goal === 'eo',
    arrows: arrowsFor(kind, goal),
    slot: algCase.slot,
    backView: algCase.id.includes('-stuck-'),
    title: algCase.name,
  };
}

/** Sticker mask for the 3D demo: the pieces that matter keep their colours, the rest are grey (D-086). */
export function demoMask(set: AlgSet, algCase: AlgCase): string | undefined {
  if (set.puzzle === '2x2x2') return undefined;
  if ((algCase.goal ?? set.goal) !== 'f2l-pair') {
    return pieceMask(set.puzzle, (colours) => (colours.includes(YELLOW) ? '-' : 'I'));
  }
  const [a, b] = SLOT_COLOURS[algCase.slot ?? 'FR'];
  return pieceMask(set.puzzle, (colours) => {
    if (colours.includes(YELLOW)) return 'I';
    const target =
      colours.every((c) => c === 0 || c === a || c === b) && colours.includes(a) && colours.includes(b);
    return target ? '-' : 'I';
  });
}
