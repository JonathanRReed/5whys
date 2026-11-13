/**
 * Career Bridge: unified read-only view across all 5 Whys tools.
 *
 * Reads each tool's localStorage namespace and exposes one dashboard-friendly
 * summary plus the concrete next actions the tools generated. Every key below
 * must match the key the owning tool actually writes; the source of truth is
 * named next to each one. If a tool renames its key, this file changes in the
 * same commit or the dashboard silently reads nothing.
 */

import {
  computeSynthesis,
  ensureResponsesLength,
  lensOf,
  normalizeSnapshot,
  readOutcome,
  type Track,
  validRootIndex,
  HISTORY_KEY as WHY_HISTORY_KEY,
  SESSION_KEY as WHY_SESSION_KEY,
  type WhyOutcome,
  type WhySnapshot,
} from '../components/career-5whys/shared';
import { isWritten, MORE_SCENARIOS } from '../components/networking/practice-model';
import scenarioData from '../data/networking-scenarios.json';
import {
  type ApplicationDeskData,
  createDefaultDeskData,
  type DatedActionStep,
  type DeskStationId,
  datedActionSteps,
  getDesk,
  type LetterDraft,
  loadApplicationDesks,
  type QualificationRow,
  stationsWithContent,
} from './application-desk';
import {
  type ApplicationsData,
  activeApplicationId,
  daysUntilDeadline,
  loadApplications,
  type SetAside,
  shortDate,
  sortApplications,
  type TrackedApplication,
} from './applications';
import { loadData as loadGlowUp } from './glowup-store';
import { averageRating, computeNextStep, type Ratings } from './networking-advice';
import { type PostingRequirement, requirementsFromBullets } from './posting';
import { type CareerProfile, readProfile } from './profile';
import { bulletRewrites } from './resume-doc/export';
import { scoreBullet } from './resume-game/scoring';
import { skillAsWritten } from './resume-game/skills';
import { STRONG_SCORE } from './resume-game/thresholds';

export type ToolName =
  | 'The Five Whys'
  | 'The Resume Game'
  | 'Networking Practice'
  | 'Interview Glow Up'
  | 'The Application Desk'
  | 'Pay';

export const TOOL_URLS: Record<ToolName, string> = {
  'The Five Whys': '/career/',
  'The Resume Game': '/resume-game/',
  'Networking Practice': '/networking-practice/',
  'Interview Glow Up': '/interview-glow-up/workspace/',
  'The Application Desk': '/application/',
  Pay: '/pay/',
};

function readJson<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

// Stored data can be hand-edited, imported from an older build, or written
// by a tool mid-change. Every reader below treats a wrong shape as empty and
// never throws: one malformed store must not take the dashboard down with it.
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** The objects in a stored list; anything that is not a list is an empty one. */
const records = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];

const textOr = <T>(value: unknown, fallback: T): string | T =>
  typeof value === 'string' ? value : fallback;

const numberOr = <T>(value: unknown, fallback: T): number | T =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/** Run a reader; if it fails anyway, use what an empty store would give. */
function safely<T>(read: () => T, empty: T): T {
  try {
    return read();
  } catch (error) {
    console.error('[career-bridge] A saved store could not be read:', error);
    return empty;
  }
}

