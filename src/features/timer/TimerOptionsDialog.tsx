import { Dialog } from '../../components/ui/Dialog';
import type { StatKey } from '../../db/types';
import { useSettings } from '../../stores/settings';

const STAT_LABELS: Record<StatKey, string> = {
  pb: 'Single (latest / best)',
  ao5: 'Ao5',
  ao12: 'Ao12',
  ao50: 'Ao50',
  ao100: 'Ao100',
  mean: 'Mean',
};

const HOLD_OPTIONS = [0, 100, 300, 500, 1000];

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-2">
      <span>
        <span className="block font-medium">{label}</span>
        {hint && <span className="block text-sm text-muted">{hint}</span>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-5 w-5 accent-accent"
      />
    </label>
  );
}

/** Timer settings (SPEC §5.4, §5.8); shared by the Timer options dialog and the Settings page. */
export function TimerOptions() {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);

  const toggleStat = (key: StatKey, on: boolean) => {
    const next = on ? [...settings.visibleStats, key] : settings.visibleStats.filter((k) => k !== key);
    void update({ visibleStats: (Object.keys(STAT_LABELS) as StatKey[]).filter((k) => next.includes(k)) });
  };

  return (
    <div className="divide-y divide-border">
      <fieldset className="pb-3">
        <legend className="font-medium">Input</legend>
        <div className="mt-2 flex gap-2">
          {(
            [
              ['timer', 'Timer (space / touch)'],
              ['typing', 'Type in times'],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border px-2 text-sm has-checked:border-accent has-checked:bg-surface-2"
            >
              <input
                type="radio"
                name="timerInput"
                checked={settings.timerInput === value}
                onChange={() => void update({ timerInput: value })}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="py-1">
        <Toggle
          label="15-second inspection"
          hint="Tap to start inspecting; over 15 s adds +2, over 17 s is a DNF."
          checked={settings.inspection}
          onChange={(inspection) => void update({ inspection })}
        />
        <Toggle
          label="Inspection call-outs"
          hint="Says “8 seconds” and “12 seconds” (or beeps)."
          checked={settings.inspectionAlerts}
          onChange={(inspectionAlerts) => void update({ inspectionAlerts })}
        />
        <Toggle
          label="Hide the time while solving"
          checked={settings.hideTimeWhileRunning}
          onChange={(hideTimeWhileRunning) => void update({ hideTimeWhileRunning })}
        />
        <label className="flex items-center justify-between gap-4 py-2">
          <span>
            <span className="block font-medium">Hold time before start</span>
            <span className="block text-sm text-muted">How long to hold until the timer turns green.</span>
          </span>
          <select
            value={settings.holdMs}
            onChange={(e) => void update({ holdMs: Number(e.target.value) })}
            className="h-10 rounded-lg border border-border bg-bg px-2"
          >
            {HOLD_OPTIONS.map((ms) => (
              <option key={ms} value={ms}>
                {ms === 0 ? 'None' : `${ms / 1000} s`}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="pt-3">
        <legend className="font-medium">Statistics to show</legend>
        <div className="mt-1 grid grid-cols-2 gap-x-4">
          {(Object.keys(STAT_LABELS) as StatKey[]).map((key) => (
            <label key={key} className="flex cursor-pointer items-center gap-2 py-1.5 text-sm">
              <input
                type="checkbox"
                checked={settings.visibleStats.includes(key)}
                onChange={(e) => toggleStat(key, e.target.checked)}
                className="h-4 w-4 accent-accent"
              />
              {STAT_LABELS[key]}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

export function TimerOptionsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Timer options">
      <TimerOptions />
    </Dialog>
  );
}
