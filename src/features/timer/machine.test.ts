import { describe, expect, it } from 'vitest';
import {
  initialTimerState,
  timerReducer,
  type TimerConfig,
  type TimerEvent,
  type TimerState,
} from './machine';

function run(config: TimerConfig, events: TimerEvent[], start: TimerState = initialTimerState) {
  return events.reduce((state, event) => timerReducer(state, event, config), start);
}

const plain: TimerConfig = { holdMs: 300, inspection: false };
const inspect: TimerConfig = { holdMs: 300, inspection: true };

describe('timer without inspection', () => {
  it('needs a hold of holdMs before it turns ready', () => {
    let state = run(plain, [
      { type: 'press', at: 0 },
      { type: 'tick', at: 299 },
    ]);
    expect(state.phase).toBe('holding');
    state = run(plain, [{ type: 'tick', at: 300 }], state);
    expect(state.phase).toBe('ready');
  });

  it('times from release to the next press', () => {
    const state = run(plain, [
      { type: 'press', at: 0 },
      { type: 'tick', at: 400 },
      { type: 'release', at: 500 },
      { type: 'press', at: 12_840 },
    ]);
    expect(state.phase).toBe('stopped');
    expect(state.result).toEqual({ timeMs: 12_340, penalty: 0 });
  });

  it('goes back to idle with a false start when released too early', () => {
    const state = run(plain, [
      { type: 'press', at: 0 },
      { type: 'tick', at: 100 },
      { type: 'release', at: 150 },
    ]);
    expect(state.phase).toBe('idle');
    expect(state.falseStart).toBe(true);
  });

  it('returns to idle after the stopping key is released', () => {
    const state = run(plain, [
      { type: 'press', at: 0 },
      { type: 'tick', at: 300 },
      { type: 'release', at: 300 },
      { type: 'press', at: 1300 },
      { type: 'release', at: 1400 },
    ]);
    expect(state).toEqual(initialTimerState);
  });

  it('is ready immediately when holdMs is 0', () => {
    expect(run({ holdMs: 0, inspection: false }, [{ type: 'press', at: 0 }]).phase).toBe('ready');
  });

  it('cancels a running solve without a result', () => {
    const state = run(plain, [
      { type: 'press', at: 0 },
      { type: 'tick', at: 300 },
      { type: 'release', at: 300 },
      { type: 'cancel' },
    ]);
    expect(state.phase).toBe('idle');
    expect(state.result).toBeNull();
  });
});

describe('timer with inspection', () => {
  const startInspection: TimerEvent[] = [
    { type: 'press', at: 0 },
    { type: 'release', at: 50 },
  ];

  function solveAfterInspecting(ms: number) {
    const begin = 50 + ms - 400;
    return run(inspect, [
      ...startInspection,
      { type: 'press', at: begin },
      { type: 'tick', at: begin + 300 },
      { type: 'release', at: 50 + ms },
      { type: 'press', at: 50 + ms + 10_000 },
    ]);
  }

  it('starts inspecting on a tap, without a hold', () => {
    expect(run(inspect, startInspection).phase).toBe('inspecting');
  });

  it('needs a hold during inspection before starting', () => {
    const state = run(inspect, [
      ...startInspection,
      { type: 'press', at: 1000 },
      { type: 'release', at: 1100 },
    ]);
    expect(state.phase).toBe('inspecting');
    expect(state.falseStart).toBe(true);
  });

  it('has no penalty when started within 15 s', () => {
    expect(solveAfterInspecting(15_000).result).toEqual({ timeMs: 10_000, penalty: 0 });
  });

  it('adds +2 when started after 15 s', () => {
    expect(solveAfterInspecting(15_001).result).toEqual({ timeMs: 10_000, penalty: 2000 });
    expect(solveAfterInspecting(17_000).result?.penalty).toBe(2000);
  });

  it('is a DNF when started after 17 s', () => {
    expect(solveAfterInspecting(17_001).result?.penalty).toBe('DNF');
  });

  it('can be cancelled during inspection', () => {
    expect(run(inspect, [...startInspection, { type: 'cancel' }])).toEqual(initialTimerState);
  });
});
