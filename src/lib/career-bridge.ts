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
  HISTORY_KEY as WHY_HISTORY_KEY,
  SESSION_KEY as WHY_SESSION_KEY,
  type WhySnapshot,
} from '../components/career-5whys/shared';
import { averageRating, computeNextStep, type Ratings } from './networking-advice';
import { type CareerProfile, readProfile } from './profile';

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
  bullets: ResumeBulletRecord[];
  lastAnalyzedAt: string | null;
  signalReport?: {
    visible?: number;
    hardSkills?: string[];
  };
}

function readResumeGame(): ResumeGameData | null {
  const data = readJson<ResumeGameData>(RESUME_SESSION_KEY);
  if (!data || !Array.isArray(data.bullets)) return null;
  return data;
}

// ============================================================================
// Career 5 Whys — src/components/career-5whys/shared.ts
// ============================================================================

interface WhySession {
  track: Track;
  topic: string;
  responses: string[];
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
  roles?: Array<{ id: string; jobTitle?: string; company?: string; updatedAt?: number }>;
  stories?: Array<{ updatedAt?: number }>;
  packets?: Array<{ updatedAt?: number }>;
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

function readGlowUp(): GlowUpSummary | null {
  const data = readJson<GlowUpRaw>(GLOWUP_KEY);
  if (!data) return null;
  const roles = data.roles ?? [];
  const stories = data.stories ?? [];
  const packets = data.packets ?? [];
  const currentRole = roles.find((r) => r.id === data.currentRoleId);
  // The store keeps updatedAt per record, not at the top level.
  const stamps = [...roles, ...stories, ...packets]
    .map((r) => r.updatedAt)
    .filter((t): t is number => typeof t === 'number');
  return {
    roleCount: roles.length,
    storyCount: stories.length,
    packetCount: packets.length,
    currentRoleTitle: currentRole?.jobTitle || null,
    currentCompany: currentRole?.company || null,
    lastUpdated: stamps.length ? Math.max(...stamps) : null,
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
    versionCount: Array.isArray(versions) ? versions.length : 0,
    sessionCount: list.length,
    latestSessionDate: latest?.createdAt ?? null,
    latestScenario: latest?.scenarioTitle ?? null,
    averageRating: average,
    nextStep: latestRatings ? computeNextStep(latestRatings) : null,
    draftedButUnpracticed: list.length === 0 && !!draft?.text?.trim(),
  };
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
    lastAnalyzedAt: string | null;
    bulletCount: number;
    /** Mean of each bullet's latest score. */
    averageScore: number;
    hardSkills: string[];
  } | null;
  reflection: {
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
  recentActivity: Array<{ tool: ToolName; action: string; date: string | null; url: string }>;
  recommendations: Recommendation[];
  nextActions: NextAction[];
}

export function readCareerDashboard(): CareerDashboardData {
  const profile = readProfile();
  const resume = readResumeGame();
  const why = readCareer5Whys();
  const glowup = readGlowUp();
  const networking = readNetworking();

  // A five whys session auto-saves without the user pressing anything, so a
  // finished chain counts as data even when no snapshot was taken.
  const sessionSynthesis = why.session
    ? computeSynthesis(why.session.responses, why.session.topic, why.session.track)
    : null;
  const latestSnapshot = why.snapshots[0] ?? null;

  const hasData = !!(
    resume?.bullets.length ||
    why.snapshots.length ||
    sessionSynthesis?.isComplete ||
    glowup?.storyCount ||
    networking?.sessionCount
  );

  const avgScore = resume?.bullets.length
    ? Math.round(
        resume.bullets.reduce((s, b) => s + (b.improvedScore ?? 0), 0) / resume.bullets.length
      )
    : 0;

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
  const reflectionNextStep = latestSnapshot?.nextStep || sessionSynthesis?.nextStep || null;
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

  // Point at the real lowest-scoring bullet, quoting what the student wrote.
  if (resume?.bullets.length) {
    const weakest = [...resume.bullets].sort(
      (a, b) => (a.improvedScore ?? 0) - (b.improvedScore ?? 0)
    )[0];
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
  const hardSkills = resume?.signalReport?.hardSkills ?? [];
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
  if (sessionSynthesis?.isComplete && !latestSnapshot) {
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
  if (!resume?.bullets.length) {
    recommendations.push({
      tool: 'Resume Game',
      text: 'No resume scored yet.',
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
          lastAnalyzedAt: resume.lastAnalyzedAt ?? null,
          bulletCount: resume.bullets.length,
          averageScore: avgScore,
          hardSkills,
        }
      : null,
    reflection:
      why.session || latestSnapshot
        ? {
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
            unsavedComplete: !!sessionSynthesis?.isComplete && !latestSnapshot,
          }
        : null,
    glowup,
    networking,
    recentActivity: recentActivity.slice(0, 5),
    recommendations: recommendations.slice(0, 4),
    nextActions,
  };
}
