import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import BulletEditor from '../src/components/resume-game/BulletEditor';
import { createBulletRecord, detectResumeStructure } from '../src/lib/resume-game';

afterEach(cleanup);

it('does not claim a qualitative achievement contains a number', () => {
  render(
    <BulletEditor
      bullet={createBulletRecord('Designed a workshop syllabus adopted by the volunteer teaching team.', 0)}
      onFieldChange={() => {}}
    />
  );
  expect(screen.queryByText(/a number, and an outcome/)).not.toBeInTheDocument();
  expect(screen.getByText(/No writing flags/)).toBeVisible();
});

it('recognizes a heading on the first line rather than calling it contact information', () => {
  const parsed = detectResumeStructure('EXPERIENCE\n• Built a reporting workflow');
  expect(parsed.skipped.heading).toBe(1);
  expect(parsed.skipped.contact).toBe(0);
});
