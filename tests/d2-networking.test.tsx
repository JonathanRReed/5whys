import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SESSION_KEY as WHY_SESSION_KEY } from '../src/components/career-5whys/shared';
import NetworkingPractice from '../src/components/NetworkingPractice';
import ConversationIngredients from '../src/components/networking/ConversationIngredients';
import IntroDraft from '../src/components/networking/IntroDraft';
import {
  applicationPrompts,
  customizeScenario,
  MORE_SCENARIOS,
  repSeconds,
  repStep,
  repTitle,
  shortWho,
} from '../src/components/networking/practice-model';
import SessionHistory from '../src/components/networking/SessionHistory';
import {
  type Scenario,
  useNetworkingPractice,
} from '../src/components/networking/useNetworkingPractice';
import { SCENARIO_TIMER_SECONDS } from '../src/components/networking/useTimer';
import scenarioData from '../src/data/networking-scenarios.json';
import { saveApplications } from '../src/lib/applications';
import {
  computeNextStep,
  describeShape,
  draftShape,
  NEXT_STEPS,
} from '../src/lib/networking-advice';
import { writeProfile } from '../src/lib/profile';

const presets = scenarioData as Scenario[];
const followup = presets.find((s) => s.id === 'followup-silence') as Scenario;
const low = { confidence: 2, clarity: 4, rapport: 4, authenticity: 4 };
const lowClarity = { confidence: 4, clarity: 2, rapport: 4, authenticity: 4 };

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
});
afterEach(cleanup);

describe('a customized scenario keeps the preset guidance', () => {
  it('keeps the preset flow and adds the visitor’s goal as their ask', () => {
    const custom = customizeScenario(followup, {
      who: 'Dana Whitfield, my VP at Meridian until 2022.',
      where: '',
      what: 'Tell her I was laid off, ask for 20 minutes.',
    });
    expect(custom.what).toEqual([
      ...followup.what,
      'Your ask: Tell her I was laid off, ask for 20 minutes',
    ]);
    expect(custom.customized).toBe(true);
  });

  it('labels only the new lines when the visitor kept some preset steps', () => {
    const custom = customizeScenario(followup, {
      who: '',
      where: '',
      what: `${followup.what[0]}\nAsk for a call next week`,
    });
    expect(custom.what).toEqual([followup.what[0], 'Your ask: Ask for a call next week']);
  });

  it('turns the named person into a plain hint, without a double period', () => {
    const custom = customizeScenario(followup, {
      who: 'Dana Whitfield, my VP until 2022. We have not spoken in two years.',
      where: '',
      what: '',
    });
    expect(custom.prepNote).toContain(
      'Dana Whitfield, my VP until 2022. We have not spoken in two years:'
    );
    expect(custom.prepNote).not.toContain('..');
    expect(custom.rapportSamples).toEqual(followup.rapportSamples);
  });

  it('names a saved rep for the person, not the preset’s fictional situation', () => {
    expect(shortWho('You + Dana Whitfield, my VP')).toBe('Dana Whitfield');
    expect(repTitle(followup, followup.title, 'Dana Whitfield, my VP')).toBe(
      `${followup.title} (Dana Whitfield)`
    );
    expect(repTitle(followup, 'Coffee with Dana', 'Dana')).toBe('Coffee with Dana');
    expect(repTitle(followup, followup.title, followup.who)).toBe(followup.title);
  });

  it('notes on the sample lines that they were written for the preset', () => {
    const custom = customizeScenario(followup, { who: 'Dana', where: '', what: '' });
    render(<ConversationIngredients currentScenario={custom} onCopy={() => {}} copiedKey={null} />);
    expect(
      screen.getByText(/Written for "Following Up After Two Weeks of Silence"/)
    ).toBeInTheDocument();
  });
});

describe('a written message is counted and advised as writing', () => {
  it('counts sentences and questions', () => {
    const shape = draftShape('Hi Marcus. I am a junior in stats. I read your post. Could we talk?');
    expect(shape).toMatchObject({ sentences: 4, questions: 1 });
    expect(describeShape(shape)).toBe('4 sentences, 1 question');
    expect(draftShape('')).toEqual({ sentences: 0, questions: 0, words: 0 });
  });

  it('gives a next step from the message, not from delivery', () => {
    expect(computeNextStep(low)).toBe(NEXT_STEPS.confidence);
    expect(computeNextStep(low, { written: true, draft: 'Hi.' })).not.toContain('pause before');
    expect(
      computeNextStep(lowClarity, { written: true, draft: 'One. Two. Three. Four. Five. Six?' })
    ).toBe('It has 6 sentences. Cut it to the 4 that lead to your ask.');
    expect(computeNextStep(lowClarity, { written: true, draft: 'Hi. I am Sam.' })).toBe(
      'End with one question they can answer in a line or two.'
    );
    expect(computeNextStep(lowClarity, { written: true, draft: 'Hi? Can we talk? When?' })).toBe(
      'It asks 3 questions. Keep the one you most need answered and cut the rest.'
    );
  });

  it('shows the counts in the draft box for a written scenario', () => {
    render(<IntroDraft draft="Hi Marcus. Could we talk?" onDraftChange={() => {}} written />);
    expect(screen.getByText(/2 sentences, 1 question, 5 words/)).toBeInTheDocument();
  });
});

