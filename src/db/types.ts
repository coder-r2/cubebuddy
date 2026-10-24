// Local data model (SPEC §7.2). Every record carries updatedAt (and soft-delete where relevant) for sync (D-038, D-039).

export type Puzzle = '3x3x3' | '2x2x2';
export type ThemePref = 'system' | 'light' | 'dark';
export type Level = 1 | 2 | 3 | 4;
export type F2LStyle = 'front-right' | 'rotationless';
export type LLMode = '2-look' | 'full';
export type CrossColorMode = 'white' | 'white-yellow' | 'neutral';
export type StatKey = 'pb' | 'ao5' | 'ao12' | 'ao50' | 'ao100' | 'mean';
export type TimerInput = 'timer' | 'typing';

export interface Settings {
  level: Level | null;
  animationSpeed: number;
  theme: ThemePref;
  /** Move → key bindings; empty means "use the cstimer defaults" (filled in P2). */
  keymap: Record<string, string>;
  f2lStyle: F2LStyle;
  llMode: LLMode;
  crossColorMode: CrossColorMode;
  inspection: boolean;
  inspectionAlerts: boolean;
  holdMs: number;
  hideTimeWhileRunning: boolean;
  /** Timer page entry mode: spacebar/touch timing or typed times (SPEC §5.4). */
  timerInput: TimerInput;
  visibleStats: StatKey[];
  onboardingDone: boolean;
  updatedAt: number;
}

export interface SettingsRow extends Settings {
  key: 'singleton';
}

export interface Session {
  id: string;
  name: string;
  puzzle: Puzzle;
  createdAt: number;
  updatedAt: number;
  deleted: boolean;
}

/** 0 = none, 2000 = +2 (ms), 'DNF'. */
export type Penalty = 0 | 2000 | 'DNF';

export interface Solve {
  id: string;
  sessionId: string;
  timeMs: number;
  penalty: Penalty;
  scramble: string;
  comment: string;
  source: 'timer' | 'typed' | 'cstimer';
  createdAt: number;
  updatedAt: number;
  deleted: boolean;
}

export interface AlgChoice {
  caseId: string;
  selected: 0 | 1 | 2 | 'custom';
  customAlg?: string;
  updatedAt: number;
}

export type ProgressState = 'none' | 'learning' | 'learned';

export interface Progress {
  caseId: string;
  state: ProgressState;
  updatedAt: number;
}

export interface TrainerStats {
  caseId: string;
  recentTimesMs: number[];
  recognitionMisses: number;
  box: number;
  lastSeen: number;
  updatedAt: number;
}

export interface SyncMeta {
  key: string;
  value: unknown;
}
