import * as React from 'react';
import { type CareerDashboardData, readCareerDashboard } from '../lib/career-bridge';
import { FOCUS_LABELS, STAGE_LABELS } from '../lib/profile';
import { cn } from '../lib/utils';
import BackupControls from './BackupControls';
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

function ScoreRing({ value, label, color }: { value: number; label: string; color: string }) {
  // Scores are clamped at the source, but clamp here too so the arc never overflows.
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative flex h-20 w-20 items-center justify-center rounded-full border-4 border-border/30">
        <svg
          aria-hidden="true"
          className="absolute inset-0 h-full w-full -rotate-90"
          viewBox="0 0 100 100"
        >
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-border/30"
          />
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${clamped * 2.64} 264`}
            className={color}
          />
        </svg>
        <span className="relative text-xl font-bold">{clamped}</span>
      </div>
      <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
    </div>
  );
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

      {/* Score cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data.resume && (
          <Card className="border-love/30 bg-overlay/25">
            <CardContent className="p-5">
              <ScoreRing value={data.resume.averageScore} label="Resume" color="text-love" />
              <div className="mt-3 text-center text-xs text-muted-foreground">
                Average of {data.resume.bulletCount}{' '}
                {data.resume.bulletCount === 1 ? 'bullet score' : 'bullet scores'}
                {data.resume.lastAnalyzedAt ? ` · ${formatDate(data.resume.lastAnalyzedAt)}` : ''}
              </div>
            </CardContent>
          </Card>
        )}
        {data.reflection && data.reflection.snapshotCount > 0 && (
          <Card className="border-foam/30 bg-overlay/25">
            <CardContent className="p-5">
              <div className="flex flex-col items-center gap-1">
                <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-foam/30">
                  <span className="text-xl font-bold text-foam">
                    {data.reflection.snapshotCount}
                  </span>
                </div>
                <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Reflections
                </span>
              </div>
              <div className="mt-3 text-center text-xs text-muted-foreground">
                {data.reflection.latestTopic || 'Career direction'}
              </div>
            </CardContent>
          </Card>
        )}
        {data.glowup && data.glowup.storyCount > 0 && (
          <Card className="border-iris/30 bg-overlay/25">
            <CardContent className="p-5">
              <div className="flex flex-col items-center gap-1">
                <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-iris/30">
                  <span className="text-xl font-bold text-iris">{data.glowup.storyCount}</span>
                </div>
                <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Stories
                </span>
              </div>
              <div className="mt-3 text-center text-xs text-muted-foreground">
                {data.glowup.currentRoleTitle || 'Interview prep'}
              </div>
            </CardContent>
          </Card>
        )}
        {data.networking && data.networking.sessionCount > 0 && (
          <Card className="border-gold/30 bg-overlay/25">
            <CardContent className="p-5">
              <div className="flex flex-col items-center gap-1">
                <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-gold/30">
                  <span className="text-xl font-bold text-gold">
                    {data.networking.sessionCount}
                  </span>
                </div>
                <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Practice rounds
                </span>
              </div>
              {data.networking.averageRating && (
                <div className="mt-3 text-center text-xs text-muted-foreground">
                  Avg rating: {data.networking.averageRating}/5
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

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
            <CardTitle className="text-lg">Your saved reflection</CardTitle>
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
                ? 'This chain is finished but not saved as a snapshot yet. '
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
            {data.recentActivity.map((activity, i) => (
              <a
                key={i}
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
          This page summarizes work you save in the four tools, and it all stays in this browser.
          Take the short career review to pick a starting point.
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
