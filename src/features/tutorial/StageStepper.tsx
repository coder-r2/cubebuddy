import { Icon } from '../../components/ui/Icon';

/** Progress through the stages: done, current and still to come (SPEC §5.6). */
export function StageStepper({ stages, current }: { stages: string[]; current: number | null }) {
  return (
    <ol
      aria-label="Stages"
      className="grid gap-1 sm:gap-2"
      style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}
    >
      {stages.map((stage, i) => {
        const done = current !== null && i < current;
        const now = current === i;
        const last = i === stages.length - 1;
        return (
          <li
            key={stage}
            aria-current={now ? 'step' : undefined}
            data-testid={now ? 'tutorial-stage' : undefined}
            className="min-w-0"
          >
            <div
              className={`h-1.5 rounded-full transition-colors ${
                done || (now && last) ? 'bg-accent' : now ? 'bg-accent/50' : 'bg-border'
              }`}
            />
            <p
              className={`mt-1.5 flex items-center justify-center gap-0.5 truncate text-[11px] sm:text-xs ${
                now ? 'font-semibold text-text' : done ? 'text-text' : 'text-muted'
              }`}
            >
              {done && <Icon name="check" className="hidden h-3 w-3 shrink-0 sm:block" />}
              <span className="truncate">{stage}</span>
              {done && <span className="sr-only">(done)</span>}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
