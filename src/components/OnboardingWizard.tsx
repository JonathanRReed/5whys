import * as React from 'react';
import { startPath } from '../lib/path';
import {
  clearProfile,
  FOCUS_LABELS,
  isFocus,
  isStageAnswer,
  profileSaved,
  readProfile,
  STAGE_LABELS,
  stageAnswer,
  writeProfile,
} from '../lib/profile';
import { cn } from '../lib/utils';
import ConfirmButton from './shared/ConfirmButton';
import PathCard from './shared/PathCard';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';

/**
 * A second activation this soon after the question changed is the second tap
 * of a double tap (or a tremor), not a new answer, so it is ignored.
 */
const DOUBLE_TAP_MS = 400;

interface Step {
  question: string;
  subtitle: string;
  options: { label: string; value: string; icon: string }[];
}

const STEPS: Step[] = [
  {
    question: 'Where are you in your career?',
    subtitle: 'This changes which tool you should start with.',
    options: [
      {
        label: 'Student',
        value: 'student',
        icon: 'M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222',
      },
      {
        label: 'High school or first job',
        value: 'first-job',
        icon: 'M15 7a3 3 0 11-6 0 3 3 0 016 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
      },
      {
        label: 'Early career',
        value: 'early',
        icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
      },
      {
        label: 'Mid-level',
        value: 'mid',
        icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M12 16h.01',
      },
      {
        label: 'Senior or lead at work',
        value: 'senior',
        icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
      },
      {
        label: 'Transitioning',
        value: 'transition',
        icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
      },
    ],
  },
  {
    question: 'What is your biggest challenge right now?',
    subtitle: 'Your answer picks the starting point.',
    options: [
      {
        label: 'Unclear direction',
        value: 'direction',
        icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 7m0 13V7',
      },
      {
        label: 'I found a job I want to apply for',
        value: 'applying',
        icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
      },
      {
        label: 'Resume needs work',
        value: 'resume',
        icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      },
      {
        label: 'I do not have much to show yet',
        value: 'starting',
        icon: 'M12 4v16m8-8H4',
      },
      {
        label: 'Interview prep',
        value: 'interview',
        icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
      },
      {
        label: 'Networking anxiety',
        value: 'networking',
        icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
      },
      {
        label: 'I have an offer to answer',
        value: 'offer',
        icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      },
    ],
  },
];

interface Recommendation {
  title: string;
  description: string;
  url: string;
  accent: string;
  steps: string[];
  /** Two plain facts about what the visitor brings and takes away. */
  stats: { label: string; value: string }[];
  icon: string;
}

