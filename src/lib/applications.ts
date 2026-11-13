/**
 * Applications: the spine the four tools hang off.
 *
 * A student rarely has one role in play; they have several deadlines at
 * once. Each tracked application is a target (title, company, deadline) plus
 * an optional link to the decoded Glow Up role it belongs to. The record is
 * deliberately thin: it never copies prep state. Readiness is derived where
 * it is shown (career-bridge.ts) from the tools that own it.
 *
 * Stored locally like everything else. The key is part of the backup
 * contract: studio-backup.ts and career-bridge.ts change in the same commit
 * as this file.
 */

import { generateId } from './glowup-store';

export const APPLICATIONS_KEY = 'career-applications';
const CURRENT_VERSION = 1;

export interface TrackedApplication {
  id: string;
  /** Free text. When roleId is linked, the decoded role's title wins at read time. */
  title: string;
  company: string;
  /** 'YYYY-MM-DD' from a date input, or null when the date is not known yet. */
  deadline: string | null;
  /** The DecodedRole in interview-glow-up-data this application tracks. */
  roleId: string | null;
  /**
   * 'YYYY-MM-DD' the visitor said they sent it, or null while it is not sent.
   * Absent in applications saved before it was recorded.
   */
  sentOn?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ApplicationsData {
  version: number;
  applications: TrackedApplication[];
  /** The one in focus on the dashboard. */
  activeId: string | null;
}

export function createDefaultApplications(): ApplicationsData {
  return { version: CURRENT_VERSION, applications: [], activeId: null };
}

const DEADLINE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A 'YYYY-MM-DD' string parsed as a local calendar date, or null. Strict:
 * '2026-13-40' would silently roll into another month as a Date, so the
 * components are checked against what the Date actually produced.
 */
function parseDeadline(deadline: string | null | undefined): Date | null {
  if (!deadline || !DEADLINE_RE.test(deadline)) return null;
  const [y, m, d] = deadline.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

/** A real 'YYYY-MM-DD' calendar date. Shared with the desk's dated steps. */
export const isDeadline = (value: unknown): value is string =>
  typeof value === 'string' && parseDeadline(value) !== null;

function normalizeApplication(value: unknown): TrackedApplication | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<TrackedApplication>;
  const title = typeof raw.title === 'string' ? raw.title : '';
  const company = typeof raw.company === 'string' ? raw.company : '';
  if (!title.trim() && !company.trim()) return null;
  const now = Date.now();
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : generateId(),
    title,
    company,
    deadline: isDeadline(raw.deadline) ? raw.deadline : null,
    roleId: typeof raw.roleId === 'string' ? raw.roleId : null,
    sentOn: isDeadline(raw.sentOn) ? raw.sentOn : null,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : now,
  };
}

export function loadApplications(): ApplicationsData {
  if (typeof window === 'undefined') return createDefaultApplications();
  try {
    const raw = window.localStorage.getItem(APPLICATIONS_KEY);
    if (!raw) return createDefaultApplications();
    const parsed = JSON.parse(raw) as Partial<ApplicationsData>;
    const list = Array.isArray(parsed.applications) ? parsed.applications : [];
    const applications = list
      .map(normalizeApplication)
      .filter((a): a is TrackedApplication => a !== null);
    const activeId =
      typeof parsed.activeId === 'string' && applications.some((a) => a.id === parsed.activeId)
        ? parsed.activeId
        : null;
    return { version: CURRENT_VERSION, applications, activeId };
  } catch {
    return createDefaultApplications();
  }
}

/** Persist. Returns false when the browser refused (storage full or blocked). */
export function saveApplications(data: ApplicationsData): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(data));
    return true;
  } catch {
    /* storage unavailable: the visit keeps working, nothing persists */
    return false;
  }
}

// ============================================================================
// Mutations. Each returns the next data object; callers persist it.
// ============================================================================

export function addApplication(
  data: ApplicationsData,
  fields: { title: string; company?: string; deadline?: string | null; roleId?: string | null }
): { data: ApplicationsData; application: TrackedApplication } {
  const now = Date.now();
  const application: TrackedApplication = {
    id: generateId(),
    title: fields.title.trim(),
    company: (fields.company ?? '').trim(),
    deadline: isDeadline(fields.deadline) ? fields.deadline : null,
    roleId: fields.roleId ?? null,
    sentOn: null,
    createdAt: now,
    updatedAt: now,
  };
  const applications = [...data.applications, application];
  return {
    data: { ...data, applications, activeId: data.activeId ?? application.id },
    application,
  };
}

