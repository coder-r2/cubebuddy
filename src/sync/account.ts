import { create } from 'zustand';
import { db, SYNCED_TABLES } from '../db/db';
import { useSettings } from '../stores/settings';
import { accountsConfigured } from './config';
import { clearSyncState, syncOnce, type ChangedArea } from './syncEngine';

// Account + sync service (SPEC §5.9, §7.3, D-092). The Firebase SDK is imported lazily: at app start only
// if this device was signed in last time, otherwise when the Account page opens.

type Firebase = typeof import('./firebase');

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

/** Dot colour for each sync status (Account page and the header badge). */
export const STATUS_COLOUR: Record<SyncStatus, string> = {
  idle: 'bg-muted',
  syncing: 'bg-accent animate-pulse',
  synced: 'bg-success',
  offline: 'bg-muted',
  error: 'bg-danger',
};

export interface AccountUser {
  uid: string;
  email: string | null;
  name: string | null;
  emailVerified: boolean;
  usesPassword: boolean;
}

interface AccountState {
  configured: boolean;
  /** 'loading' until Firebase has reported the signed-in user (or that there is none). */
  auth: 'idle' | 'loading' | 'signed-out' | 'signed-in';
  /** Firebase couldn't be loaded (e.g. offline before the app was cached). */
  loadFailed: boolean;
  user: AccountUser | null;
  sync: { status: SyncStatus; lastSyncedAt: number | null; error: string | null };
  start: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  refreshUser: () => Promise<void>;
  syncNow: () => Promise<void>;
  signOut: (keepLocalData: boolean) => Promise<void>;
  deleteAccount: (password: string | null, keepLocalData: boolean) => Promise<void>;
}

/** Remembers that this device is signed in, so Firebase loads at startup only when needed. */
const SIGNED_IN_KEY = 'cubebuddy:signed-in';
const DEBOUNCE_MS = 5000;
const FOCUS_MIN_GAP_MS = 30_000;
const MAX_BACKOFF_MS = 5 * 60_000;

function storeFlag(on: boolean) {
  try {
    if (on) localStorage.setItem(SIGNED_IN_KEY, '1');
    else localStorage.removeItem(SIGNED_IN_KEY);
  } catch {
    // Without storage Firebase just loads on the Account page instead of at startup.
  }
}

export function wasSignedIn() {
  try {
    return localStorage.getItem(SIGNED_IN_KEY) === '1';
  } catch {
    return false;
  }
}

let firebase: Firebase | null = null;
let loading: Promise<Firebase> | null = null;
const loadFirebase = () => (loading ??= import('./firebase').then((m) => (firebase = m)));

/** Friendly text for Firebase errors; '' for ones the user caused on purpose (closing the popup). */
export function authMessage(error: unknown): string {
  const code =
    error && typeof error === 'object' && 'code' in error ? String((error as { code: unknown }).code) : '';
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return '';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-login-credentials':
      return 'That email and password don’t match an account.';
    case 'auth/email-already-in-use':
      return 'There’s already an account with this email. Sign in instead, or reset the password.';
    case 'auth/weak-password':
      return 'Choose a password with at least 6 characters.';
    case 'auth/invalid-email':
    case 'auth/missing-email':
      return 'That doesn’t look like an email address.';
    case 'auth/missing-password':
      return 'Enter your password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes and try again.';
    case 'auth/network-request-failed':
      return 'No connection. Check your internet and try again.';
    case 'auth/unauthorized-domain':
      return 'Sign-in isn’t allowed from this address (the domain isn’t authorised in Firebase).';
    case 'auth/popup-blocked':
      return 'The sign-in window was blocked. Allow popups for this site and try again.';
    case 'permission-denied':
      return 'The server refused access to your data. The Firestore security rules may not be published yet.';
    case 'unavailable':
      return 'The sync server can’t be reached right now.';
    default:
      return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
  }
}

function toUser(user: import('./firebase').User, fb: Firebase): AccountUser {
  return {
    uid: user.uid,
    email: user.email,
    name: user.displayName,
    emailVerified: user.emailVerified,
    usesPassword: fb.usesPassword(user),
  };
}

/** Re-read the in-memory stores from IndexedDB after data changed underneath them (sync, import). */
export async function reloadStores(changed: Set<ChangedArea> = new Set(['settings', 'timer', 'trainer'])) {
  if (changed.has('settings')) await useSettings.getState().hydrate();
  if (changed.has('timer')) {
    const { useTimerStore } = await import('../stores/timer');
    if (useTimerStore.getState().loaded) await useTimerStore.getState().load();
  }
  if (changed.has('trainer')) {
    const { useTrainerStore } = await import('../stores/trainer');
    if (useTrainerStore.getState().loaded) await useTrainerStore.getState().load();
  }
}

