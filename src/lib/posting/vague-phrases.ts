/**
 * Vague posting phrases and neutral questions a student could ask about them.
 * Each entry is worded as a question to the employer, never as a claim about
 * what the employer means. The student decides whether to ask.
 */

import { escapeRegExp, normalizePunctuation } from './text';

export interface VaguePhrase {
  id: string;
  /** The phrase as the interface names it. */
  label: string;
  /** Spellings that count as this phrase. Words may be joined by spaces or hyphens. */
  patterns: string[];
  /** One or two questions, in the student's voice, to ask the employer. */
  questions: string[];
}

export const VAGUE_PHRASES: readonly VaguePhrase[] = [
  {
    id: 'fast-paced',
    label: 'Fast-paced environment',
    patterns: ['fast paced environment', 'fast paced', 'fast moving environment', 'high paced'],
    questions: [
      'What does a busy week look like for someone in this role?',
      'When several things are urgent at once, how does the team decide what comes first?',
    ],
  },
  {
    id: 'many-hats',
    label: 'Wear many hats',
    patterns: [
      'wear many hats',
      'wearing many hats',
      'wear multiple hats',
      'wearing multiple hats',
    ],
    questions: [
      'Which tasks would take up most of my time in the first few months?',
      'Who covers the work that sits outside this description?',
    ],
  },
  {
    id: 'self-starter',
    label: 'Self-starter',
    patterns: ['self starter', 'self starters', 'self motivated', 'self directed'],
    questions: [
      'How much direction does someone in this role usually get when they start?',
      'Who would I go to when I get stuck?',
    ],
  },
  {
    id: 'other-duties',
    label: 'Other duties as assigned',
    patterns: [
      'other duties as assigned',
      'other duties as required',
      'other duties as needed',
      'other tasks as assigned',
      'additional duties as assigned',
    ],
    questions: ['What kinds of tasks outside this description have people in this role picked up?'],
  },
  {
    id: 'competitive-pay',
    label: 'Competitive pay',
    patterns: [
      'competitive salary',
      'competitive pay',
      'competitive compensation',
      'competitive wages',
      'competitive hourly rate',
      'competitive benefits',
    ],
    questions: [
      'What is the pay range for this role?',
      'Is the pay hourly or salaried, and how is overtime handled?',
    ],
  },
  {
    id: 'depends-on-experience',
    label: 'Pay depends on experience',
    patterns: [
      'depending on experience',
      'commensurate with experience',
      'based on experience',
      'doe',
    ],
    questions: ['What is the range, and what places someone higher or lower in it?'],
  },
  {
    id: 'work-hard-play-hard',
    label: 'Work hard, play hard',
    patterns: ['work hard play hard', 'work hard and play hard'],
    questions: ['What do evenings and weekends usually look like for the team?'],
  },
  {
    id: 'like-family',
    label: 'We are like a family',
    patterns: ['like a family', 'we are a family', "we're a family", 'family atmosphere'],
    questions: [
      'How does the team handle disagreements or heavy workloads?',
      'How are boundaries around time off respected?',
    ],
  },
  {
    id: 'rockstar',
    label: 'Rockstar, ninja, or guru',
    patterns: ['rockstar', 'rock star', 'ninja', 'guru', 'superstar'],
    questions: ['What would a strong first few months look like for the person you hire?'],
  },
  {
    id: 'flexible-schedule',
    label: 'Flexible schedule',
    patterns: ['flexible schedule', 'flexible hours', 'flexible scheduling', 'flexible shifts'],
    questions: [
      'How are schedules set, and how far ahead are they shared?',
      'Who decides the flexibility: me, my manager, or the business?',
    ],
  },
  {
    id: 'as-needed',
    label: 'As needed',
    patterns: [
      'as business needs require',
      'based on business needs',
      'as business needs dictate',
      'availability as needed',
    ],
    questions: ['How often do hours or schedules change, and how much notice is given?'],
  },
  {
    id: 'unlimited-pto',
    label: 'Unlimited time off',
    patterns: [
      'unlimited pto',
      'unlimited vacation',
      'unlimited paid time off',
      'unlimited time off',
    ],
    questions: [
      'How much time off do people on the team usually take in a year?',
      'How is time off requested and approved?',
    ],
  },
  {
    id: 'high-energy',
    label: 'High energy',
    patterns: ['high energy', 'high energy environment'],
    questions: ['What does a normal shift or day look like from start to finish?'],
  },
  {
    id: 'under-pressure',
    label: 'Works well under pressure',
    patterns: [
      'thrive under pressure',
      'thrives under pressure',
      'work well under pressure',
      'works well under pressure',
      'perform under pressure',
      'handle pressure',
    ],
    questions: [
      'Which situations create the most pressure in this role?',
      'What support is there when the pressure is high?',
    ],
  },
  {
    id: 'dynamic',
    label: 'Dynamic environment',
    patterns: [
      'dynamic environment',
      'dynamic team',
      'ever changing environment',
      'constantly changing',
    ],
    questions: ['What has changed about this team or role over the past year?'],
  },
  {
    id: 'hit-the-ground-running',
    label: 'Hit the ground running',
    patterns: ['hit the ground running', 'hits the ground running'],
    questions: [
      'What training or onboarding do new hires get?',
      'What would you expect me to handle on my own in the first few weeks?',
    ],
  },
  {
    id: 'above-and-beyond',
    label: 'Go above and beyond',
    patterns: ['above and beyond', 'go the extra mile', 'going the extra mile'],
    questions: ['Can you give an example of what that has looked like on this team?'],
  },
  {
    id: 'growth',
    label: 'Room for growth',
    patterns: [
      'room for growth',
      'growth opportunities',
      'opportunities for growth',
      'opportunities for advancement',
      'career growth',
      'advancement opportunities',
    ],
    questions: [
      'What have past people in this role moved on to?',
      'How are promotions or raises decided?',
    ],
  },
  {
    id: 'ambiguity',
    label: 'Comfortable with ambiguity',
    patterns: [
      'comfortable with ambiguity',
      'navigate ambiguity',
      'thrive in ambiguity',
      'ambiguous environment',
    ],
    questions: [
      'Can you describe a recent project where the goals were unclear, and how the team handled it?',
    ],
  },
  {
    id: 'passion',
    label: 'Passionate',
    patterns: ['passion for', 'passionate about', 'passionate individual'],
    questions: ['What drew the people on this team to this work?'],
  },
  {
    id: 'multitask',
    label: 'Juggle multiple priorities',
    patterns: [
      'juggle multiple priorities',
      'juggling multiple priorities',
      'multiple competing priorities',
      'competing priorities',
      'ability to multitask',
    ],
    questions: [
      'What are the priorities someone in this role usually balances?',
      'Who helps decide what comes first when they conflict?',
    ],
  },
  {
    id: 'results-driven',
    label: 'Results-driven',
    patterns: ['results driven', 'results oriented', 'results focused'],
    questions: ['How is success measured for this role?'],
  },
  {
    id: 'minimal-supervision',
    label: 'Minimal supervision',
    patterns: [
      'minimal supervision',
      'little supervision',
      'without supervision',
      'minimal direction',
      'work independently',
    ],
    questions: [
      'How often would I check in with a manager, and in what way?',
      'Who reviews my work while I am learning the role?',
    ],
  },
  {
    id: 'tight-deadlines',
    label: 'Tight deadlines',
    patterns: ['tight deadlines', 'tight timelines', 'aggressive deadlines', 'short deadlines'],
    questions: ['How are deadlines set, and what happens when one is at risk?'],
  },
  {
    id: 'startup-mentality',
    label: 'Startup mentality',
    patterns: ['startup mentality', 'start up mentality', 'scrappy', 'startup environment'],
    questions: ['What does the team do when a tool or resource it needs is not available yet?'],
  },
  {
    id: 'team-player',
    label: 'Team player',
    patterns: ['team player', 'team players'],
    questions: ['How is work divided on the team, and how do people hand it off?'],
  },
  {
    id: 'after-hours',
    label: 'Available outside normal hours',
    patterns: [
      'on call',
      'after hours',
      'outside of normal business hours',
      'outside normal business hours',
      'outside of business hours',
      'nights and weekends',
    ],
    questions: [
      'How often is availability outside normal hours needed?',
      'Is that time paid or given back?',
    ],
  },
  {
    id: 'commission',
    label: 'Commission or earning potential',
    patterns: [
      'uncapped commission',
      'unlimited earning potential',
      'earning potential',
      'commission based',
      'commission only',
    ],
    questions: [
      'How much of the pay is base, and how much depends on commission?',
      'What did people in this role usually earn in their first year?',
    ],
  },
  {
    id: 'reliable-transportation',
    label: 'Reliable transportation',
    patterns: ['reliable transportation', 'own transportation', 'reliable means of transportation'],
    questions: [
      'Is the work site reachable by public transit?',
      'Are shifts ever moved to other locations?',
    ],
  },
  {
    id: 'some-travel',
    label: 'Some travel',
    patterns: ['some travel', 'occasional travel', 'travel as needed', 'travel may be required'],
    questions: ['How often is travel needed, and who covers the cost?'],
  },
  {
    id: 'long-hours',
    label: 'Long or extended hours',
    patterns: ['long hours', 'extended hours', 'overtime as needed', 'overtime as required'],
    questions: ['What are typical weekly hours during the busiest periods?'],
  },
  {
    id: 'evolving-role',
    label: 'Evolving role',
    patterns: [
      'evolving role',
      'role will evolve',
      'role may evolve',
      'responsibilities may change',
    ],
    questions: ['How has this role changed since it was created?'],
  },
  {
    id: 'high-volume',
    label: 'High volume',
    patterns: ['high volume', 'high volume environment'],
    questions: ['What does a high-volume day look like, in customers or in tasks?'],
  },
  {
    id: 'culture-fit',
    label: 'Culture fit',
    patterns: ['culture fit', 'cultural fit', 'fit our culture', 'fits our culture'],
    questions: ['How would you describe the way this team works day to day?'],
  },
  {
    id: 'proven-track-record',
    label: 'Proven track record',
    patterns: ['proven track record', 'track record of success'],
    questions: ['For someone early in their career, what kind of past work would show you that?'],
  },
];

