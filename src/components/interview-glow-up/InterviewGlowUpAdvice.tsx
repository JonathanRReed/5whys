import type * as React from 'react';
import { cn } from '../../lib/utils';
import { ChartIcon, CheckIcon, ClockIcon, TargetIcon, XIcon } from '../interview-glow-up/icons';

interface SectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

function Section({ title, children, className }: SectionProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h2>
      <div className="text-muted-foreground">{children}</div>
    </div>
  );
}

interface CalloutProps {
  children: React.ReactNode;
  variant?: 'default' | 'insight' | 'tip';
}

function Callout({ children, variant = 'default' }: CalloutProps) {
  const variants = {
    default: 'border-foam/40 bg-foam/8',
    insight: 'border-iris/40 bg-iris/8',
    tip: 'border-gold/40 bg-gold/8',
  };

  return (
    <div className={cn('rounded-xl border p-4 text-foreground', variants[variant])}>{children}</div>
  );
}

export default function InterviewGlowUpAdvice() {
  return (
    <article className="space-y-12 rounded-2xl border border-border/50 bg-card/45 px-6 py-12 sm:px-10 sm:py-14">
      {/* v1.3 Positioning Banner */}
      <div className="flex items-center gap-3 rounded-2xl border border-gold/35 bg-gold/8 px-5 py-4">
        <ClockIcon className="h-6 w-6 shrink-0 text-gold" />
        <p className="text-sm font-medium text-foreground sm:text-base">
          <strong>Got an interview tomorrow?</strong> Build your cheat sheet tonight.
        </p>
      </div>

      {/* Privacy Notice */}
      <div className="flex items-center gap-3 rounded-xl border border-foam/30 bg-foam/6 px-4 py-3 text-sm text-muted-foreground">
        <svg
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-foam"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
        <span>
          <strong>Private by design:</strong> nothing you write leaves this browser. Everything is
          stored on this device.
        </span>
      </div>

      {/* Intro */}
      <Section title="It's normal to feel nervous">
        <p className="leading-relaxed">
          If interviews make you anxious, you're not alone. Most people treat interviews like an
          exam, triggering fight, flight, or freeze mode.
        </p>
        <p className="mt-3 leading-relaxed">
          It is also fixable. With the right preparation, you can walk in calm and ready to have a
          real conversation instead of giving a performance.
        </p>
      </Section>

      {/* Why Interviews Feel Hard */}
      <Section title="Why interviews feel hard">
        <Callout variant="insight">
          <p className="font-medium">
            The "exam mindset" is your enemy. When you think "I'm being tested," your brain goes
            into survival mode. You forget details, speak too fast, and struggle to think clearly.
          </p>
        </Callout>
        <div className="mt-4 space-y-3">
          <p>Common symptoms of exam mindset:</p>
          <ul className="list-inside list-disc space-y-1 pl-2">
            <li>Rehearsing answers word-for-word (then blanking on them)</li>
            <li>Rambling without a clear point</li>
            <li>Saying "I don't know" when you actually do know</li>
            <li>Forgetting your best accomplishments</li>
            <li>Feeling like an impostor despite real experience</li>
          </ul>
        </div>
      </Section>

      {/* The Recruiter's Perspective */}
      <Section title="What recruiters actually want">
        <p className="leading-relaxed">
          <strong>Recruiters want to hire you.</strong> Every interview costs them time and money,
          so they are rooting for you to be the person who ends the search.
        </p>
        <Callout variant="default">
          <p className="font-medium">Three things every interviewer is checking:</p>
          <ol className="mt-2 list-inside list-decimal space-y-1 pl-2">
            <li>
              <strong>Can you do the job?</strong> (Skills and experience)
            </li>
            <li>
              <strong>Will you do the job?</strong> (Motivation and effort)
            </li>
            <li>
              <strong>Will you fit in?</strong> (How you work with people)
            </li>
          </ol>
        </Callout>
        <p className="mt-4 leading-relaxed">
          They are not trying to trick you. Most questions are skill checks in different clothing.
        </p>
      </Section>

      {/* Mindset Shift */}
      <Section title="Shift your mindset: conversation over performance">
        <p className="leading-relaxed">
          Stop thinking of interviews as performances. Think of them as{' '}
          <strong>proof-based conversations</strong>. The interviewer asks "Can you solve X?" and
          you respond with evidence that you have.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-destructive/30 bg-destructive/6 p-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-destructive">
              <XIcon className="h-3.5 w-3.5" /> Don't
            </p>
            <p className="mt-1 text-sm">Memorize scripts and deliver monologues</p>
          </div>
          <div className="rounded-xl border border-foam/30 bg-foam/6 p-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-foam">
              <CheckIcon className="h-3.5 w-3.5" /> Do
            </p>
            <p className="mt-1 text-sm">Prepare building blocks, then respond naturally</p>
          </div>
        </div>
      </Section>

      {/* Read the posting */}
      <Section title="Read the job posting for what it tests">
        <p className="leading-relaxed">
          The job posting is your study guide. Under the jargon, most lines point to a skill you can
          show with a story, and the decoder sorts each line into what is required, what is nice to
          have, and the duties of the job.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Callout variant="tip">
            <p className="font-medium">
              A student posting: "Schedule and confirm volunteers each week"
            </p>
            <p className="mt-2 text-sm">
              <strong>Skills:</strong> Scheduling, Communication
            </p>
            <p className="mt-1 text-sm">
              <strong>Likely question:</strong> "Walk me through how you would schedule and confirm
              volunteers each week."
            </p>
          </Callout>
          <Callout variant="tip">
            <p className="font-medium">
              An operations posting: "Coordinate daily shipment schedules with carriers"
            </p>
            <p className="mt-2 text-sm">
              <strong>Skills:</strong> Logistics, Scheduling, Vendor and carrier coordination
            </p>
            <p className="mt-1 text-sm">
              <strong>Likely question:</strong> "Tell me about a time you had to coordinate
              schedules with people outside your team."
            </p>
          </Callout>
        </div>
        <p className="mt-4 leading-relaxed">
          Once you have read the posting this way, most of the questions stop being surprises.
        </p>
      </Section>

      {/* Play + Proof */}
      <Section title="Stories with proof">
        <p className="leading-relaxed">
          For each skill the posting tests, you want <strong>one true story</strong> you can tell in
          a minute or two. Each story has four parts:
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border/50 bg-overlay/30 p-4">
            <p className="font-semibold text-foreground">Trigger</p>
            <p className="mt-1 text-sm text-muted-foreground">
              A short name that brings the story back to mind, such as "holiday schedule".
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-overlay/30 p-4">
            <p className="font-semibold text-foreground">Hook</p>
            <p className="mt-1 text-sm text-muted-foreground">
              The situation in a sentence: what was going on, or what was wrong.
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-overlay/30 p-4">
            <p className="flex items-center gap-2 font-semibold text-foreground">
              <TargetIcon className="h-4 w-4 text-foam" /> Play
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              What you did and decided. Keep it short, and say "I", not "we".
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-overlay/30 p-4">
            <p className="flex items-center gap-2 font-semibold text-foreground">
              <ChartIcon className="h-4 w-4 text-iris" /> Proof
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              What came of it: a number you can stand behind, a before and after, a problem that
              stopped, or what someone said.
            </p>
          </div>
        </div>
        <Callout variant="default">
          <p className="text-sm">
            <strong>From a job:</strong> "Trucks were sitting half unloaded at the end of every
            shift, so I set a dock schedule with the distribution center and moved breaks around it
            (Play). From then on the trucks were worked the same day (Proof)."
          </p>
          <p className="mt-2 text-sm">
            <strong>From school:</strong> "Our club kept losing volunteers between sign-up and the
            event, so I rebuilt the sign-up form and sent a reminder the day before (Play). Fewer
            people missed their shifts, and the club still uses the form (Proof)."
          </p>
          <p className="mt-2 text-sm">
            Know STAR? Situation and Task are the Hook, Action is the Play, and Result is the Proof.
          </p>
        </Callout>
      </Section>

      {/* Student On-Ramp */}
      <Section title="Still in school? You still have proof">
        <p className="leading-relaxed">
          A story does not care where it happened. It cares that you did something specific and can
          say what came of it. Students have four sources most people overlook:
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border/50 bg-overlay/20 p-4">
            <p className="text-sm font-semibold text-foreground">Class projects</p>
            <p className="mt-1 text-sm text-muted-foreground">
              The part you owned, the decision you made when the plan broke, the mistake you caught
              the night before it was due.
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-overlay/20 p-4">
            <p className="text-sm font-semibold text-foreground">Internships</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Even a small task counts if you can say why it mattered, what you did, and what
              happened after.
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-overlay/20 p-4">
            <p className="text-sm font-semibold text-foreground">Clubs and volunteering</p>
            <p className="mt-1 text-sm text-muted-foreground">
              The event you organized, the budget you kept, the members you recruited. That is
              leadership and ownership, named plainly.
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-overlay/20 p-4">
            <p className="text-sm font-semibold text-foreground">Campus and part-time jobs</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Handling a rush, an unhappy customer, training a new hire. Interviewers trust these
              stories because they are hard to fake.
            </p>
          </div>
        </div>
        <Callout variant="tip">
          <p className="font-medium">Proof without business numbers:</p>
          <ul className="mt-2 list-inside list-disc space-y-1 pl-2 text-sm">
            <li>A grade, or what an instructor said about the work</li>
            <li>The size of the job: how many people, how long, how much money</li>
            <li>A before and after: "sign-ups took three forms, now they take one"</li>
            <li>People actually using what you made</li>
          </ul>
        </Callout>
      </Section>

      {/* Career changers */}
      <Section title="Changing careers? Your last job is full of proof">
        <p className="leading-relaxed">
          Running a shift, a store, or a crew is real work, and most of it carries over. The job is
          to say it in the new field's words, and only for work you really did.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border/50 bg-overlay/20 p-4">
            <p className="text-sm font-semibold text-foreground">Schedules and shifts</p>
            <p className="mt-1 text-sm text-muted-foreground">
              A schedule you built, or kept together when people called out.
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-overlay/20 p-4">
            <p className="text-sm font-semibold text-foreground">Customers</p>
            <p className="mt-1 text-sm text-muted-foreground">
              A complaint you turned around, or an account you kept.
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-overlay/20 p-4">
            <p className="text-sm font-semibold text-foreground">Inventory and counts</p>
            <p className="mt-1 text-sm text-muted-foreground">
              A count that would not match until you found out why.
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-overlay/20 p-4">
            <p className="text-sm font-semibold text-foreground">A process you fixed</p>
            <p className="mt-1 text-sm text-muted-foreground">
              How it worked before, what you changed, and who uses it now.
            </p>
          </div>
        </div>
        <p className="mt-4 leading-relaxed">
          Expect to be asked why you are changing fields and about leaving your last job. The
          rehearsal room asks both, so you can practice saying them plainly.
        </p>
      </Section>

      {/* Normalize Nerves */}
      <Section title="Normalize the nerves">
        <div className="space-y-4">
          <div className="rounded-xl border border-border/50 bg-overlay/20 p-4">
            <p className="eyebrow">Before</p>
            <p className="mt-1 text-foreground">
              "I'm prepared. I know my stories. This is just a conversation."
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-overlay/20 p-4">
            <p className="eyebrow">During</p>
            <p className="mt-1 text-foreground">
              "If I blank, I can pause, breathe, and check my notes. It's normal."
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-overlay/20 p-4">
            <p className="eyebrow">After</p>
            <p className="mt-1 text-foreground">
              "I showed up and gave honest answers. That's a win regardless of outcome."
            </p>
          </div>
        </div>
      </Section>

      {/* CTA */}
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-love/40 bg-love/7 px-6 py-8 text-center sm:px-10 sm:py-10">
        <h3 className="text-xl font-semibold text-foreground sm:text-2xl">
          Ready to build your interview packet?
        </h3>
        <p className="max-w-lg text-muted-foreground">
          Decode a real job posting, write the stories it calls for, and build the HUD: a one-screen
          cheat sheet for the call.
        </p>
        <a
          href="/interview-glow-up/workspace/"
          className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-22px_hsl(var(--primary))] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Open the workspace
          <svg
            aria-hidden="true"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </a>
      </div>
    </article>
  );
}
