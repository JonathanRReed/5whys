import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import CareerHeader from '../src/components/career-5whys/CareerHeader';
import { computeSynthesis } from '../src/components/career-5whys/shared';
import WhyStepper from '../src/components/career-5whys/WhyStepper';
import { computeNextStep } from '../src/lib/networking-advice';

afterEach(cleanup);

it.each(['career', 'interest'] as const)(
  'treats the %s reflection as a hypothesis rather than a proven cause',
  (track) => {
    const answers = Array(5).fill('I want to help people understand technical ideas.');
    const summary = computeSynthesis(answers, 'Teaching', track);
    expect(summary.isComplete).toBe(true);
    expect(summary.whyStatement).toContain('Working hypothesis');
    expect(summary.whyStatement).toContain('test');
    expect(summary.whyStatement).not.toMatch(
      /the real reason|really about|Act on that, not the surface/
    );
    expect(summary.root).toBe(answers[4]);
  }
);

it('labels progress as answered questions rather than discovered depth', () => {
  render(
    <CareerHeader
      showHeader={false}
      track="career"
      topic="Teaching"
      sequentialCount={5}
      progressPercent={100}
      onTrackChange={() => {}}
      onTopicChange={() => {}}
    />
  );
  expect(screen.getByText('Questions answered')).toBeInTheDocument();
  expect(screen.queryByText('Depth found')).toBeNull();
});

it('does not claim that later answers validate earlier ones', () => {
  render(<WhyStepper responses={Array(5).fill('A reason')} sequentialCount={5} />);
  expect(screen.queryByText('Each layer validates the one above it.')).toBeNull();
  expect(screen.getByText(/does not prove/i)).toBeInTheDocument();
});

it('offers practice steps without guaranteed progress or memorized rapport lines', () => {
  expect(computeNextStep({ confidence: 1, clarity: 4, rapport: 4, authenticity: 4 })).not.toContain(
    'always steadier'
  );
  expect(computeNextStep({ confidence: 4, clarity: 4, rapport: 1, authenticity: 4 })).not.toContain(
    'word for word'
  );
});
