import * as React from 'react';
import { Card, CardContent } from './ui/card';
import { cn } from '../lib/utils';

interface Step {
  question: string;
  subtitle: string;
  options: { label: string; value: string; icon: string }[];
}

const STEPS: Step[] = [
  {
    question: 'Where are you in your career?',
    subtitle: 'This helps us recommend the right tools.',
    options: [
      { label: 'Early career', value: 'early', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
      { label: 'Mid-level', value: 'mid', icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M12 16h.01' },
      { label: 'Senior / Lead', value: 'senior', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
      { label: 'Transitioning', value: 'transition', icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' },
    ],
  },
  {
    question: 'What is your biggest challenge right now?',
    subtitle: 'We will tailor your starting point.',
    options: [
      { label: 'Unclear direction', value: 'direction', icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 7m0 13V7' },
      { label: 'Resume needs work', value: 'resume', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
      { label: 'Interview prep', value: 'interview', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
      { label: 'Networking anxiety', value: 'networking', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
    ],
  },
];

interface Recommendation {
  title: string;
  description: string;
  url: string;
  accent: string;
  steps: string[];
  stats: { label: string; value: string }[];
  icon: string;
}

function getRecommendation(level: string, challenge: string): Recommendation {
  if (challenge === 'direction') {
    return {
      title: 'Start with Career 5 Whys',
      description: 'Clarify your core motivation before polishing anything else.',
      url: '/career/',
      accent: 'foam',
      steps: [
        'Answer the five "why" prompts to surface your root motivation.',
        'Review your synthesized theme and alignment.',
        'Save a snapshot for future reference.',
      ],
      stats: [
        { label: 'Prompts', value: '5 guided' },
        { label: 'Time', value: '2 min' },
        { label: 'Output', value: 'Theme + snapshot' },
      ],
      icon: 'M7 8h10M7 12h4',
    };
  }
  if (challenge === 'resume') {
    return {
      title: 'Jump into the Resume Game',
      description: 'Analyze your bullets, detect skills, and rewrite for impact.',
      url: '/resume-game/',
      accent: 'love',
      steps: [
        'Paste or upload your current resume.',
        'Run the analysis to score each bullet.',
        'Use the structured rewrite to strengthen weak bullets.',
      ],
      stats: [
        { label: 'Analysis', value: 'Bullet scoring' },
        { label: 'Skills', value: 'Auto-detect' },
        { label: 'Rewrite', value: 'AI-guided' },
      ],
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    };
  }
  if (challenge === 'interview') {
    return {
      title: 'Build your Interview Glow Up',
      description: 'Decode job descriptions and create proof-based stories.',
      url: '/5whys/interview-glow-up/',
      accent: 'iris',
      steps: [
        'Paste a job description to decode required skills.',
        'Build 3-5 STAR-method stories from your experience.',
        'Assemble a panic-proof packet for your next call.',
      ],
      stats: [
        { label: 'Stories', value: 'STAR method' },
        { label: 'Skills', value: 'JD decode' },
        { label: 'Packet', value: 'Panic-proof' },
      ],
      icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    };
  }
  return {
    title: 'Practice with Networking Rehearsal',
    description: 'Timed scenarios and ratings to build confident delivery.',
    url: '/networking-practice/',
    accent: 'gold',
    steps: [
      'Pick a scenario that matches your next event.',
      'Practice your 2-minute pitch with the timer.',
      'Rate yourself and iterate on the next round.',
    ],
    stats: [
      { label: 'Scenarios', value: 'Event-ready' },
      { label: 'Timer', value: '2-min pitch' },
      { label: 'Feedback', value: 'Self-rated' },
    ],
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  };
}

export default function OnboardingWizard() {
  const [step, setStep] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<number, string>>({});
  const [done, setDone] = React.useState(false);

  const currentStep = STEPS[step];
  const recommendation = done
    ? getRecommendation(answers[0] || 'early', answers[1] || 'direction')
    : null;

  const handleSelect = (value: string) => {
    setAnswers((prev) => ({ ...prev, [step]: value }));
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      setDone(true);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep((s) => s - 1);
      setDone(false);
    }
  };

  if (done && recommendation) {
    const accentColors: Record<string, string> = {
      foam: 'border-[hsl(var(--foam)/0.4)] bg-[hsl(var(--foam)/0.08)] text-[hsl(var(--foam))]',
      love: 'border-[hsl(var(--love)/0.4)] bg-[hsl(var(--love)/0.08)] text-[hsl(var(--love))]',
      iris: 'border-[hsl(var(--iris)/0.4)] bg-[hsl(var(--iris)/0.08)] text-[hsl(var(--iris))]',
      gold: 'border-[hsl(var(--gold)/0.4)] bg-[hsl(var(--gold)/0.08)] text-[hsl(var(--gold))]',
    };
    const btnColor: Record<string, string> = {
      foam: 'bg-[hsl(var(--foam))] hover:bg-[hsl(var(--foam)/0.9)] text-[hsl(var(--background))]',
      love: 'bg-[hsl(var(--love))] hover:bg-[hsl(var(--love)/0.9)] text-[hsl(var(--background))]',
      iris: 'bg-[hsl(var(--iris))] hover:bg-[hsl(var(--iris)/0.9)] text-[hsl(var(--background))]',
      gold: 'bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold)/0.9)] text-[hsl(var(--background))]',
    };
    const ringColors: Record<string, string> = {
      foam: 'text-[hsl(var(--foam))]',
      love: 'text-[hsl(var(--love))]',
      iris: 'text-[hsl(var(--iris))]',
      gold: 'text-[hsl(var(--gold))]',
    };

    return (
      <div className="mx-auto w-full max-w-2xl space-y-8">
        <div className="space-y-2 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Your career review</p>
          <h1 className="text-3xl font-semibold tracking-tight">Here is your starting point</h1>
        </div>

        <Card className={cn('rounded-2xl border p-6', accentColors[recommendation.accent])}>
          <CardContent className="space-y-4 p-0">
            {/* Celebration ring */}
            <div className="flex justify-center">
              <div className={cn('flex h-16 w-16 items-center justify-center rounded-full border-4 border-current/30', ringColors[recommendation.accent])}>
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
            </div>
            {/* Large colored icon */}
            <div className="flex justify-center">
              <div className={cn('flex h-12 w-12 items-center justify-center rounded-xl', `bg-[hsl(var(--${recommendation.accent})/0.15)]`)}>
                <svg className={cn('h-6 w-6', ringColors[recommendation.accent])} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={recommendation.icon} />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-semibold text-center">{recommendation.title}</h2>
            <p className="text-muted-foreground text-center">{recommendation.description}</p>
            <ol className="space-y-2 text-sm text-muted-foreground">
              {recommendation.steps.map((s, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[hsl(var(--overlay)/0.5)] text-xs font-medium">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              {recommendation.stats.map((stat, i) => (
                <div key={i} className="rounded-xl border border-[hsl(var(--border)/0.3)] bg-[hsl(var(--overlay)/0.3)] p-3 text-center">
                  <p className="text-sm font-semibold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
            <div className="pt-2 text-center">
              <a
                href={recommendation.url}
                className={cn(
                  'inline-flex items-center gap-2 rounded-xl text-base py-3.5 px-8 font-semibold shadow-lg transition focus-visible:ring-2 focus-visible:ring-offset-2',
                  btnColor[recommendation.accent]
                )}
              >
                Start now
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Or explore other tools:</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { name: 'Career 5 Whys', url: '/career/', desc: 'Clarify direction' },
              { name: 'Resume Game', url: '/resume-game/', desc: 'Polish bullets' },
              { name: 'Interview Glow Up', url: '/5whys/interview-glow-up/', desc: 'Prep stories' },
              { name: 'Networking', url: '/networking-practice/', desc: 'Rehearse pitch' },
            ]
              .filter((t) => t.url !== recommendation.url)
              .map((tool) => (
                <a
                  key={tool.name}
                  href={tool.url}
                  className="rounded-xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.2)] px-4 py-3 text-sm transition hover:border-[hsl(var(--border)/0.55)] hover:bg-[hsl(var(--overlay)/0.35)]"
                >
                  <p className="font-medium">{tool.name}</p>
                  <p className="text-xs text-muted-foreground">{tool.desc}</p>
                </a>
              ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Step {step + 1} of {STEPS.length}</span>
          <span className="text-xs text-muted-foreground">{STEPS[step].question}</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-[hsl(var(--border)/0.3)]">
          <div
            className="h-full rounded-full bg-[hsl(var(--foam))] transition-all duration-500"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="w-20">
          {step > 0 && (
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2 rounded-md"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
          )}
        </div>
        <div className="flex-1 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">{currentStep.question}</h1>
          <p className="text-muted-foreground">{currentStep.subtitle}</p>
        </div>
        <div className="w-20" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {currentStep.options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => handleSelect(option.value)}
            className={cn(
              'flex flex-col items-center gap-3 rounded-2xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.25)] p-6 text-center transition-all duration-200 cursor-pointer',
              'hover:-translate-y-0.5 hover:border-[hsl(var(--foam)/0.5)] hover:shadow-lg hover:bg-[hsl(var(--overlay)/0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2'
            )}
          >
            <svg className="h-8 w-8 text-[hsl(var(--foam))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={option.icon} />
            </svg>
            <span className="font-medium">{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
