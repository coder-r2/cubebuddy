import { useEffect, useState, type FormEvent } from 'react';
import { Dialog } from '../../components/ui/Dialog';
import { Icon } from '../../components/ui/Icon';
import { authMessage, STATUS_COLOUR, useAccount, type SyncStatus } from '../../sync/account';
import { BackupPanel } from '../settings/BackupPanel';

const card = 'rounded-xl border border-border bg-surface p-4 sm:p-5';
const primary = 'h-11 rounded-lg bg-accent px-4 font-medium text-accent-contrast disabled:opacity-50';
const secondary =
  'h-11 rounded-lg border border-border px-4 font-medium hover:bg-surface-2 disabled:opacity-50';
const input = 'h-11 w-full rounded-lg border border-border bg-bg px-3 text-base';

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z"
      />
      <path
        fill="#FBBC05"
        d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6.1z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z"
      />
    </svg>
  );
}

const STATUS_TEXT: Record<SyncStatus, string> = {
  idle: 'Not synced yet',
  syncing: 'Syncing…',
  synced: 'Synced',
  offline: 'Offline: changes will sync when you’re back online',
  error: 'Sync problem',
};

function SignIn() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword } = useAccount();
  const [mode, setMode] = useState<'sign-in' | 'sign-up' | 'reset'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const run = async (action: () => Promise<void>, success?: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      if (success) setMessage({ ok: true, text: success });
    } catch (error) {
      const text = authMessage(error);
      if (text) setMessage({ ok: false, text });
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'reset') {
      void run(
        () => resetPassword(email.trim()),
        'If there’s an account for this email, a reset link is on its way. Check your inbox (and spam).',
      );
    } else if (mode === 'sign-up') {
      void run(() => signUpWithEmail(email.trim(), password));
    } else {
      void run(() => signInWithEmail(email.trim(), password));
    }
  };

  return (
    <div className="space-y-5">
      <div className={card}>
        <h2 className="text-lg font-semibold">Sync across your devices</h2>
        <p className="mt-1 text-sm text-muted">
          Sign in to keep your solves, sessions, settings and trainer progress in step on your phone, tablet
          and laptop. Everything works without an account too; your data stays on this device.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(signInWithGoogle)}
          className="mt-4 flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-border bg-bg font-medium hover:bg-surface-2 disabled:opacity-50"
        >
          <GoogleLogo />
          Continue with Google
        </button>

        <div className="my-5 flex items-center gap-3 text-xs text-muted" aria-hidden>
          <span className="h-px flex-1 bg-border" />
          or with email
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`mt-1 ${input}`}
            />
          </label>
          {mode !== 'reset' && (
            <label className="block">
              <span className="text-sm font-medium">Password</span>
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`mt-1 ${input}`}
              />
              {mode === 'sign-up' && (
                <span className="mt-1 block text-xs text-muted">At least 6 characters.</span>
              )}
            </label>
          )}
          <button type="submit" disabled={busy} className={`w-full ${primary}`}>
            {mode === 'sign-in' ? 'Sign in' : mode === 'sign-up' ? 'Create account' : 'Send reset link'}
          </button>
        </form>
        {message && (
          <p role="status" className={`mt-3 text-sm ${message.ok ? 'text-success' : 'text-danger'}`}>
            {message.text}
          </p>
        )}
        <div className="mt-4 flex flex-wrap justify-between gap-2 text-sm">
          {mode === 'sign-in' ? (
            <>
              <button type="button" className="text-accent underline" onClick={() => setMode('sign-up')}>
                New here? Create an account
              </button>
              <button type="button" className="text-muted underline" onClick={() => setMode('reset')}>
                Forgot password?
              </button>
            </>
          ) : (
            <button type="button" className="text-accent underline" onClick={() => setMode('sign-in')}>
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SignOutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const signOut = useAccount((s) => s.signOut);
  const [busy, setBusy] = useState(false);
  const go = async (keep: boolean) => {
    setBusy(true);
    try {
      await signOut(keep);
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onClose={onClose} title="Sign out">
      <p className="text-sm text-muted">
        Your data stays safe in your account either way. Should this device keep a copy?
      </p>
      <div className="mt-4 grid gap-2">
        <button type="button" disabled={busy} onClick={() => void go(true)} className={primary}>
          Keep my data on this device
        </button>
        <button type="button" disabled={busy} onClick={() => void go(false)} className={secondary}>
          Remove it from this device
        </button>
      </div>
    </Dialog>
  );
}

function DeleteAccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useAccount((s) => s.user);
  const deleteAccount = useAccount((s) => s.deleteAccount);
  const [password, setPassword] = useState('');
  const [keepLocal, setKeepLocal] = useState(true);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await deleteAccount(user?.usesPassword ? password : null, keepLocal);
      onClose();
    } catch (err) {
      setError(authMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Delete account">
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <p className="text-sm text-muted">
          This permanently deletes your account and every solve, session, setting and trainer record stored in
          it. It can’t be undone. Export a backup first if you might want your data later.
        </p>
        {user?.usesPassword ? (
          <label className="block">
            <span className="text-sm font-medium">Your password</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`mt-1 ${input}`}
            />
          </label>
        ) : (
          <p className="text-sm text-muted">Google will ask you to confirm it’s you.</p>
        )}
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={keepLocal}
            onChange={(e) => setKeepLocal(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-accent"
          />
          Keep a copy of my data on this device
        </label>
        <label className="block">
          <span className="text-sm font-medium">Type DELETE to confirm</span>
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} className={`mt-1 ${input}`} />
        </label>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || confirm.trim().toUpperCase() !== 'DELETE'}
          className="h-11 w-full rounded-lg bg-danger px-4 font-medium text-white disabled:opacity-50"
        >
          {busy ? 'Deleting…' : 'Delete my account'}
        </button>
      </form>
    </Dialog>
  );
}

