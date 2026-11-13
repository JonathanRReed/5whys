import * as React from 'react';
import { createPortal } from 'react-dom';
import {
  advanceTo,
  currentStep,
  evaluateCheck,
  furthestNewlyPassed,
  type GuideProgress,
  type GuideTool,
  loadGuideProgress,
  markStepDone,
  passedSteps,
  reopenFrom,
  restartGuide,
  saveGuideProgress,
  stepBackIndex,
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
/** Looks in a row a step's needs must be missing before the coach steps back. */
const MISSING_LOOKS = 2;
/** Room kept between a field and the coach bar. */
const CLEARANCE = 16;

function find(selector: string | undefined): HTMLElement | null {
  if (!selector) return null;
  try {
    return document.querySelector<HTMLElement>(selector);
  } catch {
    return null;
  }
}

/**
 * Scroll so an element sits above the coach rather than under it. A tall
 * element is brought to the top of the screen instead.
 */
function keepClearOfCoach(element: HTMLElement, coach: HTMLElement | null, smooth = false) {
  if (!coach) return;
  const bar = coach.getBoundingClientRect();
  const box = element.getBoundingClientRect();
  const overlapsSideways = box.left < bar.right && box.right > bar.left;
  if (!overlapsSideways || box.bottom <= bar.top - CLEARANCE || box.top >= bar.bottom) return;
  const lift = Math.min(box.bottom - (bar.top - CLEARANCE), box.top - CLEARANCE);
  if (lift > 0) window.scrollBy({ top: lift, behavior: smooth ? scrollBehavior() : 'auto' });
}

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
  const [coachHeight, setCoachHeight] = React.useState(0);
  // Steps whose page state showed them done at the last look. Only a change
  // moves the coach forward, so restarting on a full page starts at step 1.
  const passedRef = React.useRef<Set<string>>(new Set());
  const missingLooks = React.useRef(0);
  // A step the visitor went back to stays open until its check stops holding.
  const heldRef = React.useRef<string | null>(null);
  // "Show me where" places the target itself; its focus must not be lifted again.
  const placing = React.useRef(false);

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

  // Watch the page. The step follows what is on it: work already there on
  // load (a decoded posting, a saved story) moves the coach forward, a page
  // that no longer shows what the step needs (a reload back at the start)
  // moves it back, and the current step finishes when the visitor does it.
  React.useEffect(() => {
    if (!guide || !progress || progress.mode !== 'guided') return undefined;
    const look = () => {
      let next = progress;
      const now = passedSteps(guide, document);
      const furthest = furthestNewlyPassed(guide, now, passedRef.current);
      passedRef.current = now;
      if (furthest >= 0) next = advanceTo(guide, next, furthest);

      const back = stepBackIndex(guide, next, document);
      if (back === null) missingLooks.current = 0;
      else if (++missingLooks.current >= MISSING_LOOKS) {
        missingLooks.current = 0;
        next = reopenFrom(guide, next, back);
      }

      const step = currentStep(guide, next);
      if (step && step.done.kind !== 'manual') {
        const holds = evaluateCheck(step.done, document);
        if (heldRef.current === step.id) {
          if (!holds) heldRef.current = null;
        } else if (holds) {
          setJustDone(step.title);
          next = markStepDone(guide, next, step.id);
        }
      }
      if (next !== progress) update(next);
    };
    look();
    const timer = window.setInterval(look, WATCH_MS);
    return () => window.clearInterval(timer);
  }, [guide, progress, update]);

  // Keep the coach off the field being used: measure it, leave that much room
  // at the end of the page, and lift a focused field that lands under it.
  React.useEffect(() => {
    if (!guided) return undefined;
    const coach = coachRef.current;
    if (!coach) return undefined;
    const measure = () => setCoachHeight(coach.offsetHeight);
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(coach);
    const onFocusIn = (event: FocusEvent) => {
      const field = event.target;
      if (!(field instanceof HTMLElement) || coach.contains(field)) return;
      if (placing.current) {
        placing.current = false;
        return;
      }
      window.requestAnimationFrame(() => keepClearOfCoach(field, coach));
    };
    document.addEventListener('focusin', onFocusIn);
    return () => {
      observer?.disconnect();
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [guided]);

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
    const targetSelector = step.target;
    // The target may be on another tab: open it first.
    if (!find(targetSelector) && step.reveal) find(step.reveal)?.click();
    // On a small screen the open coach would sit on top of the target: fold it.
    const compact = window.matchMedia?.(COMPACT_QUERY).matches ?? false;
    if (compact) setCollapsed(true);
    // Wait for the tab and the folded coach to be drawn before measuring.
    window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() => {
        const target = find(targetSelector);
        if (!target) return;
        // Take the keyboard there too: the first control inside it, or the
        // region itself.
        const control = target.matches('input, textarea, select, button, a[href]')
          ? target
          : target.querySelector<HTMLElement>(
              'input:not([type="hidden"]), textarea, select, button, a[href]'
            );
        const coach = coachRef.current;
        const bottom = coach ? coach.getBoundingClientRect().top : window.innerHeight;
        const box = target.getBoundingClientRect();
        const room = bottom - 2 * CLEARANCE;
        // Center it in the space above the coach, or show its top when it is taller.
        const lift =
          box.height > room
            ? box.top - CLEARANCE
            : box.top + box.height / 2 - (CLEARANCE + room / 2);
        window.scrollBy({ top: lift, behavior: scrollBehavior() });
        placing.current = true;
        if (control) {
          control.focus({ preventScroll: true });
        } else {
          if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
          target.focus({ preventScroll: true });
        }
        // focusin runs during focus(); nothing later should be skipped.
        placing.current = false;
      })
    );
  };

  /** Go back one step. It stays open until the visitor does it again. */
  const goBack = () => {
    const at = step ? guide.steps.indexOf(step) : guide.steps.length;
    if (at <= 0) return;
    heldRef.current = guide.steps[at - 1].id;
    setJustDone(null);
    update(reopenFrom(guide, view, at - 1));
  };

  /** Start again from step 1, even on a page that already holds work. */
  const startAgain = () => {
    passedRef.current = passedSteps(guide, document);
    heldRef.current = null;
    setJustDone(null);
    update(restartGuide());
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
    else if (view.finished) startAgain();
    else update({ ...view, mode: 'guided' });
  };

  return (
    <>
      <div
        className={cn(
          'mx-auto mb-10 flex w-full max-w-6xl flex-col gap-3 rounded-xl border sm:flex-row sm:items-center sm:justify-between sm:gap-6',
          // Until the visitor has chosen, the offer is the first thing on the
          // tool: a quiet line here was read past.
          chosen ? 'border-border/40 px-4 py-3' : 'border-foam/50 bg-foam/8 px-5 py-5'
        )}
        data-guide-bar
        data-guide-offer={chosen ? undefined : ''}
      >
        {chosen ? (
          <p className="min-w-0 text-sm text-muted-foreground sm:flex-1">
            {guided
              ? 'Guided mode is on. The coach follows what you do on this page.'
              : 'You are working on your own. Turn the guide on any time.'}
          </p>
        ) : (
          <div className="min-w-0 space-y-1 sm:flex-1">
            <p className="font-display text-lg font-semibold text-foreground">
              Want to be walked through it?
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {guide.invitation} It has {guide.steps.length} steps, shows you where to press, and
              you can end it at any point.
            </p>
          </div>
        )}
        <fieldset className="m-0 min-w-0 border-0 p-0">
          <legend className="sr-only">How to use this tool</legend>
          <div className="flex gap-1.5">
            {(
              [
                ['guided', chosen ? 'Guided' : 'Guide me'],
                ['free', 'On my own'],
              ] as const
            ).map(([mode, label]) => (
              <label key={mode} className="relative">
                <input
                  ref={mode === 'free' ? freeRadioRef : undefined}
                  type="radio"
                  name={`guide-mode-${tool}`}
                  checked={chosen && view.mode === mode}
                  onChange={() => choose(mode)}
                  className="peer absolute inset-0 cursor-pointer opacity-0"
                />
                <span
                  className={cn(
                    'inline-flex items-center rounded-lg border transition-colors',
                    'peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2',
                    chosen
                      ? 'min-h-9 border-border/50 px-3 text-sm text-muted-foreground peer-hover:text-foreground peer-checked:border-foam peer-checked:bg-foam/12 peer-checked:text-foreground'
                      : mode === 'guided'
                        ? 'min-h-11 border-primary bg-primary px-4 text-sm font-semibold text-primary-foreground peer-hover:bg-primary/90'
                        : 'min-h-11 border-border/60 px-4 text-sm text-foreground peer-hover:bg-overlay/40'
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
          <>
            {/* Room at the end of the page, so the last field can scroll above the coach. */}
            <div
              aria-hidden="true"
              data-guide-spacer
              className="print:hidden"
              style={{ height: coachHeight ? coachHeight + 2 * CLEARANCE : 0 }}
            />
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
                      {position > 1 && (
                        <button
                          type="button"
                          onClick={goBack}
                          className="inline-flex min-h-9 items-center rounded-lg px-3 text-sm text-muted-foreground hover:bg-overlay/40 hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          Back a step
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
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      On a shared or lab computer, export your work from the dashboard and then
                      clear this device.{' '}
                      <a
                        href="/dashboard/#storage-title"
                        className="text-foreground underline underline-offset-4 hover:text-foam focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        Open the dashboard
                      </a>
                    </p>
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
                        onClick={goBack}
                        className="inline-flex min-h-9 items-center rounded-lg px-3 text-sm text-muted-foreground hover:bg-overlay/40 hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        Back a step
                      </button>
                      <button
                        type="button"
                        onClick={startAgain}
                        className="inline-flex min-h-9 items-center rounded-lg border border-border/60 px-3 text-sm hover:bg-overlay/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        Start the guide again
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </aside>
          </>,
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
