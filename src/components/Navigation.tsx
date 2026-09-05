import * as React from 'react';
import {
  applyTheme,
  isTheme,
  readAppliedTheme,
  setTheme,
  THEME_STORAGE_KEY,
  type Theme,
} from '../lib/theme';
import { cn } from '../lib/utils';

type NavigationProps = {
  currentPath?: string;
};

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/start/', label: 'Start Here' },
  { href: '/dashboard/', label: 'Dashboard' },
  { href: '/career/', label: 'Career 5 Whys' },
  { href: '/resume-game/', label: 'Resume Game' },
  { href: '/networking-practice/', label: 'Networking' },
  { href: '/interview-glow-up/', label: 'Interview' },
];

export default function Navigation({ currentPath = '/' }: NavigationProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [compactToolsOpen, setCompactToolsOpen] = React.useState(false);
  const [activeTheme, setActiveTheme] = React.useState<Theme>('night');
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [showScrollTop, setShowScrollTop] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > 24);
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = React.useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // The boot script has already applied the saved theme before hydration;
  // pick it up for the toggle icon, and follow changes made in other tabs.
  React.useEffect(() => {
    const applied = readAppliedTheme();
    if (applied) setActiveTheme(applied);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY || !isTheme(event.newValue)) return;
      applyTheme(event.newValue);
      setActiveTheme(event.newValue);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setMenuOpen(false);
      if (window.innerWidth < 768 || window.innerWidth >= 1280) setCompactToolsOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleTheme = React.useCallback(() => {
    const next: Theme = activeTheme === 'night' ? 'dawn' : 'night';
    setTheme(next);
    setActiveTheme(next);
  }, [activeTheme]);

  const isActive = React.useCallback(
    (href: string) => {
      if (href === '/') return currentPath === '/';
      return currentPath.startsWith(href);
    },
    [currentPath]
  );

  const isNight = activeTheme === 'night';

  const mainLinks = navLinks.filter(
    (l) => l.href === '/' || l.href === '/start/' || l.href === '/dashboard/'
  );
  const toolsLinks = navLinks.filter(
    (l) => l.href !== '/' && l.href !== '/start/' && l.href !== '/dashboard/'
  );
  const [toolsOpen, setToolsOpen] = React.useState(toolsLinks.some((l) => isActive(l.href)));
  const compactToolsActive = toolsLinks.some((l) => isActive(l.href));

  return (
    <header
      className={cn(
        'sticky top-0 z-40 w-full border-b transition-all duration-300',
        isScrolled
          ? 'border-border/50 bg-background/97 shadow-[0_18px_42px_-34px_hsl(var(--background)/0.95)]'
          : 'border-border/28 bg-background/94'
      )}
    >
      <nav
        aria-label="Primary"
        className={cn(
          'mx-auto flex max-w-6xl items-center justify-between px-4 transition-all duration-300',
          isScrolled ? 'py-2.5' : 'py-3.5'
        )}
      >
        {/* Logo */}
        <a
          href="/"
          className="group flex shrink-0 items-center gap-3 text-foreground transition-opacity hover:opacity-90"
        >
          <span
            aria-hidden="true"
            className="nav-logo flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-card/80"
          >
            <svg
              aria-hidden="true"
              className="h-6 w-6 text-foreground"
              viewBox="0 0 36 36"
              fill="none"
            >
              <rect
                x="6"
                y="5"
                width="24"
                height="2.8"
                rx="1.4"
                fill="currentColor"
                fillOpacity="0.85"
              />
              <rect
                x="8.5"
                y="11"
                width="19"
                height="2.8"
                rx="1.4"
                fill="currentColor"
                fillOpacity="0.68"
              />
              <rect
                x="11"
                y="17"
                width="14"
                height="2.8"
                rx="1.4"
                fill="currentColor"
                fillOpacity="0.5"
              />
              <rect
                x="13.5"
                y="23"
                width="9"
                height="2.8"
                rx="1.4"
                fill="currentColor"
                fillOpacity="0.34"
              />
              <rect
                x="15.5"
                y="29"
                width="5"
                height="2.8"
                rx="1.4"
                style={{ fill: 'hsl(var(--primary))' }}
              />
            </svg>
          </span>
          <span className="grid leading-none">
            <span className="font-display text-base font-semibold tracking-tight">5 Whys</span>
            <span
              className="hidden text-[0.6rem] font-medium uppercase tracking-[0.24em] text-muted-foreground sm:block"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              Career Studio
            </span>
          </span>
        </a>

        {/* Compact tablet nav */}
        <div className="relative hidden md:flex xl:hidden">
          <div className="flex items-center gap-1 rounded-full border border-border/38 bg-overlay/42 px-2 py-1">
            {mainLinks.map(({ href, label }) => {
              const active = isActive(href);
              return (
                <a
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative rounded-full px-3 py-2 text-sm font-medium transition-colors duration-200',
                    active
                      ? 'bg-background/54 text-foreground shadow-[inset_0_0_0_1px_hsl(var(--border)/0.26)]'
                      : 'text-foreground/78 hover:bg-background/34 hover:text-foreground'
                  )}
                >
                  {label}
                  {active && (
                    <span
                      className="absolute bottom-1 left-4 right-4 h-[2px] rounded-full bg-foam"
                      aria-hidden="true"
                    />
                  )}
                </a>
              );
            })}
            <button
              type="button"
              onClick={() => setCompactToolsOpen((open) => !open)}
              aria-expanded={compactToolsOpen}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors duration-200',
                compactToolsActive || compactToolsOpen
                  ? 'bg-background/54 text-foreground shadow-[inset_0_0_0_1px_hsl(var(--border)/0.26)]'
                  : 'text-foreground/78 hover:bg-background/34 hover:text-foreground'
              )}
            >
              Tools
              <svg
                className={cn(
                  'h-4 w-4 transition-transform duration-200',
                  compactToolsOpen ? 'rotate-180' : ''
                )}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                />
              </svg>
            </button>
          </div>

          {compactToolsOpen && (
            <div
              id="compact-tools-menu"
              className="absolute right-0 top-full z-50 mt-3 w-56 rounded-2xl border border-border/42 bg-popover/98 p-2 shadow-[0_28px_72px_-42px_hsl(var(--background)/0.95)]"
            >
              {toolsLinks.map(({ href, label }) => {
                const active = isActive(href);
                return (
                  <a
                    key={href}
                    href={href}
                    onClick={() => setCompactToolsOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors',
                      active
                        ? 'border-foam/46 bg-overlay/45 text-foreground'
                        : 'border-transparent text-muted-foreground hover:border-border/35 hover:bg-overlay/28 hover:text-foreground'
                    )}
                  >
                    {label}
                    {active && (
                      <span className="h-1.5 w-1.5 rounded-full bg-foam" aria-hidden="true" />
                    )}
                  </a>
                );
              })}
            </div>
          )}
        </div>

        {/* Desktop nav */}
        <div className="hidden items-center gap-1 rounded-full border border-border/38 bg-overlay/42 px-2 py-1 xl:flex">
          {navLinks.map(({ href, label }) => {
            const active = isActive(href);
            return (
              <a
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative rounded-full px-3.5 py-2 text-sm font-medium transition-colors duration-200',
                  active
                    ? 'bg-background/54 text-foreground shadow-[inset_0_0_0_1px_hsl(var(--border)/0.26)]'
                    : 'text-foreground/78 hover:bg-background/34 hover:text-foreground'
                )}
              >
                {label}
                {active && (
                  <span
                    className="absolute bottom-1 left-4 right-4 h-[2px] rounded-full bg-foam"
                    aria-hidden="true"
                  />
                )}
              </a>
            );
          })}
        </div>

        {/* Right side: theme + mobile menu */}
        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-foreground/78 transition-colors hover:bg-overlay/35 hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={isNight ? 'Switch to light theme' : 'Switch to dark theme'}
            title={isNight ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {isNight ? (
              <svg
                aria-hidden="true"
                className="h-[1.1rem] w-[1.1rem]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
                />
              </svg>
            ) : (
              <svg
                aria-hidden="true"
                className="h-[1.1rem] w-[1.1rem]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
                />
              </svg>
            )}
          </button>

          {/* Mobile menu toggle */}
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-overlay/35 hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring md:hidden"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="primary-navigation"
          >
            <span className="sr-only">Toggle navigation</span>
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/72 md:hidden"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile nav panel */}
      <div
        id="primary-navigation"
        className={cn(
          'fixed inset-y-0 right-0 z-50 w-72 flex-col gap-1 border-l border-border/25 bg-background/98 px-4 pb-4 pt-20 md:hidden transition-transform duration-300 ease-out',
          menuOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <button
          type="button"
          onClick={() => setMenuOpen(false)}
          className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-overlay/35 hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Close navigation"
        >
          <svg
            aria-hidden="true"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {mainLinks.map(({ href, label }) => {
          const active = isActive(href);
          return (
            <a
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'border-foam/50 bg-overlay/30 text-foreground'
                  : 'border-transparent text-muted-foreground hover:border-border/35 hover:bg-overlay/20 hover:text-foreground'
              )}
            >
              {label}
            </a>
          );
        })}

        <div className="my-2 h-px bg-border/30" />

        <button
          type="button"
          onClick={() => setToolsOpen((open) => !open)}
          aria-expanded={toolsOpen}
          className={cn(
            'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            toolsLinks.some((l) => isActive(l.href))
              ? 'bg-overlay/25 text-foreground'
              : 'text-muted-foreground hover:bg-overlay/20 hover:text-foreground'
          )}
        >
          <span className="flex items-center gap-2">
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 6h9.75M10.5 6a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5"
              />
            </svg>
            Tools
          </span>
          <svg
            aria-hidden="true"
            className={cn(
              'h-4 w-4 transition-transform duration-200',
              toolsOpen ? 'rotate-180' : ''
            )}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {toolsOpen && (
          <div className="flex flex-col gap-1 pl-2">
            {toolsLinks.map(({ href, label }) => {
              const active = isActive(href);
              return (
                <a
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'border-foam/50 bg-overlay/30 text-foreground'
                      : 'border-transparent text-muted-foreground hover:border-border/35 hover:bg-overlay/20 hover:text-foreground'
                  )}
                >
                  {label}
                </a>
              );
            })}
          </div>
        )}
      </div>
      {showScrollTop && (
        <button
          type="button"
          onClick={scrollToTop}
          aria-label="Scroll to top"
          className="fixed bottom-6 right-6 z-50 inline-flex h-11 w-11 items-center justify-center rounded-full border border-border/50 bg-overlay/90 text-foreground shadow-lg transition hover:bg-overlay focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
        >
          <svg
            aria-hidden="true"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
      )}
    </header>
  );
}
