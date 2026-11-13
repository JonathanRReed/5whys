import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it } from 'vitest';
import PostingMatch from '../src/components/resume-game/PostingMatch';
import {
  createDefaultDeskData,
  loadApplicationDesks,
  saveApplicationDesks,
  setQualification,
} from '../src/lib/application-desk';
import { saveApplications } from '../src/lib/applications';
import { createDefaultData, type DecodedBullet, saveData } from '../src/lib/glowup-store';

const bullet = (id: string, text: string): DecodedBullet => ({
  id,
  text,
  status: 'active',
  primarySkillId: null,
  secondarySkillIds: [],
  section: 'required',
  confirmed: true,
  origin: 'student',
});

const RESUME = 'Jordan Lee\nEXPERIENCE\n• Built a budget tracker in Excel for the student club.';

beforeEach(() => {
  localStorage.clear();
  saveData({
    ...createDefaultData(),
    roles: [
      {
        id: 'role-1',
        jobTitle: 'Office Assistant',
        company: 'Lakeshore',
        rawJdText: '',
        bullets: [
          bullet('r-age', "Must be at least 18 and have a valid driver's license"),
          bullet('r-citizen', 'U.S. citizenship required due to federal contract'),
          bullet('r-excel', 'Experience with Excel'),
          bullet('r-sql', 'Experience with SQL'),
        ],
        createdAt: 1,
        updatedAt: 1,
      },
    ],
  });
  saveApplications({
    version: 1,
    activeId: 'app-1',
    applications: [
      {
        id: 'app-1',
        title: 'Office Assistant',
        company: 'Lakeshore',
        deadline: null,
        roleId: 'role-1',
        createdAt: 1,
        updatedAt: 1,
      },
    ],
  });
});

it('lists conditions of the job apart and leaves them out of N of M (student F2)', async () => {
  render(<PostingMatch resumeText={RESUME} />);
  const summary = await screen.findByTestId('match-summary');
  expect(summary.textContent).toBe('1 of 2 confirmed requirements has evidence in your resume.');
  const conditions = screen.getByTestId('match-conditions');
  expect(conditions.textContent).toContain('U.S. citizenship required');
  expect(conditions.textContent).toContain("valid driver's license");
  expect(conditions.textContent).not.toContain('write a bullet');
  const writeLinks = screen.getAllByText('I have this: write a bullet');
  expect(writeLinks).toHaveLength(1);
  expect(writeLinks[0].closest('a')?.getAttribute('href')).toContain('requirement=r-sql');
});

it('never overwrites a "Have it" mark from the desk with Not yet (student F9)', async () => {
  saveApplicationDesks(
    setQualification(createDefaultDeskData(), 'app-1', 'r-sql', { status: 'have' })
  );
  render(<PostingMatch resumeText={RESUME} />);
  await screen.findByTestId('match-summary');
  expect(screen.queryByRole('button', { name: 'Not yet' })).toBeNull();
  expect(screen.getByText('Marked have it on the desk.')).toBeInTheDocument();
  const row = loadApplicationDesks().desks['app-1']?.qualifications.find(
    (q) => q.requirementId === 'r-sql'
  );
  expect(row?.status).toBe('have');
});

it('fills an unset row with Not yet on one tap', async () => {
  render(<PostingMatch resumeText={RESUME} />);
  await screen.findByTestId('match-summary');
  fireEvent.click(screen.getByRole('button', { name: 'Not yet' }));
  const row = loadApplicationDesks().desks['app-1']?.qualifications.find(
    (q) => q.requirementId === 'r-sql'
  );
  expect(row?.status).toBe('not-yet');
});