// The recommendation is a matrix: the challenge picks the tool, and the career
// stage changes what you should do inside it. No AI involved, just a lookup.
function getRecommendation(level: string, challenge: string): Recommendation {
  const student = level === 'student' || level === 'first-job';
  const exploring = student || level === 'early';

  if (challenge === 'direction') {
    if (exploring) {
      return {
        title: 'Start with the Five Whys, on the Interest Path',
        description: student
          ? "You don't need a target job title yet. Follow something that already holds your attention until a real direction shows up."
          : 'Before tweaking the job you have, check what pulls you in. The Interest Path helps you trace that.',
        url: '/career/?guide=1',
        accent: 'foam',
        steps: [
          'Pick the Interest Path and type something you keep coming back to.',
          'Answer the five "why" prompts to see what sits underneath it.',
          'Save a snapshot so you can compare it against roles later.',
        ],
        stats: [
          { label: 'You answer', value: 'Five questions, in order' },
          { label: 'You leave with', value: 'A statement and a next step' },
        ],
        icon: 'M7 8h10M7 12h4',
      };
    }
    return {
      title: 'Start with the Five Whys',
      description:
        level === 'transition'
          ? 'Test whether your reason for switching fields holds up through five rounds of "why" before you rebuild everything around it.'
          : level === 'senior'
            ? 'Pin down what the next move is for. Five rounds of "why" tell a real reason apart from a restless week.'
            : 'Figure out what you want out of your next move before polishing anything else.',
      url: '/career/?guide=1',
      accent: 'foam',
      steps: [
        'Answer the five "why" prompts to get past your first surface answer.',
        'Read the statement it puts together from your own words.',
        'Save a snapshot so you can come back to it on the dashboard.',
      ],
      stats: [
        { label: 'You answer', value: 'Five questions, in order' },
        { label: 'You leave with', value: 'A statement and a next step' },
      ],
      icon: 'M7 8h10M7 12h4',
    };
  }
  if (challenge === 'starting') {
    return {
      title: 'Start a resume from nothing',
      description:
        "You don't need an old resume to make one. Answer a few quick questions about school, a job, or things you do outside class to get your first lines. Babysitting, sports, caring for family, and volunteering all count.",
      url: '/resume-game/?start=blank&guide=1',
      accent: 'love',
      steps: [
        'Open the Resume Game on the start-from-nothing form.',
        'Fill in where you study, one job or activity, and what you did there in plain words.',
        'When you find a job posting, bring it to the Application Desk to fit your lines to it.',
      ],
      stats: [
        { label: 'You need', value: 'Nothing written yet' },
        { label: 'You leave with', value: 'Your first resume lines' },
      ],
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    };
  }
  if (challenge === 'applying') {
    return {
      title: 'Take the posting to the Application Desk',
      description: exploring
        ? "You don't need a finished resume first. Paste the posting and see what it asks for and where you stand."
        : level === 'transition'
          ? 'Paste the posting and see which requirements your past work already covers, whether you use the same wording or not.'
          : 'Paste the posting once and work through the whole thing: what it asks for, where you stand, your resume, and a cover letter.',
      url: '/application/?guide=1',
      accent: 'lichen',
      steps: [
        'Name the role and paste the whole posting.',
        'Check what it asks for and mark where you stand on each item.',
        exploring
          ? 'Turn one experience, like a class project or part-time job, into two bullets and a short letter.'
          : 'Tailor your resume to it, draft the letter, and run the final check before sending.',
      ],
      stats: [
        { label: 'You paste', value: 'The posting, once' },
        { label: 'You leave with', value: 'Bullets, a letter, a plan' },
      ],
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2',
    };
  }
  if (challenge === 'resume') {
    return {
      title: 'Jump into the Resume Game',
      description: exploring
        ? 'Class projects, internships, and part-time jobs all count. Score what you have and rewrite each line so it shows what you did.'
        : level === 'transition'
          ? 'Rewrite bullets from your old field so someone in the new one can follow what you did. Score them, then fix the weak ones.'
          : 'Score your bullets, pull out the skills they already show, and fix the weak ones.',
      url: '/resume-game/?guide=1',
      accent: 'love',
      steps: [
        exploring
          ? 'Paste what you have, even a few rough lines about a class project, campus job, or club.'
          : 'Paste or upload your current resume.',
        'Run the scan to score each bullet on action, outcome, and numbers.',
        exploring
          ? 'Rewrite your weakest lines so a project shows what changed instead of reading like a chore list.'
          : 'Use the rewrite editor to tighten up the weakest bullets.',
      ],
      stats: [
        { label: 'You paste', value: 'What you have' },
        { label: 'You leave with', value: 'Stronger lines, in your words' },
      ],
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    };
  }
  if (challenge === 'interview') {
    return {
      title: 'Prepare with Interview Glow Up',
      description:
        level === 'senior'
          ? 'At a senior level, vague leadership answers fall flat fast. Paste the posting and back up each skill with a specific story.'
          : level === 'transition'
            ? 'Paste a posting from the new field and write stories showing how your past work lines up with what it asks for.'
            : exploring
              ? 'First interviews usually come down to being prepared. Paste the posting and line up stories from classes and jobs you already have.'
              : 'Paste the posting and write one real story for each skill it asks for.',
      url: '/interview-glow-up/workspace/?guide=1',
      accent: 'iris',
      steps: [
        'Paste the job posting to see which skills it asks for.',
        level === 'senior'
          ? 'Write specific stories showing decisions you owned and what happened afterward.'
          : 'Write 3 to 5 short stories from your own experience with clear outcomes.',
        'Pull your best stories onto one screen to glance at before the call.',
      ],
      stats: [
        { label: 'You paste', value: 'The job posting' },
        { label: 'You leave with', value: 'Stories you can back up, on one page' },
      ],
      icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    };
  }
  if (challenge === 'offer') {
    return {
      title: 'Put the offer into plain numbers on Pay',
      description: exploring
        ? 'Hourly rates, salaries, and bonuses are tough to compare in your head. Type in what the offer says and see it by the hour, week, and year.'
        : 'Enter base pay, bonuses, and hours as written to see the offer by the hour, week, and year alongside any other offer you have.',
      url: '/pay/?guide=1',
      accent: 'gold',
      steps: [
        'Enter the pay, how often it is paid, and the hours per week.',
        'Add another offer, or your current job, to compare them side by side.',
        'Jot down anything you still need to ask before giving an answer.',
      ],
      stats: [
        { label: 'You bring', value: 'The offer, as written' },
        { label: 'You leave with', value: 'The same pay in plain numbers' },
      ],
      icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 9v1',
    };
  }
  return {
    title: 'Start with Networking Practice',
    description: student
      ? 'Career fairs and cold intros feel way less awkward after a few practice runs. Say your intro out loud before you need it.'
      : level === 'senior'
        ? 'Peer intros and panels need something better than reciting your title. Practice a tight opener against the clock.'
        : 'Real scenarios, a timer, and honest self-ratings, one round at a time.',
    url: '/networking-practice/?guide=1',
    accent: 'gold',
    steps: [
      'Pick the scenario closest to your next event.',
      'Say your intro out loud against the timer.',
      'Rate how it felt, tweak one thing, and run it once more.',
    ],
    stats: [
      { label: 'You bring', value: 'Your next event' },
      { label: 'You leave with', value: 'An intro you have said out loud' },
    ],
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  };
}

