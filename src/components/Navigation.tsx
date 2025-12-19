import * as React from 'react';

import { cn } from '../lib/utils';

type Theme = 'night' | 'moon' | 'dawn';

type NavigationProps = {
  currentPath?: string;
  initialTheme?: Theme;
};

type ThemeOption = {
  id: Theme;
  label: string;
  description: string;
  gradient: string;
};

const THEME_STORAGE_KEY = 'career-tools-theme';
const THEME_COOKIE = 'career-tools-theme';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
const THEME_CHANNEL_NAME = 'career-tools-theme';

const themeOptions: ThemeOption[] = [
  {
    id: 'night',
    label: 'Night',
    description: 'Rosé Pine classic',
    gradient: 'linear-gradient(135deg,#26233a 0%,#31748f 55%,#eb6f92 100%)',
  },
  {
    id: 'moon',
    label: 'Moon',
    description: 'Cool twilight tones',
    gradient: 'linear-gradient(135deg,#2a273f 0%,#3e8fb0 55%,#c4a7e7 100%)',
  },
  {
    id: 'dawn',
    label: 'Dawn',
    description: 'Soft sunrise warmth',
    gradient: 'linear-gradient(135deg,#faf4ed 0%,#ea9d34 55%,#b4637a 100%)',
  },
];

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/career', label: 'Career 5 Whys' },
  { href: '/resume-game', label: 'Resume Game' },
  { href: '/networking-practice', label: 'Networking Studio' },
  { href: '/5whys/interview-glow-up', label: 'Interview Glow Up' },
];

const isValidTheme = (value: unknown): value is Theme => value === 'night' || value === 'moon' || value === 'dawn';

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
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const body = document.body;
  if (theme === 'night') {
    root.removeAttribute('data-theme');
    if (body) body.removeAttribute('data-theme');
  } else {
    root.dataset.theme = theme;
    if (body) body.dataset.theme = theme;
  }
};

