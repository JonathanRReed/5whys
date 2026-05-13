import * as React from 'react';
import { readCareerDashboard, type CareerDashboardData } from '../lib/career-bridge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { cn } from '../lib/utils';

const TOOL_LINKS = [
  {
    name: 'Career 5 Whys',
    url: '/career/',
    desc: 'Clarify your core motivation',
    color: 'text-[hsl(var(--foam))]',
    bg: 'bg-[hsl(var(--foam)/0.12)]',
    icon: 'M7 8h10M7 12h4',
  },
  {
    name: 'Resume Game',
    url: '/resume-game/',
    desc: 'Score and rewrite bullets',
    color: 'text-[hsl(var(--love))]',
    bg: 'bg-[hsl(var(--love)/0.12)]',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  {
    name: 'Interview Glow Up',
    url: '/5whys/interview-glow-up/',
    desc: 'Build proof-based stories',
    color: 'text-[hsl(var(--iris))]',
    bg: 'bg-[hsl(var(--iris)/0.12)]',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
  },
  {
    name: 'Networking Practice',
    url: '/networking-practice/',
    desc: 'Rehearse your pitch',
    color: 'text-[hsl(var(--gold))]',
    bg: 'bg-[hsl(var(--gold)/0.12)]',
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
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative flex h-20 w-20 items-center justify-center rounded-full border-4 border-[hsl(var(--border)/0.3)]">
        <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-[hsl(var(--border)/0.3)]"
          />
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${value * 2.64} 264`}
            className={color}
          />
        </svg>
        <span className="relative text-xl font-bold">{value}</span>
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
          <div className="h-8 w-48 animate-pulse rounded-lg bg-[hsl(var(--overlay)/0.4)]" />
          <div className="h-4 w-72 animate-pulse rounded-lg bg-[hsl(var(--overlay)/0.3)]" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-[hsl(var(--overlay)/0.3)]" />
          ))}
        </div>
      </div>
    );
  }

  if (!data.hasData) {
    return <EmptyState />;
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold tracking-tight">Career Dashboard</h2>
        <p className="text-muted-foreground">
          Your progress across all tools. Everything stays on your device.
        </p>
      </div>

      {/* Recommendations */}
      {data.recommendations.length > 0 && (
        <div className="rounded-2xl border border-[hsl(var(--gold)/0.4)] bg-[hsl(var(--gold)/0.08)] p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--gold))]">
            Suggested next step
          </p>
          <p className="mt-2 text-sm text-muted-foreground">{data.recommendations[0]}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.recommendations.slice(1).map((rec, i) => (
              <span
                key={i}
                className="rounded-full border border-[hsl(var(--border)/0.4)] bg-[hsl(var(--overlay)/0.3)] px-3 py-1 text-xs text-muted-foreground"
              >
                {rec}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Score cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data.resume && (
          <Card className="border-[hsl(var(--love)/0.3)] bg-[hsl(var(--overlay)/0.25)]">
            <CardContent className="p-5">
              <ScoreRing
                value={data.resume.averageScore}
                label="Resume"
                color="text-[hsl(var(--love))]"
              />
              <div className="mt-3 text-center text-xs text-muted-foreground">
                {data.resume.bulletCount} bullets analyzed
              </div>
            </CardContent>
          </Card>
        )}
        {data.reflection && data.reflection.snapshotCount > 0 && (
          <Card className="border-[hsl(var(--foam)/0.3)] bg-[hsl(var(--overlay)/0.25)]">
            <CardContent className="p-5">
              <div className="flex flex-col items-center gap-1">
                <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-[hsl(var(--foam)/0.3)]">
                  <span className="text-xl font-bold text-[hsl(var(--foam))]">
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
          <Card className="border-[hsl(var(--iris)/0.3)] bg-[hsl(var(--overlay)/0.25)]">
            <CardContent className="p-5">
              <div className="flex flex-col items-center gap-1">
                <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-[hsl(var(--iris)/0.3)]">
                  <span className="text-xl font-bold text-[hsl(var(--iris))]">
                    {data.glowup.storyCount}
                  </span>
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
          <Card className="border-[hsl(var(--gold)/0.3)] bg-[hsl(var(--overlay)/0.25)]">
            <CardContent className="p-5">
              <div className="flex flex-col items-center gap-1">
                <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-[hsl(var(--gold)/0.3)]">
                  <span className="text-xl font-bold text-[hsl(var(--gold))]">
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
                <span
                  key={skill}
                  className="rounded-full bg-[hsl(var(--foam)/0.15)] px-3 py-1 text-sm text-[hsl(var(--foam))]"
                >
                  {skill}
                </span>
              ))}
            </div>
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
                className="flex items-center justify-between rounded-xl border border-[hsl(var(--border)/0.3)] bg-[hsl(var(--overlay)/0.2)] px-4 py-3 transition hover:border-[hsl(var(--border)/0.5)] hover:bg-[hsl(var(--overlay)/0.3)]"
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

      {/* Quick links */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TOOL_LINKS.map((tool) => (
          <a
            key={tool.name}
            href={tool.url}
            className={cn(
              'group flex flex-col gap-3 rounded-2xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.25)] p-5',
              'transition-all duration-300 hover:-translate-y-0.5 hover:border-[hsl(var(--border)/0.6)] hover:bg-[hsl(var(--overlay)/0.4)] hover:shadow-[0_20px_50px_-24px_hsl(var(--background)/0.8)]'
            )}
          >
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', tool.bg)}>
              <svg
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

function EmptyState() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 text-center">
      {/* Large themed icon */}
      <div className="flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(var(--foam)/0.12)]">
          <svg
            className="h-8 w-8 text-[hsl(var(--foam))]"
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
        <h2 className="text-3xl font-semibold tracking-tight">Welcome to your Career Dashboard</h2>
        <p className="text-muted-foreground">
          Your career dashboard is waiting. Take the 2-minute career review to get personalized
          recommendations.
        </p>
      </div>

      <div className="rounded-2xl border border-[hsl(var(--border)/0.4)] bg-[hsl(var(--overlay)/0.15)] p-8">
        <a
          href="/start/"
          className="inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--foam))] px-6 py-3 text-sm font-semibold text-[hsl(var(--background))] shadow-lg transition hover:bg-[hsl(var(--foam)/0.9)] focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
        >
          Get started
          <svg
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

      <div className="grid gap-4 sm:grid-cols-2">
        {TOOL_LINKS.map((tool) => (
          <a
            key={tool.name}
            href={tool.url}
            className={cn(
              'flex items-start gap-3 rounded-2xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.2)] p-4 transition-all duration-200',
              'hover:-translate-y-0.5 hover:shadow-lg hover:border-[hsl(var(--border)/0.55)] hover:bg-[hsl(var(--overlay)/0.35)]'
            )}
          >
            <div
              className={cn(
                'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl',
                tool.bg
              )}
            >
              <svg
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
