/**
 * Guided mode: an interactive walk-through of a tool for someone who has not
 * used it before. A guide is a list of steps. Each step points at a part of
 * the page and knows how to tell, from the page itself, that the visitor has
 * done it, so steps tick off because of what the visitor did, not because
 * they pressed "next".
 *
 * Guides read the page; they never read or write a tool's saved work.
 */

/** How a step knows it is done. Every check is a plain look at the page. */
export type GuideCheck =
  /** Something matching the selector is on the page. */
  | { kind: 'exists'; selector: string }
  /** A text field matching the selector holds at least `minLength` characters. */
  | { kind: 'filled'; selector: string; minLength?: number }
  /** At least `atLeast` elements match the selector. */
  | { kind: 'count'; selector: string; atLeast: number }
  /** The text of the first match contains `pattern` (a regular expression). */
  | { kind: 'text'; selector: string; pattern: string }
  /** Only the visitor can say. They press "I did this". */
  | { kind: 'manual' };

export interface GuideStep {
  id: string;
  title: string;
  /** What to do, in one or two plain sentences. */
  body: string;
  /** Why it matters. Optional, shown smaller. */
  why?: string;
  /** The part of the page this step is about. Highlighted and scrolled to. */
  target?: string;
  done: GuideCheck;
  /** A shortcut for someone with nothing of their own to try it on. */
  example?: { label: string; click: string };
}

export interface Guide {
  tool: GuideTool;
  /** Shown when the guide is offered. */
  invitation: string;
  steps: GuideStep[];
  finish: { title: string; body: string; link?: { label: string; href: string } };
}

export const GUIDE_TOOLS = [
  'career',
  'resume-game',
  'networking-practice',
  'interview-glow-up',
  'application',
  'pay',
] as const;
export type GuideTool = (typeof GUIDE_TOOLS)[number];

export type GuideMode = 'guided' | 'free';

export interface GuideProgress {
  mode: GuideMode;
  /** Steps finished or skipped, by id. */
  done: string[];
  finished: boolean;
}

/** A device preference, like the theme: its own key, not part of the backup. */
export const GUIDE_STORAGE_KEY = 'career-tools-guides';

const DEFAULT_PROGRESS: GuideProgress = { mode: 'free', done: [], finished: false };

function isTool(value: string): value is GuideTool {
  return (GUIDE_TOOLS as readonly string[]).includes(value);
}

function normalize(value: unknown): GuideProgress {
  if (!value || typeof value !== 'object') return { ...DEFAULT_PROGRESS };
  const raw = value as Partial<GuideProgress>;
  return {
    mode: raw.mode === 'guided' ? 'guided' : 'free',
    done: Array.isArray(raw.done) ? raw.done.filter((id) => typeof id === 'string') : [],
    finished: raw.finished === true,
  };
}

/** Saved progress for one tool, or null when the visitor has never chosen. */
export function loadGuideProgress(tool: GuideTool): GuideProgress | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(GUIDE_STORAGE_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw) as Record<string, unknown>;
    return all && typeof all === 'object' && tool in all ? normalize(all[tool]) : null;
  } catch {
    return null;
  }
}

export function saveGuideProgress(tool: GuideTool, progress: GuideProgress): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(GUIDE_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    const all: Record<string, unknown> = {};
    if (parsed && typeof parsed === 'object') {
      for (const [key, value] of Object.entries(parsed)) if (isTool(key)) all[key] = value;
    }
    all[tool] = progress;
    window.localStorage.setItem(GUIDE_STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable: the guide still works for this visit */
  }
}

function safeQueryAll(root: ParentNode, selector: string): Element[] {
  try {
    return [...root.querySelectorAll(selector)];
  } catch {
    return [];
  }
}

/** Look at the page and say whether a step's condition holds. */
export function evaluateCheck(check: GuideCheck, root: ParentNode): boolean {
  switch (check.kind) {
    case 'manual':
      return false;
    case 'exists':
      return safeQueryAll(root, check.selector).length > 0;
    case 'count':
      return safeQueryAll(root, check.selector).length >= check.atLeast;
    case 'filled':
      return safeQueryAll(root, check.selector).some((element) => {
        const value = (element as HTMLInputElement | HTMLTextAreaElement).value;
        return typeof value === 'string' && value.trim().length >= (check.minLength ?? 1);
      });
    case 'text': {
      const first = safeQueryAll(root, check.selector)[0];
      if (!first) return false;
      try {
        return new RegExp(check.pattern, 'i').test(first.textContent ?? '');
      } catch {
        return false;
      }
    }
  }
}

/** The first step not yet done or skipped, or null when the guide is complete. */
export function currentStep(guide: Guide, progress: GuideProgress): GuideStep | null {
  return guide.steps.find((step) => !progress.done.includes(step.id)) ?? null;
}

export function markStepDone(guide: Guide, progress: GuideProgress, stepId: string): GuideProgress {
  if (progress.done.includes(stepId)) return progress;
  const done = [...progress.done, stepId];
  return { ...progress, done, finished: guide.steps.every((step) => done.includes(step.id)) };
}

/** Start over from the first step, in guided mode. */
export function restartGuide(): GuideProgress {
  return { mode: 'guided', done: [], finished: false };
}
