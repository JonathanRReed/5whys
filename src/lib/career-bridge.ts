/**
 * Career Bridge: unified data reader across all 5 Whys tools.
 * Reads from each tool's localStorage namespace and exposes a
 * single dashboard-friendly view of the user's career data.
 *
 * Every key below must match the key the owning tool actually writes.
 * The source of truth for each one is named in a comment next to it; if a
 * tool renames its key, this file has to change in the same commit or the
 * dashboard silently reads nothing.
 */

// ============================================================================
// Resume Game
// ============================================================================

// src/lib/resume-game/session.ts
const RESUME_SESSION_KEY = 'resume-game-session-v2';

interface ResumeGameData {
  resumeText: string;
  bullets: Array<{
    id: string;
    original: string;
    fields: { verb: string; task: string; impact: string; quantifier: string };
    baselineScore: number;
    improved: string;
    improvedScore: number;
  }>;
  selectedBulletId: string | null;
  lastAnalyzedAt: string | null;
  signalReport: {
    visible: number;
    hidden: number;
    numbers: number;
    verbs: number;
    wordCount?: number;
    bulletCount?: number;
    estimatedPages?: number;
    sections?: string[];
    hardSkills?: string[];
    softSkills?: string[];
    isOptimalLength?: boolean;
    lengthRecommendation?: string;
  };
}

function readResumeGame(): ResumeGameData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(RESUME_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ResumeGameData;
  } catch {
    return null;
  }
}

// ============================================================================
// Career 5 Whys
// ============================================================================

// src/components/career-5whys/shared.ts (HISTORY_KEY, SESSION_KEY)
const WHY_HISTORY_KEY = 'career-why-history';
const WHY_SESSION_KEY = 'career-why-session-v2';

interface WhySnapshot {
  id: string;
  topic: string;
  track: 'career' | 'interest';
  responses: string[];
  theme: string;
  alignment: string;
  timestamp: string;
}

interface WhySession {
  track: 'career' | 'interest';
  topic: string;
  responses: string[];
  theme: string;
  alignment: string;
}

function readCareer5Whys(): { session: WhySession | null; snapshots: WhySnapshot[] } {
  if (typeof window === 'undefined') return { session: null, snapshots: [] };
  try {
    const sessionRaw = window.localStorage.getItem(WHY_SESSION_KEY);
    const historyRaw = window.localStorage.getItem(WHY_HISTORY_KEY);
    return {
      session: sessionRaw ? JSON.parse(sessionRaw) : null,
      snapshots: historyRaw ? JSON.parse(historyRaw) : [],
    };
  } catch {
    return { session: null, snapshots: [] };
  }
}

// ============================================================================
// Interview Glow Up
// ============================================================================

// src/lib/glowup-store.ts (STORAGE_KEY)
const GLOWUP_KEY = 'interview-glow-up-data';

interface GlowUpSummary {
  roleCount: number;
  storyCount: number;
  packetCount: number;
  currentRoleTitle: string | null;
  currentCompany: string | null;
  lastUpdated: number | null;
}

