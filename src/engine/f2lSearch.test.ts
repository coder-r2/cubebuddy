import { describe, expect, it } from 'vitest';
import { crossSolved, SLOT_PIECES, slotSolved, SLOTS } from './analyse';
import { caseBase } from './cases';
import { readPieces } from './cubies';
import { applyMoves } from './facelets';
import { pairCost, solvePair } from './f2lSearch';
import { stuckF2LStates, basicF2LStates } from './f2lCases';
import { formatAlg, parseAlg } from './notation';

const TRIGGERS = {
  FR: ["R U R'", "F' U F"],
  FL: ["L' U L", "F U F'"],
  BL: ["L U L'", "B' U B"],
  BR: ["R' U R", "B U B'"],
};

describe('F2L trigger search', () => {
  it('each trigger moves only its own slot', () => {
    for (const slot of SLOTS) {
      for (const trigger of TRIGGERS[slot]) {
        const state = applyMoves(caseBase(), parseAlg(trigger));
        expect(crossSolved(state), trigger).toBe(true);
        for (const other of SLOTS)
          expect(slotSolved(state, other), `${trigger} / ${other}`).toBe(other !== slot);
      }
    }
  });

  it('solves every last-slot state with the target slot alone', () => {
    // Corner in the top layer or the slot (15 placements) × edge in the top layer or the slot (10).
    let count = 0;
    for (let corner = 0; corner < 24; corner++) {
      for (let edge = 0; edge < 24; edge++) {
        const cornerFree = corner < 12 || Math.floor(corner / 3) === SLOT_PIECES.FR.corner;
        const edgeFree = edge < 8 || edge >> 1 === SLOT_PIECES.FR.edge;
        if (!cornerFree || !edgeFree) continue;
        count++;
        expect(pairCost(corner, edge, { free: [], noBack: true })).toBeLessThanOrEqual(15);
      }
    }
    expect(count).toBe(150);
  });

  it('solves the basic and stuck cases, keeping the cross and other slots', () => {
    for (const state of [...basicF2LStates(), ...stuckF2LStates()]) {
      const { corners, edges } = readPieces(state);
      const free = SLOTS.filter((s) => s !== 'FR' && !slotSolved(state, s));
      const moves = solvePair(corners[SLOT_PIECES.FR.corner]!, edges[SLOT_PIECES.FR.edge]!, {
        free,
        noBack: false,
      });
      const after = applyMoves(state, moves);
      expect(crossSolved(after), formatAlg(moves)).toBe(true);
      expect(slotSolved(after, 'FR'), formatAlg(moves)).toBe(true);
      for (const s of SLOTS) if (s !== 'FR' && !free.includes(s)) expect(slotSolved(after, s)).toBe(true);
    }
  });
});
