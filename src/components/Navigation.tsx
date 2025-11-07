import * as React from 'react';

import { cn } from '../lib/utils';

type Theme = 'night' | 'moon' | 'dawn';

type NavigationProps = {
  currentPath?: string;
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
  { href: '/', label: 'Overview' },
  { href: '/career', label: 'Career 5 Whys' },
  { href: '/resume-game', label: 'Resume Game' },
  { href: '/networking-practice', label: 'Networking Studio' },
];

export default function Navigation({ currentPath = '/' }: NavigationProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [activeTheme, setActiveTheme] = React.useState<Theme>(() => {
    // Check if we're on the client
    if (typeof window === 'undefined') {
      return 'night';
    }

    try {
      // First check the current DOM theme (set by server-side script)
      const currentDatasetTheme = document.documentElement.dataset.theme;
      if (currentDatasetTheme === 'moon' || currentDatasetTheme === 'dawn') {
        return currentDatasetTheme;
      }
      
      // If no dataset theme, check cookies
      const cookieMatch = document.cookie.match(new RegExp('(^|; )' + THEME_COOKIE + '=([^;]*)'));
      if (cookieMatch?.[2]) {
        const cookieValue = cookieMatch[2];
        if (cookieValue === 'night' || cookieValue === 'moon' || cookieValue === 'dawn') {
          return cookieValue;
        }
      }

      // Fall back to localStorage
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'night' || stored === 'moon' || stored === 'dawn') {
        return stored;
      }
    } catch (_) {
      // ignore storage access issues
    }

    return 'night';
  });

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

    const root = document.documentElement;
    if (activeTheme === 'night') {
      root.removeAttribute('data-theme');
    } else {
      root.dataset.theme = activeTheme;
    }

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, activeTheme);
    } catch (_) {
      // storage might be unavailable; fail silently
    }

    try {
      document.cookie = `${THEME_COOKIE}=${activeTheme};path=/;max-age=${COOKIE_MAX_AGE};SameSite=Lax`;
    } catch (_) {
      // ignore cookie issues
    }
  }, [activeTheme]);

  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const setTheme = React.useCallback((theme: Theme) => {
    setActiveTheme(theme);
  }, []);

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
    <header className="sticky top-0 z-40 border-b border-[hsl(var(--border)/0.35)] bg-[hsl(var(--background)/0.92)]/95 backdrop-blur-xl transition-colors duration-300">
      <nav
        aria-label="Primary"
        className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 sm:py-4 md:flex-row md:items-center md:justify-between"
      >
        <div className="flex w-full flex-wrap items-center justify-between gap-4 md:w-auto md:flex-nowrap md:justify-start">
          <a href="/" className="flex items-center gap-3 text-foreground transition-transform hover:scale-[1.02]">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[radial-gradient(circle_at_top_right,hsl(var(--foam)/0.32)_0%,hsl(var(--iris)/0.4)_55%,hsl(var(--love)/0.28)_100%)] shadow-[0_10px_24px_-18px_hsl(var(--background)/0.8)]">
              <img
                src="/favicon.webp"
                alt="Career Tools Growth Studio icon"
                width={28}
                height={28}
                className="h-7 w-7 object-contain"
              />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">Career Tools</span>
              <span className="text-base font-semibold tracking-tight">Growth Studio</span>
            </div>
          </a>

          <div className="hidden items-center gap-6 md:flex">
            {navLinks.map(({ href, label }) => {
              const active = isActive(href);
              return (
                <a
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'group relative inline-flex items-center overflow-hidden rounded-full border border-[hsl(var(--border)/0.38)] bg-[linear-gradient(135deg,hsl(var(--overlay)/0.26)_0%,hsl(var(--overlay)/0.16)_100%)] px-4 py-2 text-sm font-semibold tracking-tight text-muted-foreground transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--background))] hover:-translate-y-0.5 hover:border-[hsl(var(--accent)/0.45)] hover:text-foreground hover:shadow-[0_18px_36px_-24px_hsl(var(--background)/0.88)]',
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
                  <span className="relative z-10 flex items-center gap-3">
                    <span
                      aria-hidden
                      className={cn(
                        'h-2.5 w-2.5 flex-none rounded-full transition-all duration-300',
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
            <div className="hidden items-center gap-2 md:flex">
              {themeOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setTheme(option.id)}
                  className={cn(
                    'group inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.28em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--background))]',
                    activeTheme === option.id &&
                      'border-transparent bg-[radial-gradient(circle_at_top_right,hsl(var(--overlay)/0.48)_0%,hsl(var(--overlay)/0.28)_55%,transparent_100%)] text-foreground shadow-[0_18px_36px_-26px_hsl(var(--background)/0.85)]'
                  ,
                    activeTheme !== option.id &&
                      'border-[hsl(var(--border)/0.6)] bg-[hsl(var(--overlay)/0.22)] text-muted-foreground hover:-translate-y-0.5 hover:border-[hsl(var(--accent)/0.4)] hover:text-foreground hover:shadow-[0_14px_28px_-24px_hsl(var(--background)/0.85)]'
                  )}
                  aria-pressed={activeTheme === option.id}
                  aria-label={`Activate ${option.label} theme`}
                  title={`${option.label} · ${option.description}`}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'h-1.5 w-1.5 rounded-full transition-colors duration-200',
                      activeTheme === option.id
                        ? 'bg-[hsl(var(--foam))]'
                        : 'bg-[hsl(var(--muted-foreground)/0.45)] group-hover:bg-[hsl(var(--foam))]'
                    )}
                  />
                  <span className="leading-none">{option.label}</span>
                </button>
              ))}
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
                {themeOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setTheme(option.id)}
                    className={cn(
                      'flex-1 min-w-[90px] rounded-full border border-[hsl(var(--border)/0.7)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground transition-colors hover:bg-[hsl(var(--overlay)/0.3)] hover:text-foreground',
                      activeTheme === option.id && 'bg-[hsl(var(--overlay)/0.35)] text-foreground ring-1 ring-[hsl(var(--ring))]'
                    )}
                    aria-pressed={activeTheme === option.id}
                    aria-label={`Activate ${option.label} theme`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}
