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
  normalizeSnapshot,
  type Track,
  validRootIndex,
  HISTORY_KEY as WHY_HISTORY_KEY,
  SESSION_KEY as WHY_SESSION_KEY,
  type WhySnapshot,
} from '../components/career-5whys/shared';
import {
  type ApplicationDeskData,
  type DatedActionStep,
  type DeskStationId,
  datedActionSteps,
  getDesk,
  loadApplicationDesks,
  stationsWithContent,
} from './application-desk';
import {
  type ApplicationsData,
  daysUntilDeadline,
  loadApplications,
  sortApplications,
} from './applications';
import { averageRating, computeNextStep, type Ratings } from './networking-advice';
import { type CareerProfile, readProfile } from './profile';
import { STRONG_SCORE } from './resume-game/thresholds';

export type ToolName =
  | 'Career 5 Whys'
  | 'Resume Game'
  | 'Networking Practice'
  | 'Interview Glow Up';

export const TOOL_URLS: Record<ToolName, string> = {
  'Career 5 Whys': '/career/',
  'Resume Game': '/resume-game/',
  'Networking Practice': '/networking-practice/',
  'Interview Glow Up': '/interview-glow-up/workspace/',
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

const clip = (text: string, max: number): string => {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max).trimEnd()}...` : trimmed;
};

// ============================================================================
// Resume Game — src/lib/resume-game/session.ts
// ============================================================================

const RESUME_SESSION_KEY = 'resume-game-session-v2';

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
  const data = readJson<ResumeGameData>(RESUME_SESSION_KEY);
  if (data && Array.isArray(data.bullets)) return data;
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

interface WhySession {
  track: Track;
  topic: string;
  responses: string[];
  rootIndex?: number;
}

function readCareer5Whys(): { session: WhySession | null; snapshots: WhySnapshot[] } {
  const sessionRaw = readJson<Partial<WhySession>>(WHY_SESSION_KEY);
  const historyRaw = readJson<unknown[]>(WHY_HISTORY_KEY);
  const session: WhySession | null =
    sessionRaw && typeof sessionRaw === 'object'
      ? {
          track: sessionRaw.track === 'interest' ? 'interest' : 'career',
          topic: typeof sessionRaw.topic === 'string' ? sessionRaw.topic : '',
          responses: ensureResponsesLength(sessionRaw.responses),
          // Which answer the visitor chose as the real reason, when they chose one.
          rootIndex: validRootIndex((sessionRaw as { rootIndex?: unknown }).rootIndex),
        }
      : null;
  const snapshots = Array.isArray(historyRaw)
    ? (historyRaw.map((entry) => normalizeSnapshot(entry)).filter(Boolean) as WhySnapshot[])
    : [];
  return { session, snapshots };
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
    updatedAt?: number;
    bullets?: Array<{ status?: string }>;
  }>;
  stories?: Array<{ id?: string; updatedAt?: number }>;
  packets?: Array<{ roleId?: string; topStoryIds?: unknown[]; updatedAt?: number }>;
  currentRoleId?: string | null;
}

export interface GlowUpSummary {
  roleCount: number;
  storyCount: number;
  packetCount: number;
  currentRoleTitle: string | null;
  currentCompany: string | null;
  lastUpdated: number | null;
}

function readGlowUpRaw(): GlowUpRaw | null {
  return readJson<GlowUpRaw>(GLOWUP_KEY);
}

function readGlowUp(data: GlowUpRaw | null): GlowUpSummary | null {
  if (!data) return null;
  const roles = data.roles ?? [];
  const stories = data.stories ?? [];
  const packets = data.packets ?? [];
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

  return {
    roleCount: roles.length,
    storyCount: stories.length,
    packetCount: packets.length,
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
}

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
  const sessions = readJson<NetworkingSessionRaw[]>(NETWORKING_SESSIONS_KEY);
  const draft = readJson<{ text?: string }>(NETWORKING_DRAFT_KEY);
  if (!versions && !sessions && !draft) return null;

  const hasDraft = typeof draft?.text === 'string' && !!draft.text.trim();
  const list = Array.isArray(sessions) ? sessions : [];
  const rated = list
    .map((s) => s.ratings)
    .filter((r): r is Ratings => !!r && typeof r.confidence === 'number');
  const average = rated.length
    ? Math.round((rated.reduce((sum, r) => sum + averageRating(r), 0) / rated.length) * 10) / 10
    : null;
  const latest = list[0];
  const latestRatings =
    latest?.ratings && typeof latest.ratings.confidence === 'number'
      ? (latest.ratings as Ratings)
      : null;

  return {
    hasDraft,
    versionCount: Array.isArray(versions) ? versions.length : 0,
    sessionCount: list.length,
    latestSessionDate: latest?.createdAt ?? null,
    latestScenario: latest?.scenarioTitle ?? null,
    averageRating: average,
    nextStep: latestRatings ? computeNextStep(latestRatings) : null,
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
  roleId: string | null;
  /** The linked role exists and its posting was actually parsed. */
  decoded: boolean;
  /** Stories packed for the linked role's packet. */
  packetStories: number;
  /** Which desk stations hold any of the student's work (career-application-desk). */
  stations: Record<DeskStationId, boolean>;
  updatedAt: number;
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
  const summaries = data.applications.map((app) => {
    const role = app.roleId ? roles.find((r) => r.id === app.roleId) : undefined;
    const decoded = !!role?.bullets?.some((b) => b.status !== 'ignored');
    const packet = app.roleId ? packets.find((p) => p.roleId === app.roleId) : undefined;
    const packetStories = (packet?.topStoryIds ?? []).filter(
      (id): id is string => typeof id === 'string' && storyIds.has(id)
    ).length;
    return {
      id: app.id,
      title: role?.jobTitle?.trim() || app.title,
      company: role?.company?.trim() || app.company,
      deadline: app.deadline,
      daysUntil: daysUntilDeadline(app.deadline),
      isActive: app.id === data.activeId,
      roleId: app.roleId,
      decoded,
      packetStories,
      stations: stationsWithContent(getDesk(desks, app.id)),
      updatedAt: app.updatedAt,
    };
  });
  return sortApplications(summaries, data.activeId);
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
  return datedActionSteps(desks, byId.keys()).map((step) => {
    const app = byId.get(step.applicationId);
    return { ...step, applicationTitle: app?.title ?? '', company: app?.company ?? '' };
  });
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
  recommendations: Recommendation[];
  nextActions: NextAction[];
}

export function readCareerDashboard(): CareerDashboardData {
  const profile = readProfile();
  const resume = readResumeGame();
  const why = readCareer5Whys();
  const glowRaw = readGlowUpRaw();
  const glowup = readGlowUp(glowRaw);
  const networking = readNetworking();
  const desks = loadApplicationDesks();
  const applications = summarizeApplications(loadApplications(), glowRaw, desks);
  const actionSteps = readActionSteps(desks, applications);

  // A five whys session auto-saves without the user pressing anything, so a
  // finished chain counts as data even when no snapshot was taken.
  const sessionSynthesis = why.session
    ? computeSynthesis(
        why.session.responses,
        why.session.topic,
        why.session.track,
        why.session.rootIndex
      )
    : null;
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
  const focusedDue =
    focusedApp && focusedApp.daysUntil !== null
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
      tool: 'Resume Game',
      action: `Analyzed ${resume.bullets.length} bullets`,
      date: resume.lastAnalyzedAt,
      url: TOOL_URLS['Resume Game'],
    });
  }
  if (latestSnapshot) {
    recentActivity.push({
      tool: 'Career 5 Whys',
      action: `Reflected on "${latestSnapshot.topic || 'Career direction'}"`,
      date: latestSnapshot.timestamp,
      url: TOOL_URLS['Career 5 Whys'],
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
      action: glowup.storyCount
        ? `Working on ${glowup.storyCount === 1 ? '1 story' : `${glowup.storyCount} stories`}`
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
      tool: 'Career 5 Whys',
      text: reflectionNextStep,
      href: TOOL_URLS['Career 5 Whys'],
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
  // sorted: focused first, then soonest) surfaces its first gap only, capped
  // so a busy season cannot crowd out the tool pointers below.
  for (const app of applications.slice(0, 2)) {
    const name = `"${app.title}${app.company ? ` at ${app.company}` : ''}"`;
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
        tool: 'Interview Glow Up',
        text: `${name} has no decoded posting.${when}`,
        href: `${TOOL_URLS['Interview Glow Up']}?tab=decode`,
        cta: 'Decode it',
      });
    } else if (app.packetStories === 0) {
      const hasStories = (glowup?.storyCount ?? 0) > 0;
      recommendations.push({
        tool: 'Interview Glow Up',
        text: hasStories
          ? `${name} has nothing packed for the call.${when}`
          : `${name} is decoded but no story backs it yet.${when}`,
        href: `${TOOL_URLS['Interview Glow Up']}?tab=${hasStories ? 'packet' : 'stories'}`,
        cta: hasStories ? 'Pack the packet' : 'Build a story',
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
      tool: 'Resume Game',
      text: 'Your saved resume results need a refresh before using their feedback.',
      href: TOOL_URLS['Resume Game'],
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
      const excerpt = clip(weakest.original || '', 70);
      recommendations.push({
        tool: 'Resume Game',
        text: excerpt
          ? `Your lowest bullet scores ${weakestScore}: "${excerpt}".`
          : `Your lowest bullet scores ${weakestScore}.`,
        href: `${TOOL_URLS['Resume Game']}?bullet=${encodeURIComponent(weakest.id)}`,
        cta: 'Rewrite it',
      });
    }
  }

  // Name the detected skills and turn them into stories.
  const hardSkills = resumeNeedsRescan ? [] : (resume?.signalReport?.hardSkills ?? []);
  if (hardSkills.length && !glowup?.storyCount) {
    const named = hardSkills.slice(0, 3).join(', ');
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
      tool: 'Career 5 Whys',
      text: 'Your five-round reflection is complete but not saved as a snapshot.',
      href: TOOL_URLS['Career 5 Whys'],
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

  // Real practice numbers, or a drafted intro that has never been spoken.
  if (networking?.sessionCount && networking.averageRating !== null) {
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
      cta: 'Do one two-minute rep',
    });
  }

  // Quiet pointers for tools with nothing saved yet.
  if (!resume?.bullets.length && !resumeNeedsRescan) {
    recommendations.push({
      tool: 'Resume Game',
      text: resume?.resumeText?.trim()
        ? 'Your resume draft is ready to review.'
        : 'No resume scored yet.',
      href: TOOL_URLS['Resume Game'],
      cta: 'Paste yours to see which bullets carry proof',
    });
  }
  if (!why.snapshots.length && !sessionSynthesis?.isComplete) {
    recommendations.push({
      tool: 'Career 5 Whys',
      text: 'No saved reflection yet.',
      href: TOOL_URLS['Career 5 Whys'],
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
 * Resume lines the visitor rewrote in the Resume Game, as the original text
 * and its new wording. Read only.
 */
export function readResumeRewrites(): { original: string; improved: string }[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RESUME_SESSION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { bullets?: unknown };
    if (!Array.isArray(parsed.bullets)) return [];
    return parsed.bullets.flatMap((bullet: unknown) => {
      if (!bullet || typeof bullet !== 'object') return [];
      const { original, improved, edited } = bullet as Record<string, unknown>;
      return edited === true &&
        typeof original === 'string' &&
        typeof improved === 'string' &&
        improved.trim() &&
        improved.trim() !== original.trim()
        ? [{ original, improved }]
        : [];
    });
  } catch {
    return [];
  }
}
