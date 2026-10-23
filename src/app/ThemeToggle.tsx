import { Icon } from '../components/ui/Icon';
import type { ThemePref } from '../db/types';
import { useSettings } from '../stores/settings';

const NEXT: Record<ThemePref, ThemePref> = { system: 'light', light: 'dark', dark: 'system' };
const ICON = { system: 'monitor', light: 'sun', dark: 'moon' } as const;
const LABEL: Record<ThemePref, string> = { system: 'System theme', light: 'Light theme', dark: 'Dark theme' };

export function ThemeToggle() {
  const theme = useSettings((s) => s.settings.theme);
  const update = useSettings((s) => s.update);

  return (
    <button
      type="button"
      onClick={() => void update({ theme: NEXT[theme] })}
      className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text"
      aria-label={`${LABEL[theme]} (click to change)`}
      title={LABEL[theme]}
    >
      <Icon name={ICON[theme]} />
    </button>
  );
}
