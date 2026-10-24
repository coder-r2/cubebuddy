import { useState } from 'react';
import { Dialog } from '../../components/ui/Dialog';
import { Icon, type IconName } from '../../components/ui/Icon';
import type { Puzzle, Session } from '../../db/types';
import { useTimerStore } from '../../stores/timer';

const PUZZLE_LABEL: Record<Puzzle, string> = { '3x3x3': '3x3', '2x2x2': '2x2' };

interface SessionBarProps {
  onOpenOptions: () => void;
  onOpenData: () => void;
}

function IconButton({ icon, label, onClick }: { icon: IconName; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text"
    >
      <Icon name={icon} />
    </button>
  );
}

/** Session picker plus create / rename / delete (SPEC §5.4, D-018). */
export function SessionBar({ onOpenOptions, onOpenData }: SessionBarProps) {
  const sessions = useTimerStore((s) => s.sessions);
  const currentId = useTimerStore((s) => s.currentSessionId);
  const selectSession = useTimerStore((s) => s.selectSession);
  const deleteSession = useTimerStore((s) => s.deleteSession);
  const [editing, setEditing] = useState<'new' | Session | null>(null);
  const current = sessions.find((s) => s.id === currentId);

  const onDelete = () => {
    if (!current) return;
    if (window.confirm(`Delete the session “${current.name}” and all its solves?`))
      void deleteSession(current.id);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <h1 className="mr-2 text-2xl font-semibold tracking-tight">Timer</h1>
      <label className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
        <span className="sr-only">Session</span>
        <select
          value={currentId ?? ''}
          onChange={(e) => void selectSession(e.target.value)}
          className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 sm:w-56"
        >
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({PUZZLE_LABEL[s.puzzle]})
            </option>
          ))}
        </select>
      </label>
      <div className="flex w-full items-center justify-between sm:w-auto sm:justify-start">
        <IconButton icon="plus" label="New session" onClick={() => setEditing('new')} />
        <IconButton icon="edit" label="Rename session" onClick={() => current && setEditing(current)} />
        <IconButton icon="trash" label="Delete session" onClick={onDelete} />
        <IconButton icon="transfer" label="Import / export" onClick={onOpenData} />
        <IconButton icon="sliders" label="Timer options" onClick={onOpenOptions} />
      </div>

      <SessionDialog editing={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function SessionDialog({ editing, onClose }: { editing: 'new' | Session | null; onClose: () => void }) {
  const createSession = useTimerStore((s) => s.createSession);
  const renameSession = useTimerStore((s) => s.renameSession);
  const isNew = editing === 'new';

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get('name') ?? '');
    if (isNew) await createSession(name, form.get('puzzle') as Puzzle);
    else if (editing) await renameSession(editing.id, name);
    onClose();
  };

  return (
    <Dialog open={editing !== null} onClose={onClose} title={isNew ? 'New session' : 'Rename session'}>
      {/* Keyed so the form's default values reset each time the dialog opens. */}
      <form
        key={isNew ? 'new' : (editing?.id ?? '')}
        onSubmit={(e) => void onSubmit(e)}
        className="space-y-4"
      >
        <label className="block">
          <span className="text-sm font-medium">Name</span>
          <input
            name="name"
            required
            maxLength={40}
            autoFocus
            defaultValue={isNew ? '' : (editing?.name ?? '')}
            className="mt-1 h-11 w-full rounded-lg border border-border bg-bg px-3"
          />
        </label>
        {isNew && (
          <fieldset>
            <legend className="text-sm font-medium">Puzzle</legend>
            <div className="mt-1 flex gap-2">
              {(['3x3x3', '2x2x2'] as const).map((puzzle) => (
                <label
                  key={puzzle}
                  className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border has-checked:border-accent has-checked:bg-surface-2"
                >
                  <input type="radio" name="puzzle" value={puzzle} defaultChecked={puzzle === '3x3x3'} />
                  {PUZZLE_LABEL[puzzle]}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <button type="submit" className="h-11 w-full rounded-lg bg-accent font-medium text-accent-contrast">
          {isNew ? 'Create session' : 'Save'}
        </button>
      </form>
    </Dialog>
  );
}
