import * as React from 'react';
import QuickStartTiles from '../QuickStartTiles';

type Props = {
  showHeader?: boolean;
};

export default function NetworkingHeader({ showHeader = true }: Props) {
  if (!showHeader) return null;

  return (
    <header className="text-center space-y-4">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-[hsl(var(--iris)/0.3)] bg-[hsl(var(--iris)/0.1)]">
        <svg
          className="h-7 w-7 text-[hsl(var(--iris))]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.6}
            d="M5.121 17.804A3 3 0 017 17h10a3 3 0 012.879 2.804L20 21H4l1.121-3.196zM12 14a5 5 0 100-10 5 5 0 000 10z"
          />
        </svg>
      </div>
      <p className="eyebrow justify-self-center" style={{ color: 'hsl(var(--iris))' }}>
        Rehearse the conversation
      </p>
      <h1 className="text-4xl font-semibold tracking-tight text-foreground">
        Networking Practice Studio
      </h1>
      <p className="mx-auto max-w-3xl text-base text-[hsl(var(--muted-foreground))]">
        Twelve scenarios, from a career fair with a line behind you to a cold email to a professor.
        Draft the intro in your own words, run it against a two-minute timer, score it honestly, and
        keep every rep so you can watch the intro improve.
      </p>
      <QuickStartTiles
        className="max-w-3xl"
        items={[
          {
            title: 'Pick a scenario',
            body: 'Twelve situations for students and career changers. Each includes sample lines, plus honest ones that work with zero experience.',
          },
          {
            title: 'Draft and run a rep',
            body: 'Write the intro you would actually say, then start the two-minute timer and say it out loud.',
          },
          {
            title: 'Rate and save',
            body: 'Score the rep, note one fix, and save. The history keeps your exact words so you can compare reps over time.',
          },
        ]}
      />
    </header>
  );
}
