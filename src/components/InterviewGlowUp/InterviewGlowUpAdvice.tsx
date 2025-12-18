import * as React from 'react';
import { cn } from '../../lib/utils';

interface SectionProps {
    title: string;
    children: React.ReactNode;
    className?: string;
}

function Section({ title, children, className }: SectionProps) {
    return (
        <div className={cn('space-y-4', className)}>
            <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {title}
            </h2>
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
        default: 'border-[hsl(var(--foam)/0.4)] bg-[hsl(var(--foam)/0.08)]',
        insight: 'border-[hsl(var(--iris)/0.4)] bg-[hsl(var(--iris)/0.08)]',
        tip: 'border-[hsl(var(--gold)/0.4)] bg-[hsl(var(--gold)/0.08)]',
    };

    return (
        <div
            className={cn(
                'rounded-xl border p-4 text-foreground',
                variants[variant]
            )}
        >
            {children}
        </div>
    );
}

export default function InterviewGlowUpAdvice() {
    return (
        <article className="space-y-12 rounded-[2.5rem] border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.25)] px-6 py-12 sm:px-10 sm:py-14">
            {/* v1.3 Positioning Banner */}
            <div className="flex items-center gap-3 rounded-2xl border border-[hsl(var(--gold)/0.35)] bg-[hsl(var(--gold)/0.08)] px-5 py-4">
                <span className="text-2xl" role="img" aria-label="clock">⏱</span>
                <p className="text-sm font-medium text-foreground sm:text-base">
                    <strong>Got an interview tomorrow?</strong> Build your cheat sheet in 20 minutes.
                </p>
            </div>

            {/* Privacy Notice */}
            <div className="flex items-center gap-3 rounded-xl border border-[hsl(var(--foam)/0.3)] bg-[hsl(var(--foam)/0.06)] px-4 py-3 text-sm text-muted-foreground">
                <svg className="h-4 w-4 flex-shrink-0 text-[hsl(var(--foam))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span><strong>Privacy first:</strong> No data leaves your browser. Everything is stored locally on your device.</span>
            </div>

            {/* Intro */}
            <Section title="It's normal to feel nervous">
                <p className="leading-relaxed">
                    If interviews make you anxious, you're not alone. Most people treat interviews like an exam—
                    triggering fight, flight, or freeze mode. You start rambling, blanking, or worse: giving
                    rehearsed answers that sound robotic.
                </p>
                <p className="mt-3 leading-relaxed">
                    The good news? <strong>This feeling is fixable.</strong> With the right preparation method,
                    you can walk in calm, confident, and ready to have a real conversation.
                </p>
            </Section>

            {/* Why Interviews Feel Hard */}
            <Section title="Why interviews feel hard">
                <Callout variant="insight">
                    <p className="font-medium">
                        🧠 The "exam mindset" is your enemy. When you think "I'm being tested," your brain goes into
                        survival mode. You forget details, speak too fast, and struggle to think clearly.
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
                    Here's the secret: <strong>recruiters want to hire you</strong>. Every interview is expensive.
                    They're rooting for you to be "the one" so they can stop searching.
                </p>
                <Callout variant="default">
                    <p className="font-medium">
                        ✅ The Three Checks Every Interviewer Makes:
                    </p>
                    <ol className="mt-2 list-inside list-decimal space-y-1 pl-2">
                        <li><strong>Can you do the job?</strong> (Skills & experience)</li>
                        <li><strong>Will you do the job?</strong> (Motivation & work ethic)</li>
                        <li><strong>Will you fit in?</strong> (Culture & collaboration)</li>
                    </ol>
                </Callout>
                <p className="mt-4 leading-relaxed">
                    That's it. They're not trying to trick you. Most questions are just skill checks wearing
                    different clothes.
                </p>
            </Section>

            {/* Mindset Shift */}
            <Section title="Shift your mindset: conversation over performance">
                <p className="leading-relaxed">
                    Stop thinking of interviews as performances. Think of them as <strong>proof-based conversations</strong>.
                    The interviewer asks "Can you solve X?" and you respond with evidence that you have.
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-[hsl(var(--destructive)/0.3)] bg-[hsl(var(--destructive)/0.06)] p-4">
                        <p className="text-sm font-semibold text-destructive">❌ Don't</p>
                        <p className="mt-1 text-sm">Memorize scripts and deliver monologues</p>
                    </div>
                    <div className="rounded-xl border border-[hsl(var(--foam)/0.3)] bg-[hsl(var(--foam)/0.06)] p-4">
                        <p className="text-sm font-semibold text-[hsl(var(--foam))]">✓ Do</p>
                        <p className="mt-1 text-sm">Prepare building blocks, then respond naturally</p>
                    </div>
                </div>
            </Section>

            {/* Decode the JD */}
            <Section title="Decode the job description">
                <p className="leading-relaxed">
                    The job description is your cheat sheet. It tells you exactly what skills they're testing.
                    Hidden under corporate jargon, every bullet maps to 1-2 skills.
                </p>
                <Callout variant="tip">
                    <p className="font-medium">
                        💡 Example: "Own the end-to-end development lifecycle for key features"
                    </p>
                    <p className="mt-2 text-sm">
                        <strong>Skills:</strong> Ownership, Technical Execution, Project Management
                    </p>
                    <p className="mt-1 text-sm">
                        <strong>Likely question:</strong> "Tell me about a feature you owned from start to finish."
                    </p>
                </Callout>
                <p className="mt-4 leading-relaxed">
                    Once you decode the JD, you know 80% of the questions before you walk in.
                </p>
            </Section>

            {/* Play + Proof */}
            <Section title="The Play + Proof method">
                <p className="leading-relaxed">
                    For each skill, you need <strong>one strong story</strong>. Structure it with Play + Proof:
                </p>
                <div className="mt-4 space-y-4">
                    <div className="rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] p-4">
                        <p className="font-semibold text-foreground">🎯 Play (What You Did)</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            The specific action you took. Keep it concise—2-3 sentences max.
                        </p>
                    </div>
                    <div className="rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] p-4">
                        <p className="font-semibold text-foreground">📊 Proof (The Receipt)</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            The measurable result. Numbers, time saved, revenue impact, or specific praise you received.
                        </p>
                    </div>
                </div>
                <Callout variant="default">
                    <p className="text-sm">
                        <strong>Example:</strong> "I refactored the authentication system to use JWT tokens (Play),
                        which reduced login failures by 40% and support tickets by 25% (Proof)."
                    </p>
                </Callout>
            </Section>

            {/* Normalize Nerves */}
            <Section title="Normalize the nerves">
                <div className="space-y-4">
                    <div className="rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.2)] p-4">
                        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Before</p>
                        <p className="mt-1 text-foreground">"I'm prepared. I know my stories. This is just a conversation."</p>
                    </div>
                    <div className="rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.2)] p-4">
                        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">During</p>
                        <p className="mt-1 text-foreground">"If I blank, I can pause, breathe, and check my notes. It's normal."</p>
                    </div>
                    <div className="rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.2)] p-4">
                        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">After</p>
                        <p className="mt-1 text-foreground">"I showed up and gave honest answers. That's a win regardless of outcome."</p>
                    </div>
                </div>
            </Section>

            {/* CTA */}
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-[hsl(var(--iris)/0.4)] bg-gradient-to-br from-[hsl(var(--iris)/0.12)] to-[hsl(var(--foam)/0.08)] px-6 py-8 text-center sm:px-10 sm:py-10">
                <h3 className="text-xl font-semibold text-foreground sm:text-2xl">
                    Ready to build your interview packet?
                </h3>
                <p className="max-w-lg text-muted-foreground">
                    Decode a real job description, create your Play + Proof stories, and generate a panic-proof
                    cheat sheet you can use during the interview.
                </p>
                <a
                    href="/5whys/interview-glow-up/workspace"
                    className="mt-2 inline-flex items-center gap-2 rounded-full border border-transparent bg-[hsl(var(--foam))] px-6 py-3 text-sm font-semibold text-[hsl(var(--background))] shadow-lg shadow-[hsl(var(--foam)/0.25)] transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[hsl(var(--foam)/0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--background))]"
                >
                    Open the Workspace
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                </a>
            </div>
        </article>
    );
}
