import type { Cloud, CloudCollection, CloudDoc, CloudWrite, PulledDocs, SyncCursor } from './cloudTypes';
import { cursorAfter } from './cloudTypes';

/**
 * In-memory stand-in for Firestore used by the sync tests. Like Firestore, a merge write merges map
 * fields key by key, and every write gets a later server timestamp.
 */
export class MemoryCloud implements Cloud {
  docs: Record<CloudCollection, Map<string, CloudDoc>> = {
    meta: new Map(),
    sessions: new Map(),
    solveChunks: new Map(),
  };
  private clock = 0;
  reads = 0;
  writes = 0;

  async pull(since: SyncCursor | null): Promise<PulledDocs> {
    const changed = (collection: CloudCollection) => {
      const docs = [...this.docs[collection].values()].filter((d) => cursorAfter(d.syncedAt, since));
      this.reads += Math.max(1, docs.length); // Firestore bills an empty query as one read
      return structuredClone(docs);
    };
    return { meta: changed('meta'), sessions: changed('sessions'), solveChunks: changed('solveChunks') };
  }

  async push(writes: readonly CloudWrite[]): Promise<void> {
    for (const write of writes) {
      const syncedAt = { seconds: ++this.clock, nanos: 0 };
      const existing = this.docs[write.collection].get(write.id);
      const data: Record<string, unknown> = write.merge && existing ? structuredClone(existing.data) : {};
      for (const [key, value] of Object.entries(structuredClone(write.data))) {
        const old = data[key];
        data[key] = write.merge && isMap(old) && isMap(value) ? { ...old, ...value } : value;
      }
      this.docs[write.collection].set(write.id, { id: write.id, data, syncedAt });
      this.writes += 1;
    }
  }

  async deleteAll(): Promise<void> {
    for (const map of Object.values(this.docs)) map.clear();
  }
}

const isMap = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
