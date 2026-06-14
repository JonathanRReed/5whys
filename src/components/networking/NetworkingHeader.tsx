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
        <svg className="h-7 w-7 text-[hsl(var(--iris))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M5.121 17.804A3 3 0 017 17h10a3 3 0 012.879 2.804L20 21H4l1.121-3.196zM12 14a5 5 0 100-10 5 5 0 000 10z" />
        </svg>
      </div>
      <p className="eyebrow justify-self-center" style={{ color: 'hsl(var(--iris))' }}>Rehearse the conversation</p>
      <h1 className="text-4xl font-semibold tracking-tight text-foreground">Networking Practice Studio</h1>
      <p className="mx-auto max-w-3xl text-base text-[hsl(var(--muted-foreground))]">
        Craft confident introductions for career fairs, conferences, and outreach. Practice your Who / Where / What openings, pace yourself with a two-minute timer, and capture reflections to keep improving.
      </p>
      <QuickStartTiles
        className="max-w-3xl"
        items={[
          {
            title: 'Choose a scenario',
            body: 'Pick a built-in prompt or clone it for your own event so the notes stay contextual.',
          },
          {
            title: 'Run a timed rep',
            body: 'Start the two-minute timer, talk aloud, and jot quick reflections while the energy is fresh.',
          },
          {
            title: 'Save + export',
            body: 'Log each run to see progress over time. Export the JSON bundle when you want to archive or share.',
          },
        ]}
      />
    </header>
  );
}
