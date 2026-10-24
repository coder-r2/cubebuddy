// The cloud side of sync, as an interface so the merge logic can be unit-tested with an in-memory fake
// (D-092). The real implementation is Firestore Lite (firestore.ts).

export type CloudCollection = 'meta' | 'sessions' | 'solveChunks';

/** A server timestamp, kept at full precision so "changed since" queries don't re-read the newest doc. */
export interface SyncCursor {
  seconds: number;
  nanos: number;
}

export const cursorAfter = (a: SyncCursor, b: SyncCursor | null) =>
  !b || a.seconds > b.seconds || (a.seconds === b.seconds && a.nanos > b.nanos);

export interface CloudDoc {
  id: string;
  data: Record<string, unknown>;
  /** Server time of the doc's last write. */
  syncedAt: SyncCursor;
}

export interface CloudWrite {
  collection: CloudCollection;
  id: string;
  data: Record<string, unknown>;
  /** Merge maps into the existing doc (algs, solve chunks) instead of replacing it. */
  merge: boolean;
}

export type PulledDocs = Record<CloudCollection, CloudDoc[]>;

export interface Cloud {
  /** Every doc written after `since` (all docs when null). */
  pull(since: SyncCursor | null): Promise<PulledDocs>;
  push(writes: readonly CloudWrite[]): Promise<void>;
  /** Delete every doc of the user (account deletion). */
  deleteAll(): Promise<void>;
}