const clip = (text: string, max: number): string => {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max).trimEnd()}...` : trimmed;
};

// ============================================================================
// Resume Game — src/lib/resume-game/session.ts
// ============================================================================

/** Read here; written only by the Resume Game. */
export const RESUME_SESSION_KEY = 'resume-game-session-v2';

interface ResumeBulletRecord {
  id: string;
  original: string;
  improved: string;
  baselineScore: number;
  improvedScore: number;
}

interface ResumeGameData {
  resumeText?: string;
  needsRescan?: boolean;
  bullets: ResumeBulletRecord[];
  lastAnalyzedAt: string | null;
  /** Older sessions also stored retired composite numbers here; they are not read. */
  signalReport?: {
    hardSkills?: string[];
  };
}

function readResumeGame(): ResumeGameData | null {
  const data = readJson<unknown>(RESUME_SESSION_KEY);
  if (isRecord(data) && Array.isArray(data.bullets)) {
    // A score is a pure function of the line, and the Resume Game works it
    // out again on load. Do the same here, so a session saved under an older
    // rubric shows the dashboard the numbers the tool itself would show.
    const signal = isRecord(data.signalReport) ? data.signalReport : null;
    return {
      resumeText: textOr(data.resumeText, undefined),
      needsRescan: typeof data.needsRescan === 'boolean' ? data.needsRescan : undefined,
      lastAnalyzedAt: textOr(data.lastAnalyzedAt, null),
      signalReport: signal
        ? {
            hardSkills: Array.isArray(signal.hardSkills)
              ? signal.hardSkills.filter((skill): skill is string => typeof skill === 'string')
              : undefined,
          }
        : undefined,
      bullets: records(data.bullets).map((bullet) => {
        const original = textOr(bullet.original, '');
        const improved = textOr(bullet.improved, '');
        const record = {
          ...bullet,
          id: textOr(bullet.id, ''),
          original,
          improved,
        } as unknown as ResumeBulletRecord;
        if (!original && !improved) return record;
        return {
          ...record,
          baselineScore: scoreBullet(original || improved),
          improvedScore: scoreBullet(improved || original),
        };
      }),
    };
  }
  if (typeof window === 'undefined') return null;
  try {
    // Match Resume Game's supported legacy fallback without migrating data.
    if (window.localStorage.getItem(RESUME_SESSION_KEY)) return null;
    const legacy = window.localStorage.getItem('resume-game-text');
    return legacy?.trim()
      ? { resumeText: legacy, needsRescan: true, bullets: [], lastAnalyzedAt: null }
      : null;
  } catch {
    return null;
  }
}

// ============================================================================
// Career 5 Whys — src/components/career-5whys/shared.ts
// ============================================================================

interface WhySession extends WhyOutcome {
  track: Track;
  topic: string;
  responses: string[];
  rootIndex?: number;
  /** Set when the chain started from an experience rather than a role or interest. */
  start?: 'experience';
}

function readCareer5Whys(): { session: WhySession | null; snapshots: WhySnapshot[] } {
  const sessionRaw = readJson<Partial<WhySession>>(WHY_SESSION_KEY);
  const historyRaw = readJson<unknown[]>(WHY_HISTORY_KEY);
  const session: WhySession | null =
    sessionRaw && isRecord(sessionRaw)
      ? {
          track: sessionRaw.track === 'interest' ? 'interest' : 'career',
          topic: typeof sessionRaw.topic === 'string' ? sessionRaw.topic : '',
          responses: ensureResponsesLength(sessionRaw.responses),
          // Which answer the visitor chose as the real reason, when they chose one.
          rootIndex: validRootIndex((sessionRaw as { rootIndex?: unknown }).rootIndex),
          ...((sessionRaw as { start?: unknown }).start === 'experience'
            ? { start: 'experience' as const }
            : {}),
          ...readOutcome(sessionRaw as Record<string, unknown>),
        }
      : null;
  const snapshots = Array.isArray(historyRaw)
    ? (historyRaw.map((entry) => normalizeSnapshot(entry)).filter(Boolean) as WhySnapshot[])
    : [];
  return { session, snapshots };
}

/**
 * The synthesis of the session as the Five Whys shows it: a chain started
 * from an experience is read with the experience questions and next steps,
 * not the interest ones it is stored under.
 */
function sessionSynthesisOf(session: WhySession) {
  return computeSynthesis(session.responses, session.topic, lensOf(session), session.rootIndex);
}

/** A finished reflection another tool can offer back to the visitor. */
export type ReflectionForReuse = {
  topic: string;
  /** The visitor's own statement, or their root reason when they wrote none. */
  statement: string;
  mustOffer: string;
  fromExperience: boolean;
};

function reuseOf(entry: WhySession): ReflectionForReuse | null {
  const synthesis = computeSynthesis(entry.responses, entry.topic, lensOf(entry), entry.rootIndex);
  if (!synthesis.isComplete) return null;
  const statement = entry.statement?.trim() || synthesis.root;
  if (!statement) return null;
  return {
    topic: entry.topic.trim(),
    statement,
    mustOffer: entry.mustOffer?.trim() ?? '',
    fromExperience: entry.start === 'experience',
  };
}

/**
 * The finished reflection to offer in another tool: the session on screen in
 * the Five Whys when it is complete, otherwise the newest saved snapshot that
 * is. Null when there is none. Read only.
 */
export function readReflectionForReuse(): ReflectionForReuse | null {
  try {
    const why = readCareer5Whys();
    for (const entry of [...(why.session ? [why.session] : []), ...why.snapshots]) {
      const found = reuseOf(entry);
      if (found) return found;
    }
    return null;
  } catch {
    return null;
  }
}

// ============================================================================
// Interview Glow Up — src/lib/glowup-store.ts
// ============================================================================

const GLOWUP_KEY = 'interview-glow-up-data';

interface GlowUpRaw {
  roles?: Array<{
    id: string;
    jobTitle?: string;
    company?: string;
    /** The posting as pasted. */
    rawJdText?: string;
    updatedAt?: number;
    bullets?: Array<{ status?: string }>;
  }>;
  stories?: Array<{ id?: string; updatedAt?: number }>;
  packets?: Array<{ roleId?: string; topStoryIds?: unknown[]; updatedAt?: number }>;
  /** Answers kept from the rehearsal room: written or spoken interview practice. */
  answers?: Array<{ roleId: string | null; updatedAt?: number }>;
  currentRoleId?: string | null;
}

export interface GlowUpSummary {
  roleCount: number;
  storyCount: number;
  packetCount: number;
  /** Rehearsal answers the visitor kept: interview practice, typed or spoken. */
  answerCount: number;
  currentRoleTitle: string | null;
  currentCompany: string | null;
  lastUpdated: number | null;
}

/** The Glow Up store reduced to the fields read here, each in the shape expected. */
function readGlowUpRaw(): GlowUpRaw | null {
  const data = readJson<unknown>(GLOWUP_KEY);
  if (!isRecord(data)) return null;
  return {
    roles: records(data.roles)
      .filter((role) => typeof role.id === 'string')
      .map((role) => ({
        id: role.id as string,
        jobTitle: textOr(role.jobTitle, undefined),
        company: textOr(role.company, undefined),
        rawJdText: textOr(role.rawJdText, undefined),
        updatedAt: numberOr(role.updatedAt, undefined),
        bullets: records(role.bullets).map((bullet) => ({
          status: textOr(bullet.status, undefined),
        })),
      })),
    stories: records(data.stories).map((story) => ({
      id: textOr(story.id, undefined),
      updatedAt: numberOr(story.updatedAt, undefined),
    })),
    packets: records(data.packets).map((packet) => ({
      roleId: textOr(packet.roleId, undefined),
      topStoryIds: Array.isArray(packet.topStoryIds) ? packet.topStoryIds : [],
      updatedAt: numberOr(packet.updatedAt, undefined),
    })),
    answers: records(data.answers)
      .filter((answer) => typeof answer.id === 'string' && textOr(answer.text, '').trim())
      .map((answer) => ({
        roleId: textOr(answer.roleId, null),
        updatedAt: numberOr(answer.updatedAt, undefined),
      })),
    currentRoleId: textOr(data.currentRoleId, null),
  };
}

function readGlowUp(data: GlowUpRaw | null): GlowUpSummary | null {
  if (!data) return null;
  const roles = data.roles ?? [];
  const stories = data.stories ?? [];
  const packets = data.packets ?? [];
  const answers = data.answers ?? [];
  const currentRole = roles.find((r) => r.id === data.currentRoleId);
  // Performance optimization: Find max timestamp in O(N) single-pass loops
  // to avoid intermediate array allocations and spread operator overhead.
  let maxUpdated: number | null = null;
  const updateMax = (updatedAt?: number) => {
    if (typeof updatedAt === 'number' && (maxUpdated === null || updatedAt > maxUpdated)) {
      maxUpdated = updatedAt;
    }
  };
  for (const r of roles) updateMax(r.updatedAt);
  for (const s of stories) updateMax(s.updatedAt);
  for (const p of packets) updateMax(p.updatedAt);
  for (const a of answers) updateMax(a.updatedAt);

  return {
    roleCount: roles.length,
    storyCount: stories.length,
    packetCount: packets.length,
    answerCount: answers.length,
    currentRoleTitle: currentRole?.jobTitle || null,
    currentCompany: currentRole?.company || null,
    lastUpdated: maxUpdated,
  };
}

// ============================================================================
// Networking Practice — src/utils/storage.ts, src/components/networking/useNetworkingPractice.ts
// ============================================================================

const NETWORKING_VERSIONS_KEY = 'networking-practice-versions';
const NETWORKING_SESSIONS_KEY = 'networking-practice-sessions';
const NETWORKING_DRAFT_KEY = 'networking-practice-draft';

interface NetworkingSessionRaw {
  createdAt?: string;
  ratings?: Partial<Ratings>;
  scenarioTitle?: string;
  scenarioId?: string;
  /** The words of the rep's first attempt, which the written advice reads. */
  script?: string;
}

/**
 * Scenarios read on a screen rather than heard (a message, an email), by id.
 * The tool's own scenario list decides it, so the advice here matches it.
 */
const WRITTEN_SCENARIO_IDS = new Set(
  [...(scenarioData as { id: string; mode: string }[]), ...MORE_SCENARIOS]
    .filter(isWritten)
    .map((scenario) => scenario.id)
);

export interface NetworkingSummary {
  hasDraft: boolean;
  versionCount: number;
  sessionCount: number;
  latestSessionDate: string | null;
  latestScenario: string | null;
  averageRating: number | null;
  /** The fix the tool suggested after the most recent round. */
  nextStep: string | null;
  /** An intro is drafted but no round has ever been saved. */
  draftedButUnpracticed: boolean;
}

function readNetworking(): NetworkingSummary | null {
  const versions = readJson<unknown[]>(NETWORKING_VERSIONS_KEY);
  const sessions = readJson<unknown>(NETWORKING_SESSIONS_KEY);
  const draft = readJson<unknown>(NETWORKING_DRAFT_KEY);
  if (!versions && !sessions && !draft) return null;

  const draftText = isRecord(draft) ? draft.text : undefined;
  const hasDraft = typeof draftText === 'string' && !!draftText.trim();
  const list: NetworkingSessionRaw[] = records(sessions).map((session) => ({
    createdAt: textOr(session.createdAt, undefined),
    scenarioTitle: textOr(session.scenarioTitle, undefined),
    scenarioId: textOr(session.scenarioId, undefined),
    script: textOr(records(session.attempts)[0]?.script, undefined),
    ratings: isRecord(session.ratings) ? (session.ratings as Partial<Ratings>) : undefined,
  }));
  // A rating counts only when all four parts of it are numbers.
  const complete = (r: Partial<Ratings> | undefined): r is Ratings =>
    !!r &&
    [r.confidence, r.clarity, r.rapport, r.authenticity].every(
      (value) => typeof value === 'number' && Number.isFinite(value)
    );
  const rated = list.map((s) => s.ratings).filter(complete);
  const average = rated.length
    ? Math.round((rated.reduce((sum, r) => sum + averageRating(r), 0) / rated.length) * 10) / 10
    : null;
  const latest = list[0];
  const latestRatings = latest && complete(latest.ratings) ? latest.ratings : null;

  return {
    hasDraft,
    versionCount: Array.isArray(versions) ? versions.length : 0,
    sessionCount: list.length,
    latestSessionDate: latest?.createdAt ?? null,
    latestScenario: latest?.scenarioTitle ?? null,
    averageRating: average,
    // The same step the tool shows for this rep, written advice included.
    nextStep: latestRatings
      ? computeNextStep(latestRatings, {
          written: WRITTEN_SCENARIO_IDS.has(latest?.scenarioId ?? ''),
          draft: latest?.script ?? '',
        })
      : null,
    draftedButUnpracticed: list.length === 0 && hasDraft,
  };
}

// ============================================================================
// Applications — src/lib/applications.ts
// ============================================================================

/**
 * What the dashboard needs per tracked application. Prep state is derived,
 * never stored on the record: role-scoped facts (decoded posting, packed
 * packet) come from the Glow Up store the application points at; resume and
 * practice readiness stay global, because a resume and an intro are the same
 * across applications.
 */
export interface ApplicationSummary {
  id: string;
  /** The linked role's title when it exists, else what was typed. */
  title: string;
  company: string;
  deadline: string | null;
  daysUntil: number | null;
  isActive: boolean;
  /** 'YYYY-MM-DD' the visitor marked it sent, or null. A sent application is never overdue. */
  sentOn?: string | null;
  roleId: string | null;
  /** The linked role exists and its posting was actually parsed. */
  decoded: boolean;
  /** Stories packed for the linked role's packet. */
  packetStories: number;
  /** Rehearsal answers kept for the linked role: interview practice for this job. */
  keptAnswers?: number;
  /** Which desk stations hold any of the student's work (career-application-desk). */
  stations: Record<DeskStationId, boolean>;
  /**
   * True when `roleId` was found by the role's title and company, not saved
   * on the application: an offer added in Pay for a posting already decoded.
   */
  roleMatched?: boolean;
  /** Set when the visitor said this is an offer they have in hand. */
  offer?: {
    /** 'YYYY-MM-DD' to answer by, or null when not set yet. */
    answerBy: string | null;
    daysToAnswer: number | null;
  } | null;
  /** Set when the visitor decided not to apply. The work is kept. */
  setAside?: SetAside | null;
  /** When the desk for this application last changed (ms), or null. */
  deskUpdatedAt?: number | null;
  /** When the Pay worksheet for this application last changed (ms), or null. */
  payEditedAt?: number | null;
  updatedAt: number;
}

/** A title or company as compared: case, spacing and punctuation do not count. */
const sameName = (a: string | undefined, b: string | undefined): boolean => {
  const clean = (value: string | undefined) =>
    (value ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  return clean(a) === clean(b);
};

type RawRole = NonNullable<GlowUpRaw['roles']>[number];

/**
 * The application in focus on the dashboard, for a tool that offers its role
 * and company back to the visitor (networking prompts). Only reads.
 */
export function readFocusedApplication(): { title: string; company: string } | null {
  try {
    const data = loadApplications();
    const id = activeApplicationId(data);
    const app = data.applications.find((item) => item.id === id);
    return app ? { title: app.title, company: app.company } : null;
  } catch {
    return null;
  }
}

/** The posting behind a role was actually parsed into requirements. */
const isDecoded = (role: RawRole | undefined): boolean =>
  !!role?.bullets?.some((b) => b.status !== 'ignored');

/**
 * The decoded role each application belongs to. A saved link wins. An
 * application with no link (one added in Pay, say) is matched to a decoded
 * role with the same title, and the same company when both name one, but
 * only when exactly one role fits and no other application already holds it.
 * Matching is read only: nothing is written.
 */
export function rolesForApplications(
  applications: TrackedApplication[],
  roles: RawRole[]
): Map<string, { roleId: string; matched: boolean }> {
  const out = new Map<string, { roleId: string; matched: boolean }>();
  const held = new Set<string>();
  for (const app of applications) {
    if (app.roleId && roles.some((r) => r.id === app.roleId)) {
      out.set(app.id, { roleId: app.roleId, matched: false });
      held.add(app.roleId);
    }
  }
  for (const app of applications) {
    if (out.has(app.id) || !app.title.trim()) continue;
    const fits = roles.filter(
      (role) =>
        !held.has(role.id) &&
        isDecoded(role) &&
        sameName(role.jobTitle, app.title) &&
        (!role.company?.trim() || !app.company.trim() || sameName(role.company, app.company))
    );
    if (fits.length === 1) {
      out.set(app.id, { roleId: fits[0].id, matched: true });
      held.add(fits[0].id);
    }
  }
  return out;
}

function summarizeApplications(
  data: ApplicationsData,
  glow: GlowUpRaw | null,
  desks: ApplicationDeskData
): ApplicationSummary[] {
  const roles = glow?.roles ?? [];
  const packets = glow?.packets ?? [];
  const storyIds = new Set(
    (glow?.stories ?? []).map((s) => s.id).filter((id): id is string => typeof id === 'string')
  );
  const activeId = activeApplicationId(data);
  const linked = rolesForApplications(data.applications, roles);
  const summaries = data.applications.map((app) => {
    const link = linked.get(app.id);
    const roleId = link?.roleId ?? null;
    const role = roleId ? roles.find((r) => r.id === roleId) : undefined;
    const decoded = isDecoded(role);
    const packet = roleId ? packets.find((p) => p.roleId === roleId) : undefined;
    const desk = desks.desks[app.id];
    const offer = getDesk(desks, app.id).offer;
    const packetStories = (packet?.topStoryIds ?? []).filter(
      (id): id is string => typeof id === 'string' && storyIds.has(id)
    ).length;
    const keptAnswers = roleId
      ? (glow?.answers ?? []).filter((answer) => answer.roleId === roleId).length
      : 0;
    return {
      id: app.id,
      title: role?.jobTitle?.trim() || app.title,
      company: role?.company?.trim() || app.company,
      deadline: app.deadline,
      daysUntil: daysUntilDeadline(app.deadline),
      isActive: app.id === activeId,
      sentOn: app.sentOn ?? null,
      roleId,
      decoded,
      packetStories,
      keptAnswers,
      stations: stationsWithContent(getDesk(desks, app.id)),
      roleMatched: link?.matched ?? false,
      offer: offer.received
        ? {
            answerBy: offer.answerBy ?? null,
            daysToAnswer: daysUntilDeadline(offer.answerBy ?? null),
          }
        : null,
      setAside: app.setAside ?? null,
      deskUpdatedAt: desk ? desk.updatedAt : null,
      payEditedAt: offer.editedAt ?? null,
      updatedAt: app.updatedAt,
    };
  });
  // An offer's answer-by date is as much a deadline as an application's.
  // Once an offer is in hand the application's own deadline is behind it:
  // the date that matters is the one the offer must be answered by.
  const soonest = (app: ApplicationSummary): number | null =>
    app.offer ? app.offer.daysToAnswer : app.daysUntil;
  return sortApplications(
    summaries.map((app) => ({
      app,
      id: app.id,
      daysUntil: soonest(app),
      updatedAt: app.updatedAt,
      sentOn: app.sentOn,
      setAside: app.setAside,
      offerReceived: app.offer !== null,
    })),
    activeId
  ).map((entry) => entry.app);
}

/**
 * The next desk station this application still needs, or null when every
 * station holds work. Shared by the application list and "where you left off".
 */
export function nextDeskStep(
  app: Pick<ApplicationSummary, 'decoded' | 'stations'>
): { station: string; text: string } | null {
  if (!app.decoded) return { station: 'posting', text: 'Paste the posting on the desk' };
  if (!app.stations.qualifications) {
    return { station: 'qualifications', text: 'Mark where you stand on each requirement' };
  }
  if (!app.stations.bullets) return { station: 'bullets', text: 'Write two bullets for this role' };
  if (!app.stations.letter) return { station: 'letter', text: 'Draft the letter' };
  if (!app.stations['before-you-send']) {
    return { station: 'send', text: 'Run the check before you send' };
  }
  return null;
}

/** "Operations Intern at Coastline Supply Co." */
export const applicationName = (app: Pick<ApplicationSummary, 'title' | 'company'>): string =>
  `${app.title}${app.company ? ` at ${app.company}` : ''}`;

/**
 * The posting text for one application: from its linked role, or a decoded
 * role matched by title and company. Read only. Null when there is none.
 */
export function readPostingFor(
  applicationId: string
): { roleId: string; title: string; company: string; text: string } | null {
  try {
    const data = loadApplications();
    const roles = readGlowUpRaw()?.roles ?? [];
    const link = rolesForApplications(data.applications, roles).get(applicationId);
    const role = link ? roles.find((r) => r.id === link.roleId) : undefined;
    if (!role?.rawJdText?.trim()) return null;
    return {
      roleId: role.id,
      title: role.jobTitle ?? '',
      company: role.company ?? '',
      text: role.rawJdText,
    };
  } catch {
    return null;
  }
}

/**
 * What "Before you send" checks for one application, as the desk holds it
 * now: the letter, the posting's requirements, and where the visitor stands
 * on each. The role is the one saved on the application, as on the desk.
 * Null when the application is not found. Read only.
 */
export function readSendInputs(applicationId: string): {
  title: string;
  company: string;
  letter: LetterDraft;
  requirements: PostingRequirement[];
  rows: QualificationRow[];
} | null {
  try {
    const app = loadApplications().applications.find((a) => a.id === applicationId);
    if (!app) return null;
    const role = app.roleId ? loadGlowUp().roles.find((r) => r.id === app.roleId) : undefined;
    const desk = getDesk(loadApplicationDesks(), app.id);
    return {
      title: app.title,
      company: app.company,
      letter: desk.letter,
      requirements: requirementsFromBullets(role?.bullets ?? []),
      rows: desk.qualifications,
    };
  } catch {
    return null;
  }
}

/**
 * The reason the visitor reached in the Five Whys, in their words, with the
 * topic it was about: from the latest saved snapshot, or a finished session.
 * Null when there is none. Read only.
 */
export function readReflectionReason(): { reason: string; topic: string } | null {
  try {
    const why = readCareer5Whys();
    const latest = why.snapshots[0];
    if (latest?.rootReason?.trim()) {
      return { reason: latest.rootReason.trim(), topic: latest.topic.trim() };
    }
    if (!why.session) return null;
    const synthesis = sessionSynthesisOf(why.session);
    return synthesis.isComplete && synthesis.root.trim()
      ? { reason: synthesis.root.trim(), topic: why.session.topic.trim() }
      : null;
  } catch {
    return null;
  }
}

// ============================================================================
// Application desk — src/lib/application-desk.ts (key: career-application-desk)
// ============================================================================

/** A dated action-plan step with the application it belongs to, for the dashboard. */
export interface DashboardActionStep extends DatedActionStep {
  /** The application's display title (the linked role's title when it exists). */
  applicationTitle: string;
  company: string;
}

/**
 * Open dated steps from every tracked application's action plan, soonest
 * first. Desks left behind by a removed application are never read.
 */
function readActionSteps(
  desks: ApplicationDeskData,
  applications: ApplicationSummary[]
): DashboardActionStep[] {
  const byId = new Map(applications.map((app) => [app.id, app]));
  return (
    datedActionSteps(desks, byId.keys())
      // A step whose date passed on an application already sent is not overdue
      // work: the application went.
      .filter((step) => !(byId.get(step.applicationId)?.sentOn && step.daysUntil < 0))
      .map((step) => {
        const app = byId.get(step.applicationId);
        return { ...step, applicationTitle: app?.title ?? '', company: app?.company ?? '' };
      })
  );
}

// ============================================================================
// Unified dashboard data
// ============================================================================

export interface Recommendation {
  tool: ToolName;
  text: string;
  /** Deep link into the tool, including the item it names where possible. */
  href: string;
  cta: string;
  /**
   * The decoded role the link is about. The interview tools open on the
   * current role, so following the link makes this one current first.
   */
  roleId?: string | null;
}

/** The work saved most recently, and the way back into it. */
export interface LeftOff {
  tool: ToolName;
  /** What it was, in a phrase: "The desk for Operations Intern at Coastline Supply Co." */
  what: string;
  /** The next step there, when the tool knows one. */
  next: string | null;
  href: string;
  /** The role to make current before following the link. */
  roleId?: string | null;
  /** ISO time it was saved. */
  date: string;
}

export interface NextAction {
  tool: ToolName;
  text: string;
  href: string;
}

export interface CareerDashboardData {
  hasData: boolean;
  profile: CareerProfile | null;
  resume: {
    hasDraft: boolean;
    needsRescan: boolean;
    lastAnalyzedAt: string | null;
    bulletCount: number;
    /** Lines whose latest score is at or above the Resume Game's strong label. */
    strongCount: number;
    hardSkills: string[];
  } | null;
  reflection: {
    hasDraft: boolean;
    draftTopic: string | null;
    latestTopic: string | null;
    latestTrack: Track | null;
    snapshotCount: number;
    whyStatement: string | null;
    rootReason: string | null;
    nextStep: string | null;
    /** True when the current session is complete but never saved as a snapshot. */
    unsavedComplete: boolean;
  } | null;
  glowup: GlowUpSummary | null;
  networking: NetworkingSummary | null;
  applications: ApplicationSummary[];
  /** Open dated action steps across applications, soonest first. */
  actionSteps: DashboardActionStep[];
  /**
   * One quiet line when the loop is actually closed: reflection saved, resume
   * scored, reps run, and a packet holding a live story. Names the in-focus
   * deadline when there is one. Null while any stage is still open.
   */
  arcLine: string | null;
  recentActivity: Array<{ tool: ToolName; action: string; date: string | null; url: string }>;
  /** The most recent saved work across the tools, or null when nothing has a date. */
  leftOff: LeftOff | null;
  recommendations: Recommendation[];
  nextActions: NextAction[];
}

export function readCareerDashboard(): CareerDashboardData {
  const profile = safely(readProfile, null);
  const resume = safely(readResumeGame, null);
  const why = safely(readCareer5Whys, { session: null, snapshots: [] });
  const glowRaw = safely(readGlowUpRaw, null);
  const glowup = safely(() => readGlowUp(glowRaw), null);
  const networking = safely(readNetworking, null);
  const desks = safely(loadApplicationDesks, createDefaultDeskData());
  const applications = safely(
    () => summarizeApplications(loadApplications(), glowRaw, desks),
    [] as ApplicationSummary[]
  );
  const actionSteps = safely(() => readActionSteps(desks, applications), []);

  // A five whys session auto-saves without the user pressing anything, so a
  // finished chain counts as data even when no snapshot was taken.
  const sessionSynthesis = why.session ? sessionSynthesisOf(why.session) : null;
  const latestSnapshot = why.snapshots[0] ?? null;
  const reflectionHasDraft = !!(
    why.session &&
    (why.session.topic.trim() || why.session.responses.some((response) => response.trim())) &&
    !why.snapshots.some(
      (snapshot) =>
        snapshot.track === why.session?.track &&
        snapshot.topic.trim() === why.session.topic.trim() &&
        snapshot.responses.every(
          (response, index) => response.trim() === why.session?.responses[index]?.trim()
        )
    )
  );

  // The whole loop, honestly: a reflection, a scored resume, at least one
  // practice rep, and a packet holding a story that still exists.
  const storyIds = new Set(
    (glowRaw?.stories ?? []).map((s) => s.id).filter((id): id is string => typeof id === 'string')
  );
  const hasPackedPacket = (glowRaw?.packets ?? []).some((p) =>
    (p.topStoryIds ?? []).some((id) => typeof id === 'string' && storyIds.has(id))
  );
  const arcComplete = !!(
    (why.snapshots.length || sessionSynthesis?.isComplete) &&
    resume?.bullets.length &&
    networking?.sessionCount &&
    hasPackedPacket
  );
  const focusedApp = applications.find((a) => a.isActive);
  const focusedDue = focusedApp?.sentOn
    ? ` You sent ${focusedApp.title} on ${shortDate(focusedApp.sentOn)}.`
    : focusedApp && focusedApp.daysUntil !== null
      ? focusedApp.daysUntil < 0
        ? ` ${focusedApp.title} is past its deadline.`
        : focusedApp.daysUntil === 0
          ? ` ${focusedApp.title} is due today.`
          : focusedApp.daysUntil === 1
            ? ` ${focusedApp.title} is due tomorrow.`
            : ` ${focusedApp.title} is due in ${focusedApp.daysUntil} days.`
      : '';
  const arcLine = arcComplete
    ? `You have done the whole loop: reflection, resume, reps, and a packed packet.${focusedDue}`
    : null;

  const hasData = !!(
    resume?.bullets.length ||
    resume?.resumeText?.trim() ||
    why.session?.topic.trim() ||
    why.session?.responses.some((response) => response.trim()) ||
    why.snapshots.length ||
    sessionSynthesis?.isComplete ||
    glowup?.storyCount ||
    glowup?.roleCount ||
    glowup?.answerCount ||
    networking?.sessionCount ||
    networking?.versionCount ||
    networking?.draftedButUnpracticed ||
    applications.length
  );

  // A count, not an average: the Resume Game has no resume-level score.
  const strongCount =
    resume?.bullets.filter(
      (b) => typeof b.improvedScore === 'number' && b.improvedScore >= STRONG_SCORE
    ).length ?? 0;

  // ---- Recent activity -----------------------------------------------------
  const recentActivity: CareerDashboardData['recentActivity'] = [];
  if (resume?.lastAnalyzedAt) {
    recentActivity.push({
      tool: 'The Resume Game',
      action: `Analyzed ${resume.bullets.length} bullets`,
      date: resume.lastAnalyzedAt,
      url: TOOL_URLS['The Resume Game'],
    });
  }
  if (latestSnapshot) {
    recentActivity.push({
      tool: 'The Five Whys',
      action: `Reflected on "${latestSnapshot.topic || 'Career direction'}"`,
      date: latestSnapshot.timestamp,
      url: TOOL_URLS['The Five Whys'],
    });
  }
  if (networking?.latestSessionDate) {
    recentActivity.push({
      tool: 'Networking Practice',
      action: networking.latestScenario
        ? `Practiced "${networking.latestScenario}"`
        : 'Completed a practice round',
      date: networking.latestSessionDate,
      url: TOOL_URLS['Networking Practice'],
    });
  }
  if (glowup?.lastUpdated) {
    recentActivity.push({
      tool: 'Interview Glow Up',
      // A posting decoded on the desk is saved here too, so with no stories
      // the honest name for the work is the decode.
      action: glowup.storyCount
        ? `Working on ${glowup.storyCount === 1 ? '1 story' : `${glowup.storyCount} stories`}`
        : glowup.answerCount
          ? `Kept ${glowup.answerCount === 1 ? '1 interview answer' : `${glowup.answerCount} interview answers`}`
          : glowup.roleCount
            ? `Decoded ${glowup.roleCount === 1 ? 'a posting' : `${glowup.roleCount} postings`}`
            : 'Started prep',
      date: new Date(glowup.lastUpdated).toISOString(),
      url: TOOL_URLS['Interview Glow Up'],
    });
  }
  recentActivity.sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  // ---- Next actions: the concrete steps the tools themselves produced ------
  const nextActions: NextAction[] = [];
  const reflectionNextStep =
    reflectionHasDraft && sessionSynthesis?.isComplete
      ? sessionSynthesis.nextStep
      : latestSnapshot?.nextStep || sessionSynthesis?.nextStep || null;
  if (reflectionNextStep) {
    nextActions.push({
      tool: 'The Five Whys',
      text: reflectionNextStep,
      href: TOOL_URLS['The Five Whys'],
    });
  }
  if (networking?.nextStep) {
    nextActions.push({
      tool: 'Networking Practice',
      text: networking.nextStep,
      href: TOOL_URLS['Networking Practice'],
    });
  }

  // ---- Recommendations built from what was actually saved -----------------
  const recommendations: Recommendation[] = [];

  // Deadlines outrank everything else. Each tracked application (already
  // sorted: soonest date first, sent and set-aside last) surfaces its first
  // gap only, capped so a busy season cannot crowd out the tool pointers
  // below. Every link names the application it is about: the desk by its id,
  // the interview tools by making its role current first.
  for (const app of applications.filter((a) => !a.setAside).slice(0, 2)) {
    const name = `"${applicationName(app)}"`;
    const desk = (station: string) =>
      `${TOOL_URLS['The Application Desk']}?id=${encodeURIComponent(app.id)}&station=${station}`;
    if (app.offer) {
      const answer = app.offer.answerBy
        ? ` Answer by ${shortDate(app.offer.answerBy)}${dueIn(app.offer.daysToAnswer)}.`
        : ' Set the date you have to answer by.';
      recommendations.push({
        tool: 'Pay',
        text: `You have an offer for ${name}.${answer}`,
        href: `${TOOL_URLS.Pay}?id=${encodeURIComponent(app.id)}`,
        cta: 'Weigh it in Pay',
      });
      continue;
    }
    if (app.sentOn) {
      // Sent: no deadline to chase. The useful next thing is the interview,
      // and the questions are only about this job once its posting is decoded.
      recommendations.push(
        app.roleId
          ? {
              tool: 'Interview Glow Up',
              text: `${name} was sent on ${shortDate(app.sentOn)}. Practice for the interview while you wait.`,
              href: withRole('/interview-glow-up/rehearse/', app.roleId),
              cta: 'Rehearse the interview',
              roleId: app.roleId,
            }
          : {
              tool: 'The Application Desk',
              text: `${name} was sent on ${shortDate(app.sentOn)}. Paste its posting so the practice questions are about this job.`,
              href: desk('posting'),
              cta: 'Paste the posting',
            }
      );
      continue;
    }
    const when =
      app.daysUntil === null
        ? ''
        : app.daysUntil < 0
          ? ' The deadline has passed.'
          : app.daysUntil === 0
            ? ' It is due today.'
            : app.daysUntil === 1
              ? ' It is due tomorrow.'
              : ` It is due in ${app.daysUntil} days.`;
    if (!app.decoded) {
      recommendations.push({
        tool: 'The Application Desk',
        text: `${name} has no decoded posting.${when}`,
        href: desk('posting'),
        cta: 'Decode it',
      });
    } else if (app.packetStories === 0) {
      const hasStories = (glowup?.storyCount ?? 0) > 0;
      recommendations.push({
        tool: 'Interview Glow Up',
        text: hasStories
          ? `${name} has nothing packed for the call.${when}`
          : `${name} is decoded but no story backs it yet.${when}`,
        href: withRole(
          `${TOOL_URLS['Interview Glow Up']}?tab=${hasStories ? 'packet' : 'stories'}`,
          app.roleId
        ),
        cta: hasStories ? 'Pack the packet' : 'Build a story',
        roleId: app.roleId,
      });
    }
  }

  const hasResumeAnalysis = !!(
    resume?.lastAnalyzedAt ||
    resume?.bullets.length ||
    resume?.signalReport?.hardSkills?.length
  );
  const resumeNeedsRescan = hasResumeAnalysis && resume?.needsRescan !== false;
  if (resumeNeedsRescan) {
    recommendations.push({
      tool: 'The Resume Game',
      text: 'Your saved resume results need a refresh before using their feedback.',
      href: TOOL_URLS['The Resume Game'],
      cta: 'Review changed resume',
    });
  }

  // Only recommend edits using results known to match the current source.
  if (resume?.bullets.length && !resumeNeedsRescan) {
    // Saved data is not schema-validated here. Keep the original stable-sort
    // behavior for malformed scores, including numeric strings and NaN comparisons.
    const hasNumericScores = resume.bullets.every(
      (bullet) => bullet.improvedScore == null || Number.isFinite(bullet.improvedScore)
    );
    let weakest = resume.bullets[0];
    if (hasNumericScores) {
      // Linear scan preserves the first bullet on ties without copying the array.
      for (let i = 1; i < resume.bullets.length; i++) {
        if ((resume.bullets[i].improvedScore ?? 0) < (weakest.improvedScore ?? 0)) {
          weakest = resume.bullets[i];
        }
      }
    } else {
      weakest = [...resume.bullets].sort(
        (a, b) => (a.improvedScore ?? 0) - (b.improvedScore ?? 0)
      )[0];
    }
    const weakestScore = weakest?.improvedScore ?? 0;
    if (weakest && weakestScore < 60) {
      // Lead with what is already there. The low line is the next one to work
      // on, named by its words, never by its score.
      const excerpt = clip(weakest.original || '', 70);
      const total = resume.bullets.length;
      const strong = resume.bullets.filter(
        (b) => typeof b.improvedScore === 'number' && b.improvedScore >= STRONG_SCORE
      ).length;
      // The verb agrees with the strong lines: "1 of your 2 lines is".
      const lead =
        strong > 0
          ? `${strong} of your ${total} resume ${total === 1 ? 'line' : 'lines'} ${strong === 1 ? 'is' : 'are'} already strong.`
          : `You have ${total} resume ${total === 1 ? 'line' : 'lines'} to build on.`;
      recommendations.push({
        tool: 'The Resume Game',
        text: excerpt ? `${lead} A good next line to work on: "${excerpt}".` : lead,
        href: `${TOOL_URLS['The Resume Game']}?bullet=${encodeURIComponent(weakest.id)}`,
        cta: 'Work on this line',
      });
    }
  }

  // Name the detected skills and turn them into stories.
  const hardSkills = resumeNeedsRescan ? [] : (resume?.signalReport?.hardSkills ?? []);
  if (hardSkills.length && !glowup?.storyCount) {
    // As the resume writes them: "SQL" and "Excel", not "sql" and "excel".
    const named = hardSkills
      .slice(0, 3)
      .map((skill) => skillAsWritten(resume?.resumeText ?? '', skill))
      .join(', ');
    const extra = hardSkills.length > 3 ? ` and ${hardSkills.length - 3} more` : '';
    recommendations.push({
      tool: 'Interview Glow Up',
      text:
        hardSkills.length === 1
          ? `Your resume shows ${named}.`
          : `Your resume shows ${named}${extra}.`,
      href: `${TOOL_URLS['Interview Glow Up']}?tab=stories`,
      cta: 'Turn the strongest one into an interview story',
    });
  }

  // A finished chain that was never kept.
  if (sessionSynthesis?.isComplete && reflectionHasDraft) {
    recommendations.push({
      tool: 'The Five Whys',
      text: 'Your five-round reflection is complete but not saved as a snapshot.',
      href: TOOL_URLS['The Five Whys'],
      cta: 'Save it',
    });
  }

  // Stories exist but no packet assembled yet.
  if (glowup?.storyCount && !glowup.packetCount) {
    const role = glowup.currentRoleTitle ? ` for ${glowup.currentRoleTitle}` : '';
    recommendations.push({
      tool: 'Interview Glow Up',
      text: `You have ${glowup.storyCount === 1 ? '1 story' : `${glowup.storyCount} stories`}${role}.`,
      href: `${TOOL_URLS['Interview Glow Up']}?tab=packet`,
      cta: 'Assemble them into a packet',
    });
  }

  // Real practice numbers, or a drafted intro that has never been spoken. When
  // the last rep already produced a next step above, a second card about the
  // same rep would only repeat it.
  if (networking?.sessionCount && networking.averageRating !== null && !networking.nextStep) {
    recommendations.push({
      tool: 'Networking Practice',
      text: `You average ${networking.averageRating}/5 across ${networking.sessionCount === 1 ? '1 practice round' : `${networking.sessionCount} practice rounds`}.`,
      href: TOOL_URLS['Networking Practice'],
      cta: 'Run one more rep',
    });
  } else if (networking?.draftedButUnpracticed) {
    recommendations.push({
      tool: 'Networking Practice',
      text: 'You drafted an intro but never ran it against the timer.',
      href: TOOL_URLS['Networking Practice'],
      cta: 'Do one timed rep',
    });
  }

  // Quiet pointers for tools with nothing saved yet.
  if (!resume?.bullets.length && !resumeNeedsRescan) {
    recommendations.push({
      tool: 'The Resume Game',
      text: resume?.resumeText?.trim()
        ? 'Your resume draft is ready to review.'
        : 'No resume scored yet.',
      href: TOOL_URLS['The Resume Game'],
      cta: 'Paste yours to see which bullets carry proof',
    });
  }
  if (!why.snapshots.length && !sessionSynthesis?.isComplete) {
    recommendations.push({
      tool: 'The Five Whys',
      text: 'No saved reflection yet.',
      href: TOOL_URLS['The Five Whys'],
      cta: 'Five rounds of "why" give the other tools a direction',
    });
  }

  return {
    hasData,
    profile,
    resume: resume
      ? {
          hasDraft: !!resume.resumeText?.trim(),
          needsRescan: resumeNeedsRescan,
          lastAnalyzedAt: resume.lastAnalyzedAt ?? null,
          bulletCount: resume.bullets.length,
          strongCount,
          hardSkills,
        }
      : null,
    reflection:
      why.session || latestSnapshot
        ? {
            hasDraft: reflectionHasDraft,
            draftTopic: reflectionHasDraft ? why.session?.topic || null : null,
            latestTopic: latestSnapshot?.topic || why.session?.topic || null,
            latestTrack: latestSnapshot?.track ?? why.session?.track ?? null,
            snapshotCount: why.snapshots.length,
            whyStatement:
              latestSnapshot?.whyStatement ||
              (sessionSynthesis?.isComplete ? sessionSynthesis.whyStatement : null),
            rootReason:
              latestSnapshot?.rootReason ||
              (sessionSynthesis?.isComplete ? sessionSynthesis.root : null),
            nextStep: reflectionNextStep,
            unsavedComplete: !!sessionSynthesis?.isComplete && reflectionHasDraft,
          }
        : null,
    glowup,
    networking,
    applications,
    actionSteps,
    arcLine,
    recentActivity: recentActivity.slice(0, 5),
    leftOff: safely(() => findLeftOff(applications, recentActivity, glowRaw), null),
    recommendations: recommendations.slice(0, 4),
    nextActions,
  };
}

/**
 * The master resume's text, for tools that compare it with a posting. Read
 * only: this never writes to the Resume Game's session.
 */
export function readResumeText(): string {
  if (typeof window === 'undefined') return '';
  try {
    const raw = window.localStorage.getItem(RESUME_SESSION_KEY);
    if (!raw) return '';
    const parsed = JSON.parse(raw) as { resumeText?: unknown };
    return typeof parsed.resumeText === 'string' ? parsed.resumeText : '';
  } catch {
    return '';
  }
}

/**
 * Resume lines the visitor rewrote in the Resume Game, as the original text,
 * its new wording, and which occurrence of that line it was (counted from 0
 * in resume order), so a line that appears twice is rewritten in the right
 * place. Counted the way the Resume Game's own export counts. Read only.
 */
export function readResumeRewrites(): { original: string; improved: string; occurrence: number }[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RESUME_SESSION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { bullets?: unknown };
    if (!Array.isArray(parsed.bullets)) return [];
    // Every line counts toward the occurrence, edited or not, so the count
    // matches the line's place on the resume.
    const bullets = parsed.bullets.map((bullet: unknown) => {
      const { original, improved, edited } = isRecord(bullet) ? bullet : {};
      return {
        original: typeof original === 'string' ? original : '',
        improved: typeof improved === 'string' ? improved : '',
        edited: edited === true,
      };
    });
    return bulletRewrites(bullets)
      .filter((rewrite) => rewrite.improved.trim() !== rewrite.original.trim())
      .map(({ original, improved, occurrence }) => ({
        original,
        improved,
        occurrence: occurrence ?? 0,
      }));
  } catch {
    return [];
  }
}

/**
 * A link into the interview tools that names the role it is about, so it
 * opens on that role even in a new tab: "/interview-glow-up/rehearse/?role=r1".
 */
export function withRole(href: string, roleId: string | null | undefined): string {
  if (!roleId) return href;
  const [path, hash] = href.split('#');
  const joiner = path.includes('?') ? '&' : '?';
  return `${path}${joiner}role=${encodeURIComponent(roleId)}${hash === undefined ? '' : `#${hash}`}`;
}

/** " (in 3 days)", " (today)", or "" when there is no date or it has passed. */
function dueIn(days: number | null): string {
  if (days === null || days < 0) return '';
  if (days === 0) return ', today';
  if (days === 1) return ', tomorrow';
  return `, in ${days} days`;
}

/**
 * The work saved most recently and the way back into it. An application's
 * desk and its Pay worksheet name the application and the next step there;
 * the other tools reuse their recent-activity line.
 */
function findLeftOff(
  applications: ApplicationSummary[],
  recentActivity: CareerDashboardData['recentActivity'],
  glow: GlowUpRaw | null
): LeftOff | null {
  const candidates: Array<LeftOff & { at: number }> = [];
  for (const app of applications) {
    if (app.setAside) continue;
    const name = applicationName(app);
    // Pay writes to the same store as the desk, so the desk's time moves too.
    // The worksheet was the last thing touched when the two times agree.
    const payAt = app.payEditedAt ?? null;
    const deskAt = app.deskUpdatedAt ?? null;
    if (payAt !== null && deskAt !== null && deskAt - payAt < 1000) {
      candidates.push({
        tool: 'Pay',
        what: `The pay for ${name}`,
        next: app.offer?.answerBy ? `Answer by ${shortDate(app.offer.answerBy)}.` : null,
        href: `${TOOL_URLS.Pay}?id=${encodeURIComponent(app.id)}`,
        date: new Date(payAt).toISOString(),
        at: payAt,
      });
    } else if (deskAt !== null) {
      const step = app.sentOn ? null : nextDeskStep(app);
      candidates.push({
        tool: 'The Application Desk',
        what: `The desk for ${name}`,
        next: step ? `${step.text}.` : null,
        href: `${TOOL_URLS['The Application Desk']}?id=${encodeURIComponent(app.id)}${step ? `&station=${step.station}` : ''}`,
        date: new Date(deskAt).toISOString(),
        at: deskAt,
      });
    }
  }
  for (const activity of recentActivity) {
    if (!activity.date) continue;
    const at = new Date(activity.date).getTime();
    if (!Number.isFinite(at)) continue;
    const role =
      activity.tool === 'Interview Glow Up'
        ? glow?.roles?.find((r) => r.id === glow.currentRoleId)
        : undefined;
    candidates.push({
      tool: activity.tool,
      what:
        activity.tool === 'Interview Glow Up' && role?.jobTitle
          ? `Interview prep for ${role.jobTitle}${role.company ? ` at ${role.company}` : ''}`
          : activity.action,
      next: null,
      href: withRole(activity.url, role?.id),
      roleId: role?.id ?? null,
      date: activity.date,
      at,
    });
  }
  if (candidates.length === 0) return null;
  const { at: _at, ...latest } = candidates.reduce((a, b) => (b.at > a.at ? b : a));
  return latest;
}