const writeStorageTheme = (theme: Theme) => {
  if (typeof window === 'undefined') return;
  try {
    const existing = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (existing !== theme) {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
  } catch {
    // ignore storage failures
  }
};

const writeCookieTheme = (theme: Theme) => {
  if (typeof document === 'undefined') return;
  try {
    const current = readCookieTheme();
    if (current === theme) return;
    const secureToken = typeof window !== 'undefined' && window.location.protocol === 'https:' ? ';Secure' : '';
    document.cookie = `${THEME_COOKIE}=${theme};path=/;max-age=${COOKIE_MAX_AGE};SameSite=Lax${secureToken}`;
  } catch {
    // ignore cookie failures
  }
};

const resolveInitialTheme = (): Theme => {
  if (typeof window === 'undefined') return 'night';
  return readDatasetTheme() ?? readCookieTheme() ?? readStorageTheme() ?? 'night';
};

export default function Navigation({ currentPath = '/', initialTheme }: NavigationProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [activeTheme, setActiveTheme] = React.useState<Theme>(initialTheme ?? resolveInitialTheme);
  const [isHydrated, setIsHydrated] = React.useState(false);
  const [isScrolled, setIsScrolled] = React.useState(false);
  const broadcastRef = React.useRef<BroadcastChannel | null>(null);

  React.useEffect(() => {
    // mark hydrated to allow applying active UI states
    setIsHydrated(true);
  }, []);

  // Scroll-aware navigation
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const onScroll = () => setIsScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // Check initial state
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      // Use the same improved cookie parsing logic
      const cookieMatch = document.cookie.match(new RegExp('(^|; )' + THEME_COOKIE + '=([^;]*)'));
      let theme = null;

      if (cookieMatch?.[2]) {
        const cookieValue = cookieMatch[2];
        if (cookieValue === 'night' || cookieValue === 'moon' || cookieValue === 'dawn') {
          theme = cookieValue;
        }
      }

      const stored = theme ?? window.localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'night' || stored === 'moon' || stored === 'dawn') {
        setActiveTheme(stored);
      }
    } catch (_) {
      // ignore hydration sync issues
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    applyThemeToDom(activeTheme);

    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (stored !== activeTheme) {
        window.localStorage.setItem(THEME_STORAGE_KEY, activeTheme);
      }
    } catch (_) {
      // storage might be unavailable; fail silently
    }

    try {
      const secureToken = window.location.protocol === 'https:' ? ';Secure' : '';
      const cookieMatch = document.cookie.match(new RegExp('(^|; )' + THEME_COOKIE + '=([^;]*)'));
      if (cookieMatch?.[2] !== activeTheme) {
        document.cookie = `${THEME_COOKIE}=${activeTheme};path=/;max-age=${COOKIE_MAX_AGE};SameSite=Lax${secureToken}`;
      }
    } catch (_) {
      // ignore cookie issues
    }

    broadcastRef.current?.postMessage({ theme: activeTheme });
  }, [activeTheme]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY || !event.newValue) return;
      if (event.newValue === 'night' || event.newValue === 'moon' || event.newValue === 'dawn') {
        // Apply DOM immediately, then update state
        applyThemeToDom(event.newValue as Theme);
        setActiveTheme((previous) => (previous === event.newValue ? previous : (event.newValue as Theme)));
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) {
      return;
    }
    try {
      const channel = new BroadcastChannel(THEME_CHANNEL_NAME);
      broadcastRef.current = channel;
      const handleMessage = (event: MessageEvent<{ theme?: Theme }>) => {
        const incoming = event.data?.theme;
        if (incoming === 'night' || incoming === 'moon' || incoming === 'dawn') {
          // Apply DOM immediately, then update state
          applyThemeToDom(incoming);
          setActiveTheme((previous) => (previous === incoming ? previous : incoming));
        }
      };
      channel.addEventListener('message', handleMessage);
      return () => {
        channel.removeEventListener('message', handleMessage);
        channel.close();
        broadcastRef.current = null;
      };
    } catch (_) {
      broadcastRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const setTheme = React.useCallback(
    (theme: Theme) => {
      if (theme === activeTheme) return;
      // Optimistically apply immediately to avoid waiting for effects
      try {
        applyThemeToDom(theme);
        writeStorageTheme(theme);
        writeCookieTheme(theme);
        broadcastRef.current?.postMessage({ theme });
      } catch { }
      setActiveTheme(theme);
    },
    [activeTheme]
  );

  const isActive = React.useCallback(
    (href: string) => {
      if (href === '/') {
        return currentPath === '/';
      }
      return currentPath.startsWith(href);
    },
    [currentPath]
  );

  return (
    <header className={cn(
      "sticky top-0 z-40 border-b transition-all duration-300",
      isScrolled
        ? "border-[hsl(var(--border)/0.5)] bg-[hsl(var(--background)/0.88)] backdrop-blur-2xl shadow-[0_4px_24px_-8px_hsl(var(--background)/0.5)]"
        : "border-[hsl(var(--border)/0.35)] bg-[hsl(var(--background)/0.92)]/95 backdrop-blur-xl"
    )}>
      <nav
        aria-label="Primary"
        className={cn(
          "mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 md:flex-row md:items-center md:justify-between transition-all duration-300",
          isScrolled ? "py-2 sm:py-2.5" : "py-3 sm:py-4"
        )}
      >
        <div className="flex w-full flex-wrap items-center justify-between gap-4 md:w-auto md:flex-nowrap md:justify-start">
          <a href="/" className="flex items-center gap-3 text-foreground transition-transform hover:scale-[1.02]">
            <div className="nav-logo flex h-10 w-10 items-center justify-center rounded-2xl">
              <img
                src="/favicon.webp"
                alt="Career Tools Growth Studio icon"
                width={26}
                height={26}
                className="nav-logo__icon h-7 w-7 object-contain"
              />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">Career Tools</span>
              <span className="text-base font-semibold tracking-tight">Growth Studio</span>
            </div>
          </a>

          <div className="hidden items-center gap-2 lg:flex xl:gap-4">
            {navLinks.map(({ href, label }) => {
              const active = isActive(href);
              return (
                <a
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'group relative inline-flex flex-shrink-0 items-center whitespace-nowrap rounded-full border border-[hsl(var(--border)/0.38)] bg-[linear-gradient(135deg,hsl(var(--overlay)/0.26)_0%,hsl(var(--overlay)/0.16)_100%)] px-3 py-1.5 text-xs font-semibold tracking-tight text-muted-foreground transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--background))] hover:-translate-y-0.5 hover:border-[hsl(var(--accent)/0.45)] hover:text-foreground hover:shadow-[0_18px_36px_-24px_hsl(var(--background)/0.88)] xl:px-4 xl:py-2 xl:text-sm',
                    active
                      ? 'border-transparent bg-[linear-gradient(130deg,hsl(var(--overlay)/0.72)_0%,hsl(var(--overlay)/0.36)_60%,hsl(var(--overlay)/0.22)_100%)] text-foreground shadow-[0_22px_44px_-26px_hsl(var(--background)/0.95)]'
                      : 'shadow-[0_6px_20px_-16px_hsl(var(--background)/0.85)]'
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_14%_50%,hsl(var(--foam)/0.55)_0%,transparent_45%)] opacity-0 transition-opacity duration-300',
                      active ? 'opacity-100' : 'group-hover:opacity-75'
                    )}
                  />
                  <span className="relative z-10 flex items-center gap-2 lg:gap-3">
                    <span
                      aria-hidden
                      className={cn(
                        'hidden h-2 w-2 flex-none rounded-full transition-all duration-300 xl:block xl:h-2.5 xl:w-2.5',
                        active
                          ? 'bg-[radial-gradient(circle,hsl(var(--foam))_0%,hsl(var(--foam)/0.25)_100%)] shadow-[0_0_0_1px_hsl(var(--foam)/0.7)]'
                          : 'bg-[radial-gradient(circle,hsl(var(--foam)/0.6)_0%,hsl(var(--foam)/0.08)_100%)] opacity-80 group-hover:opacity-100'
                      )}
                    />
                    <span className="leading-none">{label}</span>
                  </span>
                </a>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 lg:flex">
              {themeOptions.map((option) => {
                const isActiveUi = isHydrated && activeTheme === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setTheme(option.id)}
                    className={cn(
                      'group inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.28em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--background))]',
                      isActiveUi &&
                      'border-transparent bg-[radial-gradient(circle_at_top_right,hsl(var(--overlay)/0.48)_0%,hsl(var(--overlay)/0.28)_55%,transparent_100%)] text-foreground shadow-[0_18px_36px_-26px_hsl(var(--background)/0.85)]'
                      ,
                      !isActiveUi &&
                      'border-[hsl(var(--border)/0.6)] bg-[hsl(var(--overlay)/0.22)] text-muted-foreground hover:-translate-y-0.5 hover:border-[hsl(var(--accent)/0.4)] hover:text-foreground hover:shadow-[0_14px_28px_-24px_hsl(var(--background)/0.85)]'
                    )}
                    aria-pressed={isHydrated ? activeTheme === option.id : undefined}
                    aria-label={`Activate ${option.label} theme`}
                    title={`${option.label} · ${option.description}`}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'h-1.5 w-1.5 rounded-full transition-colors duration-200',
                        isActiveUi
                          ? 'bg-[hsl(var(--foam))]'
                          : 'bg-[hsl(var(--muted-foreground)/0.45)] group-hover:bg-[hsl(var(--foam))]'
                      )}
                    />
                    <span className="leading-none">{option.label}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[hsl(var(--border)/0.7)] text-foreground hover:bg-[hsl(var(--overlay)/0.35)] md:hidden"
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
        </div>

        <div
          id="primary-navigation"
          className={cn(
            'w-full flex-col gap-4 border-t border-[hsl(var(--border)/0.35)] py-4 md:hidden',
            menuOpen
              ? 'flex translate-y-0 opacity-100'
              : 'hidden -translate-y-2 opacity-0'
          )}
        >
          <div className="flex flex-col gap-3">
            {navLinks.map(({ href, label }) => {
              const active = isActive(href);
              return (
                <a
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'rounded-xl px-3 py-2 text-base font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--background))]',
                    active
                      ? 'bg-[hsl(var(--overlay)/0.35)] text-foreground'
                      : 'text-muted-foreground hover:bg-[hsl(var(--overlay)/0.28)] hover:text-foreground'
                  )}
                >
                  {label}
                </a>
              );
            })}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Theme</span>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {themeOptions.map((option) => {
                  const isActiveUi = isHydrated && activeTheme === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setTheme(option.id)}
                      className={cn(
                        'flex-1 min-w-[90px] rounded-full border border-[hsl(var(--border)/0.7)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground transition-colors hover:bg-[hsl(var(--overlay)/0.3)] hover:text-foreground',
                        isActiveUi && 'bg-[hsl(var(--overlay)/0.35)] text-foreground ring-1 ring-[hsl(var(--ring))]'
                      )}
                      aria-pressed={isHydrated ? activeTheme === option.id : undefined}
                      aria-label={`Activate ${option.label} theme`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}
