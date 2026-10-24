import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const CHECK_EVERY_MS = 60 * 60 * 1000;

/**
 * Registers the service worker and offers new versions instead of switching silently (D-023): the new
 * worker waits until the user presses Reload, so a page never changes under someone mid-solve.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // Installed apps can stay open for days; look for a new deploy hourly and when they come back.
      const check = () => {
        if (navigator.onLine) registration.update().catch(() => undefined);
      };
      setInterval(check, CHECK_EVERY_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
    onRegisterError(error) {
      console.warn('Service worker registration failed', error);
    },
  });

  useEffect(() => {
    if (!offlineReady) return;
    const id = setTimeout(() => setOfflineReady(false), 5000);
    return () => clearTimeout(id);
  }, [offlineReady, setOfflineReady]);

  if (!needRefresh && !offlineReady) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-border bg-surface p-3 shadow-lg lg:bottom-6 print:hidden"
    >
      <p className="flex-1 text-sm">
        {needRefresh ? 'A new version of CubeBuddy is available.' : 'CubeBuddy is ready to work offline.'}
      </p>
      {needRefresh && (
        <button
          type="button"
          onClick={() => void updateServiceWorker(true)}
          className="h-10 rounded-lg bg-accent px-4 text-sm font-medium text-accent-contrast"
        >
          Reload
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          setNeedRefresh(false);
          setOfflineReady(false);
        }}
        className="h-10 rounded-lg px-3 text-sm text-muted hover:bg-surface-2"
      >
        {needRefresh ? 'Later' : 'OK'}
      </button>
    </div>
  );
}
