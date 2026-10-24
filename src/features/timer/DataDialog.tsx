import { useState } from 'react';
import { Dialog } from '../../components/ui/Dialog';
import { download, today } from '../../lib/download';
import { useTimerStore, type ImportSummary } from '../../stores/timer';
import { CstimerFormatError, parseCstimer } from './cstimer';

const safeName = (name: string) => name.replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '') || 'session';

function describe(summary: ImportSummary) {
  const parts = [
    `Added ${summary.solvesAdded} solve${summary.solvesAdded === 1 ? '' : 's'}`,
    `${summary.sessionsCreated} new session${summary.sessionsCreated === 1 ? '' : 's'}`,
  ];
  if (summary.duplicatesSkipped) parts.push(`${summary.duplicatesSkipped} already here (skipped)`);
  let text = parts.join(', ') + '.';
  if (summary.unsupportedSessions.length) {
    text += ` Not imported (only 3x3 and 2x2 are supported): ${summary.unsupportedSessions.join(', ')}.`;
  }
  return text;
}

/** cstimer import/export (SPEC §5.4, D-008, D-022). */
export function DataDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const sessions = useTimerStore((s) => s.sessions);
  const currentId = useTimerStore((s) => s.currentSessionId);
  const importSessions = useTimerStore((s) => s.importSessions);
  const exportSessions = useTimerStore((s) => s.exportSessions);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const current = sessions.find((s) => s.id === currentId);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const summary = await importSessions(parseCstimer(await file.text()));
      setMessage({ ok: true, text: describe(summary) });
    } catch (error) {
      console.error('cstimer import failed', error);
      setMessage({
        ok: false,
        text:
          error instanceof CstimerFormatError
            ? error.message
            : 'Import failed. Is this a cstimer export file?',
      });
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setMessage(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} title="Import / export">
      <div className="space-y-5">
        <section>
          <h3 className="font-medium">Import from cstimer</h3>
          <p className="mt-1 text-sm text-muted">
            In cstimer, open Export → “Export to file”, then choose that file here. Each cstimer session
            becomes a session here; solves you already have are skipped.
          </p>
          <label className="mt-2 flex h-11 cursor-pointer items-center justify-center rounded-lg bg-accent font-medium text-accent-contrast has-disabled:opacity-60">
            {busy ? 'Importing…' : 'Choose file…'}
            <input
              type="file"
              accept=".txt,.json,text/plain,application/json"
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                void onFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
          {message && (
            <p role="status" className={`mt-2 text-sm ${message.ok ? 'text-success' : 'text-danger'}`}>
              {message.text}
            </p>
          )}
        </section>

        <section>
          <h3 className="font-medium">Export (cstimer format)</h3>
          <p className="mt-1 text-sm text-muted">
            The file can be imported into cstimer or back into CubeBuddy.
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={!current}
              onClick={async () =>
                current &&
                download(
                  await exportSessions([current.id]),
                  `cubebuddy-${safeName(current.name)}-${today()}.txt`,
                )
              }
              className="h-11 rounded-lg border border-border font-medium hover:bg-surface-2"
            >
              This session
            </button>
            <button
              type="button"
              onClick={async () =>
                download(await exportSessions(sessions.map((s) => s.id)), `cubebuddy-all-${today()}.txt`)
              }
              className="h-11 rounded-lg border border-border font-medium hover:bg-surface-2"
            >
              All sessions
            </button>
          </div>
        </section>
      </div>
    </Dialog>
  );
}