export interface VaguePhraseHit {
  /** The dictionary entry's id. */
  id: string;
  /** Offsets of the matched words in the searched text. */
  start: number;
  end: number;
  /** The words as they appear in the text. */
  text: string;
  phrase: VaguePhrase;
}

function patternSource(pattern: string): string {
  return pattern
    .toLowerCase()
    .split(/[\s-]+/)
    .map(escapeRegExp)
    .join('[\\s-]+');
}

const COMPILED: { phrase: VaguePhrase; regex: RegExp }[] = VAGUE_PHRASES.map((phrase) => ({
  phrase,
  regex: new RegExp(
    `(?<![a-z0-9])(?:${[...phrase.patterns]
      .sort((a, b) => b.length - a.length)
      .map(patternSource)
      .join('|')})(?![a-z0-9])`,
    'gi'
  ),
}));

/**
 * Every vague phrase in a posting, in reading order. Where two entries
 * overlap, the longer match wins.
 */
export function findVaguePhrases(text: string): VaguePhraseHit[] {
  const normalized = normalizePunctuation(text);
  const hits: VaguePhraseHit[] = [];
  for (const { phrase, regex } of COMPILED) {
    for (const match of normalized.matchAll(regex)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      // "DOE" is only the abbreviation when written in capitals.
      if (phrase.id === 'depends-on-experience' && /^doe$/i.test(match[0]) && match[0] !== 'DOE') {
        continue;
      }
      hits.push({ id: phrase.id, start, end, text: text.slice(start, end), phrase });
    }
  }
  hits.sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start);
  const kept: VaguePhraseHit[] = [];
  for (const hit of hits) {
    if (!kept.some((k) => hit.start < k.end && k.start < hit.end)) kept.push(hit);
  }
  return kept.sort((a, b) => a.start - b.start);
}