describe('one rep is one flow', () => {
  it('moves through write, say, rate, save', () => {
    expect(repStep({ hasDraft: false, practiced: false, rated: false })).toBe(0);
    expect(repStep({ hasDraft: true, practiced: false, rated: false })).toBe(1);
    expect(repStep({ hasDraft: true, practiced: true, rated: false })).toBe(2);
    expect(repStep({ hasDraft: true, practiced: true, rated: true })).toBe(3);
  });

  it('saves the recording length when the timer was not used', () => {
    expect(repSeconds(0, 41.6)).toBe(42);
    expect(repSeconds(30, 12)).toBe(30);
    expect(repSeconds(0, 4000)).toBe(600);
  });

  it('a recorded rep keeps its length, and the next step stays on the saved rep', () => {
    const { result } = renderHook(() => useNetworkingPractice());
    act(() => result.current.setDraft('Hi, I am Sam, a junior in mechanical engineering.'));
    act(() => result.current.handleRecordingStop(37_000));
    expect(result.current.activeRepStep).toBe(2);
    for (const key of ['confidence', 'clarity', 'rapport', 'authenticity'] as const) {
      act(() => result.current.handleRatingChange(key, key === 'clarity' ? 2 : 4));
    }
    act(() => result.current.saveCurrentSession());
    const saved = result.current.sessions[0];
    expect(saved.attempts[0].durationSeconds).toBe(37);
    render(
      <SessionHistory
        sessions={[saved]}
        onExport={() => {}}
        onClearHistory={() => {}}
        onRemoveSession={() => {}}
      />
    );
    expect(screen.getByText(NEXT_STEPS.clarity)).toBeInTheDocument();
  });

  it('shows the last rep’s fix above the draft after saving', () => {
    render(<NetworkingPractice />);
    fireEvent.change(screen.getByLabelText('Draft'), {
      target: { value: 'Hi, I am Sam. I study stats. What do interns own here?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    fireEvent.click(screen.getByRole('button', { name: /Pause/ }));
    for (const name of ['confidence', 'clarity', 'rapport', 'authenticity']) {
      const radio = document.querySelector(
        `input[name="rating-${name}"][value="3"]`
      ) as HTMLInputElement;
      fireEvent.click(radio);
    }
    fireEvent.change(screen.getByLabelText('One fix for next rep'), {
      target: { value: 'Slow down the opener' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save this rep' }));
    const last = document.querySelector('[data-guide="last-rep"]');
    expect(last).toHaveTextContent('Your fix: Slow down the opener');
    expect(last).toHaveTextContent('Next step:');
  });
});

describe('scenarios for more situations, and for the visitor’s stage', () => {
  it('adds a lab meeting and a reconnecting scenario, each with a timer length', () => {
    const ids = MORE_SCENARIOS.map((s) => s.id);
    expect(ids).toEqual(['lab-meeting', 'reconnect-colleague']);
    for (const scenario of MORE_SCENARIOS) {
      expect(scenario.what).toHaveLength(4);
      expect(SCENARIO_TIMER_SECONDS[scenario.id]).toBeGreaterThan(0);
      expect(presets.some((p) => p.id === scenario.id)).toBe(false);
      expect(JSON.stringify(scenario)).not.toMatch(/—|!/);
    }
    const { result } = renderHook(() => useNetworkingPractice());
    expect(result.current.scenarios.map((s) => s.id)).toContain('lab-meeting');
  });

  it('opens on a work-register scenario for a senior profile, and drops the student-only note', () => {
    writeProfile('senior', 'networking');
    const { result } = renderHook(() => useNetworkingPractice());
    expect(result.current.currentScenario?.id).toBe('reconnect-colleague');
    expect(result.current.studentLike).toBe(false);
    expect(localStorage.getItem('networking-practice-versions')).toBeNull();
    render(
      <ConversationIngredients
        currentScenario={result.current.currentScenario}
        onCopy={() => {}}
        copiedKey={null}
        studentLike={false}
      />
    );
    expect(screen.queryByText(/No achievements to cite/)).not.toBeInTheDocument();
  });

  it('builds prompts from the application in focus, naming only what the visitor typed', () => {
    expect(applicationPrompts(null)).toBeNull();
    const prompts = applicationPrompts({ title: 'Data analyst', company: 'Valley Health' });
    expect(prompts?.line).toBe('I am applying for the data analyst role at Valley Health.');
    expect(prompts?.questions[0].prompt).toBe(
      'What does a good first month look like for a data analyst at Valley Health?'
    );
    saveApplications({
      version: 1,
      activeId: null,
      applications: [
        {
          id: 'a1',
          title: 'Data analyst',
          company: 'Valley Health',
          deadline: null,
          roleId: null,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });
    const { result } = renderHook(() => useNetworkingPractice());
    expect(result.current.questionTemplates[0].prompt).toContain('data analyst at Valley Health');
  });
});

describe('the Five Whys statement can join the intro', () => {
  it('offers a finished reflection and adds it to the end of the draft, never over it', () => {
    localStorage.setItem(
      WHY_SESSION_KEY,
      JSON.stringify({
        track: 'career',
        topic: 'Nursing',
        responses: [
          'I liked the lab days more than anything else this year.',
          'I could see a person get calmer when someone explained things.',
          'The nurse was the only one who told us what the machines meant.',
          'I want to make a scary place less confusing for a family.',
          'I need work where helping someone understand is part of the job.',
        ],
        statement: 'I want work where explaining things is the job.',
      })
    );
    render(<NetworkingPractice />);
    fireEvent.change(screen.getByLabelText('Draft'), { target: { value: 'Hi, I am Sam.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to the end of my draft' }));
    expect(screen.getByLabelText('Draft')).toHaveValue(
      'Hi, I am Sam.\nI want work where explaining things is the job.'
    );
    expect(screen.getByRole('button', { name: 'In your draft' })).toBeDisabled();
  });
});
