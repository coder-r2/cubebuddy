import { create } from 'zustand';
import { db as defaultDb, type CubeBuddyDB } from '../db/db';
import type { Penalty, Puzzle, Session, Solve } from '../db/types';
import { serializeCstimer, solveKey, type PortableSession } from '../features/timer/cstimer';

/** Last-used session; UI state, so it lives in namespaced localStorage (D-030). */
export const SESSION_STORAGE_KEY = 'cubebuddy:timer:session';

const PUZZLE_NAMES: Record<Puzzle, string> = { '3x3x3': '3x3', '2x2x2': '2x2' };

export interface NewSolve {
  timeMs: number;
  penalty: Penalty;
  scramble: string;
  source: Solve['source'];
  comment?: string;
}

export interface ImportSummary {
  sessionsCreated: number;
  solvesAdded: number;
  duplicatesSkipped: number;
  /** Names of cstimer sessions for events CubeBuddy doesn't support. */
  unsupportedSessions: string[];
}

interface TimerStoreState {
  loaded: boolean;
  /** Non-deleted sessions, oldest first. */
  sessions: Session[];
  currentSessionId: string | null;
  /** Non-deleted solves of the current session, oldest first. */
  solves: Solve[];
  load: () => Promise<void>;
  selectSession: (id: string) => Promise<void>;
  createSession: (name: string, puzzle: Puzzle) => Promise<Session>;
  renameSession: (id: string, name: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  addSolve: (solve: NewSolve) => Promise<Solve>;
  updateSolve: (id: string, patch: Partial<Pick<Solve, 'penalty' | 'comment'>>) => Promise<void>;
  deleteSolve: (id: string) => Promise<void>;
  importSessions: (sessions: readonly PortableSession[]) => Promise<ImportSummary>;
  exportSessions: (sessionIds: readonly string[]) => Promise<string>;
}

function readStoredSessionId(): string | null {
  try {
    return localStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeSessionId(id: string) {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, id);
  } catch {
    // Unavailable storage only means the first session is selected next visit.
  }
}

const byCreatedAt = (a: { createdAt: number }, b: { createdAt: number }) => a.createdAt - b.createdAt;

export function createTimerStore(database: CubeBuddyDB = defaultDb) {
  const liveSessions = async () =>
    (await database.sessions.filter((s) => !s.deleted).toArray()).sort(byCreatedAt);

  const liveSolves = (sessionId: string) =>
    database.solves
      .where('[sessionId+createdAt]')
      .between([sessionId, -Infinity], [sessionId, Infinity])
      .filter((s) => !s.deleted)
      .toArray();

  const newSession = (name: string, puzzle: Puzzle, now = Date.now()): Session => ({
    id: crypto.randomUUID(),
    name: name.trim() || PUZZLE_NAMES[puzzle],
    puzzle,
    createdAt: now,
    updatedAt: now,
    deleted: false,
  });

  return create<TimerStoreState>((set, get) => ({
    loaded: false,
    sessions: [],
    currentSessionId: null,
    solves: [],

    async load() {
      let sessions = await liveSessions();
      if (sessions.length === 0) {
        const first = newSession('3x3', '3x3x3');
        await database.sessions.add(first);
        sessions = [first];
      }
      const stored = readStoredSessionId();
      const current = sessions.find((s) => s.id === stored) ?? sessions[0]!;
      set({ sessions, currentSessionId: current.id, solves: await liveSolves(current.id), loaded: true });
    },

    async selectSession(id) {
      storeSessionId(id);
      set({ currentSessionId: id, solves: await liveSolves(id) });
    },

    async createSession(name, puzzle) {
      const session = newSession(name, puzzle);
      await database.sessions.add(session);
      set({ sessions: [...get().sessions, session] });
      await get().selectSession(session.id);
      return session;
    },

    async renameSession(id, name) {
      const trimmed = name.trim();
      if (!trimmed) return;
      const updatedAt = Date.now();
      await database.sessions.update(id, { name: trimmed, updatedAt });
      set({ sessions: get().sessions.map((s) => (s.id === id ? { ...s, name: trimmed, updatedAt } : s)) });
    },

    async deleteSession(id) {
      const updatedAt = Date.now();
      // Soft delete (tombstones) so the deletion can sync later (D-039).
      await database.transaction('rw', database.sessions, database.solves, async () => {
        await database.sessions.update(id, { deleted: true, updatedAt });
        await database.solves
          .where('[sessionId+createdAt]')
          .between([id, -Infinity], [id, Infinity])
          .modify({ deleted: true, updatedAt });
      });
      const remaining = get().sessions.filter((s) => s.id !== id);
      if (remaining.length === 0) {
        set({ sessions: [] });
        await get().load();
        return;
      }
      set({ sessions: remaining });
      if (get().currentSessionId === id) await get().selectSession(remaining[0]!.id);
    },

    async addSolve(input) {
      const sessionId = get().currentSessionId;
      if (!sessionId) throw new Error('No session selected');
      // Strictly increasing so same-millisecond solves keep their order (the index sorts by createdAt).
      const now = Math.max(Date.now(), (get().solves.at(-1)?.createdAt ?? 0) + 1);
      const solve: Solve = {
        id: crypto.randomUUID(),
        sessionId,
        timeMs: input.timeMs,
        penalty: input.penalty,
        scramble: input.scramble,
        comment: input.comment ?? '',
        source: input.source,
        createdAt: now,
        updatedAt: now,
        deleted: false,
      };
      await database.solves.add(solve);
      if (get().currentSessionId === sessionId) set({ solves: [...get().solves, solve] });
      return solve;
    },

    async updateSolve(id, patch) {
      const updatedAt = Date.now();
      await database.solves.update(id, { ...patch, updatedAt });
      set({ solves: get().solves.map((s) => (s.id === id ? { ...s, ...patch, updatedAt } : s)) });
    },

    async deleteSolve(id) {
      await database.solves.update(id, { deleted: true, updatedAt: Date.now() });
      set({ solves: get().solves.filter((s) => s.id !== id) });
    },

    async importSessions(portable) {
      const summary: ImportSummary = {
        sessionsCreated: 0,
        solvesAdded: 0,
        duplicatesSkipped: 0,
        unsupportedSessions: [],
      };
      const sessions = [...get().sessions];
      const now = Date.now();

      await database.transaction('rw', database.sessions, database.solves, async () => {
        for (const incoming of portable) {
          if (!incoming.puzzle) {
            summary.unsupportedSessions.push(incoming.name);
            continue;
          }
          // Re-importing the same file fills the matching session instead of creating a copy.
          let target = sessions.find((s) => s.name === incoming.name && s.puzzle === incoming.puzzle);
          if (!target) {
            target = newSession(incoming.name, incoming.puzzle, now + summary.sessionsCreated);
            await database.sessions.add(target);
            sessions.push(target);
            summary.sessionsCreated += 1;
          }

          const existing = new Set((await liveSolves(target.id)).map(solveKey));
          const additions: Solve[] = [];
          for (const solve of incoming.solves) {
            const key = solveKey(solve);
            if (existing.has(key)) {
              summary.duplicatesSkipped += 1;
              continue;
            }
            existing.add(key);
            additions.push({
              id: crypto.randomUUID(),
              sessionId: target.id,
              ...solve,
              source: 'cstimer',
              updatedAt: now,
              deleted: false,
            });
          }
          await database.solves.bulkAdd(additions);
          summary.solvesAdded += additions.length;
        }
      });

      set({ sessions });
      const current = get().currentSessionId;
      if (current) set({ solves: await liveSolves(current) });
      return summary;
    },

    async exportSessions(sessionIds) {
      const chosen = get().sessions.filter((s) => sessionIds.includes(s.id));
      const portable: PortableSession[] = [];
      for (const session of chosen) {
        const solves = (await liveSolves(session.id)).sort(byCreatedAt);
        portable.push({
          name: session.name,
          puzzle: session.puzzle,
          solves: solves.map(({ timeMs, penalty, scramble, comment, createdAt }) => ({
            timeMs,
            penalty,
            scramble,
            comment,
            createdAt,
          })),
        });
      }
      return serializeCstimer(portable);
    },
  }));
}

export const useTimerStore = createTimerStore();
