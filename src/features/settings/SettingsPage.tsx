import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { SpeedPreview, SpeedSlider } from '../../components/SpeedControl';
import { useSettings } from '../../stores/settings';
import { useTimerStore } from '../../stores/timer';
import { LEVEL_NAMES } from '../learn/quiz';
import { Choice, HelperOptions } from '../play/PlayOptionsDialog';
import { DataDialog } from '../timer/DataDialog';
import { TimerOptions } from '../timer/TimerOptionsDialog';
import { BackupPanel } from './BackupPanel';
import { KeymapEditor } from './KeymapEditor';

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <h2 id={id} className="mb-4 text-lg font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** The colour scheme CubeBuddy uses: white top, green front (the standard Western scheme). */
function ColourScheme() {
  const faces: [string, string, number, number][] = [
    ['U', '#ffffff', 1, 0],
    ['L', '#f97316', 0, 1],
    ['F', '#16a34a', 1, 1],
    ['R', '#dc2626', 2, 1],
    ['B', '#2563eb', 3, 1],
    ['D', '#facc15', 1, 2],
  ];
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 124 94" className="h-24 w-32 shrink-0" role="img" aria-label="Colour scheme net">
        {faces.map(([face, colour, col, row]) => (
          <g key={face}>
            <rect
              x={col * 31 + 1}
              y={row * 31 + 1}
              width={29}
              height={29}
              rx={3}
              fill={colour}
              stroke="var(--color-border)"
            />
            <text
              x={col * 31 + 15.5}
              y={row * 31 + 20}
              textAnchor="middle"
              fontSize="12"
              fontWeight="600"
              fill="#111"
            >
              {face}
            </text>
          </g>
        ))}
      </svg>
      <p className="text-sm text-muted">
        White on top, green in front, red on the right: the standard scheme used by WCA scrambles and most
        cubes.
      </p>
    </div>
  );
}

export default function SettingsPage() {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const [dataOpen, setDataOpen] = useState(false);

  const openCstimer = async () => {
    if (!useTimerStore.getState().loaded) await useTimerStore.getState().load();
    setDataOpen(true);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="text-sm text-muted">
        Changes are saved straight away and, if you’re{' '}
        <Link to="/account" className="text-accent underline">
          signed in
        </Link>
        , synced to your other devices.
      </p>

      <Section id="settings-profile" title="Profile">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted">Level</p>
            <p className="font-medium">{settings.level ? LEVEL_NAMES[settings.level] : 'Not set'}</p>
          </div>
          <Link
            to="/learn?quiz"
            className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-surface-2"
          >
            {settings.level ? 'Retake the quiz' : 'Take the quiz'}
          </Link>
        </div>
      </Section>

      <Section id="settings-cube" title="Cube">
        <div className="space-y-6">
          <div>
            <p className="font-medium">Animation speed</p>
            <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row">
              <SpeedPreview speed={settings.animationSpeed} className="h-32 w-32 shrink-0" />
              <div className="w-full flex-1">
                <SpeedSlider
                  value={settings.animationSpeed}
                  onChange={(animationSpeed) => void update({ animationSpeed })}
                />
              </div>
            </div>
          </div>
          <div>
            <p className="mb-2 font-medium">Colour scheme</p>
            <ColourScheme />
          </div>
          <details className="group rounded-lg border border-border">
            <summary className="flex min-h-11 cursor-pointer items-center px-3 font-medium">
              Keyboard map
            </summary>
            <div className="border-t border-border p-3">
              <KeymapEditor />
            </div>
          </details>
        </div>
      </Section>

      <Section id="settings-helpers" title="Solving helpers">
        <HelperOptions speed={false} />
      </Section>

      <Section id="settings-timer" title="Timer">
        <TimerOptions />
      </Section>

      <Section id="settings-appearance" title="Appearance">
        <Choice
          legend="Theme"
          name="theme"
          value={settings.theme}
          options={[
            ['system', 'System'],
            ['light', 'Light'],
            ['dark', 'Dark'],
          ]}
          onChange={(theme) => void update({ theme })}
        />
      </Section>

      <Section id="settings-data" title="Data">
        <div className="space-y-5">
          <BackupPanel />
          <div className="border-t border-border pt-4">
            <p className="font-medium">cstimer</p>
            <p className="mt-1 text-sm text-muted">
              Import a cstimer export file, or export sessions for cstimer.
            </p>
            <button
              type="button"
              onClick={() => void openCstimer()}
              className="mt-2 h-11 rounded-lg border border-border px-4 font-medium hover:bg-surface-2"
            >
              cstimer import / export…
            </button>
          </div>
        </div>
      </Section>

      <DataDialog open={dataOpen} onClose={() => setDataOpen(false)} />
    </div>
  );
}
