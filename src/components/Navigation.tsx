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
  { href: '/role-decoder', label: 'Role Decoder Pro' },
];

export default function Navigation({ currentPath = '/' }: NavigationProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [activeTheme, setActiveTheme] = React.useState<Theme>(() => {
    if (typeof window === 'undefined') {
      return 'night';
    }

    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'night' || stored === 'moon' || stored === 'dawn') {
        return stored;
      }
    } catch (_) {
      // ignore storage access issues
    }

    const datasetTheme = document.documentElement.dataset.theme;
    if (datasetTheme === 'moon' || datasetTheme === 'dawn') {
      return datasetTheme;
    }

    return 'night';
  });

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
      <nav aria-label="Primary" className="mx-auto flex h-20 max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-4">
          <a href="/" className="flex items-center gap-3 text-foreground transition-transform hover:scale-[1.02]">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[radial-gradient(circle_at_top,#eb6f92_0%,#31748f_60%,transparent_100%)] text-sm font-semibold text-foreground shadow-inner shadow-[hsl(var(--background)/0.4)]">
              CT
            </div>
            <div className="flex flex-col text-left">
              <span className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">Career Tools</span>
              <span className="text-base font-semibold tracking-tight">Growth Studio</span>
            </div>
          </a>

          <div className="hidden items-center gap-8 md:flex">
            {navLinks.map(({ href, label }) => {
              const active = isActive(href);
              return (
                <a
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'inline-flex items-center rounded-full px-3 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--background))]',
                    active
                      ? 'bg-[hsl(var(--overlay)/0.45)] text-foreground shadow-[0_16px_32px_-28px_hsl(var(--background)/0.8)]'
                      : 'text-muted-foreground hover:bg-[hsl(var(--overlay)/0.3)] hover:text-foreground'
                  )}
                >
                  {label}
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
                    'inline-flex items-center justify-center rounded-full border border-[hsl(var(--border)/0.7)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground transition-all duration-200 hover:-translate-y-0.5 hover:text-foreground',
                    activeTheme === option.id &&
                      'bg-[hsl(var(--overlay)/0.35)] text-foreground ring-2 ring-[hsl(var(--ring))] ring-offset-2 ring-offset-[hsl(var(--background))]'
                  )}
                  aria-pressed={activeTheme === option.id}
                  aria-label={`Activate ${option.label} theme`}
                  title={`${option.label} · ${option.description}`}
                >
                  {option.label}
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
            'flex flex-col gap-4 border-t border-[hsl(var(--border)/0.35)] py-4 md:hidden',
            menuOpen
              ? 'visible translate-y-0 opacity-100'
              : 'invisible -translate-y-2 opacity-0'
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