function SignedIn() {
  const { user, sync, syncNow, resendVerification, refreshUser } = useAccount();
  const [dialog, setDialog] = useState<'sign-out' | 'delete' | null>(null);
  const [note, setNote] = useState('');
  if (!user) return null;

  return (
    <div className="space-y-5">
      <div className={card}>
        <p className="text-sm text-muted">Signed in as</p>
        <p className="text-lg font-semibold break-all">{user.name || user.email}</p>
        {user.name && user.email && <p className="text-sm break-all text-muted">{user.email}</p>}

        {user.usesPassword && !user.emailVerified && (
          <div className="mt-4 rounded-lg border border-accent/40 bg-accent/5 p-3 text-sm">
            <p className="font-medium">Please verify your email</p>
            <p className="mt-1 text-muted">
              We sent a link to {user.email}. Verifying lets you reset your password if you forget it. Sync
              works in the meantime.
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              <button
                type="button"
                className="text-accent underline"
                onClick={() =>
                  void resendVerification().then(
                    () => setNote('Sent. Check your inbox (and spam).'),
                    (e: unknown) => setNote(authMessage(e)),
                  )
                }
              >
                Send the link again
              </button>
              <button type="button" className="text-accent underline" onClick={() => void refreshUser()}>
                I’ve verified it
              </button>
            </div>
            {note && <p className="mt-2 text-muted">{note}</p>}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_COLOUR[sync.status]}`} aria-hidden />
          <div className="min-w-0 flex-1" role="status" data-testid="sync-status">
            <p className="font-medium">{STATUS_TEXT[sync.status]}</p>
            {sync.lastSyncedAt && sync.status !== 'syncing' && (
              <p className="text-sm text-muted">
                Last synced{' '}
                {new Date(sync.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
            {sync.error && <p className="text-sm text-danger">{sync.error} It will retry automatically.</p>}
          </div>
          <button
            type="button"
            disabled={sync.status === 'syncing'}
            onClick={() => void syncNow()}
            className={`inline-flex items-center gap-2 ${secondary}`}
          >
            <Icon name="refresh" className="h-4 w-4" />
            Sync now
          </button>
        </div>
        <button type="button" onClick={() => setDialog('sign-out')} className={`mt-4 ${secondary}`}>
          Sign out
        </button>
      </div>

      <div className={card}>
        <h2 className="mb-3 text-lg font-semibold">Backup</h2>
        <BackupPanel />
      </div>

      <div className={`${card} border-danger/40`}>
        <h2 className="text-lg font-semibold">Delete account</h2>
        <p className="mt-1 text-sm text-muted">Removes your account and all data stored in it.</p>
        <button
          type="button"
          onClick={() => setDialog('delete')}
          className="mt-3 h-11 rounded-lg border border-danger px-4 font-medium text-danger hover:bg-danger/10"
        >
          Delete account…
        </button>
      </div>

      <SignOutDialog open={dialog === 'sign-out'} onClose={() => setDialog(null)} />
      <DeleteAccountDialog open={dialog === 'delete'} onClose={() => setDialog(null)} />
    </div>
  );
}

export default function AccountPage() {
  const { configured, auth, loadFailed, start } = useAccount();
  useEffect(() => {
    void start().catch((error: unknown) => console.error('Accounts failed to load', error));
  }, [start]);

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
      {!configured ? (
        <>
          <p className={`${card} text-muted`}>
            Accounts aren’t available in this build. Everything else works, and your data stays on this
            device.
          </p>
          <div className={card}>
            <h2 className="mb-3 text-lg font-semibold">Backup</h2>
            <BackupPanel />
          </div>
        </>
      ) : auth === 'signed-in' ? (
        <SignedIn />
      ) : auth === 'signed-out' ? (
        <>
          <SignIn />
          <div className={card}>
            <h2 className="mb-3 text-lg font-semibold">Backup</h2>
            <BackupPanel />
          </div>
        </>
      ) : loadFailed ? (
        <div className={card}>
          <p className="text-muted">Sign-in couldn’t load. Check your connection and try again.</p>
          <button
            type="button"
            onClick={() => void start().catch(() => undefined)}
            className={`mt-3 ${secondary}`}
          >
            Try again
          </button>
        </div>
      ) : (
        <p className="text-muted">Loading…</p>
      )}
    </div>
  );
}