export const useAccount = create<AccountState>((set, get) => {
  // --- Sync scheduling: pull on sign-in, focus and reconnect; push 5 s after local changes. ---
  let uid: string | null = null;
  let running: Promise<void> | null = null;
  let again = false;
  let debounce: ReturnType<typeof setTimeout> | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let failures = 0;
  let lastAttempt = 0;
  let detach: (() => void) | null = null;

  const setSync = (patch: Partial<AccountState['sync']>) => set({ sync: { ...get().sync, ...patch } });

  async function runSync() {
    if (!uid || !firebase) return;
    if (running) {
      again = true;
      return running;
    }
    clearTimeout(debounce);
    clearTimeout(retry);
    debounce = retry = undefined;
    if (!navigator.onLine) {
      setSync({ status: 'offline' });
      return;
    }
    lastAttempt = Date.now();
    setSync({ status: 'syncing', error: null });
    const forUid = uid;
    running = (async () => {
      try {
        const result = await syncOnce(db, firebase!.cloudFor(forUid), forUid);
        if (uid !== forUid) return;
        failures = 0;
        setSync({ status: 'synced', lastSyncedAt: Date.now(), error: null });
        await reloadStores(result.changed);
      } catch (error) {
        if (uid !== forUid) return;
        console.warn('Sync failed', error);
        const offline = !navigator.onLine || firebase!.errorCode(error) === 'unavailable';
        setSync({ status: offline ? 'offline' : 'error', error: offline ? null : authMessage(error) });
        // Retry with exponential backoff; a reconnect or focus retries sooner.
        failures++;
        retry = setTimeout(() => void runSync(), Math.min(MAX_BACKOFF_MS, 5000 * 2 ** (failures - 1)));
      } finally {
        running = null;
      }
    })();
    await running;
    if (again && uid === forUid) {
      again = false;
      await runSync();
    }
  }

  function attach() {
    const onWrite = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => void runSync(), DEBOUNCE_MS);
    };
    const onFocus = () => {
      if (Date.now() - lastAttempt > FOCUS_MIN_GAP_MS) void runSync();
    };
    const onVisibility = () => {
      // Leaving the page: push pending changes now rather than after the debounce.
      if (document.visibilityState === 'hidden' && debounce) void runSync();
      if (document.visibilityState === 'visible') onFocus();
    };
    const onOnline = () => void runSync();
    const onOffline = () => setSync({ status: 'offline' });
    const unsubscribe = db.onLocalWrite(onWrite);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    detach = () => {
      unsubscribe();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      clearTimeout(debounce);
      clearTimeout(retry);
      debounce = retry = undefined;
      detach = null;
    };
  }

  async function clearLocalData() {
    await db.transaction('rw', [...SYNCED_TABLES.map((t) => db.table(t)), db.syncMeta], async () => {
      await Promise.all([...SYNCED_TABLES.map((t) => db.table(t).clear()), db.syncMeta.clear()]);
    });
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('cubebuddy:') && key !== SIGNED_IN_KEY) localStorage.removeItem(key);
      }
    } catch {
      // Nothing else to clear.
    }
    await reloadStores();
  }

  async function afterSignOut(keepLocalData: boolean) {
    detach?.();
    uid = null;
    failures = 0;
    await clearSyncState(db);
    if (!keepLocalData) await clearLocalData();
    set({ sync: { status: 'idle', lastSyncedAt: null, error: null } });
  }

  return {
    configured: accountsConfigured,
    auth: 'idle',
    loadFailed: false,
    user: null,
    sync: { status: 'idle', lastSyncedAt: null, error: null },

    async start() {
      if (!accountsConfigured || get().auth !== 'idle') return;
      set({ auth: 'loading', loadFailed: false });
      let fb: Firebase;
      try {
        fb = await loadFirebase();
      } catch (error) {
        loading = null;
        set({ auth: 'idle', loadFailed: true });
        throw error;
      }
      fb.onUser((user) => {
        if (user) {
          storeFlag(true);
          set({ auth: 'signed-in', user: toUser(user, fb) });
          if (uid !== user.uid) {
            detach?.();
            uid = user.uid;
            attach();
            void runSync();
          }
        } else {
          storeFlag(false);
          const wasIn = uid !== null;
          set({ auth: 'signed-out', user: null });
          // Signed out elsewhere (or the session expired): stop syncing but keep local data.
          if (wasIn) void afterSignOut(true);
        }
      });
    },

    async signInWithGoogle() {
      await (await loadFirebase()).signInWithGoogle();
    },
    async signInWithEmail(email, password) {
      await (await loadFirebase()).signInWithEmail(email, password);
    },
    async signUpWithEmail(email, password) {
      await (await loadFirebase()).signUpWithEmail(email, password);
    },
    async resetPassword(email) {
      await (await loadFirebase()).resetPassword(email);
    },
    async resendVerification() {
      await (await loadFirebase()).resendVerification();
    },
    async refreshUser() {
      const fb = await loadFirebase();
      const user = await fb.refreshUser();
      if (user) set({ user: toUser(user, fb) });
    },

    syncNow: () => runSync(),

    async signOut(keepLocalData) {
      const fb = await loadFirebase();
      // Upload anything still pending first, so nothing made on this device is lost.
      if (uid && navigator.onLine) await runSync().catch(() => undefined);
      await afterSignOut(keepLocalData);
      await fb.signOut();
    },

    async deleteAccount(password, keepLocalData) {
      const fb = await loadFirebase();
      detach?.();
      try {
        await fb.deleteAccount(password);
      } catch (error) {
        if (uid) attach();
        throw error;
      }
      await afterSignOut(keepLocalData);
    },
  };
});
