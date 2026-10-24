import type { IconName } from '../components/ui/Icon';

export interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
}

/** Top tab bar on laptops (SPEC §3.2). */
export const MAIN_NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/learn', label: 'Learn', icon: 'book' },
  { to: '/play', label: 'Free-play', icon: 'cube' },
  { to: '/timer', label: 'Timer', icon: 'timer' },
  { to: '/trainer', label: 'Trainer', icon: 'target' },
  { to: '/tutorial/cfop', label: 'CFOP tutorial', icon: 'route' },
  { to: '/tutorial/ortega', label: 'Ortega tutorial', icon: 'route' },
];

export const ACCOUNT_NAV: NavItem[] = [
  { to: '/settings', label: 'Settings', icon: 'settings' },
  { to: '/account', label: 'Account', icon: 'user' },
];

/** Bottom bar on phones/tablets; everything else lives under "More". */
export const BOTTOM_NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/play', label: 'Play', icon: 'cube' },
  { to: '/timer', label: 'Timer', icon: 'timer' },
  { to: '/trainer', label: 'Trainer', icon: 'target' },
];

export const MORE_NAV: NavItem[] = [
  { to: '/learn', label: 'Learn', icon: 'book' },
  { to: '/tutorial/cfop', label: 'CFOP tutorial', icon: 'route' },
  { to: '/tutorial/ortega', label: 'Ortega tutorial', icon: 'route' },
  ...ACCOUNT_NAV,
  { to: '/about', label: 'About & credits', icon: 'info' },
];
