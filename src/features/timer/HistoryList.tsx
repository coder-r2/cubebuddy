import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Solve } from '../../db/types';
import { formatResult, formatStat } from './time';

interface HistoryListProps {
  solves: readonly Solve[];
  /** Rolling Ao5/Ao12 aligned with `solves` (oldest first). */
  ao5: readonly (number | null)[];
  ao12: readonly (number | null)[];
  onSelect: (solve: Solve) => void;
}

const ROW_HEIGHT = 44;

/** Virtualised solve list, newest first (SPEC §5.4, D-043). */
export function HistoryList({ solves, ao5, ao12, onSelect }: HistoryListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // TanStack Virtual returns fresh functions each render; the React Compiler lint rule knows to skip it.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: solves.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  return (
    <div className="rounded-2xl border border-border bg-surface">
      <div className="grid grid-cols-[3rem_1fr_1fr_1fr] gap-2 border-b border-border px-3 py-2 text-xs font-medium tracking-wide text-muted uppercase">
        <span>#</span>
        <span className="text-right">Time</span>
        <span className="text-right">Ao5</span>
        <span className="text-right">Ao12</span>
      </div>
      {solves.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-muted">No solves in this session yet.</p>
      ) : (
        <div ref={scrollRef} className="h-72 overflow-y-auto lg:h-[26rem]" data-testid="history">
          <ul style={{ height: virtualizer.getTotalSize() }} className="relative">
            {virtualizer.getVirtualItems().map((row) => {
              // Row 0 is the newest solve.
              const index = solves.length - 1 - row.index;
              const solve = solves[index]!;
              return (
                <li
                  key={solve.id}
                  className="absolute inset-x-0"
                  style={{ height: ROW_HEIGHT, transform: `translateY(${row.start}px)` }}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(solve)}
                    className="grid h-full w-full grid-cols-[3rem_1fr_1fr_1fr] items-center gap-2 px-3 text-sm tabular-nums hover:bg-surface-2"
                  >
                    <span className="text-left text-muted">{index + 1}</span>
                    <span className="text-right font-mono font-medium" data-testid="history-time">
                      {formatResult(solve)}
                      {solve.comment && (
                        <span className="ml-1 text-muted" title={solve.comment}>
                          *
                        </span>
                      )}
                    </span>
                    <span className="text-right font-mono text-muted">{formatStat(ao5[index] ?? null)}</span>
                    <span className="text-right font-mono text-muted">{formatStat(ao12[index] ?? null)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
