import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import BulletEditor from '../src/components/resume-game/BulletEditor';
import { createBulletRecord, detectResumeStructure } from '../src/lib/resume-game';

afterEach(cleanup);

it('does not claim a qualitative achievement contains a number', () => {
  render(
    <BulletEditor
      bullet={createBulletRecord(
        'Designed a workshop syllabus adopted by the volunteer teaching team.',
        0
      )}
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

it('renders a quick-fill button when a number is detected in a bullet and populates quantifier on click', () => {
  const onFieldChange = vi.fn();
  const bullet = createBulletRecord('Managed a $50,000 budget for campus events.', 0);
  bullet.fields.quantifier = '';
  render(<BulletEditor bullet={bullet} onFieldChange={onFieldChange} />);

  const fillBtn = screen.getByRole('button', { name: 'Use $50,000 as quantifier' });
  expect(fillBtn).toBeVisible();

  fireEvent.click(fillBtn);
  expect(onFieldChange).toHaveBeenCalledWith(bullet.id, 'quantifier', '$50,000');
});
