import { create } from 'zustand';
import { db as defaultDb, type CubeBuddyDB } from '../db/db';
import type { Settings } from '../db/types';

// Pre-onboarding defaults; the quiz (P5) replaces these with a level preset (SPEC §5.2).
export const DEFAULT_SETTINGS: Settings = {
  level: null,
  animationSpeed: 1,
  theme: 'system',
  keymap: {},
  f2lStyle: 'front-right',
  llMode: '2-look',
  crossColorMode: 'white',
  inspection: false,
  inspectionAlerts: true,
  holdMs: 300,
  hideTimeWhileRunning: false,
  timerInput: 'timer',
  visibleStats: ['pb', 'ao5', 'ao12', 'ao50', 'ao100', 'mean'],
  onboardingDone: false,
  updatedAt: 0,
};

/** Mirror of the theme preference read by the pre-paint script in index.html. */
export const THEME_STORAGE_KEY = 'cubebuddy:theme';

type SettingsPatch = Partial<Omit<Settings, 'updatedAt'>>;

interface SettingsState {
  settings: Settings;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  update: (patch: SettingsPatch) => Promise<void>;
}

function mirrorTheme(theme: Settings['theme']) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be unavailable (private mode); the theme still applies for this visit.
  }
}

export function createSettingsStore(database: CubeBuddyDB = defaultDb) {
  return create<SettingsState>((set, get) => ({
    settings: DEFAULT_SETTINGS,
    hydrated: false,

    async hydrate() {
      const row = await database.settings.get('singleton');
      if (row) {
        const { key: _key, ...stored } = row;
        // Merge so settings added in later versions get their defaults.
        set({ settings: { ...DEFAULT_SETTINGS, ...stored }, hydrated: true });
      } else {
        set({ hydrated: true });
      }
      mirrorTheme(get().settings.theme);
    },

    async update(patch) {
      const settings = { ...get().settings, ...patch, updatedAt: Date.now() };
      set({ settings });
      if (patch.theme) mirrorTheme(patch.theme);
      await database.settings.put({ key: 'singleton', ...settings });
    },
  }));
}

export const useSettings = createSettingsStore();
