import * as React from 'react';
import { type CareerDashboardData, readCareerDashboard } from '../lib/career-bridge';
import { FOCUS_LABELS, STAGE_LABELS } from '../lib/profile';
import { STRONG_SCORE } from '../lib/resume-game/thresholds';
import { cn } from '../lib/utils';
import ApplicationsPanel, { NewApplicationForm } from './ApplicationsPanel';
import BackupControls from './BackupControls';
import StoragePanel from './StoragePanel';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

const TOOL_LINKS = [
  {
    name: 'Career 5 Whys',
    url: '/career/',
    desc: 'Clarify your core motivation',
    color: 'text-foam',
    bg: 'bg-foam/12',
    icon: 'M7 8h10M7 12h4',
  },
  {
    name: 'Resume Game',
    url: '/resume-game/',
    desc: 'Score and rewrite bullets',
    color: 'text-love',
    bg: 'bg-love/12',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  {
    name: 'Interview Glow Up',
    url: '/interview-glow-up/',
    desc: 'Build proof-based stories',
    color: 'text-iris',
    bg: 'bg-iris/12',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
  },
  {
    name: 'Networking Practice',
    url: '/networking-practice/',
    desc: 'Rehearse your pitch',
    color: 'text-gold',
    bg: 'bg-gold/12',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  },
];

function formatDate(iso: string | null): string {
  if (!iso) return 'Not started';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** "today", "3 days ago", or "on Nov 12": a date that reads inside a sentence. */
function scoredWhen(iso: string): string {
  const when = formatDate(iso);
  return /^[A-Z][a-z]{2} \d/.test(when) ? `on ${when}` : when.toLowerCase();
}

/**
 * One line naming what the visitor has actually saved, in the order they
 * would have made it. Counts belong in a sentence.
 */
function ledgerSentence(data: CareerDashboardData): string {
  const parts: string[] = [];
  if (data.reflection?.snapshotCount) {
    const n = data.reflection.snapshotCount;
    const topic = data.reflection.latestTopic ? ` on ${data.reflection.latestTopic}` : '';
    parts.push(`${n === 1 ? 'one reflection' : `${n} reflections`}${topic}`);
  }
  if (data.reflection?.hasDraft) {
    parts.push(`a reflection in progress on ${data.reflection.draftTopic || 'career direction'}`);
  }
  if (data.resume?.bulletCount) {
    const n = data.resume.bulletCount;
    parts.push(`${n === 1 ? 'one scored resume line' : `${n} scored resume lines`}`);
  } else if (data.resume?.hasDraft) {
    parts.push('a resume draft awaiting review');
  }
  if (data.networking?.sessionCount) {
    const n = data.networking.sessionCount;
    const avg = data.networking.averageRating;
    parts.push(
      `${n === 1 ? 'one practice round' : `${n} practice rounds`}${avg ? ` averaging ${avg} of 5` : ''}`
    );
  }
  if (data.networking?.hasDraft) {
    parts.push('an introduction draft');
  } else if (!data.networking?.sessionCount && data.networking?.versionCount) {
    parts.push('saved introduction notes');
  }
  if (data.glowup?.storyCount) {
    const n = data.glowup.storyCount;
    parts.push(n === 1 ? 'one interview story' : `${n} interview stories`);
  }
  if (data.glowup?.roleCount) {
    const n = data.glowup.roleCount;
    parts.push(n === 1 ? 'one saved role' : `${n} saved roles`);
  }
  if (parts.length === 0) return 'You have saved work in progress.';
  if (parts.length === 1) return `You have ${parts[0]}.`;
  return `You have ${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}.`;
}

export default function CareerDashboard() {
  const [data, setData] = React.useState<CareerDashboardData | null>(null);

  React.useEffect(() => {
    setData(readCareerDashboard());
  }, []);

  if (!data) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <div className="space-y-2">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-overlay/40" />
          <div className="h-4 w-72 animate-pulse rounded-lg bg-overlay/30" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-overlay/30" />
          ))}
        </div>
      </div>
    );
  }

  if (!data.hasData) {
    return <EmptyState onRestored={() => setData(readCareerDashboard())} />;
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold tracking-tight">Career Dashboard</h2>
          <p className="text-muted-foreground">
            Your progress across all tools. Everything stays on your device.
          </p>
        </div>
        {data.profile && (
          <a
            href="/start/"
            className="inline-flex items-center gap-2 self-start rounded-full border border-border/40 bg-overlay/25 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-border/60 hover:text-foreground"
          >
            <span className="font-medium text-foreground">{STAGE_LABELS[data.profile.stage]}</span>
            <span aria-hidden="true">·</span>
            <span>{FOCUS_LABELS[data.profile.focus]}</span>
            <span className="text-foam">Change</span>
          </a>
        )}
      </div>

      {/* One quiet line when the whole loop is actually closed. */}
      {data.arcLine && <p className="text-sm text-foam">{data.arcLine}</p>}

      {/* Applications first: they are the deadlines the other work serves. */}
      <ApplicationsPanel
        applications={data.applications}
        readiness={{
          resumeScored: (data.resume?.bulletCount ?? 0) > 0,
          practiceRounds: data.networking?.sessionCount ?? 0,
          storyCount: data.glowup?.storyCount ?? 0,
        }}
        onChanged={() => setData(readCareerDashboard())}
      />

      {/* Next actions: the steps the tools themselves produced */}
      {data.nextActions.length > 0 && (
        <Card className="border-gold/40 bg-gold/8">
          <CardHeader>
            <p className="text-xs uppercase tracking-[0.3em] text-gold">Your next actions</p>
            <CardTitle className="text-lg">What the tools told you to do next</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {data.nextActions.map((action) => (
                <li key={`${action.tool}-${action.text}`}>
                  <a
                    href={action.href}
                    className="group flex flex-col gap-1 rounded-xl border border-border/30 bg-background/40 px-4 py-3 transition hover:border-gold/50 hover:bg-background/60"
                  >
                    <span className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
                      {action.tool}
                    </span>
                    <span className="text-sm leading-relaxed text-foreground">{action.text}</span>
                  </a>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Recommendations, each a link to the thing it names */}
      {data.recommendations.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.recommendations.map((rec) => (
            <a
              key={`${rec.tool}-${rec.href}`}
              href={rec.href}
              className="group flex flex-col justify-between gap-3 rounded-2xl border border-border/35 bg-overlay/20 p-4 transition hover:-translate-y-0.5 hover:border-border/60 hover:bg-overlay/35"
            >
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
                  {rec.tool}
                </p>
                <p className="text-sm leading-relaxed text-foreground">{rec.text}</p>
              </div>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-foam">
                {rec.cta}
                <svg
                  aria-hidden="true"
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </a>
          ))}
        </div>
      )}

      {/* Dated steps from each application's action plan, soonest first. */}
      {data.actionSteps.length > 0 && (
        <section aria-labelledby="dated-steps-title" className="space-y-3">
          <h2 id="dated-steps-title" className="text-xl font-semibold">
            Steps you gave a date
          </h2>
          <ul className="divide-y divide-border/30 rounded-xl border border-border/40">
            {data.actionSteps.slice(0, 6).map((step) => (
              <li key={`${step.applicationId}-${step.stepId}`}>
                <a
                  href={`/application/?id=${encodeURIComponent(step.applicationId)}&station=qualifications`}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm transition-colors hover:bg-overlay/30 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-foam"
                >
                  <span className="min-w-0 text-foreground">
                    {step.text}
                    <span className="ml-2 text-muted-foreground">
                      for {step.applicationTitle}
                      {step.company ? ` at ${step.company}` : ''}
                    </span>
                  </span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {step.daysUntil < 0
                      ? `${-step.daysUntil} ${step.daysUntil === -1 ? 'day' : 'days'} overdue`
                      : step.daysUntil === 0
                        ? 'today'
                        : step.daysUntil === 1
                          ? 'tomorrow'
                          : `in ${step.daysUntil} days`}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* What is on file. A sentence, not a wall of rings: the values here are
          counts, and a progress ring around a count reads as a proportion it
          does not have. The resume is described the same way, as a count of
          strong lines; each line's own score lives in the Resume Game. */}
      <section className="border-y border-border/40 py-6">
        <p className="eyebrow text-muted-foreground">On file</p>
        <p className="mt-3 max-w-3xl text-pretty text-lg leading-relaxed text-foreground">
          {ledgerSentence(data)}
        </p>
        {data.resume?.needsRescan && (
          <p className="mt-4 text-sm text-muted-foreground">
            Saved resume results need a fresh analysis before their scores can guide you.
          </p>
        )}
        {data.resume && data.resume.bulletCount > 0 && !data.resume.needsRescan && (
          <p className="mt-4 text-sm text-muted-foreground">
            {data.resume.strongCount} of {data.resume.bulletCount} resume{' '}
            {data.resume.bulletCount === 1 ? 'line is' : 'lines are'} strong, {STRONG_SCORE} or more
            {data.resume.lastAnalyzedAt ? `, scored ${scoredWhen(data.resume.lastAnalyzedAt)}` : ''}
            .
          </p>
        )}
      </section>

      {/* Skills */}
      {data.resume && data.resume.hardSkills.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Skills from your resume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.resume.hardSkills.map((skill) => (
                <span key={skill} className="rounded-full bg-foam/15 px-3 py-1 text-sm text-foam">
                  {skill}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Saved reflection */}
      {data.reflection?.whyStatement && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {data.reflection.snapshotCount > 0
                ? 'Your saved reflection'
                : 'Your current reflection'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.reflection.latestTopic && (
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                {data.reflection.latestTopic}
              </p>
            )}
            <blockquote className="border-l-2 border-foam/50 pl-4 text-sm leading-relaxed text-foreground">
              {data.reflection.whyStatement}
            </blockquote>
            {data.reflection.rootReason && (
              <p className="text-sm text-muted-foreground">
                Root reason, in your words:{' '}
                <span className="italic text-foreground">{data.reflection.rootReason}</span>
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {data.reflection.unsavedComplete
                ? `Current reflection on ${data.reflection.draftTopic || 'career direction'} is complete but not yet saved as a snapshot. `
                : 'From your last saved 5 Whys snapshot. '}
              <a href="/career/" className="font-medium text-foam hover:underline">
                {data.reflection.unsavedComplete ? 'Save it' : 'Revisit it'}
              </a>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Recent activity */}
      {data.recentActivity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recentActivity.map((activity) => (
              <a
                key={`${activity.tool}-${activity.action}-${activity.date}`}
                href={activity.url}
                className="flex items-center justify-between rounded-xl border border-border/30 bg-overlay/20 px-4 py-3 transition hover:border-border/50 hover:bg-overlay/30"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
                    {activity.tool}
                  </span>
                  <span className="text-sm text-foreground">{activity.action}</span>
                </div>
                <span className="text-xs text-muted-foreground">{formatDate(activity.date)}</span>
              </a>
            ))}
          </CardContent>
        </Card>
      )}

      <BackupControls onRestored={() => setData(readCareerDashboard())} />

      <StoragePanel />

      {/* Quick links */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TOOL_LINKS.map((tool) => (
          <a
            key={tool.name}
            href={tool.url}
            className={cn(
              'group flex flex-col gap-3 rounded-2xl border border-border/35 bg-overlay/25 p-5',
              'transition-all duration-300 hover:-translate-y-0.5 hover:border-border/60 hover:bg-overlay/40 hover:shadow-[0_20px_50px_-24px_hsl(var(--background)/0.8)]'
            )}
          >
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', tool.bg)}>
              <svg
                aria-hidden="true"
                className={cn('h-5 w-5', tool.color)}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={tool.icon} />
              </svg>
            </div>
            <div>
              <p className="font-medium text-foreground">{tool.name}</p>
              <p className="text-xs text-muted-foreground">{tool.desc}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ onRestored }: { onRestored: () => void }) {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 text-center">
      {/* Large themed icon */}
      <div className="flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-foam/12">
          <svg
            aria-hidden="true"
            className="h-8 w-8 text-foam"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
        </div>
      </div>
      <div className="space-y-3">
        <h2 className="text-3xl font-semibold tracking-tight">Nothing saved yet</h2>
        <p className="text-muted-foreground">
          This page summarizes work you save in the tools, and it all stays in this browser. Take
          the short career review to pick a starting point.
        </p>
      </div>

      <div className="rounded-2xl border border-border/40 bg-overlay/15 p-8">
        <a
          href="/start/"
          className="inline-flex items-center gap-2 rounded-xl bg-foam px-6 py-3 text-sm font-semibold text-background shadow-lg transition hover:bg-foam/90 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
        >
          Get started
          <svg
            aria-hidden="true"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>

      <div className="rounded-2xl border border-border/40 bg-overlay/15 p-6 text-left">
        <p className="eyebrow text-muted-foreground">Have a deadline already?</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Track the application here and the tools fill in the prep.
        </p>
        <NewApplicationForm idPrefix="empty-app" onCreated={onRestored} />
      </div>

      <BackupControls onRestored={onRestored} className="text-left" />

      <div className="grid gap-4 sm:grid-cols-2">
        {TOOL_LINKS.map((tool) => (
          <a
            key={tool.name}
            href={tool.url}
            className={cn(
              'flex items-start gap-3 rounded-2xl border border-border/35 bg-overlay/20 p-4 transition-all duration-200',
              'hover:-translate-y-0.5 hover:shadow-lg hover:border-border/55 hover:bg-overlay/35'
            )}
          >
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                tool.bg
              )}
            >
              <svg
                aria-hidden="true"
                className={cn('h-5 w-5', tool.color)}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={tool.icon} />
              </svg>
            </div>
            <div className="text-left">
              <p className="text-sm font-medium">{tool.name}</p>
              <p className="text-xs text-muted-foreground">{tool.desc}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
