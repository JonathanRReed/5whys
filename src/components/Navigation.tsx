import * as React from 'react';
import { cn, scrollBehavior } from '../lib/utils';
import DisplayMenu from './DisplayMenu';

type NavigationProps = {
  currentPath?: string;
};

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/start/', label: 'Start here' },
  { href: '/dashboard/', label: 'Dashboard' },
  { href: '/career/', label: 'The Five Whys' },
  { href: '/resume-game/', label: 'The Resume Game' },
  { href: '/networking-practice/', label: 'Networking Practice' },
  { href: '/interview-glow-up/', label: 'Interview Glow Up' },
  { href: '/application/', label: 'The Application Desk' },
  { href: '/pay/', label: 'Pay' },
];

export default function Navigation({ currentPath = '/' }: NavigationProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [compactToolsOpen, setCompactToolsOpen] = React.useState(false);
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [showScrollTop, setShowScrollTop] = React.useState(false);
  const compactToolsTrigger = React.useRef<HTMLButtonElement>(null);
  const compactToolsMenu = React.useRef<HTMLDivElement>(null);
  const mobileMenuTrigger = React.useRef<HTMLButtonElement>(null);
  const mobileMenu = React.useRef<HTMLElement>(null);

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
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      if (!mainContent.hasAttribute('tabindex')) {
        mainContent.setAttribute('tabindex', '-1');
      }
      mainContent.focus({ preventScroll: true });
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

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (compactToolsOpen) {
          setCompactToolsOpen(false);
          compactToolsTrigger.current?.focus();
        }
        if (menuOpen) {
          setMenuOpen(false);
          mobileMenuTrigger.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [compactToolsOpen, menuOpen]);

  React.useEffect(() => {
    if (!compactToolsOpen) return;

    const dismissOutside = (event: PointerEvent | FocusEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        !compactToolsTrigger.current?.contains(target) &&
        !compactToolsMenu.current?.contains(target)
      ) {
        setCompactToolsOpen(false);
      }
    };

    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('focusin', dismissOutside);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('focusin', dismissOutside);
    };
  }, [compactToolsOpen]);

  // The phone menu covers the page, so Tab must not walk into the page behind
  // it. When focus leaves the menu (and its toggle), the menu closes.
  React.useEffect(() => {
    if (!menuOpen) return undefined;
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        !mobileMenu.current?.contains(target) &&
        !mobileMenuTrigger.current?.contains(target)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, [menuOpen]);

  const isActive = React.useCallback(
    (href: string) => {
      if (href === '/') return currentPath === '/';
      return currentPath.startsWith(href);
    },
    [currentPath]
  );

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
          // Wraps rather than pushing the Aa and menu buttons off screen at large text sizes.
          'mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-y-2 px-4 transition-all duration-300',
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
              className="hidden text-[0.72rem] font-medium uppercase tracking-[0.24em] text-muted-foreground sm:block"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              Career Studio
            </span>
          </span>
        </a>

        {/* Main links, with the six tools behind one menu so the bar stays
            the same width however many plates there are. */}
        <div className="relative hidden md:flex">
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
              ref={compactToolsTrigger}
              onClick={() => setCompactToolsOpen((open) => !open)}
              aria-expanded={compactToolsOpen}
              aria-controls={compactToolsOpen ? 'compact-tools-menu' : undefined}
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
              ref={compactToolsMenu}
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

        {/* Right side: display settings + mobile menu */}
        <div className="flex items-center gap-2">
          <DisplayMenu />

          {/* Mobile menu toggle */}
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-overlay/35 hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring md:hidden"
            ref={mobileMenuTrigger}
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
      <nav
        id="primary-navigation"
        ref={mobileMenu}
        aria-label="Menu"
        aria-hidden={!menuOpen}
        inert={!menuOpen ? true : undefined}
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-72 max-w-full flex-col gap-1 overflow-y-auto border-l border-border/25 bg-background/98 px-4 pb-4 pt-20 md:hidden transition-transform duration-300 ease-out',
          menuOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'
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
      </nav>
      {showScrollTop && (
        <button
          type="button"
          onClick={scrollToTop}
          aria-label="Scroll to top"
          title="Scroll to top"
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
