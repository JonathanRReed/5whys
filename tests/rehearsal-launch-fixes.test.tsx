import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RehearsalRoom, { workAuthorizationLine } from '../src/components/rehearsal/RehearsalRoom';
import TakeReview, { type Take } from '../src/components/rehearsal/TakeReview';
import {
  getGeneralQuestions,
  getQuestionById,
  planRehearsal,
  TERMS_QUESTION_IDS,
} from '../src/lib/glowup-banks';
import type { DecodedRole, GlowUpData } from '../src/lib/glowup-store';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

const recorded = (extra: Partial<Take> = {}): Take => ({
  question: 'Tell me about yourself.',
  audio: {
    blob: new Blob(['x'], { type: 'audio/webm' }),
    durationMs: 4600,
    mimeType: 'audio/webm',
  },
  text: '',
  segments: [],
  durationSeconds: 4.6,
  ...extra,
});

function review(take: Take) {
  if (!URL.createObjectURL) {
    Object.assign(URL, { createObjectURL: () => 'blob:take', revokeObjectURL: () => {} });
  }
  return render(
    <TakeReview
      take={take}
      transcribing={false}
      canTranscribe={false}
      onTextChange={vi.fn()}
      onKeep={null}
      kept={false}
      onRetry={vi.fn()}
      onNext={vi.fn()}
      isLast={false}
      countDelivery
      onCountDeliveryChange={vi.fn()}
    />
  );
}

describe('review counts', () => {
  it('says a recording with no transcript needs one, instead of "0 words"', async () => {
    review(recorded());
    expect(await screen.findByTestId('take-words')).toHaveTextContent('Needs a transcript');
    expect(screen.getByTestId('take-pace')).toHaveTextContent('Needs a transcript');
  });

  it('shows the length the way the audio player does, in whole seconds', () => {
    review(recorded());
    expect(screen.getByTestId('take-length')).toHaveTextContent('0:04');
  });

  it('counts pace from the words typed for a recording, and says so', async () => {
    const words = Array.from({ length: 30 }, (_, i) => `word${i}`).join(' ');
    review(
      recorded({
        text: words,
        durationSeconds: 12,
        audio: {
          blob: new Blob(['x'], { type: 'audio/webm' }),
          durationMs: 12000,
          mimeType: 'audio/webm',
        },
      })
    );
    await waitFor(() =>
      expect(screen.getByTestId('take-pace')).toHaveTextContent('150 words a minute')
    );
    expect(screen.getByTestId('take-pace')).toHaveTextContent('From what you typed');
    expect(screen.getByTestId('take-words')).toHaveTextContent('30');
  });
});

describe('questions about the terms of a job', () => {
  it('asks about sponsorship only with a work-authorization line, and says only what it should', () => {
    const base = { audience: 'student' as const, fromPosting: [], postingSkillIds: [] };
    const question = getQuestionById('q-work-authorization');
    const plain = planRehearsal(base).map((q) => q.questionId);
    expect(plain).not.toContain('q-work-authorization');
    const line = 'Must be authorized to work in the United States without sponsorship.';
    const withLine = planRehearsal({ ...base, workAuthorizationLine: line });
    const asked = withLine.find((q) => q.questionId === 'q-work-authorization');
    expect(asked?.requirement).toBe(line);
    // Truthful and brief, ask the international student office, then back to fit.
    const notes = `${question?.strongAnswer} ${question?.commonMistake}`;
    expect(notes).toMatch(/truthful/i);
    expect(notes).toMatch(/brief/i);
    expect(notes).toMatch(/international student office/);
    expect(notes).toMatch(/why you fit the role/);
    expect(notes).not.toMatch(
      /\b(?:CPT|OPT|F-1|H-1B|you can work|you are allowed|you may work)\b/i
    );
  });

  it('adds the salary question only when the visitor asks for it', () => {
    const base = { audience: 'student' as const, fromPosting: [], postingSkillIds: [] };
    expect(planRehearsal(base).map((q) => q.questionId)).not.toContain('q-salary-expectations');
    const plan = planRehearsal({ ...base, extras: ['q-salary-expectations'] });
    expect(plan.map((q) => q.questionId)).toContain('q-salary-expectations');
    // The close stays last.
    expect(plan.at(-1)?.questionId).toBe('q-why-role');
    for (const id of TERMS_QUESTION_IDS) {
      expect(getQuestionById(id)?.strongAnswer.length).toBeGreaterThan(10);
      expect(getQuestionById(id)?.commonMistake.length).toBeGreaterThan(10);
    }
  });

  it('keeps terms questions out of the story question lists', () => {
    const general = getGeneralQuestions().map((q) => q.id);
    for (const id of TERMS_QUESTION_IDS) expect(general).not.toContain(id);
  });

  it('finds the work-authorization line in a posting', () => {
    const role = {
      id: 'r',
      jobTitle: 'Intern',
      company: '',
      rawJdText: 'Intern\nHelp at events.\nApplicants must be authorized to work in the U.S.',
      bullets: [],
      createdAt: 1,
      updatedAt: 1,
    } as DecodedRole;
    expect(workAuthorizationLine(role)).toBe('Applicants must be authorized to work in the U.S.');
    expect(workAuthorizationLine({ ...role, rawJdText: 'Intern\nHelp at events.' })).toBeNull();
  });
});

describe('the room', () => {
  it('lets the visitor skip a question, and offers "Hear it again" only after reading aloud', async () => {
    const data: GlowUpData = {
      version: 1,
      roles: [],
      stories: [],
      packets: [],
      currentRoleId: null,
      currentPacketId: null,
    };
    localStorage.setItem('interview-glow-up-data', JSON.stringify(data));
    render(<RehearsalRoom />);
    fireEvent.click(await screen.findByRole('button', { name: 'Start with the first question' }));
    const first = await screen.findByTestId('rehearsal-question');
    expect(first).toHaveTextContent('Tell me about yourself.');
    expect(screen.queryByRole('button', { name: 'Hear it again' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Skip to the next question' }));
    await waitFor(() =>
      expect(screen.getByTestId('rehearsal-question')).not.toHaveTextContent(
        'Tell me about yourself.'
      )
    );
    expect(screen.getByText(/Question 2 of/)).toBeInTheDocument();
  });

  it('offers the terms questions on the setup screen', async () => {
    render(<RehearsalRoom />);
    const salary = await screen.findByRole('checkbox', {
      name: 'What are your salary expectations?',
    });
    fireEvent.click(salary);
    expect(salary).toBeChecked();
    expect(
      screen.getByRole('checkbox', {
        name: 'Will you now or in the future require sponsorship to work in this role?',
      })
    ).not.toBeChecked();
  });
});
