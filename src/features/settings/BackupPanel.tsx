import { useState } from 'react';
import { db } from '../../db/db';
import { BackupFormatError, exportBackup, importBackup, parseBackup } from '../../lib/backup';
import { download, today } from '../../lib/download';
import { reloadStores, useAccount } from '../../sync/account';

/** Export / import everything as JSON (SPEC §5.8, §5.9): works signed in or out. */
export function BackupPanel() {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const onExport = async () => {
    const backup = await exportBackup(db);
    download(JSON.stringify(backup, null, 1), `cubebuddy-backup-${today()}.json`, 'application/json');
    setMessage({
      ok: true,
      text: `Saved ${backup.solves.length} solve${backup.solves.length === 1 ? '' : 's'} in ${backup.sessions.length} session${backup.sessions.length === 1 ? '' : 's'}, your settings and trainer progress.`,
    });
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const result = await importBackup(db, parseBackup(await file.text()));
      await reloadStores();
      if (useAccount.getState().auth === 'signed-in') void useAccount.getState().syncNow();
      setMessage({
        ok: true,
        text:
          result.added + result.updated === 0
            ? 'Nothing new: everything in this backup is already here.'
            : `Imported: ${result.added} new record${result.added === 1 ? '' : 's'}, ${result.updated} updated. Newer data on this device was kept.`,
      });
    } catch (error) {
      console.error('Backup import failed', error);
      setMessage({
        ok: false,
        text:
          error instanceof BackupFormatError
            ? error.message
            : 'Import failed. Is this a CubeBuddy backup file?',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        A backup file holds your solves, sessions, settings, alg choices and trainer progress. Importing
        merges it with what’s here; nothing newer is overwritten.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => void onExport()}
          className="h-11 rounded-lg border border-border font-medium hover:bg-surface-2"
        >
          Export backup (JSON)
        </button>
        <label className="flex h-11 cursor-pointer items-center justify-center rounded-lg border border-border font-medium hover:bg-surface-2 has-disabled:opacity-60">
          {busy ? 'Importing…' : 'Import backup…'}
          <input
            type="file"
            accept=".json,application/json"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
      </div>
      {message && (
        <p role="status" className={`text-sm ${message.ok ? 'text-success' : 'text-danger'}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