function readGlowUp(): GlowUpSummary | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(GLOWUP_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const currentRole = data.roles?.find((r: { id: string }) => r.id === data.currentRoleId);
    return {
      roleCount: data.roles?.length ?? 0,
      storyCount: data.stories?.length ?? 0,
      packetCount: data.packets?.length ?? 0,
      currentRoleTitle: currentRole?.jobTitle ?? null,
      currentCompany: currentRole?.company ?? null,
      lastUpdated: data.updatedAt ?? null,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// Networking Practice
// ============================================================================

// src/utils/storage.ts (VERSION_KEY, SESSION_KEY)
const NETWORKING_VERSIONS_KEY = 'networking-practice-versions';
const NETWORKING_SESSIONS_KEY = 'networking-practice-sessions';

interface NetworkingSummary {
  versionCount: number;
  sessionCount: number;
  latestSessionDate: string | null;
  averageRating: number | null;
}

function readNetworking(): NetworkingSummary | null {
  if (typeof window === 'undefined') return null;
  try {
    const versionsRaw = window.localStorage.getItem(NETWORKING_VERSIONS_KEY);
    const sessionsRaw = window.localStorage.getItem(NETWORKING_SESSIONS_KEY);
    const versions = versionsRaw ? JSON.parse(versionsRaw) : [];
    const sessions = sessionsRaw ? JSON.parse(sessionsRaw) : [];

    let averageRating: number | null = null;
    if (sessions.length > 0) {
      const ratings = sessions
        .filter((s: { ratings?: Record<string, number> }) => s.ratings)
        .map((s: { ratings: Record<string, number> }) => {
          const vals = Object.values(s.ratings);
          return vals.reduce((a: number, b: number) => a + b, 0) / vals.length;
        });
      if (ratings.length > 0) {
        averageRating =
          Math.round((ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length) * 10) /
          10;
      }
    }

    return {
      versionCount: Array.isArray(versions) ? versions.length : 0,
      sessionCount: Array.isArray(sessions) ? sessions.length : 0,
      latestSessionDate: sessions[0]?.createdAt ?? null,
      averageRating,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// Unified Dashboard Data
// ============================================================================

export interface CareerDashboardData {
  hasData: boolean;
  resume: {
    lastAnalyzedAt: string | null;
    bulletCount: number;
    averageScore: number;
    signalStrength: number;
    hardSkills: string[];
    isAnalyzed: boolean;
  } | null;
  reflection: {
    latestTopic: string | null;
    latestTrack: string | null;
    snapshotCount: number;
    whyStatement: string | null;
    hasSession: boolean;
  } | null;
  glowup: GlowUpSummary | null;
  networking: NetworkingSummary | null;
  recentActivity: Array<{ tool: string; action: string; date: string | null; url: string }>;
  recommendations: string[];
}

export function readCareerDashboard(): CareerDashboardData {
  const resume = readResumeGame();
  const why = readCareer5Whys();
  const glowup = readGlowUp();
  const networking = readNetworking();

  // A five whys session auto-saves without the user pressing anything, so a
  // finished chain counts as data even when no snapshot was taken.
  const answeredWhyCount = why?.session?.responses?.filter(Boolean).length ?? 0;

  const hasData = !!(
    resume?.bullets?.length ||
    why?.snapshots?.length ||
    answeredWhyCount >= 4 ||
    glowup?.storyCount ||
    networking?.sessionCount
  );

  const avgScore = resume?.bullets?.length
    ? Math.round(resume.bullets.reduce((s, b) => s + b.improvedScore, 0) / resume.bullets.length)
    : 0;

  const recentActivity: CareerDashboardData['recentActivity'] = [];

  if (resume?.lastAnalyzedAt) {
    recentActivity.push({
      tool: 'Resume Game',
      action: `Analyzed ${resume.bullets?.length ?? 0} bullets`,
      date: resume.lastAnalyzedAt,
      url: '/resume-game/',
    });
  }

  if (why?.snapshots?.length) {
    const latest = why.snapshots[0];
    recentActivity.push({
      tool: 'Career 5 Whys',
      action: `Reflected on "${latest.topic || 'Career direction'}"`,
      date: latest.timestamp,
      url: '/career/',
    });
  }

  if (networking?.latestSessionDate) {
    recentActivity.push({
      tool: 'Networking Practice',
      action: `Completed a practice round`,
      date: networking.latestSessionDate,
      url: '/networking-practice/',
    });
  }

  if (glowup?.lastUpdated) {
    recentActivity.push({
      tool: 'Interview Glow Up',
      action: glowup.storyCount ? `Working on ${glowup.storyCount} stories` : 'Started prep',
      date: new Date(glowup.lastUpdated).toISOString(),
      url: '/5whys/interview-glow-up/',
    });
  }

  recentActivity.sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  // Recommendations built from what the user actually saved, most specific first.
  const recommendations: string[] = [];
  const clip = (text: string, max: number): string => {
    const trimmed = text.trim();
    return trimmed.length > max ? `${trimmed.slice(0, max).trimEnd()}...` : trimmed;
  };

  // Point at the real lowest-scoring bullet.
  if (resume?.bullets?.length) {
    const weakest = [...resume.bullets].sort(
      (a, b) => (a.improvedScore ?? 0) - (b.improvedScore ?? 0)
    )[0];
    const weakestScore = weakest?.improvedScore ?? 0;
    if (weakest && weakestScore < 60) {
      const excerpt = clip(weakest.improved || weakest.original || '', 70);
      recommendations.push(
        excerpt
          ? `Your lowest bullet scores ${weakestScore}: "${excerpt}". Rewrite it in the Resume Game.`
          : `Your lowest bullet scores ${weakestScore}. Rewrite it in the Resume Game.`
      );
    }
  }

  // Name the actual detected skills and turn them into stories.
  const hardSkills = resume?.signalReport?.hardSkills ?? [];
  if (hardSkills.length && !glowup?.storyCount) {
    const named = hardSkills.slice(0, 3).join(', ');
    const extra = hardSkills.length > 3 ? ` and ${hardSkills.length - 3} more` : '';
    recommendations.push(
      hardSkills.length === 1
        ? `Your resume shows ${named}. Turn it into an interview story in Interview Glow Up.`
        : `Your resume shows ${named}${extra}. Turn the strongest one into an interview story in Interview Glow Up.`
    );
  }

  // Quote the saved root cause and give it a next step.
  const rootCause =
    why?.snapshots?.[0]?.theme ||
    (why?.session && why.session.responses?.filter(Boolean).length >= 4
      ? why.session.responses[why.session.responses.length - 1]
      : null);
  if (rootCause) {
    recommendations.push(
      `Your last reflection landed on "${clip(rootCause, 80)}". Check that your strongest bullets and stories point the same way.`
    );
  }

  // Stories exist but no packet assembled yet.
  if (glowup?.storyCount && !glowup.packetCount) {
    const role = glowup.currentRoleTitle ? ` for ${glowup.currentRoleTitle}` : '';
    recommendations.push(
      `You have ${glowup.storyCount === 1 ? '1 story' : `${glowup.storyCount} stories`}${role}. Assemble them into a packet before your next interview.`
    );
  }

  // Real practice numbers, or a drafted intro that has never been spoken.
  if (networking?.sessionCount && networking.averageRating !== null) {
    recommendations.push(
      `You average ${networking.averageRating}/5 across ${networking.sessionCount === 1 ? '1 practice round' : `${networking.sessionCount} practice rounds`}. Run one more rep and try to beat it.`
    );
  } else if (!networking?.sessionCount && networking?.versionCount) {
    recommendations.push(
      'You drafted an intro in Networking Practice but never ran it against the timer. One two-minute rep will tell you if it works out loud.'
    );
  }

  // Quiet pointers for tools with nothing saved yet.
  if (!resume?.bullets?.length) {
    recommendations.push(
      'No resume in the Resume Game yet. Paste yours to see which bullets carry proof.'
    );
  }
  if (!why?.snapshots?.length && !why?.session) {
    recommendations.push(
      'No saved reflection yet. A five-round "why" session gives the other tools a direction.'
    );
  }

  return {
    hasData,
    resume: resume
      ? {
          lastAnalyzedAt: resume.lastAnalyzedAt,
          bulletCount: resume.bullets?.length ?? 0,
          averageScore: avgScore,
          signalStrength: resume.signalReport?.visible ?? 0,
          hardSkills: resume.signalReport?.hardSkills ?? [],
          isAnalyzed: !!resume.lastAnalyzedAt,
        }
      : null,
    reflection: why
      ? {
          latestTopic: why.session?.topic ?? (why.snapshots[0]?.topic || null),
          latestTrack: why.session?.track ?? (why.snapshots[0]?.track || null),
          snapshotCount: why.snapshots?.length ?? 0,
          whyStatement:
            why.session && why.session.responses?.filter(Boolean).length >= 4
              ? why.session.responses[why.session.responses.length - 1]
              : null,
          hasSession: !!why.session,
        }
      : null,
    glowup,
    networking,
    recentActivity: recentActivity.slice(0, 5),
    recommendations: recommendations.slice(0, 4),
  };
}
