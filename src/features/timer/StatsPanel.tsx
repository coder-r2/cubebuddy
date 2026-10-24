import type { StatKey } from '../../db/types';
import type { SessionStats } from './stats';
import { formatStat } from './time';

interface StatsPanelProps {
  stats: SessionStats;
  visible: readonly StatKey[];
}

const AVERAGE_ROWS = [
  ['ao5', 5],
  ['ao12', 12],
  ['ao50', 50],
  ['ao100', 100],
] as const;

/** Session statistics (SPEC §5.4); rows can be hidden in the timer options. */
export function StatsPanel({ stats, visible }: StatsPanelProps) {
  const show = (key: StatKey) => visible.includes(key);

  return (
    <div className="rounded-2xl border border-border bg-surface p-3 sm:p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-medium tracking-wide text-muted uppercase">Statistics</h2>
        <span className="text-sm text-muted" data-testid="solve-count">
          {stats.solved}/{stats.count} solves
        </span>
      </div>
      <table className="mt-2 w-full text-sm tabular-nums">
        <thead>
          <tr className="text-left text-muted">
            <th scope="col" className="py-1 font-normal">
              <span className="sr-only">Statistic</span>
            </th>
            <th scope="col" className="py-1 text-right font-normal">
              Current
            </th>
            <th scope="col" className="py-1 text-right font-normal">
              Best
            </th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {show('pb') && (
            <tr className="border-t border-border">
              <th scope="row" className="py-1.5 text-left font-sans font-medium">
                Single
              </th>
              <td className="text-right">{formatStat(stats.latest)}</td>
              <td className="text-right">{formatStat(stats.pb)}</td>
            </tr>
          )}
          {AVERAGE_ROWS.filter(([key]) => show(key)).map(([key, size]) => (
            <tr key={key} className="border-t border-border">
              <th scope="row" className="py-1.5 text-left font-sans font-medium">
                Ao{size}
              </th>
              <td className="text-right" data-testid={`${key}-current`}>
                {formatStat(stats.averages[size].current)}
              </td>
              <td className="text-right">{formatStat(stats.averages[size].best)}</td>
            </tr>
          ))}
          {show('mean') && (
            <tr className="border-t border-border">
              <th scope="row" className="py-1.5 text-left font-sans font-medium">
                Mean
              </th>
              <td className="text-right">{formatStat(stats.mean)}</td>
              <td className="text-right text-muted">–</td>
            </tr>
          )}
        </tbody>
      </table>
      {show('mean') && stats.worst !== null && (
        <p className="mt-2 text-xs text-muted">
          Worst single <span className="font-mono">{formatStat(stats.worst)}</span>
        </p>
      )}
    </div>
  );
}