export function updateApplication(
  data: ApplicationsData,
  id: string,
  updates: Partial<Pick<TrackedApplication, 'title' | 'company' | 'deadline' | 'roleId'>>
): ApplicationsData {
  return {
    ...data,
    applications: data.applications.map((a) =>
      a.id === id
        ? {
            ...a,
            ...updates,
            deadline:
              'deadline' in updates
                ? isDeadline(updates.deadline)
                  ? updates.deadline
                  : null
                : a.deadline,
            updatedAt: Date.now(),
          }
        : a
    ),
  };
}

/**
 * Removing an application never touches the Glow Up role it pointed at. This
 * is the pure list change; `deleteApplication` in application-desk.ts also
 * drops the application's desk and persists both.
 */
export function removeApplication(data: ApplicationsData, id: string): ApplicationsData {
  return {
    ...data,
    applications: data.applications.filter((a) => a.id !== id),
    activeId: data.activeId === id ? null : data.activeId,
  };
}

export function setActiveApplication(data: ApplicationsData, id: string | null): ApplicationsData {
  if (id !== null && !data.applications.some((a) => a.id === id)) return data;
  if (data.activeId === id) return data;
  return { ...data, activeId: id };
}

/**
 * The one application in focus, read the same way by the desk, the
 * dashboard, Pay and the bridge: the one the visitor made active, or, when
 * only one is tracked, that one. Null when there are several and none was
 * chosen. Reading never writes.
 */
export function activeApplicationId(data: ApplicationsData): string | null {
  if (data.activeId && data.applications.some((a) => a.id === data.activeId)) {
    return data.activeId;
  }
  return data.applications.length === 1 ? data.applications[0].id : null;
}

/** Mark an application sent on a date ('YYYY-MM-DD'), or not sent with null. */
export function markSent(
  data: ApplicationsData,
  id: string,
  sentOn: string | null
): ApplicationsData {
  const date = isDeadline(sentOn) ? sentOn : null;
  if (!data.applications.some((a) => a.id === id && (a.sentOn ?? null) !== date)) return data;
  return {
    ...data,
    applications: data.applications.map((a) =>
      a.id === id ? { ...a, sentOn: date, updatedAt: Date.now() } : a
    ),
  };
}

export type ApplicationStatus = 'not-started' | 'in-progress' | 'sent';

/**
 * Where an application stands. "Sent" is what the visitor said; the other two
 * are derived from whether any work for it is saved.
 */
export function applicationStatus(
  app: Pick<TrackedApplication, 'sentOn'>,
  hasWork: boolean
): ApplicationStatus {
  if (app.sentOn) return 'sent';
  return hasWork ? 'in-progress' : 'not-started';
}

// ============================================================================
// Dates
// ============================================================================

/**
 * A day as 'YYYY-MM-DD' on this device's calendar, not in UTC: an export at
 * 23:30 in the evening is named for that evening, not for tomorrow.
 */
export function localDate(when: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}`;
}

/** 'YYYY-MM-DD' as it reads in a sentence: "Nov 15", with the year when it is not this one. */
export function shortDate(iso: string, now: Date = new Date()): string {
  const date = parseDeadline(iso);
  if (!date) return iso;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
}

/**
 * Whole days from today until the deadline, negative once it has passed.
 * 'YYYY-MM-DD' is parsed as a local calendar date, not UTC: a bare ISO date
 * would otherwise land on the previous evening in the Americas.
 */
export function daysUntilDeadline(deadline: string | null, now: Date = new Date()): number | null {
  const target = parseDeadline(deadline);
  if (!target) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/** How the deadline reads next to an application: "in 4 days", "Due today", "3 days past". */
export function deadlineLabel(days: number): string {
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days > 1) return `in ${days} days`;
  if (days === -1) return '1 day past';
  return `${-days} days past`;
}

// ============================================================================
// Ordering
// ============================================================================

/**
 * The focused application first, then by soonest deadline (none last), then
 * most recently touched. The dashboard and the bridge share this ordering.
 */
export function sortApplications<
  T extends { id: string; daysUntil: number | null; updatedAt: number },
>(applications: T[], activeId: string | null): T[] {
  return [...applications].sort((a, b) => {
    if (a.id === activeId) return -1;
    if (b.id === activeId) return 1;
    if (a.daysUntil === null && b.daysUntil === null) return b.updatedAt - a.updatedAt;
    if (a.daysUntil === null) return 1;
    if (b.daysUntil === null) return -1;
    return a.daysUntil - b.daysUntil;
  });
}
