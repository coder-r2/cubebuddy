import { wrap, type Remote } from 'comlink';
import type { EngineAPI } from './api';

let remote: Remote<EngineAPI> | null = null;

/** The engine worker, started on first use; its tables are built straight away in the background. */
export function getEngine(): Remote<EngineAPI> {
  if (!remote) {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), {
      type: 'module',
      name: 'cubebuddy-engine',
    });
    remote = wrap<EngineAPI>(worker);
    remote
      .init()
      .then((timings) => console.info('[engine] tables built (ms)', timings))
      .catch((error: unknown) => console.error('[engine] failed to start', error));
  }
  return remote;
}
