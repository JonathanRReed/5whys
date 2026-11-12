import * as React from 'react';
import { createPortal } from 'react-dom';
import {
  currentStep,
  evaluateCheck,
  type GuideProgress,
  type GuideTool,
  loadGuideProgress,
  markStepDone,
  restartGuide,
  saveGuideProgress,
} from '../../lib/guide';
import { GUIDES } from '../../lib/guides';
import { cn, scrollBehavior } from '../../lib/utils';

const WATCH_MS = 500;
const TARGET_ATTR = 'data-guide-active';
/**
 * Screens where an open coach would sit on top of the thing it describes:
 * phones, tablets, and short laptops such as a 1366 by 768 Chromebook.
 */
const COMPACT_QUERY = '(max-width: 1279px), (max-height: 820px)';

/**
 * Guided mode for one tool. Renders a small bar where it is mounted (the
 * choice between "Guided" and "On my own") and, while guided, a coach panel
 * that stays out of the way: docked to the corner on wide screens and to the
 * bottom edge on phones. It is not a modal and never blocks the tool.
 *
 * Steps complete by watching the page for what the visitor actually did.
 */
export default function GuideCoach({ tool }: { tool: GuideTool }) {
  const guide = GUIDES[tool];
  const [progress, setProgress] = React.useState<GuideProgress | null>(null);
  const [chosen, setChosen] = React.useState(true);
  const [collapsed, setCollapsed] = React.useState(false);
  const [justDone, setJustDone] = React.useState<string | null>(null);

  // On a small screen the coach is a one-line bar, so it never sits on top of the
  // control a step is asking for. It opens on demand and folds away again
  // each time a step changes.
  const stepId = guide && progress ? (currentStep(guide, progress)?.id ?? 'finished') : null;
  // Someone who moved the step on from inside the coach (Skip, I did this) is
  // reading it, so it stays open and keeps their focus.
  const hadFocus = React.useRef(false);
  const coachRef = React.useRef<HTMLElement>(null);
  /** True when the keyboard was in the coach and is still there, or was dropped by it. */
  const focusIsWithCoach = () => {
    if (!hadFocus.current) return false;
    const current = document.activeElement;
    return !current || current === document.body || Boolean(coachRef.current?.contains(current));
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: fold when the step changes
  React.useEffect(() => {
    if (!focusIsWithCoach() && window.matchMedia?.(COMPACT_QUERY).matches) setCollapsed(true);
  }, [stepId]);

  // Hydrate from empty state, then read the saved choice.
  React.useEffect(() => {
    const saved = loadGuideProgress(tool);
    // A link can open a tool with the guide already on (?guide=1), for
    // someone sent here by the career review or a teacher.
    const asked = new URLSearchParams(window.location.search).get('guide') === '1';
    if (asked && saved?.mode !== 'guided') {
      const next =
        saved && !saved.finished ? { ...saved, mode: 'guided' as const } : restartGuide();
      saveGuideProgress(tool, next);
      setChosen(true);
      setProgress(next);
      return;
    }
    setChosen(saved !== null);
    setProgress(saved ?? { mode: 'free', done: [], finished: false });
  }, [tool]);

  const update = React.useCallback(
    (next: GuideProgress) => {
      setProgress(next);
      setChosen(true);
      saveGuideProgress(tool, next);
    },
    [tool]
  );

  const guided = progress?.mode === 'guided';
  const step = guide && progress && guided ? currentStep(guide, progress) : null;

  // Watch the page: a step is done when the visitor has done it.
  React.useEffect(() => {
    if (!guide || !progress || !step || step.done.kind === 'manual') return undefined;
    const check = () => {
      if (!evaluateCheck(step.done, document)) return;
      setJustDone(step.title);
      update(markStepDone(guide, progress, step.id));
    };
    check();
    const timer = window.setInterval(check, WATCH_MS);
    return () => window.clearInterval(timer);
  }, [guide, progress, step, update]);

  // Mark the part of the page the current step is about.
  React.useEffect(() => {
    if (!step?.target) return undefined;
    let marked: Element | null = null;
    const mark = () => {
      let found: Element | null = null;
      try {
        found = document.querySelector(step.target as string);
      } catch {
        found = null;
      }
      if (found === marked) return;
      marked?.removeAttribute(TARGET_ATTR);
      found?.setAttribute(TARGET_ATTR, '');
      marked = found;
    };
    mark();
    const timer = window.setInterval(mark, WATCH_MS);
    return () => {
      window.clearInterval(timer);
      marked?.removeAttribute(TARGET_ATTR);
    };
  }, [step]);

  // When a step finishes while the keyboard is inside the coach, the button
  // that had focus is replaced. Put focus on the new step's title instead of
  // letting it fall back to the top of the page.
  const freeRadioRef = React.useRef<HTMLInputElement>(null);
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const finishTitleRef = React.useRef<HTMLHeadingElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the step changes
  React.useEffect(() => {
    if (focusIsWithCoach()) {
      (titleRef.current ?? finishTitleRef.current)?.focus({ preventScroll: true });
    }
    hadFocus.current = false;
  }, [stepId]);
  const noteFocus = () => {
    hadFocus.current = Boolean(coachRef.current?.contains(document.activeElement));
  };

  if (!guide) return null;

  // Before the saved choice is read, show the bar as a first-time visitor
  // would see it, so the page does not jump when it arrives.
  const view = progress ?? { mode: 'free' as const, done: [], finished: false };
  const total = guide.steps.length;
  const position = step ? guide.steps.findIndex((s) => s.id === step.id) + 1 : total;

  const showTarget = () => {
    if (!step?.target) return;
    try {
      const target = document.querySelector<HTMLElement>(step.target);
      if (!target) return;
      target.scrollIntoView({ block: 'center', behavior: scrollBehavior() });
      // Take the keyboard there too: the first control inside it, or the
      // region itself.
      const control = target.matches('input, textarea, select, button, a[href]')
        ? target
        : target.querySelector<HTMLElement>(
            'input:not([type="hidden"]), textarea, select, button, a[href]'
          );
      if (control) {
        control.focus({ preventScroll: true });
      } else {
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
    } catch {
      /* a selector that matches nothing has nothing to show */
    }
  };

  const useExample = () => {
    if (!step?.example) return;
    try {
      (document.querySelector(step.example.click) as HTMLElement | null)?.click();
    } catch {
      /* nothing to press */
    }
  };

  const choose = (mode: 'guided' | 'free') => {
    setJustDone(null);
    // Ending the guide from the coach removes the coach: put focus on the
    // choice in the bar, where the guide can be turned back on.
    if (mode === 'free' && coachRef.current?.contains(document.activeElement)) {
      window.requestAnimationFrame(() => freeRadioRef.current?.focus());
    }
    // Someone who just asked for the guide wants to read the first step.
    if (mode === 'guided') setCollapsed(false);
    if (mode === 'free') update({ ...view, mode: 'free' });
    else update(view.finished ? restartGuide() : { ...view, mode: 'guided' });
  };

  return (
    <>
      <div
        className="mx-auto mb-10 flex w-full max-w-6xl flex-col gap-3 rounded-xl border border-border/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
        data-guide-bar
      >
        <p className="min-w-0 text-sm text-muted-foreground sm:flex-1">
          {guided
            ? 'Guided mode is on. The coach follows what you do on this page.'
            : chosen
              ? 'You are working on your own. Turn the guide on any time.'
              : guide.invitation}
        </p>
        <fieldset className="m-0 min-w-0 border-0 p-0">
          <legend className="sr-only">How to use this tool</legend>
          <div className="flex gap-1.5">
            {(
              [
                ['guided', 'Guided'],
                ['free', 'On my own'],
              ] as const
            ).map(([mode, label]) => (
              <label key={mode} className="relative">
                <input
                  ref={mode === 'free' ? freeRadioRef : undefined}
                  type="radio"
                  name={`guide-mode-${tool}`}
                  checked={view.mode === mode}
                  onChange={() => choose(mode)}
                  className="peer absolute inset-0 cursor-pointer opacity-0"
                />
                <span
                  className={cn(
                    'inline-flex min-h-9 items-center rounded-lg border border-border/50 px-3 text-sm text-muted-foreground transition-colors',
                    'peer-hover:text-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring',
                    'peer-checked:border-foam peer-checked:bg-foam/12 peer-checked:text-foreground'
                  )}
                >
                  {label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {guided &&
        createPortal(
          <aside
            ref={coachRef}
            onClickCapture={noteFocus}
            onKeyDownCapture={noteFocus}
            aria-label="Guide"
            className={cn(
              'fixed inset-x-3 bottom-3 z-40 rounded-xl bg-popover text-popover-foreground shadow-[0_28px_70px_-32px_hsl(var(--background))] ring-1 ring-border/50 print:hidden',
              // Never taller than the screen, so Hide and End guide stay reachable at large text sizes.
              'max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain',
              'sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[22rem]'
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 px-4 pt-3">
              <p className="min-w-[10rem] flex-1 text-xs text-muted-foreground">
                <span className="font-mono tabular-nums">
                  {step ? `Step ${position} of ${total}` : 'Guide finished'}
                </span>
                {collapsed && (
                  <span className="mt-0.5 block text-sm font-medium text-foreground">
                    {step ? step.title : guide.finish.title}
                  </span>
                )}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  aria-expanded={!collapsed}
                  onClick={() => setCollapsed((value) => !value)}
                  className="inline-flex min-h-9 items-center rounded-md px-2.5 text-xs text-muted-foreground hover:bg-overlay/40 hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {collapsed ? 'Show' : 'Hide'}
                </button>
                <button
                  type="button"
                  onClick={() => choose('free')}
                  className="inline-flex min-h-9 items-center rounded-md px-2.5 text-xs text-muted-foreground hover:bg-overlay/40 hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                >
                  End guide
                </button>
              </div>
            </div>

            <div
              className={cn(
                'mx-4 mt-2 h-1 overflow-hidden rounded-full bg-foreground/10',
                collapsed && 'mb-3'
              )}
              aria-hidden="true"
            >
              <div
                className="forced-fill h-full origin-left rounded-full bg-foam transition-transform duration-300 motion-reduce:transition-none"
                style={{ transform: `scaleX(${view.done.length / total})` }}
              />
            </div>

            <div className={cn('px-4 pb-4 pt-3', collapsed && 'hidden')}>
              {step ? (
                <div className="space-y-2">
                  {justDone && <p className="text-xs text-foam">Done: {justDone}.</p>}
                  <h2
                    ref={titleRef}
                    tabIndex={-1}
                    className="font-display text-lg font-semibold leading-snug focus-visible:outline-hidden"
                  >
                    {step.title}
                  </h2>
                  <p className="text-sm leading-relaxed">{step.body}</p>
                  {step.why && (
                    <p className="hidden text-xs leading-relaxed text-muted-foreground sm:block">
                      {step.why}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {step.target && (
                      <button
                        type="button"
                        onClick={showTarget}
                        className="inline-flex min-h-9 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        Show me where
                      </button>
                    )}
                    {step.example && (
                      <button
                        type="button"
                        onClick={useExample}
                        className="inline-flex min-h-9 items-center rounded-lg border border-border/60 px-3 text-sm hover:bg-overlay/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {step.example.label}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setJustDone(null);
                        update(markStepDone(guide, view, step.id));
                      }}
                      className="inline-flex min-h-9 items-center rounded-lg px-3 text-sm text-muted-foreground hover:bg-overlay/40 hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {step.done.kind === 'manual' ? 'I did this' : 'Skip this step'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <h2
                    ref={finishTitleRef}
                    tabIndex={-1}
                    className="font-display text-lg font-semibold leading-snug focus-visible:outline-hidden"
                  >
                    {guide.finish.title}
                  </h2>
                  <p className="text-sm leading-relaxed">{guide.finish.body}</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {guide.finish.link && (
                      <a
                        href={guide.finish.link.href}
                        className="inline-flex min-h-9 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {guide.finish.link.label}
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => update(restartGuide())}
                      className="inline-flex min-h-9 items-center rounded-lg border border-border/60 px-3 text-sm hover:bg-overlay/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Start the guide again
                    </button>
                  </div>
                </div>
              )}
            </div>
          </aside>,
          document.body
        )}
      {/* Read each new step aloud in full, whether the coach is open or folded. */}
      <p className="sr-only" role="status">
        {guided && step
          ? `Step ${position} of ${total}. ${step.title}. ${step.body}`
          : guided
            ? `Guide finished. ${guide.finish.title}. ${guide.finish.body}`
            : ''}
      </p>
    </>
  );
}
