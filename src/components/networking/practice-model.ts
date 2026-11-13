/**
 * Pure rules for one networking rep: how a customized scenario keeps the
 * preset's guidance, what a saved rep is called, which step of the rep the
 * visitor is on, and prompts built from the application in focus. No
 * storage, no React, so each rule can be tested on its own.
 */
import { midSentence } from '../career-5whys/shared';
import type { Scenario } from './useNetworkingPractice';

/**
 * Two situations the first twelve did not cover: a lab or research group
 * meeting, and writing to a former colleague after a long gap. Every line is
 * spoken by a fictional person and written literally, without idioms.
 */
export const MORE_SCENARIOS: Scenario[] = [
  {
    id: 'lab-meeting',
    title: 'Lab or Research Group Meeting',
    mode: 'Research group',
    focus: 'Your project in one breath',
    audience: 'student',
    who: 'You (new to the lab) + the PI, two postdocs, and a lab technician',
    where: 'Weekly lab meeting, going around the table, about thirty seconds each',
    what: [
      'Your name and how you came to this lab',
      'The project or task you are on, in plain words',
      'One thing you are stuck on or about to try',
      'Who you would like to learn one method from',
    ],
    ingredients: [
      {
        id: 'opener',
        label: 'Opener',
        line: 'Hi, I am Jordan. I joined this week as an undergraduate researcher.',
      },
      {
        id: 'identity',
        label: 'Your project',
        line: 'I am helping with the cell counts for the drug response study, starting with the plates from last month.',
      },
      {
        id: 'value',
        label: 'Where you are',
        line: 'This week I am learning the imaging software. I can run it, but I am still slow at choosing the exposure.',
      },
      {
        id: 'value-honest',
        label: 'No results yet, say this',
        line: 'I do not have results yet. I read the two papers the group sent me, and I would like to see how the counts are checked before I start.',
      },
    ],
    rapportSamples: [
      'Can I ask what you are running this week? I am trying to learn how the projects fit together.',
      'Your update on the imaging helped me. Could I watch the next time you set it up?',
      'I am still learning everyone’s projects. Who should I ask about the protocols?',
    ],
    questionTemplates: [
      {
        id: 'method',
        label: 'Method',
        prompt: 'Who here could show me how the counts are checked?',
      },
      {
        id: 'reading',
        label: 'Reading',
        prompt: 'Is there one paper the whole group treats as the starting point?',
      },
      {
        id: 'first-month',
        label: 'First month',
        prompt:
          'What would you like a new person to be able to do by the end of their first month?',
      },
    ],
  },
  {
    id: 'reconnect-colleague',
    title: 'Reconnecting with a Former Colleague',
    mode: 'Written outreach',
    focus: 'Name the shared work, then the ask',
    audience: 'transition',
    who: 'You + Dana (your manager two jobs ago; you have not spoken in two years)',
    where: 'A short message by email or LinkedIn, after a long gap',
    what: [
      'Name the work you shared, in one sentence',
      'Say plainly what changed for you',
      'One specific ask, small enough to say yes to',
      'Make it easy to say no',
    ],
    ingredients: [
      {
        id: 'opener',
        label: 'Shared work',
        line: 'Hi Dana, it has been a while. I still use the weekly planning sheet we built for the warehouse team.',
      },
      {
        id: 'identity',
        label: 'What changed',
        line: 'My role was cut last month, and I am looking at operations roles in logistics.',
      },
      {
        id: 'value',
        label: 'The ask',
        line: 'Would you have twenty minutes in the next two weeks to tell me which companies you see hiring for operations leads?',
      },
      {
        id: 'value-honest',
        label: 'Easy to say no',
        line: 'If this is a busy time, there is no need to reply. I would still like to hear how you are.',
      },
    ],
    rapportSamples: [
      'I saw that the new site opened. Congratulations, I know that was a long project.',
      'I still run my Monday reviews the way you ran ours.',
      'There is no rush to reply. I know how full your weeks are.',
    ],
    questionTemplates: [
      {
        id: 'market',
        label: 'Who is hiring',
        prompt: 'Which teams near you are hiring for this kind of role now?',
      },
      {
        id: 'intro',
        label: 'Introduction',
        prompt:
          'Is there one person I should talk to, and would you be comfortable introducing us?',
      },
      {
        id: 'read',
        label: 'Honest read',
        prompt: 'From what you saw of my work on our team, which role would you see me in now?',
      },
    ],
  },
];

/** A written scenario is read on a screen, not heard. */
export function isWritten(scenario: Pick<Scenario, 'mode'> | undefined): boolean {
  return scenario?.mode === 'Written outreach';
}

/** The fields of a saved intro that can change a scenario. */
export type ScenarioEdits = { who: string; where: string; what: string };