export default function OnboardingWizard() {
  const [step, setStep] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<number, string>>({});
  const [done, setDone] = React.useState(false);
  const [unsaved, setUnsaved] = React.useState(false);
  const [restored, setRestored] = React.useState(false);
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const [navigation, setNavigation] = React.useState(0);
  // When the question last changed, for the double-tap guard.
  const changedAt = React.useRef(Number.NEGATIVE_INFINITY);

  // A returning visitor sees their recommendation straight away and can
  // change the answers instead of re-taking the review.
  React.useEffect(() => {
    const profile = readProfile();
    if (!profile) return;
    setAnswers({ 0: stageAnswer(profile), 1: profile.focus });
    setDone(true);
    setRestored(true);
  }, []);

  const currentStep = STEPS[step];
  const recommendation = done
    ? getRecommendation(answers[0] || 'student', answers[1] || 'direction')
    : null;

  // Mounting and profile restoration leave focus where the visitor put it.
  // Only a visitor-initiated transition requests focus after React commits.
  React.useEffect(() => {
    if (navigation > 0) headingRef.current?.focus();
  }, [navigation]);

  const announcement =
    navigation === 0
      ? ''
      : done
        ? 'Career review complete.'
        : `Step ${step + 1} of ${STEPS.length}.`;

  const handleSelect = (value: string, event: React.MouseEvent) => {
    // A pointer activation (detail > 0) right after the question changed is
    // the second half of a double tap. Keyboard activations are never held back.
    if (event.detail > 0 && performance.now() - changedAt.current < DOUBLE_TAP_MS) return;
    changedAt.current = performance.now();
    setNavigation((n) => n + 1);
    const next = { ...answers, [step]: value };
    setAnswers(next);
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
      return;
    }
    // The two answers become the studio's profile so every tool can default
    // to the right register (student samples, interest track first, and so on).
    if (isStageAnswer(next[0]) && isFocus(next[1])) {
      setUnsaved(!profileSaved(writeProfile(next[0], next[1])));
    }
    setDone(true);
  };

  const handleBack = () => {
    changedAt.current = performance.now();
    setNavigation((n) => n + 1);
    if (done) {
      setDone(false);
      setRestored(false);
      setStep(STEPS.length - 1);
      return;
    }
    if (step > 0) setStep((s) => s - 1);
  };

  const handleStartOver = () => {
    // "Clear both answers" means the saved ones too, not only this screen.
    clearProfile();
    setUnsaved(false);
    changedAt.current = performance.now();
    setNavigation((n) => n + 1);
    setAnswers({});
    setDone(false);
    setRestored(false);
    setStep(0);
  };

  if (done && recommendation) {
    const accentColors: Record<string, string> = {
      foam: 'border-foam/40 bg-foam/8',
      love: 'border-love/40 bg-love/8',
      iris: 'border-iris/40 bg-iris/8',
      gold: 'border-gold/40 bg-gold/8',
      lichen: 'border-lichen/40 bg-lichen/8',
    };
    const iconColors: Record<string, string> = {
      foam: 'bg-foam/15 text-foam',
      love: 'bg-love/15 text-love',
      iris: 'bg-iris/15 text-iris',
      gold: 'bg-gold/15 text-gold',
      lichen: 'bg-lichen/15 text-lichen',
    };
    const quiet =
      'inline-flex min-h-10 items-center rounded-lg px-3 text-sm text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2';

    return (
      <div className="mx-auto w-full max-w-2xl space-y-8">
        <div
          key="review-status"
          className="sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {announcement}
        </div>
        <div className="space-y-2 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Your career review
          </p>
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="text-3xl font-semibold tracking-tight focus:outline-hidden focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foam"
          >
            {restored ? 'Welcome back. Your starting point' : 'Here is your starting point'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isStageAnswer(answers[0]) ? STAGE_LABELS[answers[0]] : ''}
            {isStageAnswer(answers[0]) && isFocus(answers[1]) ? ' · ' : ''}
            {isFocus(answers[1]) ? FOCUS_LABELS[answers[1]] : ''}
          </p>
          {unsaved && (
            <p role="alert" className="rounded-lg bg-gold/12 px-3 py-2 text-sm text-foreground">
              This browser would not save your answers. The suggestion below is for this visit only,
              and the tools will use student examples until the review is saved.
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" onClick={handleBack} className={quiet}>
              Change the last answer
            </button>
            <ConfirmButton
              tone="neutral"
              confirmLabel="Clear both answers"
              onConfirm={handleStartOver}
              className="min-h-10"
            >
              Start over
            </ConfirmButton>
          </div>
        </div>

        <Card className={cn('rounded-2xl border p-6', accentColors[recommendation.accent])}>
          <CardContent className="space-y-5 p-0">
            <div className="flex flex-col items-start gap-4 sm:flex-row">
              <div
                className={cn(
                  'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
                  iconColors[recommendation.accent]
                )}
              >
                <svg
                  aria-hidden="true"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={recommendation.icon} />
                </svg>
              </div>
              <div className="min-w-0 space-y-2">
                <h2 className="text-xl font-semibold text-foreground">{recommendation.title}</h2>
                <p className="text-muted-foreground">{recommendation.description}</p>
              </div>
            </div>
            <ol className="space-y-2 text-sm text-muted-foreground">
              {recommendation.steps.map((s, i) => (
                <li key={s} className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-overlay/50 text-xs font-medium text-foreground">
                    {i + 1}
                  </span>
                  <span className="min-w-0">{s}</span>
                </li>
              ))}
            </ol>
            <dl className="grid gap-x-6 gap-y-3 border-t border-border/40 pt-4 text-sm sm:grid-cols-2">
              {recommendation.stats.map((stat) => (
                <div key={stat.label} className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{stat.label}</dt>
                  <dd className="font-medium text-foreground">{stat.value}</dd>
                </div>
              ))}
            </dl>
            <div>
              <Button asChild size="lg" className="px-5">
                <a
                  href={recommendation.url}
                  onClick={() => {
                    // The first stop of the path for this answer is this tool.
                    if (isFocus(answers[1])) startPath(answers[1]);
                  }}
                >
                  Start now
                  <svg
                    aria-hidden="true"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {isFocus(answers[1]) && <PathCard offer={answers[1]} />}

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Or explore other tools:</p>
          <ul className="divide-y divide-border/30 rounded-xl border border-border/40">
            {[
              {
                name: 'The Five Whys',
                url: '/career/',
                desc: 'Find the reason behind a direction',
              },
              { name: 'The Resume Game', url: '/resume-game/', desc: 'Score and rewrite lines' },
              { name: 'Interview Glow Up', url: '/interview-glow-up/', desc: 'Stories with proof' },
              {
                name: 'Networking Practice',
                url: '/networking-practice/',
                desc: 'Practice an introduction',
              },
              { name: 'The Application Desk', url: '/application/', desc: 'Work one posting' },
              { name: 'Pay', url: '/pay/', desc: 'Weigh an offer' },
            ]
              .filter(
                (t) =>
                  !recommendation.url.startsWith(t.url) &&
                  !t.url.startsWith(recommendation.url.split('?')[0])
              )
              .map((tool) => (
                <li key={tool.name}>
                  <a
                    href={tool.url}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-4 py-3 text-sm transition-colors hover:bg-overlay/30 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-foam"
                  >
                    <span className="font-medium text-foreground">{tool.name}</span>
                    <span className="text-xs text-muted-foreground">{tool.desc}</span>
                  </a>
                </li>
              ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8">
      <div
        key="review-status"
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </div>
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Step {step + 1} of {STEPS.length}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-border/30">
          <div
            className="h-full rounded-full bg-foam transition-all duration-500"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* On a phone the question gets the full width and Back sits on its own
          row above it. From the small breakpoint up, Back and an equal empty
          column keep the question centered. */}
      <div className="grid gap-3 sm:grid-cols-[5rem_minmax(0,1fr)_5rem] sm:items-center">
        <div className={cn(step === 0 && 'max-sm:hidden')}>
          {step > 0 && (
            <button
              type="button"
              onClick={handleBack}
              className="flex min-h-10 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
            >
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
          )}
        </div>
        <div className="min-w-0 text-center" data-testid="review-question">
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="text-3xl font-semibold tracking-tight focus:outline-hidden focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foam"
          >
            {currentStep.question}
          </h2>
          <p className="text-muted-foreground">{currentStep.subtitle}</p>
        </div>
        <div className="max-sm:hidden" aria-hidden="true" />
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        {currentStep.options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={(event) => handleSelect(option.value, event)}
            className={cn(
              'flex min-w-0 flex-col items-center gap-3 rounded-2xl border border-border/35 bg-overlay/25 p-6 text-center break-words transition-all duration-200 cursor-pointer',
              'hover:-translate-y-0.5 hover:border-foam/50 hover:shadow-lg hover:bg-overlay/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2'
            )}
          >
            <svg
              aria-hidden="true"
              className="h-8 w-8 text-foam"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d={option.icon} />
            </svg>
            <span className="font-medium">{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
