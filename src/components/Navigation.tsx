import * as React from 'react';
import { cn } from '../lib/utils';

type Theme = 'night' | 'dawn';

declare global {
  interface Window {
    __careerToolsSetTheme?: (theme: Theme) => void;
  }
}

type NavigationProps = {
  currentPath?: string;
  initialTheme?: Theme;
};

const THEME_STORAGE_KEY = 'career-tools-theme';
const THEME_COOKIE = 'career-tools-theme';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const THEME_CHANNEL_NAME = 'career-tools-theme';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/start/', label: 'Start Here' },
  { href: '/dashboard/', label: 'Dashboard' },
  { href: '/career/', label: 'Career 5 Whys' },
  { href: '/resume-game/', label: 'Resume Game' },
  { href: '/networking-practice/', label: 'Networking' },
  { href: '/5whys/interview-glow-up/', label: 'Interview' },
];

const isValidTheme = (value: unknown): value is Theme => value === 'night' || value === 'dawn';

const readDatasetTheme = (): Theme | null => {
  if (typeof document === 'undefined') return null;
  const datasetTheme = document.documentElement?.dataset?.theme;
  return isValidTheme(datasetTheme) ? datasetTheme : null;
};

const readCookieTheme = (): Theme | null => {
  if (typeof document === 'undefined') return null;
  try {
    const cookie = document.cookie
      .split('; ')
      .find((entry) => entry.startsWith(`${THEME_COOKIE}=`));
    if (!cookie) return null;
    const [, value] = cookie.split('=');
    return isValidTheme(value) ? value : null;
  } catch {
    return null;
  }
};

const readStorageTheme = (): Theme | null => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isValidTheme(stored) ? stored : null;
  } catch {
    return null;
  }
};

const applyThemeToDom = (theme: Theme) => {
  if (typeof window !== 'undefined' && typeof window.__careerToolsSetTheme === 'function') {
    window.__careerToolsSetTheme(theme);
    return;
  }
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const body = document.body;
  root.dataset.theme = theme;
  root.classList.toggle('theme-dawn', theme === 'dawn');
  root.classList.toggle('theme-night', theme === 'night');
  if (body) {
    body.dataset.theme = theme;
    body.classList.toggle('theme-dawn', theme === 'dawn');
    body.classList.toggle('theme-night', theme === 'night');
  }
  try {
    const colorScheme = theme === 'dawn' ? 'only light' : 'dark';
    root.style.colorScheme = colorScheme;
    if (body) body.style.colorScheme = colorScheme;
    document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', colorScheme);
  } catch {
    /* ignore */
  }
};

