import { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { moveCount, solutionText, type SolutionRow } from './stages';

interface SolutionPanelProps {
  scramble: string;
  rows: SolutionRow[] | null;
  /** What the solution starts from: the scramble, or the cube as it is now. */
  from: 'scramble' | 'here';
  /** Offer "solve from here" once the user has made moves of their own. */
  onSolveFromHere?: () => void;
}

/** Full CFOP / Ortega solution, stage by stage, with move counts and copy (SPEC §5.6). */
export function SolutionPanel({ scramble, rows, from, onSolveFromHere }: SolutionPanelProps) {
  const [copied, setCopied] = useState(false);
  const total = rows?.reduce((sum, row) => sum + moveCount(row.moves), 0) ?? 0;

  const copy = async () => {
    if (!rows) return;
    try {
      await navigator.clipboard.writeText(solutionText(scramble, rows));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the moves are on screen anyway.
    }
  };

  return (
    <details className="group rounded-2xl border border-border bg-surface">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 sm:px-4 [&::-webkit-details-marker]:hidden">
        <span className="font-medium">Full solution</span>
        <span className="flex items-center gap-2 text-sm text-muted">
          {rows ? `${total} moves` : 'Working…'}
          <Icon name="chevron" className="h-4 w-4 transition-transform group-open:rotate-90" />
        </span>
      </summary>
      <div className="space-y-3 border-t border-border px-3 py-3 sm:px-4">
        <p className="text-sm text-muted">
          {from === 'scramble'
            ? 'The whole solution for this scramble, stage by stage.'
            : 'The solution from the cube as it is now.'}
          {onSolveFromHere && (
            <>
              {' '}
              You’ve made moves of your own since.{' '}
              <button type="button" onClick={onSolveFromHere} className="text-accent underline">
                Solve from here
              </button>
            </>
          )}
        </p>
        {rows && (
          <table className="w-full text-sm" data-testid="solution-table">
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-border last:border-0 [&>*]:py-1.5 [&>*]:align-top">
                  <th scope="row" className="pr-3 text-left font-medium whitespace-nowrap">
                    {row.label}
                  </th>
                  <td className="font-mono break-words">{row.moves.join(' ') || '—'}</td>
                  <td className="pl-3 text-right text-muted tabular-nums">{moveCount(row.moves)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" className="pt-2 text-left font-semibold">
                  Total
                </th>
                <td />
                <td className="pt-2 pl-3 text-right font-semibold tabular-nums">{total}</td>
              </tr>
            </tfoot>
          </table>
        )}
        <button
          type="button"
          onClick={() => void copy()}
          disabled={!rows}
          className="flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-surface-2 disabled:opacity-50"
        >
          <Icon name={copied ? 'check' : 'copy'} className="h-4 w-4" />
          {copied ? 'Copied' : 'Copy solution'}
        </button>
      </div>
    </details>
  );
}
