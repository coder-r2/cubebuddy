import { useEffect } from 'react';

/** Keep the screen on while `active` (Screen Wake Lock API, where supported). */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let released = false;

    const acquire = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (released) await lock.release();
        else sentinel = lock;
      } catch {
        // Denied (e.g. battery saver); the page works without it.
      }
    };
    // The browser drops the lock whenever the tab is hidden, so take it again on return.
    const onVisibility = () => void acquire();

    void acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void sentinel?.release();
    };
  }, [active]);
}