const writeStorageTheme = (theme: Theme) => {
  if (typeof window === 'undefined') return;
  try {
    const existing = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (existing !== theme) window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
};

const writeCookieTheme = (theme: Theme) => {
  if (typeof document === 'undefined') return;
  try {
    const secureToken =
      typeof window !== 'undefined' && window.location.protocol === 'https:' ? ';Secure' : '';
    document.cookie = `${THEME_COOKIE}=${theme};path=/;max-age=${COOKIE_MAX_AGE};SameSite=Lax${secureToken}`;
  } catch {
    /* ignore */
  }
};

export default function Navigation({ currentPath = '/', initialTheme }: NavigationProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [compactToolsOpen, setCompactToolsOpen] = React.useState(false);
  const [activeTheme, setActiveTheme] = React.useState<Theme>(initialTheme ?? 'night');
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [showScrollTop, setShowScrollTop] = React.useState(false);
  const broadcastRef = React.useRef<BroadcastChannel | null>(null);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const onScroll = () => {
      setIsScrolled(window.scrollY > 24);
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = React.useCallback(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = readDatasetTheme() ?? readCookieTheme() ?? readStorageTheme();
    if (stored) setActiveTheme(stored);
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    applyThemeToDom(activeTheme);
    writeStorageTheme(activeTheme);
    writeCookieTheme(activeTheme);
    broadcastRef.current?.postMessage({ theme: activeTheme });
  }, [activeTheme]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY || !event.newValue) return;
      if (event.newValue === 'night' || event.newValue === 'dawn') {
        applyThemeToDom(event.newValue as Theme);
        setActiveTheme((prev) => (prev === event.newValue ? prev : (event.newValue as Theme)));
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    try {
      const channel = new BroadcastChannel(THEME_CHANNEL_NAME);
      broadcastRef.current = channel;
      const handleMessage = (event: MessageEvent<{ theme?: Theme }>) => {
        const incoming = event.data?.theme;
        if (incoming === 'night' || incoming === 'dawn') {
          applyThemeToDom(incoming);
          setActiveTheme((prev) => (prev === incoming ? prev : incoming));
        }
      };
      channel.addEventListener('message', handleMessage);
      return () => {
        channel.removeEventListener('message', handleMessage);
        channel.close();
        broadcastRef.current = null;
      };
    } catch {
      broadcastRef.current = null;
    }
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
    const next = activeTheme === 'night' ? 'dawn' : 'night';
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
          ? 'border-[hsl(var(--border)/0.5)] bg-[hsl(var(--background)/0.97)] shadow-[0_18px_42px_-34px_hsl(var(--background)/0.95)]'
          : 'border-[hsl(var(--border)/0.28)] bg-[hsl(var(--background)/0.94)]'
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
          className="flex flex-shrink-0 items-center gap-3 text-foreground transition-opacity hover:opacity-85"
        >
          <span aria-hidden="true" className="nav-logo nav-logo__mark h-12 w-9 rounded-xl" />
          <span className="grid leading-none">
            <span className="text-base font-semibold tracking-tight">5 Whys</span>
            <span className="hidden text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-[hsl(var(--foreground)/0.82)] sm:block">
              Career Studio
            </span>
          </span>
        </a>

        {/* Compact tablet nav */}
        <div className="relative hidden md:flex xl:hidden">
          <div className="flex items-center gap-1 rounded-full border border-[hsl(var(--border)/0.38)] bg-[hsl(var(--overlay)/0.42)] px-2 py-1">
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
                      ? 'bg-[hsl(var(--background)/0.54)] text-foreground shadow-[inset_0_0_0_1px_hsl(var(--border)/0.26)]'
                      : 'text-[hsl(var(--foreground)/0.78)] hover:bg-[hsl(var(--background)/0.34)] hover:text-foreground'
                  )}
                >
                  {label}
                  {active && (
                    <span
                      className="absolute bottom-1 left-4 right-4 h-[2px] rounded-full bg-[hsl(var(--foam))]"
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
                  ? 'bg-[hsl(var(--background)/0.54)] text-foreground shadow-[inset_0_0_0_1px_hsl(var(--border)/0.26)]'
                  : 'text-[hsl(var(--foreground)/0.78)] hover:bg-[hsl(var(--background)/0.34)] hover:text-foreground'
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
              className="absolute right-0 top-full z-50 mt-3 w-56 rounded-2xl border border-[hsl(var(--border)/0.42)] bg-[hsl(var(--popover)/0.98)] p-2 shadow-[0_28px_72px_-42px_hsl(var(--background)/0.95)]"
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
                        ? 'border-[hsl(var(--foam)/0.46)] bg-[hsl(var(--overlay)/0.45)] text-foreground'
                        : 'border-transparent text-muted-foreground hover:border-[hsl(var(--border)/0.35)] hover:bg-[hsl(var(--overlay)/0.28)] hover:text-foreground'
                    )}
                  >
                    {label}
                    {active && (
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--foam))]"
                        aria-hidden="true"
                      />
                    )}
                  </a>
                );
              })}
            </div>
          )}
        </div>

        {/* Desktop nav */}
        <div className="hidden items-center gap-1 rounded-full border border-[hsl(var(--border)/0.38)] bg-[hsl(var(--overlay)/0.42)] px-2 py-1 xl:flex">
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
                    ? 'bg-[hsl(var(--background)/0.54)] text-foreground shadow-[inset_0_0_0_1px_hsl(var(--border)/0.26)]'
                    : 'text-[hsl(var(--foreground)/0.78)] hover:bg-[hsl(var(--background)/0.34)] hover:text-foreground'
                )}
              >
                {label}
                {active && (
                  <span
                    className="absolute bottom-1 left-4 right-4 h-[2px] rounded-full bg-[hsl(var(--foam))]"
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
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-[hsl(var(--foreground)/0.78)] transition-colors hover:bg-[hsl(var(--overlay)/0.35)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
            aria-label={isNight ? 'Switch to light theme' : 'Switch to dark theme'}
            title={isNight ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {isNight ? (
              <svg
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
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-[hsl(var(--overlay)/0.35)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] md:hidden"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="primary-navigation"
          >
            <span className="sr-only">Toggle navigation</span>
            <svg
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
          className="fixed inset-0 z-40 bg-[hsl(var(--background)/0.72)] md:hidden"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile nav panel */}
      <div
        id="primary-navigation"
        className={cn(
          'fixed inset-y-0 right-0 z-50 w-72 flex-col gap-1 border-l border-[hsl(var(--border)/0.25)] bg-[hsl(var(--background)/0.98)] px-4 pb-4 pt-20 md:hidden transition-transform duration-300 ease-out',
          menuOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <button
          type="button"
          onClick={() => setMenuOpen(false)}
          className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-[hsl(var(--overlay)/0.35)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
          aria-label="Close navigation"
        >
          <svg
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
                  ? 'border-[hsl(var(--foam)/0.5)] bg-[hsl(var(--overlay)/0.3)] text-foreground'
                  : 'border-transparent text-muted-foreground hover:border-[hsl(var(--border)/0.35)] hover:bg-[hsl(var(--overlay)/0.2)] hover:text-foreground'
              )}
            >
              {label}
            </a>
          );
        })}

        <div className="my-2 h-px bg-[hsl(var(--border)/0.3)]" />

        <button
          type="button"
          onClick={() => setToolsOpen((open) => !open)}
          aria-expanded={toolsOpen}
          className={cn(
            'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            toolsLinks.some((l) => isActive(l.href))
              ? 'bg-[hsl(var(--overlay)/0.25)] text-foreground'
              : 'text-muted-foreground hover:bg-[hsl(var(--overlay)/0.2)] hover:text-foreground'
          )}
        >
          <span className="flex items-center gap-2">
            <svg
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
                      ? 'border-[hsl(var(--foam)/0.5)] bg-[hsl(var(--overlay)/0.3)] text-foreground'
                      : 'border-transparent text-muted-foreground hover:border-[hsl(var(--border)/0.35)] hover:bg-[hsl(var(--overlay)/0.2)] hover:text-foreground'
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
          className="fixed bottom-6 right-6 z-50 inline-flex h-11 w-11 items-center justify-center rounded-full border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.9)] text-foreground shadow-lg transition hover:bg-[hsl(var(--overlay))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
        >
          <svg
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
