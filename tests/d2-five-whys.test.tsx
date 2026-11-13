import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Career5Whys from '../src/components/Career5Whys';
import {
  addPhrase,
  answerPhrases,
  hasPhrase,
  outcomeText,
  readReflectionForReuse,
  removePhrase,
} from '../src/components/career-5whys/outcome';
import type { WhyOutcome as Outcome } from '../src/components/career-5whys/shared';
import {
  buildPrompts,
  computeSynthesis,
  firstSentence,
  HISTORY_KEY,
  isRoleTitle,
  midSentence,
  normalizeSnapshot,
  quotableAnswer,
  SESSION_KEY,
  suggestNextStep,
  TRACKS,
  topicOptions,
} from '../src/components/career-5whys/shared';
import WhyForm from '../src/components/career-5whys/WhyForm';
import WhyOutcome from '../src/components/career-5whys/WhyOutcome';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

const LONG =
  'I want a job that pays enough for rent and still lets me take classes at night and see my family.';

const FIVE = [
  'I liked the lab days more than anything else in my classes this year.',
  'On the floor I could see a person get calmer because someone explained what was happening.',
  'When my brother was in the hospital, the nurse was the only one who told us what the machines meant.',
  'I want to be the person who makes a scary place less confusing for a family.',
  'I need work where helping someone understand is part of the job, not extra.',
];

describe('Five Whys questions stay specific', () => {
  it('asks a specific Career Path question at every depth, even when the answer is too long to quote', () => {
    const prompts = buildPrompts('career', 'Nursing', [LONG, LONG, LONG, LONG, '']);
    expect(prompts[1]).toBe(
      'Why does that first reason matter to you? Say what it gives you that other work would not.'
    );
    expect(prompts[2]).toMatch(/moment, the person, or the need/);
    expect(prompts[3]).toMatch(/paid less or had a smaller title/);
    expect(prompts[4]).toMatch(/check for in any job/);
    for (const prompt of prompts) {
      expect(prompt).not.toMatch(/^And why does that matter\? What sits underneath it\?$/);
    }
  });

  it('names the topic in lowercase mid-sentence, but keeps acronyms', () => {
    expect(buildPrompts('career', 'Operations analyst', [])[0]).toContain(
      'toward operations analyst right now'
    );
    expect(midSentence('UX designer')).toBe('UX designer');
    expect(midSentence('Nursing')).toBe('nursing');
  });

  it('starts from an experience and quotes it as written', () => {
    const prompts = buildPrompts('experience', 'Closing the bakery on Saturdays', [
      'I count the drawer and pack the leftovers',
    ]);
    expect(prompts[0]).toBe(
      'Tell the story of "Closing the bakery on Saturdays". What did you do, in a sentence or two?'
    );
    expect(prompts[1]).toContain('"I count the drawer and pack the leftovers"');
  });
});

describe('the test step reads well and covers every option', () => {
  it('writes the step for each side of an either/or topic', () => {
    const step = suggestNextStep(
      'career',
      'Research technician or pharmacy',
      'I want to help patients.'
    );
    expect(step).toBe(
      'Book 30 minutes with one person who works as a research technician and one who works in pharmacy this week. Ask each what their week actually looks like, then check which answer your root reason survives.'
    );
    expect(step).not.toContain('doing Research technician or pharmacy');
  });

  it('uses an article and lowercase for a role, and "in" for a field', () => {
    expect(
      suggestNextStep('career', 'Operations analyst or project coordinator', 'It pays well.')
    ).toBe(
      'Talk to one person who works as an operations analyst and one who works as a project coordinator. Trade your five whys for theirs and see whose roots match yours.'
    );
    expect(suggestNextStep('career', 'Accountant', 'It pays well.')).toContain('as an accountant');
    expect(suggestNextStep('career', 'UX designer', 'It pays well.')).toContain('as a UX designer');
  });

  it('splits only on or, vs and versus', () => {
    expect(topicOptions('biology or chemistry')).toEqual(['biology', 'chemistry']);
    expect(topicOptions('nursing, teaching, or law')).toEqual(['nursing', 'teaching', 'law']);
    expect(topicOptions('research and development')).toEqual(['research and development']);
    expect(topicOptions('UX/UI designer')).toEqual(['UX/UI designer']);
  });

  it('tells a job title from a field', () => {
    expect(isRoleTitle('research technician')).toBe(true);
    expect(isRoleTitle('pharmacy tech')).toBe(true);
    expect(isRoleTitle('pharmacy')).toBe(false);
    expect(isRoleTitle('government')).toBe(false);
    expect(isRoleTitle('tech')).toBe(false);
  });

  it('gives an interest topic with two options a test for each', () => {
    expect(suggestNextStep('interest', 'biology or chemistry', 'I enjoy mentoring kids.')).toBe(
      'Find one person who turned biology into work and one who turned chemistry into work. Ask each one question: which part survived becoming a job?'
    );
  });
});

describe('a chain written in Chinese advances', () => {
  it('completes the chain and quotes and condenses without spaces', () => {
    const answers = [
      '我喜歡用數據幫助醫院的病人。',
      '因為數據可以讓醫生更快做決定。',
      '我的奶奶在醫院等了很久才看到醫生。',
      '我想讓別人不用像她那樣等待。',
      '我需要一份能讓別人的生活變得更容易的工作。',
    ];
    const synthesis = computeSynthesis(answers, '資料分析師', 'career');
    expect(synthesis.isComplete).toBe(true);
    expect(firstSentence(answers[4])).toBe('我需要一份能讓別人的生活變得更容易的工作。');
    expect(quotableAnswer(answers[0])).toBe('我喜歡用數據幫助醫院的病人');
  });

  it('marks a Chinese answer answered for the guide, and opens the next depth', () => {
    const props = {
      sequentialCount: 1,
      prompts: buildPrompts('career', '資料分析師', []),
      example: TRACKS.career.example,
      exampleOpen: {},
      onResponseChange: () => {},
      onToggleExample: () => {},
    };
    render(<WhyForm {...props} responses={['我喜歡用數據幫助醫院的病人', '', '', '', '']} />);
    expect(screen.getByLabelText('Depth 1 response')).toHaveAttribute('data-answered');
    expect(screen.getByLabelText('Depth 2 response')).not.toBeDisabled();
    expect(screen.getByText('Answered')).toBeInTheDocument();
  });
});

