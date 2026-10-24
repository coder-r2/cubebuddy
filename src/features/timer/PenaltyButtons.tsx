import type { Penalty } from '../../db/types';

const OPTIONS: { value: Penalty; label: string; name: string }[] = [
  { value: 0, label: 'OK', name: 'No penalty' },
  { value: 2000, label: '+2', name: 'Plus two' },
  { value: 'DNF', label: 'DNF', name: 'Did not finish' },
];

interface PenaltyButtonsProps {
  value: Penalty;
  onChange: (penalty: Penalty) => void;
  label?: string;
}

/** OK / +2 / DNF toggle group (D-009). */
export function PenaltyButtons({ value, onChange, label = 'Penalty' }: PenaltyButtonsProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex rounded-lg border border-border bg-surface p-0.5"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.label}
          type="button"
          aria-pressed={value === option.value}
          title={option.name}
          onClick={() => onChange(option.value)}
          className="h-9 min-w-12 rounded-md px-3 text-sm font-medium text-muted aria-pressed:bg-surface-2 aria-pressed:text-text"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
