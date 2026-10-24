import { useState } from 'react';
import { formatMove, mergeMoves, parseMove } from '../../engine/notation';
import type { LogEntry } from './useFreePlay';

const SHOWN = 35;

interface Group {
  source: LogEntry['source'];
  moves: string[];
}

/** Merge runs of same-source moves (`R R` → `R2`, `R R'` → gone); helper and user moves never merge (D-032/033). */
function mergeLog(log: readonly LogEntry[]): Group[] {
  const groups: Group[] = [];
  for (const entry of log) {
    const last = groups.at(-1);
    if (last && last.source === entry.source) last.moves.push(entry.move);
    else groups.push({ source: entry.source, moves: [entry.move] });
  }
  return groups.map((g) => ({
    source: g.source,
    moves: mergeMoves(g.moves.map((m) => parseMove(m)!)).map(formatMove),
  }));
}

export function HistoryPanel({ base, log }: { base: string; log: readonly LogEntry[] }) {
  const [copied, setCopied] = useState(false);
  const tokens = mergeLog(log).flatMap((g) => g.moves.map((move) => ({ move, source: g.source })));
  const shown = tokens.slice(-SHOWN);
  const full = tokens.map((t) => t.move).join(' ');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText([base && `(${base})`, full].filter(Boolean).join(' '));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; the sequence is still visible to copy by hand.
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-medium tracking-wide text-muted uppercase">History</h2>
        <div className="flex items-center gap-3 text-sm text-muted">
          <span data-testid="move-count">
            {log.length} move{log.length === 1 ? '' : 's'}
          </span>
          <button
            type="button"
            onClick={() => void copy()}
            disabled={tokens.length === 0}
            className="rounded-md px-2 py-1 hover:bg-surface-2 hover:text-text disabled:opacity-50"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      {base && (
        <p className="mt-2 font-mono text-xs break-words text-muted">
          <span className="font-sans">Scramble:</span> {base}
        </p>
      )}
      <p className="mt-2 min-h-7 font-mono text-base leading-relaxed break-words" data-testid="history-moves">
        {tokens.length > SHOWN && <span className="text-muted">… </span>}
        {shown.length === 0 && (
          <span className="font-sans text-sm text-muted">Moves you make appear here.</span>
        )}
        {shown.map((t, i) => (
          <span key={i} className={t.source === 'helper' ? 'text-accent' : ''}>
            {t.move}{' '}
          </span>
        ))}
      </p>
      {log.length > 0 && (
        <details className="mt-2 text-sm text-muted">
          <summary className="cursor-pointer">Raw move log</summary>
          <p className="mt-1 font-mono text-xs break-words">{log.map((e) => e.move).join(' ')}</p>
        </details>
      )}
      <p className="mt-2 text-xs text-muted">
        <span className="text-accent">Blue</span> moves came from the helpers.
      </p>
    </div>
  );
}