describe('the statement is built from the visitor’s own phrases', () => {
  it('cuts an answer into phrases at sentences, commas and "because"', () => {
    expect(
      answerPhrases('I like the floor, because I can see people get calmer. That is it.')
    ).toEqual(['I like the floor', 'I can see people get calmer', 'That is it']);
  });

  it('adds and takes back a phrase without leaving stray commas', () => {
    let statement = addPhrase('', 'I like the floor');
    statement = addPhrase(statement, 'I can see people get calmer');
    expect(statement).toBe('I like the floor, I can see people get calmer');
    expect(hasPhrase(statement, 'I like the floor')).toBe(true);
    expect(removePhrase(statement, 'I like the floor')).toBe('I can see people get calmer');
    expect(removePhrase(statement, 'I can see people get calmer')).toBe('I like the floor');
  });

  it('writes nothing the visitor did not write when copied', () => {
    expect(
      outcomeText({ statement: 'Helping people understand', mustOffer: 'time with patients' }, '')
    ).toBe('Helping people understand\nA role must offer: time with patients');
    expect(outcomeText({}, 'My root.')).toBe('My root.');
  });

  it('builds the statement by pressing phrases, and the lists are typed', () => {
    function Harness() {
      const [outcome, setOutcome] = React.useState<Outcome>({});
      return (
        <WhyOutcome
          answers={FIVE}
          root="I need work where helping someone understand is part of the job, not extra."
          outcome={outcome}
          fromExperience={false}
          onChange={(field, value) => setOutcome((prev) => ({ ...prev, [field]: value }))}
        />
      );
    }
    render(<Harness />);
    const phrase = screen.getByRole('button', { name: /I liked the lab days/ });
    fireEvent.click(phrase);
    expect(screen.getByLabelText('Your statement')).toHaveValue(
      'I liked the lab days more than anything else in my classes this year'
    );
    expect(phrase).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(phrase);
    expect(screen.getByLabelText('Your statement')).toHaveValue('');
    fireEvent.change(screen.getByLabelText('A role must offer'), {
      target: { value: 'time with patients' },
    });
    expect(screen.getByLabelText('A role must offer')).toHaveValue('time with patients');
    expect(screen.getByRole('link', { name: 'Put it in a networking intro' })).toHaveAttribute(
      'href',
      '/networking-practice/'
    );
  });
});

describe('the page stores the start, the statement and the lists', () => {
  it('saves the experience start and the outcome with a snapshot, and restores them', () => {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        id: 's1',
        track: 'interest',
        start: 'experience',
        topic: 'Closing the bakery',
        responses: FIVE,
        statement: 'Setting things up so others do well',
        mustOffer: 'a team to set up',
        updatedAt: new Date().toISOString(),
      })
    );
    render(<Career5Whys showHeader={false} showFooter={false} />);
    expect(screen.getByRole('button', { name: /Start from an experience/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByLabelText('Your statement')).toHaveValue(
      'Setting things up so others do well'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save snapshot' }));
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
    expect(saved[0]).toMatchObject({
      track: 'interest',
      start: 'experience',
      statement: 'Setting things up so others do well',
      mustOffer: 'a team to set up',
    });
    expect(normalizeSnapshot(saved[0])?.start).toBe('experience');
  });

  it('switches to an experience start and back without losing answers', () => {
    render(<Career5Whys showHeader={false} showFooter={false} />);
    fireEvent.change(screen.getByLabelText('Target role / path'), {
      target: { value: 'Nursing' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Start from an experience/ }));
    let stored = JSON.parse(localStorage.getItem(SESSION_KEY) ?? '{}');
    expect(stored).toMatchObject({ track: 'interest', start: 'experience', topic: 'Nursing' });
    fireEvent.click(screen.getByRole('button', { name: /Career Path/ }));
    stored = JSON.parse(localStorage.getItem(SESSION_KEY) ?? '{}');
    expect(stored.track).toBe('career');
    expect(stored.start).toBeUndefined();
  });
});

describe('another tool can offer the finished reflection back', () => {
  it('reads the finished session first, then the newest snapshot, and never writes', () => {
    expect(readReflectionForReuse()).toBeNull();
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([
        {
          id: 'h',
          timestamp: '2026-11-01T00:00:00Z',
          track: 'career',
          topic: 'Nursing',
          responses: FIVE,
        },
      ])
    );
    expect(readReflectionForReuse()?.statement).toBe(
      'I need work where helping someone understand is part of the job, not extra.'
    );
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ track: 'career', topic: 'Nursing', responses: FIVE, statement: 'Mine' })
    );
    const before = JSON.stringify({ ...localStorage });
    expect(readReflectionForReuse()?.statement).toBe('Mine');
    expect(JSON.stringify({ ...localStorage })).toBe(before);
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ track: 'career', topic: 'Nursing', responses: ['only one answer here'] })
    );
    // An unfinished session falls back to the saved snapshot.
    expect(readReflectionForReuse()?.topic).toBe('Nursing');
  });
});
