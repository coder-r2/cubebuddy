import { useEffect, useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { bindKey, effectiveKeymap, isBindableKey, keyLabel, unbindKey } from '../../lib/keymap';
import { useSettings } from '../../stores/settings';

const GROUPS: { title: string; moves: string[] }[] = [
  { title: 'Faces', moves: ['R', "R'", 'L', "L'", 'U', "U'", 'D', "D'", 'F', "F'", 'B', "B'"] },
  { title: 'Wide', moves: ['r', "r'", 'l', "l'", 'u', "u'", 'd', "d'", 'f', "f'", 'b', "b'"] },
  { title: 'Slices', moves: ['M', "M'", 'E', "E'", 'S', "S'"] },
  { title: 'Rotations', moves: ['x', "x'", 'y', "y'", 'z', "z'"] },
];

const pretty = (move: string) => move.replace(/'/g, '′');

/** Keyboard map for the virtual cube (SPEC §5.8): cstimer layout by default, every key re-bindable. */
export function KeymapEditor() {
  const overrides = useSettings((s) => s.settings.keymap);
  const update = useSettings((s) => s.update);
  const [capturing, setCapturing] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const map = effectiveKeymap(overrides);
  const keysFor = (move: string) =>
    Object.keys(map)
      .filter((code) => map[code] === move)
      .sort();

  useEffect(() => {
    if (!capturing) return;
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') {
        setCapturing(null);
        return;
      }
      if (!isBindableKey(e.code) || e.ctrlKey || e.metaKey || e.altKey) {
        setNotice(
          `${e.key === ' ' ? 'Space' : e.key} can’t be used. Press a letter, digit or punctuation key.`,
        );
        return;
      }
      const previous = map[e.code];
      void update({ keymap: bindKey(overrides, e.code, capturing) });
      setNotice(
        previous && previous !== capturing
          ? `${keyLabel(e.code)} now does ${pretty(capturing)} (it did ${pretty(previous)} before).`
          : `${keyLabel(e.code)} now does ${pretty(capturing)}.`,
      );
      setCapturing(null);
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [capturing, map, overrides, update]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Keys follow cstimer’s virtual cube by default. Press <span className="font-medium">+</span> next to a
        move and then the key you want; a key can only do one move.
      </p>
      <p className="min-h-5 text-sm" role="status" aria-live="polite">
        {capturing ? `Press a key for ${pretty(capturing)} (Esc to cancel)…` : notice}
      </p>
      {GROUPS.map((group) => (
        <fieldset key={group.title}>
          <legend className="text-sm font-medium">{group.title}</legend>
          <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {group.moves.map((move) => (
              <li
                key={move}
                className={`flex min-h-11 items-center gap-2 rounded-lg border px-2 ${
                  capturing === move ? 'border-accent bg-surface-2' : 'border-border'
                }`}
              >
                <span className="w-8 font-mono font-semibold">{pretty(move)}</span>
                <span className="flex flex-1 flex-wrap gap-1">
                  {keysFor(move).map((code) => (
                    <span
                      key={code}
                      className="inline-flex items-center gap-0.5 rounded border border-border bg-surface-2 pl-1.5 font-mono text-sm"
                    >
                      {keyLabel(code)}
                      <button
                        type="button"
                        aria-label={`Remove key ${keyLabel(code)} from ${move}`}
                        onClick={() => void update({ keymap: unbindKey(overrides, code) })}
                        className="grid h-7 w-7 place-items-center text-muted hover:text-text"
                      >
                        <Icon name="close" className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </span>
                <button
                  type="button"
                  aria-label={`Add a key for ${move}`}
                  aria-pressed={capturing === move}
                  onClick={() => {
                    setNotice('');
                    setCapturing(capturing === move ? null : move);
                  }}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text"
                >
                  <Icon name="plus" className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </fieldset>
      ))}
      <button
        type="button"
        disabled={Object.keys(overrides).length === 0}
        onClick={() => {
          void update({ keymap: {} });
          setNotice('Keyboard map reset to the cstimer layout.');
        }}
        className="h-10 rounded-lg border border-border px-4 text-sm font-medium hover:bg-surface-2 disabled:opacity-50"
      >
        Reset to default
      </button>
    </div>
  );
}
