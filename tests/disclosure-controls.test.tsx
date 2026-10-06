import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import WhyForm from '../src/components/career-5whys/WhyForm';
import InterviewHUD from '../src/components/interview-glow-up/InterviewHUD';
import ScanResults from '../src/components/resume-game/ScanResults';
import type { InterviewPacket, Story } from '../src/lib/glowup-store';
import { EMPTY_SIGNAL_REPORT } from '../src/lib/resume-game';

afterEach(cleanup);

function controlledPanel(button: HTMLElement) {
  const id = button.getAttribute('aria-controls');
  expect(id).toBeTruthy();
  expect(id).not.toMatch(/\s/);
  const panel = document.getElementById(id ?? '');
  expect(panel).toBeInTheDocument();
  return panel as HTMLElement;
}

const example = { persona: 'Student', topic: 'Career', answers: ['Example one', 'Example two'] };
const whyProps = {
  responses: ['', ''],
  sequentialCount: 0,
  prompts: ['First prompt', 'Second prompt'],
  example,
  onResponseChange: () => {},
  onToggleExample: () => {},
};

it('keeps worked-example targets hidden, expanded, and collapsed with stable relationships', () => {
  const view = render(<WhyForm {...whyProps} exampleOpen={{}} />);
  const buttons = screen.getAllByRole('button', { name: /worked example/i });
  const panels = buttons.map(controlledPanel);
  for (const [index, button] of buttons.entries()) {
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(panels[index]).not.toBeVisible();
  }
  view.rerender(<WhyForm {...whyProps} exampleOpen={{ 0: true }} />);
  expect(buttons[0]).toHaveAttribute('aria-expanded', 'true');
  expect(controlledPanel(buttons[0])).toBe(panels[0]);
  expect(panels[0]).toBeVisible();
  expect(panels[0]).toHaveTextContent('Example one');
  view.rerender(<WhyForm {...whyProps} exampleOpen={{ 0: false }} />);
  expect(controlledPanel(buttons[0])).toBe(panels[0]);
  expect(panels[0]).not.toBeVisible();
});

it('uses distinct worked-example targets across form instances and depths', () => {
  render(
    <>
      <WhyForm {...whyProps} exampleOpen={{ 0: true, 1: true }} />
      <WhyForm {...whyProps} exampleOpen={{ 0: true, 1: true }} />
    </>
  );
  const buttons = screen.getAllByRole('button', { name: /worked example/i });
  expect(new Set(buttons.map((button) => controlledPanel(button).id)).size).toBe(4);
});

const scanProps = {
  resumeText: '',
  signalReport: { ...EMPTY_SIGNAL_REPORT, benchmarkScore: 0 },
  resumeOutOfDate: false,
};

it('keeps deep-analysis targets valid through repeated toggles and distinct across instances', () => {
  render(
    <>
      <ScanResults {...scanProps} />
      <ScanResults {...scanProps} />
    </>
  );
  const buttons = screen.getAllByRole('button', { name: /Deep Analysis/ });
  const panels = buttons.map(controlledPanel);
  expect(panels[0].id).not.toBe(panels[1].id);
  for (const button of buttons) {
    const panel = controlledPanel(button);
    expect(panel).not.toBeVisible();
    for (let cycle = 0; cycle < 2; cycle++) {
      fireEvent.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'true');
      expect(controlledPanel(button)).toBe(panel);
      expect(panel).toBeVisible();
      fireEvent.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(controlledPanel(button)).toBe(panel);
      expect(panel).not.toBeVisible();
    }
  }
});

function story(id: string, trigger: string): Story {
  return {
    id,
    trigger,
    primarySkillId: 'communication',
    otherSkillIds: [],
    hook: 'What happened',
    proofSnippet: 'The outcome',
    play: 'The action',
    proof: 'The evidence',
    confidence: 60,
    readiness: 'solid',
    questionPrompts: [],
    tags: [],
    createdAt: 1,
    updatedAt: 1,
  };
}

it('keeps HUD story targets valid for imported IDs, switching stories, and collapse', () => {
  const stories = [story('imported story\tid', 'First story'), story('second-id', 'Second story')];
  const packet: InterviewPacket = {
    id: 'packet',
    roleId: 'role',
    mode: 'hud',
    topStoryIds: stories.map((item) => item.id),
    customQuestions: [],
    notes: '',
    createdAt: 1,
    updatedAt: 1,
  };
  const hudProps = { packet, stories, role: undefined, onClose: () => {} };
  render(<InterviewHUD {...hudProps} />);
  const buttons = stories.map((item) =>
    screen.getByRole('button', { name: new RegExp(item.trigger) })
  );
  const panels = buttons.map(controlledPanel);
  expect(panels[0].id).not.toBe(panels[1].id);
  panels.forEach((panel) => {
    expect(panel).not.toBeVisible();
  });
  fireEvent.click(buttons[0]);
  expect(buttons[0]).toHaveAttribute('aria-expanded', 'true');
  expect(controlledPanel(buttons[0])).toBe(panels[0]);
  expect(panels[0]).toBeVisible();
  fireEvent.click(buttons[1]);
  expect(buttons[0]).toHaveAttribute('aria-expanded', 'false');
  expect(controlledPanel(buttons[0])).toBe(panels[0]);
  expect(panels[0]).not.toBeVisible();
  expect(panels[1]).toBeVisible();
  fireEvent.click(buttons[1]);
  expect(buttons[1]).toHaveAttribute('aria-expanded', 'false');
  expect(controlledPanel(buttons[1])).toBe(panels[1]);
  expect(panels[1]).not.toBeVisible();
});
