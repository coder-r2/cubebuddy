import { Suspense, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { Icon } from '../components/ui/Icon';
import { ACCOUNT_NAV, BOTTOM_NAV, MAIN_NAV, MORE_NAV } from './nav';
import { SyncBadge } from './SyncBadge';
import { ThemeToggle } from './ThemeToggle';
import { UpdatePrompt } from './UpdatePrompt';

const topLink = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap ${
    isActive ? 'bg-surface-2 text-text' : 'text-muted hover:bg-surface-2 hover:text-text'
  }`;

const bottomLink = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs ${
    isActive ? 'text-accent' : 'text-muted'
  }`;

export function Layout() {
  const { pathname } = useLocation();
  // The "More" sheet remembers the path it was opened on, so navigating anywhere closes it.
  const [moreOpenOn, setMoreOpenOn] = useState<string | null>(null);
  const moreOpen = moreOpenOn === pathname;
  const setMoreOpen = (open: boolean) => setMoreOpenOn(open ? pathname : null);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur print:hidden">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-7 w-7" />
            CubeBuddy
          </Link>
          <nav aria-label="Main" className="ml-4 hidden flex-1 gap-1 overflow-x-auto lg:flex">
            {MAIN_NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={topLink}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <SyncBadge />
            <ThemeToggle />
            {ACCOUNT_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                aria-label={item.label}
                title={item.label}
                className={({ isActive }) =>
                  `hidden h-10 w-10 place-items-center rounded-lg lg:grid ${
                    isActive ? 'bg-surface-2 text-text' : 'text-muted hover:bg-surface-2 hover:text-text'
                  }`
                }
              >
                <Icon name={item.icon} />
              </NavLink>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-24 lg:pb-10 print:max-w-none print:p-0">
        <Suspense fallback={<p className="text-muted">Loading…</p>}>
          <Outlet />
        </Suspense>
      </main>

      <footer className="hidden border-t border-border lg:block print:hidden">
        <div className="mx-auto flex max-w-7xl gap-4 px-4 py-3 text-sm text-muted">
          <span>CubeBuddy</span>
          <Link to="/about" className="hover:text-text">
            About &amp; credits
          </Link>
        </div>
      </footer>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden"
      >
        {BOTTOM_NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={bottomLink}>
            <Icon name={item.icon} />
            {item.label}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(!moreOpen)}
          aria-expanded={moreOpen}
          aria-controls="more-menu"
          className={bottomLink({ isActive: moreOpen })}
        >
          <Icon name="more" />
          More
        </button>
      </nav>

      <UpdatePrompt />

      {moreOpen && (
        <div className="fixed inset-0 z-20 lg:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            id="more-menu"
            role="menu"
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] rounded-t-2xl border-t border-border bg-surface p-2"
          >
            {MORE_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                role="menuitem"
                className={({ isActive }) =>
                  `flex min-h-12 items-center gap-3 rounded-lg px-4 ${isActive ? 'bg-surface-2' : 'hover:bg-surface-2'}`
                }
              >
                <Icon name={item.icon} />
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
