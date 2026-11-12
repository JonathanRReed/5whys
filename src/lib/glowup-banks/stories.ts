/**
 * Which of the visitor's saved stories could answer a question. Pure: it
 * reads the stories it is given and writes nothing.
 */

import { readinessOf, type Story } from '../glowup-store';
import { detectSkillsFromText } from './detect';

export interface StoryQuestion {
  /** The question as asked. */
  question?: string;
  /** The posting line it tests, if any. */
  requirement?: string | null;
  /** Skills the question tests. Detected from the requirement when absent. */
  skillIds?: readonly string[];
}

export interface StoryMatch {
  story: Story;
  /** Skills the story is tagged with that the question tests. */
  matchedSkillIds: string[];
  /** Words the story shares with the question and its requirement. */
  sharedWords: string[];
}

const STOPWORDS = new Set(
  (
    'about after again also and any are because been before being but can could did does doing ' +
    'during each from had has have having her here him his how into its just like made make more ' +
    'most much need not now off once only other our out over own same she should some such than ' +
    'that the their them then there these they this those through time times under until very was ' +
    'were what when where which while who why will with would you your tell walk describe give ' +
    'example experience work worked working job role team someone something thing things way'
  ).split(' ')
);

function contentWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 3 && !STOPWORDS.has(word))
      .map((word) => word.replace(/(?:ing|ed|es|s)$/, ''))
      .filter((word) => word.length > 2)
  );
}

const READINESS_ORDER = { rehearsed: 0, solid: 1, rough: 2 } as const;

/**
 * Stories that could answer this question: those tagged with a skill the
 * question tests come first (more shared skills first), then stories that
 * share at least two meaningful words with the question or its requirement.
 * Ties go to the readier story, then the more recently edited one.
 */
export function storiesForQuestion(
  question: StoryQuestion,
  stories: readonly Story[],
  limit = 3
): StoryMatch[] {
  const skills = new Set(
    (question.skillIds && question.skillIds.length > 0
      ? question.skillIds
      : detectSkillsFromText(question.requirement ?? '').map((s) => s.skillId)
    ).filter((id) => id && id !== 'general')
  );
  const asked = contentWords(`${question.question ?? ''} ${question.requirement ?? ''}`);

  const matches: StoryMatch[] = [];
  for (const story of stories) {
    const storySkills = [story.primarySkillId, ...(story.otherSkillIds ?? [])];
    const matchedSkillIds = [...new Set(storySkills.filter((id) => skills.has(id)))];
    const told = contentWords(
      [
        story.trigger,
        story.hook,
        story.play,
        story.proof,
        story.proofSnippet,
        ...(story.tags ?? []),
      ].join(' ')
    );
    const sharedWords = [...asked].filter((word) => told.has(word));
    if (matchedSkillIds.length > 0 || sharedWords.length >= 2) {
      matches.push({ story, matchedSkillIds, sharedWords });
    }
  }

  return matches
    .sort(
      (a, b) =>
        b.matchedSkillIds.length - a.matchedSkillIds.length ||
        b.sharedWords.length - a.sharedWords.length ||
        READINESS_ORDER[readinessOf(a.story)] - READINESS_ORDER[readinessOf(b.story)] ||
        b.story.updatedAt - a.story.updatedAt
    )
    .slice(0, limit);
}
