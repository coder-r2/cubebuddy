import { useEffect } from 'react';
import { useSettings } from '../stores/settings';

/** Keeps <html data-theme> in sync with the theme preference and, for "system", the OS setting. */
export function useApplyTheme() {
  const theme = useSettings((s) => s.settings.theme);

  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}
