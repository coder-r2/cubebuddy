import { Dialog } from '../../components/ui/Dialog';
import { SPEEDS } from '../../lib/speeds';
import { useSettings } from '../../stores/settings';

export function Choice<T extends string | number>({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  name: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="font-medium">{legend}</legend>
      <div
        className="mt-2 grid gap-2"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map(([option, label]) => (
          <label
            key={String(option)}
            className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border px-2 text-center text-sm has-checked:border-accent has-checked:bg-surface-2"
          >
            <input type="radio" name={name} checked={value === option} onChange={() => onChange(option)} />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Tap direction and solving-helper style (SPEC §5.3, §5.8); shared by the options dialogs and Settings. */
export function HelperOptions({ speed = true }: { speed?: boolean }) {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);

  return (
    <div className="space-y-5">
      <Choice
        legend="Tapping a sticker turns its face"
        name="tapDirection"
        value={settings.tapDirection}
        options={[
          ['clockwise', 'Clockwise'],
          ['anticlockwise', 'Anticlockwise'],
        ]}
        onChange={(tapDirection) => void update({ tapDirection })}
      />
      <p className="-mt-3 text-sm text-muted">
        Right-click turns the other way. Shift-click turns a middle slice, Ctrl-click rotates the whole cube.
      </p>
      <Choice
        legend="Cross colour"
        name="crossColorMode"
        value={settings.crossColorMode}
        options={[
          ['white', 'White'],
          ['white-yellow', 'White or yellow'],
          ['neutral', 'Any colour'],
        ]}
        onChange={(crossColorMode) => void update({ crossColorMode })}
      />
      <p className="-mt-3 text-sm text-muted">
        With more than one colour, the helpers pick whichever cross is shortest (on the 2x2, the first face)
        and keep that colour for the rest of the solve.
      </p>
      <Choice
        legend="F2L helper style"
        name="f2lStyle"
        value={settings.f2lStyle}
        options={[
          ['front-right', 'Rotate to front-right'],
          ['rotationless', 'No rotations'],
        ]}
        onChange={(f2lStyle) => void update({ f2lStyle })}
      />
      <Choice
        legend="Last layer"
        name="llMode"
        value={settings.llMode}
        options={[
          ['2-look', '2-look (beginner)'],
          ['full', 'Full OLL / PLL'],
        ]}
        onChange={(llMode) => void update({ llMode })}
      />
      {speed && (
        <Choice
          legend="Animation speed"
          name="animationSpeed"
          value={settings.animationSpeed}
          options={SPEEDS.map((s) => [s.value, s.label] as const)}
          onChange={(animationSpeed) => void update({ animationSpeed })}
        />
      )}
    </div>
  );
}

/** Free-play (and tutorial) options dialog. */
export function PlayOptionsDialog({
  open,
  onClose,
  title = 'Free-play options',
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <HelperOptions />
    </Dialog>
  );
}
