import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import ScanResults from '../src/components/resume-game/ScanResults';
import { buildDeepSignalReport, createBulletRecord } from '../src/lib/resume-game';

afterEach(cleanup);

function showReview(lines: string[]) {
  const bullets = lines.map((line, index) => createBulletRecord(line, index));
  const resumeText = lines.join('\n');
  return render(
    <ScanResults
      bullets={bullets}
      resumeText={resumeText}
      signalReport={buildDeepSignalReport(bullets, resumeText)}
      resumeOutOfDate={false}
    />
  );
}

it('presents a limited writing review rather than a resume letter grade', () => {
  showReview(['Built an accessible workshop guide for student volunteers.']);
  expect(screen.queryByText('Grade:')).not.toBeInTheDocument();
  expect(screen.getByText(/not a hiring prediction/i)).toBeVisible();
});

it('does not ask for more numbers when every reviewed bullet has a measure', () => {
  showReview([
    'Automated grant reporting in Excel to save the lab 6 hours per week.',
    'Led workshops for 20 students to improve research skills.',
  ]);
  expect(screen.queryByText(/Add 2-3 more quantified metrics/)).not.toBeInTheDocument();
});

it('does not equate an unrecognized skills dictionary with missing qualifications', () => {
  showReview(['Designed a workshop syllabus adopted by the volunteer teaching team.']);
  expect(screen.queryByText(/Add more hard skills/)).not.toBeInTheDocument();
  expect(screen.getByText(/may miss skills/i)).toBeVisible();
});

it('limits next steps to three and ties them to the reviewed text', () => {
  const lines = [
    'Helped with team events',
    'Responsible for club work',
    'Worked on reports',
    'Helped with meetings',
  ];
  showReview(lines);
  const nextSteps = screen.getByRole('region', { name: 'Your next steps' });
  expect(within(nextSteps).getAllByRole('listitem')).toHaveLength(3);
  expect(within(nextSteps).getByText(lines[0])).toBeVisible();
});

it('does not invent a weakness when the reviewed bullet meets the checklist', () => {
  showReview(['Automated weekly grant reporting in Excel to save the lab 6 hours per week.']);
  expect(screen.getByText(/No obvious writing flags/)).toBeVisible();
});
