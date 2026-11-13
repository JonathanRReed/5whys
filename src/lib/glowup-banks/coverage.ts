/**
 * The competency view for one packet: each requirement line of the posting
 * beside the skill it tests, a question an interviewer could ask about it,
 * what a strong answer shows, one common mistake, and the packed story that
 * answers it. Coverage counts only stories packed for this job, by their
 * three-state readiness; the library-wide gap list keeps its own meaning.
 * Pure: it reads what it is given and writes nothing.
 */

import {
  type DecodedBullet,
  type InterviewPacket,
  type Readiness,
  readinessOf,
  requirementBullets,
  type Story,
} from '../glowup-store';
import { isRealAnswer } from '../non-answer';
import type { PostingSection } from '../posting/types';
import type { Audience } from './audience';
import { type QuestionPrompt, questionsFor } from './questions';

export interface CompetencyRow {
  bulletId: string;
  /** The posting sentence, verbatim. */
  requirement: string;
  section: PostingSection | undefined;
  /** The skill this line tests, or null when none is picked. */
  skillId: string | null;
  /** A question an interviewer could ask about this skill, with its notes. */
  question: QuestionPrompt | null;
  /** The packed story that answers it, most ready first, or null. */
  story: Story | null;
  readiness: Readiness | null;
}

export interface PacketCoverage {
  rows: CompetencyRow[];
  /** Requirement lines with a skill picked: the denominator. */
  total: number;
  /** Of those, the lines a packed, written story answers. */
  covered: number;
  byReadiness: Record<Readiness, number>;
  /** Requirement lines with no skill picked, so no story can be matched. */
  untagged: number;
}

const READY_ORDER: Readiness[] = ['rehearsed', 'solid', 'rough'];

/** The skill a line tests: its picked skill, else its first other tag. */
function lineSkill(bullet: DecodedBullet): string | null {
  return bullet.primarySkillId || bullet.secondarySkillIds?.[0] || null;
}

export function packetCoverage(
  bullets: readonly DecodedBullet[],
  stories: readonly Story[],
  packet: InterviewPacket | undefined,
  audience: Audience
): PacketCoverage {
  const packedIds = new Set(packet?.topStoryIds ?? []);
  // A packed story that was deleted is gone from `stories`, so it never counts.
  // "idk" is not a story yet, so it answers nothing.
  const packed = stories.filter((s) => packedIds.has(s.id) && isRealAnswer(s.play));
  const requirements = requirementBullets(bullets);
  const postingSkillIds = requirements.map(lineSkill).filter((id): id is string => Boolean(id));
  const byReadiness: Record<Readiness, number> = { rehearsed: 0, solid: 0, rough: 0 };
  let covered = 0;
  let untagged = 0;

  const rows = requirements.map((bullet): CompetencyRow => {
    const skillId = lineSkill(bullet);
    if (!skillId) untagged++;
    const matching = skillId
      ? packed
          .filter((s) => s.primarySkillId === skillId || s.otherSkillIds.includes(skillId))
          .sort(
            (a, b) =>
              READY_ORDER.indexOf(readinessOf(a)) - READY_ORDER.indexOf(readinessOf(b)) ||
              // A story whose main skill this is beats one that only touches it.
              Number(b.primarySkillId === skillId) - Number(a.primarySkillId === skillId)
          )
      : [];
    const story = matching[0] ?? null;
    const readiness = story ? readinessOf(story) : null;
    if (story && readiness) {
      covered++;
      byReadiness[readiness]++;
    }
    const question = skillId
      ? (questionsFor(skillId, { audience, postingSkillIds }).find(
          (q) => q.category === 'behavioral' || q.category === 'situational'
        ) ??
        questionsFor(skillId, { audience, postingSkillIds })[0] ??
        null)
      : null;
    return {
      bulletId: bullet.id,
      requirement: bullet.text,
      section: bullet.section,
      skillId,
      question,
      story,
      readiness,
    };
  });

  return { rows, total: requirements.length - untagged, covered, byReadiness, untagged };
}