export type CustomizedScenario = Scenario & {
  /** True when the visitor changed who, where, or what. */
  customized: boolean;
  /** A plain hint about the person the visitor named. Not a line to copy. */
  prepNote: string | null;
  /** The preset the sample lines were written for. */
  presetTitle: string;
};

/** "Dana Whitfield, my VP until 2022." → "Dana Whitfield, my VP until 2022" */
function withoutEndPunctuation(text: string): string {
  return text.trim().replace(/[\s.。]+$/u, '');
}

/**
 * The scenario as the visitor customized it. Their who, where and ask
 * replace the preset's, but the preset's opening flow stays: a line they
 * added becomes "Your ask: ..." after the preset steps they kept, or after
 * all of them when they kept none. The person they named becomes a plain
 * hint, never a copyable line.
 */
export function customizeScenario(preset: Scenario, edits: ScenarioEdits): CustomizedScenario {
  const who = edits.who.trim() || preset.who;
  const where = edits.where.trim() || preset.where;
  const lines = edits.what
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const presetSteps = new Set(preset.what);
  const added = lines.filter((line) => !presetSteps.has(line));
  const kept = lines.filter((line) => presetSteps.has(line));
  const asAsk = (line: string) => `Your ask: ${withoutEndPunctuation(line)}`;
  const what =
    lines.length === 0
      ? preset.what
      : kept.length === 0
        ? [...preset.what, ...added.map(asAsk)]
        : lines.map((line) => (presetSteps.has(line) ? line : asAsk(line)));
  const changedAudience = who !== preset.who;
  const changedGoal = what.join('\n') !== preset.what.join('\n');
  return {
    ...preset,
    who,
    where,
    what,
    customized: changedAudience || changedGoal || where !== preset.where,
    prepNote: changedAudience
      ? `Before you reach out to ${withoutEndPunctuation(who)}: choose one real detail about their work that connects to your reason for writing or speaking.`
      : null,
    presetTitle: preset.title,
    questionTemplates: added.length
      ? [
          {
            id: 'custom-goal',
            label: 'Your planned ask',
            prompt: added.map(withoutEndPunctuation).join('\n'),
          },
          ...preset.questionTemplates,
        ]
      : preset.questionTemplates,
  };
}

/** "You + Dana Whitfield, my VP at Meridian" → "Dana Whitfield". */
export function shortWho(who: string): string {
  const person = who
    .replace(/^you\s*(?:\([^)]*\))?\s*\+\s*/i, '')
    .split(/[,(;]/)[0]
    .trim();
  const letters = Array.from(person);
  return letters.length > 40 ? `${letters.slice(0, 40).join('').trim()}…` : person;
}

/**
 * What a saved rep is called: the name the visitor gave the intro, or the
 * preset's title with the person they named, so a rep for Dana does not read
 * as the preset's fictional situation.
 */
export function repTitle(preset: Scenario, versionTitle: string, who: string): string {
  const title = versionTitle.trim();
  if (title && !title.startsWith(preset.title)) return title;
  if (who.trim() && who.trim() !== preset.who) {
    const person = shortWho(who);
    if (person) return `${preset.title} (${person})`;
  }
  return preset.title;
}

/** The four parts of one rep, in order. */
export const REP_STEPS = ['Write it', 'Say it', 'Rate it', 'Save it'] as const;

/**
 * Where the visitor is in this rep: 0 before a draft, 1 before any practice
 * (timer or recording), 2 before all four ratings, 3 when it can be saved.
 */
export function repStep(state: { hasDraft: boolean; practiced: boolean; rated: boolean }): number {
  if (!state.hasDraft) return 0;
  if (!state.practiced) return 1;
  if (!state.rated) return 2;
  return 3;
}

/** The seconds a rep took: the timer or the recording, whichever ran longer. */
export function repSeconds(timerSeconds: number, recordedSeconds: number): number {
  return Math.min(Math.max(timerSeconds, Math.round(recordedSeconds), 0), 600);
}

/** The application in focus, as far as a networking prompt needs it. */
export type FocusedApplication = { title: string; company: string };

/**
 * Prompts built from the application in focus. They name the role and the
 * company the visitor typed, and add nothing else.
 */
export function applicationPrompts(app: FocusedApplication | null): {
  line: string;
  questions: { id: string; label: string; prompt: string }[];
} | null {
  const typed = app?.title.trim();
  if (!app || !typed) return null;
  const title = midSentence(typed);
  const company = app.company.trim();
  const at = company ? ` at ${company}` : '';
  return {
    line: `I am applying for the ${title} role${at}.`,
    questions: [
      {
        id: 'app-first-month',
        label: 'From your application',
        prompt: `What does a good first month look like for a ${title}${at}?`,
      },
      {
        id: 'app-prepare',
        label: 'From your application',
        prompt: `What would you want someone applying for ${title}${at} to have read or tried first?`,
      },
    ],
  };
}
