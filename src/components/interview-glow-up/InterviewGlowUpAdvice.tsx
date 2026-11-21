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
      <div className="space-y-4 rounded-2xl border border-gold/35 bg-gold/8 px-5 py-5">
        <div className="flex items-center gap-3">
          <ClockIcon className="h-6 w-6 shrink-0 text-gold" />
          <p className="min-w-0 text-sm font-medium text-foreground sm:text-base">
            <strong>Got an interview tomorrow?</strong> Build your cheat sheet tonight.
          </p>
        </div>
        {/* The two things the tool does come first; the advice below can wait. */}
        <div className="flex flex-col gap-3 sm:flex-row" data-testid="glowup-start">
          <a
            href="/interview-glow-up/workspace/?guide=1"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-center text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Prepare for a posting
          </a>
          <a
            href="/interview-glow-up/rehearse/"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-overlay/30 px-5 py-2.5 text-center text-sm font-semibold text-foreground transition-colors hover:bg-overlay/50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Rehearse questions
          </a>
        </div>
        <p className="text-sm text-muted-foreground">
          Paste a job posting to see what questions are likely to come up and line up stories for
          them, or jump straight into practicing answers out loud or in writing. The notes below are
          optional.
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
          <strong>Stays local:</strong> nothing you write leaves this browser. Everything saves on
          this device.
        </span>
      </div>

      {/* Intro */}
      <Section title="Being nervous is normal">
        <p className="leading-relaxed">
          Almost everyone gets tense before an interview. Most of the time it happens because an
          interview feels like an oral exam where one wrong sentence sinks you, and that pressure
          makes people lock up.
        </p>
        <p className="mt-3 leading-relaxed">
          The easiest way to lower the stress is having a few concrete stories ready ahead of time
          so you aren't scrambling to invent an example on the spot.
        </p>
      </Section>

      {/* Why Interviews Feel Hard */}
      <Section title="Why interviews feel so awkward">
        <Callout variant="insight">
          <p className="font-medium">
            When you treat an interview like a test you have to pass from memory, it's easy to
            freeze up. You talk too fast, blank on projects you know well, and lose track of what
            they asked.
          </p>
        </Callout>
        <div className="mt-4 space-y-3">
          <p>You can usually tell that's happening when you start doing things like:</p>
          <ul className="list-inside list-disc space-y-1 pl-2">
            <li>Memorizing answers word for word, then freezing the second you forget a line</li>
            <li>Talking in circles because you haven't landed on the point yet</li>
            <li>Saying "I don't know" on something you've handled before</li>
            <li>Forgetting your strongest examples until ten minutes after the call ends</li>
            <li>Downplaying real work because you didn't have a fancy title</li>
          </ul>
        </div>
      </Section>

      {/* The Recruiter's Perspective */}
      <Section title="What the interviewer is checking">
        <p className="leading-relaxed">
          <strong>They want to find someone and be done hiring.</strong> Running interviews takes
          time away from their regular job, so they're hoping you're the person who works out.
        </p>
        <Callout variant="default">
          <p className="font-medium">Most questions come down to three things:</p>
          <ol className="mt-2 list-inside list-decimal space-y-1 pl-2">
            <li>
              <strong>Can you do the work?</strong> Your skills and what you've already handled.
            </li>
            <li>
              <strong>Do you want to do it?</strong> Your interest and follow-through.
            </li>
            <li>
              <strong>What's it like to work with you?</strong> Day to day, and when something goes
              wrong.
            </li>
          </ol>
        </Callout>
        <p className="mt-4 leading-relaxed">
          They're rarely trying to trick you. Even odd questions are usually asking for an example
          of one of those three things.
        </p>
      </Section>

      {/* Real examples */}
      <Section title="Talk through real examples">
        <p className="leading-relaxed">
          An interview works much better as a normal back-and-forth than a speech. The interviewer
          asks whether you can handle something, and you give them a real example of a time you did.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-destructive/30 bg-destructive/6 p-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-destructive">
              <XIcon className="h-3.5 w-3.5" /> Skip this
            </p>
            <p className="mt-1 text-sm">Memorizing full scripts and reciting them</p>
          </div>
          <div className="rounded-xl border border-foam/30 bg-foam/6 p-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-foam">
              <CheckIcon className="h-3.5 w-3.5" /> Do this
            </p>
            <p className="mt-1 text-sm">Keep a few short notes ready and talk like yourself</p>
          </div>
        </div>
      </Section>

      {/* Read the posting */}
      <Section title="Read the job posting for what it's going to test">
        <p className="leading-relaxed">
          The job posting tells you most of what they're going to ask about. Once you get past the
          corporate wording, almost every bullet points to a specific skill. The decoder sorts each
          line into required items, nice to haves, and day-to-day duties so you can see them
          clearly.
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
          Once you break a posting down like this, very few questions catch you off guard.
        </p>
      </Section>

      {/* Play + Proof */}
      <Section title="Keep stories short and backed up">
        <p className="leading-relaxed">
          For each skill the posting brings up, prepare <strong>one true story</strong> you can tell
          in a minute or two. Each one has four parts:
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border/50 bg-overlay/30 p-4">
            <p className="font-semibold text-foreground">Trigger</p>
            <p className="mt-1 text-sm text-muted-foreground">
              A short name that reminds you which story this is, like "holiday schedule".
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-overlay/30 p-4">
            <p className="font-semibold text-foreground">Hook</p>
            <p className="mt-1 text-sm text-muted-foreground">
              One sentence on the setup: what was going on or what broke.
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-overlay/30 p-4">
            <p className="flex items-center gap-2 font-semibold text-foreground">
              <TargetIcon className="h-4 w-4 text-foam" /> Play
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              What you did and decided. Keep it brief, and say "I" so your part is clear.
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-overlay/30 p-4">
            <p className="flex items-center gap-2 font-semibold text-foreground">
              <ChartIcon className="h-4 w-4 text-iris" /> Proof
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              What happened afterward: a real number, a clear before and after, a problem that went
              away, or feedback you got.
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
            If you've heard of STAR, Situation and Task are the Hook, Action is the Play, and Result
            is the Proof.
          </p>
        </Callout>
      </Section>

      {/* Student On-Ramp */}
      <Section title="Still in school? You still have real examples">
        <p className="leading-relaxed">
          Interviewers mostly care that you can walk through something specific you did and what
          changed because of it. Even without full-time office work, students usually have plenty of
          good material in four places:
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border/50 bg-overlay/20 p-4">
            <p className="text-sm font-semibold text-foreground">Class projects</p>
            <p className="mt-1 text-sm text-muted-foreground">
              The part you owned, the call you made when the plan fell apart, or the mistake you
              caught the night before it was due.
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-overlay/20 p-4">
            <p className="text-sm font-semibold text-foreground">Internships</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Small tasks still work well if you can explain why they mattered, what you did, and
              what happened next.
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-overlay/20 p-4">
            <p className="text-sm font-semibold text-foreground">Clubs and volunteering</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Running an event, managing a club budget, or recruiting new members all show real
              follow-through.
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-overlay/20 p-4">
            <p className="text-sm font-semibold text-foreground">Campus and part-time jobs</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Dealing with a rush, calming down an upset customer, or training a new hire. People
              trust these stories because they're grounded and hard to fake.
            </p>
          </div>
        </div>
        <Callout variant="tip">
          <p className="font-medium">Ways to show results without corporate metrics:</p>
          <ul className="mt-2 list-inside list-disc space-y-1 pl-2 text-sm">
            <li>A grade or specific feedback from an instructor</li>
            <li>The scope of the work: how many people, how long it ran, or the budget involved</li>
            <li>A simple before and after: "sign-ups took three forms, now they take one"</li>
            <li>People continuing to use something you built or set up</li>
          </ul>
        </Callout>
      </Section>

      {/* Career changers */}
      <Section title="Changing careers? Your last job already has examples">
        <p className="leading-relaxed">
          Running a shift, managing a store, or leading a crew takes real coordination, and a lot of
          it carries over. The main step is explaining it in the new field's terms without
          stretching what you did.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border/50 bg-overlay/20 p-4">
            <p className="text-sm font-semibold text-foreground">Schedules and shifts</p>
            <p className="mt-1 text-sm text-muted-foreground">
              A schedule you built or held together when people called out.
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-overlay/20 p-4">
            <p className="text-sm font-semibold text-foreground">Customers</p>
            <p className="mt-1 text-sm text-muted-foreground">
              A rough complaint you resolved or an account you kept from leaving.
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-overlay/20 p-4">
            <p className="text-sm font-semibold text-foreground">Inventory and counts</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Numbers that wouldn't line up until you tracked down why.
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-overlay/20 p-4">
            <p className="text-sm font-semibold text-foreground">A process you fixed</p>
            <p className="mt-1 text-sm text-muted-foreground">
              How it worked before, what you changed, and who still uses it.
            </p>
          </div>
        </div>
        <p className="mt-4 leading-relaxed">
          You'll probably get asked why you're switching fields and why you left your last job. The
          rehearsal room includes both so you can practice giving a clean, plain answer.
        </p>
      </Section>

      {/* Practical reminders */}
      <Section title="A few things to keep in mind">
        <div className="space-y-4">
          <div className="rounded-xl border border-border/50 bg-overlay/20 p-4">
            <p className="eyebrow">Before</p>
            <p className="mt-1 text-foreground">
              Skim your cheat sheet once, close the extra tabs, and keep a glass of water nearby.
              Cramming new answers ten minutes before the call usually only makes you more anxious.
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-overlay/20 p-4">
            <p className="eyebrow">During</p>
            <p className="mt-1 text-foreground">
              If you draw a blank, take a second and glance at your notes. Pausing for two seconds
              always looks better than rambling.
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-overlay/20 p-4">
            <p className="eyebrow">After</p>
            <p className="mt-1 text-foreground">
              Write down any question that tripped you up while it's still fresh so you have a
              better answer ready for the next interview.
            </p>
          </div>
        </div>
      </Section>

      {/* CTA */}
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-love/40 bg-love/7 px-6 py-8 text-center sm:px-10 sm:py-10">
        <h3 className="text-xl font-semibold text-foreground sm:text-2xl">
          Ready to put your packet together?
        </h3>
        <p className="max-w-lg text-muted-foreground">
          Paste a real job posting, write the stories it asks for, and open the HUD, a one-screen
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
