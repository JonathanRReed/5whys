/**
 * Interview Glow Up: the skill bank, the question bank, and the reading of
 * posting lines into skills and questions. Single source of truth; add or
 * rename a skill here without refactoring the rest of the app, but never
 * change an id.
 */

// JD line extraction and repeated-phrase counting moved to the posting engine
// (src/lib/posting/), which builds sections, spans, and term matching on top
// of them. Re-exported so existing imports keep working.
export { extractRequirementLines, type JdExtractionResult } from '../posting/lines';
export { getRepeatedTerms, type RepeatedTerm } from '../posting/terms';
export {
  AUDIENCES,
  type Audience,
  audienceForProfile,
  audienceForStage,
  usesStudentExamples,
} from './audience';
export { detectSkillsFromText, type SkillSuggestion } from './detect';
export {
  findQuestionByText,
  getGeneralQuestions,
  getQuestionById,
  getQuestionsForSkill,
  QUESTION_BANK,
  QUESTION_MAP,
  type QuestionFilter,
  type QuestionPrompt,
  questionFits,
  questionsFor,
  resolveQuestionText,
  SUGGESTED_QUESTIONS_TO_ASK,
  TERMS_QUESTION_IDS,
} from './questions';
export {
  CAREER_CHANGER_MUST_ASK,
  planRehearsal,
  type RehearsalPlanInput,
  type RehearsalQuestion,
} from './rehearsal';
export { type PostingNames, postingRepeatedTerms } from './repeated';
export {
  getSkillName,
  KEYWORD_CONTEXT,
  type KeywordContext,
  SKILL_BANK,
  SKILL_MAP,
  type Skill,
} from './skills';
export { type StoryMatch, type StoryQuestion, storiesForQuestion } from './stories';
