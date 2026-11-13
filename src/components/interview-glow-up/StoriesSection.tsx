import * as React from 'react';
import {
  type Audience,
  getGeneralQuestions,
  getSkillName,
  type QuestionPrompt,
  questionFits,
  questionsFor,
  resolveQuestionText,
  usesStudentExamples,
} from '../../lib/glowup-banks';
import {
  createStory,
  type DecodedRole,
  type GlowUpData,
  getTopGaps,
  type InterviewPacket,
  READINESS,
  readinessLabel,
  readinessOf,
  type Story,
  skillCounts,
  toggleStoryInPacket,
  updateStory,
} from '../../lib/glowup-store';
import { ANSWER_RULE, isNonAnswer, isRealAnswer, nonAnswerFollowUp } from '../../lib/non-answer';
import { cn } from '../../lib/utils';
import Announcer, { useAnnouncer } from '../shared/Announcer';
import { LightbulbIcon, PencilIcon, WarningIcon, XIcon } from './icons';
import SkillSelect from './SkillSelect';

/** The story being written, kept by the workspace so a tab switch does not drop it. */
export type StoryEditor = { editingId: string | null; formData: Partial<Story> };
export const CLOSED_EDITOR: StoryEditor = { editingId: null, formData: {} };

/** The editor for a story that does not exist yet. */
export const newStoryEditor = (skillId?: string): StoryEditor => ({
  editingId: 'new',
  formData: {
    primarySkillId: skillId ?? '',
    otherSkillIds: [],
    trigger: '',
    hook: '',
    proofSnippet: '',
    play: '',
    proof: '',
    confidence: 30,
    readiness: 'rough',
    questionPrompts: [],
    tags: [],
  },
});

type Props = {
  data: GlowUpData;
  setData: React.Dispatch<React.SetStateAction<GlowUpData>>;
  currentRole: DecodedRole | undefined;
  currentPacket: InterviewPacket | undefined;
  onGoToDecode: () => void;
  audience?: Audience;
  /** Supplied by the workspace so an unsaved story survives switching tabs. */
  editor?: StoryEditor;
  onEditorChange?: React.Dispatch<React.SetStateAction<StoryEditor>>;
};

/** The one line the cheat sheet shows: the proof's first sentence, kept short. */
export function proofLine(proof: string): string {
  const text = proof.replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const sentence = (text.match(/^[^.!?]+[.!?]?/)?.[0] ?? text).trim();
  if (sentence.length <= 100) return sentence;
  const cut = sentence.slice(0, 100);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 60)).trimEnd()}\u2026`;
}

const MAX_SKILL_SUGGESTIONS = 8;

/** Placeholders and prompts in the visitor's register. */
const EXAMPLES = {
  student: {
    trigger: 'Club sign-up fix, campus job rush',
    hook: 'The club sign-up sheet kept losing people halfway through...',
    proof: 'A grade, a before and after, what an instructor or manager said...',
    proofHint:
      'Numbers you can stand behind, feedback, or a before and after. No business numbers? A grade, the size of the job, or what an instructor said counts too.',
  },
  work: {
    trigger: 'Holiday schedule, freight backlog',
    hook: 'Trucks were sitting half unloaded at the end of every shift...',
    proof: 'Hours saved, errors caught, a schedule that held, what a manager or customer said...',
    proofHint:
      'Numbers you can stand behind, feedback, or a before and after: hours saved, counts that matched, a schedule that held.',
  },
} as const;

export default function StoriesSection({
  data,
  setData,
  currentRole,
  currentPacket,
  onGoToDecode,
  audience = 'student',
  editor: liftedEditor,
  onEditorChange,
}: Props) {
  const student = usesStudentExamples(audience);
  const examples = student ? EXAMPLES.student : EXAMPLES.work;
  const [ownEditor, setOwnEditor] = React.useState<StoryEditor>(CLOSED_EDITOR);
  const { editingId, formData } = liftedEditor ?? ownEditor;
  const setEditor = onEditorChange ?? setOwnEditor;
  const setFormData = (next: Partial<Story>) => setEditor((prev) => ({ ...prev, formData: next }));
  const [customQuestion, setCustomQuestion] = React.useState('');
  const [showGeneralQuestions, setShowGeneralQuestions] = React.useState(false);
  const [announcement, announce] = useAnnouncer();
  // Where focus goes when the editor opens or closes: the editor's heading, or
  // back to the start of the list it replaced.
  const editorHeadingRef = React.useRef<HTMLHeadingElement>(null);
  const newStoryRef = React.useRef<HTMLButtonElement>(null);
  const focusAfterRender = (target: React.RefObject<HTMLElement | null>) =>
    window.requestAnimationFrame(() => target.current?.focus());

  const recentStories = [...data.stories].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6);

  const startNew = (skillId?: string) => {
    focusAfterRender(editorHeadingRef);
    setCustomQuestion('');
    setShowGeneralQuestions(false);
    setEditor(newStoryEditor(skillId));
  };

  const saveStory = () => {
    if (!formData.primarySkillId || !isRealAnswer(formData.play)) return;
    const readiness = formData.readiness ?? readinessOf(formData);
    // The proof is asked for once. Its first line is what the cheat sheet
    // shows; an older story keeps its own line while its proof is unchanged.
    const original = data.stories.find((story) => story.id === editingId);
    const proof = formData.proof ?? '';
    const proofSnippet =
      original?.proofSnippet && (original.proof || original.proofSnippet) === proof
        ? original.proofSnippet
        : proofLine(proof);
    const payload = {
      ...formData,
      proof,
      proofSnippet,
      readiness,
      confidence: READINESS.find((r) => r.id === readiness)?.confidence ?? 60,
    };

    if (editingId === 'new') {
      const next = createStory(data, payload as Omit<Story, 'id' | 'createdAt' | 'updatedAt'>);
      // A new story goes straight into the current packet; it can be removed later.
      const created = next.stories[next.stories.length - 1];
      setData(
        currentPacket && created ? toggleStoryInPacket(next, currentPacket.id, created.id) : next
      );
    } else if (editingId) {
      setData(updateStory(data, editingId, payload));
    }
    announce(
      editingId === 'new' && currentPacket ? 'Story saved and added to the packet.' : 'Story saved.'
    );
    focusAfterRender(newStoryRef);
    setEditor(CLOSED_EDITOR);
  };

  const cancelEdit = () => {
    focusAfterRender(newStoryRef);
    setEditor(CLOSED_EDITOR);
  };

  const playIsPlaceholder = isNonAnswer(formData.play);
  const canSave = Boolean(formData.primarySkillId && isRealAnswer(formData.play));
  const playSentences = (formData.play ?? '').split(/[.!?]+/).filter((s) => s.trim()).length;
  const hasNumbers = /[$%#0-9]/.test(formData.proof ?? '');
  const topGaps = currentRole ? getTopGaps(data, currentRole.bullets) : [];

  // Questions likely to surface the skills this story covers
  const attachedPrompts = formData.questionPrompts ?? [];
  const attachedPromptsSet = new Set(attachedPrompts);
  const coveredSkillIds = [formData.primarySkillId, ...(formData.otherSkillIds ?? [])].filter(
    (id): id is string => Boolean(id)
  );
  // Skills this posting names lead the skill list. A technical question is
  // offered only when the posting asks for that technology, or the story is
  // itself tagged with it: a Python question never turns up under "Attention
  // to detail" for an operations job.
  const postingSkillIds = currentRole
    ? skillCounts(currentRole.bullets).counts.map((entry) => entry.skillId)
    : [];
  const filter = { audience, postingSkillIds: [...postingSkillIds, ...coveredSkillIds] };
  const skillQuestionSuggestions: QuestionPrompt[] = [];
  for (const skillId of coveredSkillIds) {
    for (const q of questionsFor(skillId, filter)) {
      if (!attachedPromptsSet.has(q.id) && !skillQuestionSuggestions.some((x) => x.id === q.id)) {
        skillQuestionSuggestions.push(q);
      }
    }
  }
  const visibleSkillSuggestions = skillQuestionSuggestions.slice(0, MAX_SKILL_SUGGESTIONS);
  const generalSuggestions = showGeneralQuestions
    ? getGeneralQuestions().filter((q) => !attachedPromptsSet.has(q.id) && questionFits(q, filter))
    : [];

  const attachQuestion = (idOrText: string) => {
    if (!idOrText.trim() || attachedPrompts.includes(idOrText)) return;
    setFormData({ ...formData, questionPrompts: [...attachedPrompts, idOrText] });
  };

  const detachQuestion = (idOrText: string) => {
    setFormData({
      ...formData,
      questionPrompts: attachedPrompts.filter((v) => v !== idOrText),
    });
  };

  const addOtherSkill = (skillId: string) => {
    if (!skillId) return;
    const current = formData.otherSkillIds ?? [];
    if (skillId === formData.primarySkillId || current.includes(skillId)) return;
    setFormData({ ...formData, otherSkillIds: [...current, skillId] });
  };

  const inputClass =
    'w-full rounded-lg border border-border/50 bg-overlay/30 px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2';

  return (
    <div className="space-y-6">
      <Announcer message={announcement} />
      {!editingId && (
        <div className="flex flex-wrap items-center gap-3" data-guide="stories-start">
          <button
            ref={newStoryRef}
            type="button"
            onClick={() => startNew()}
            className="rounded-lg bg-foam px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-foam/90 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
          >
            + New story
          </button>
          {topGaps.length > 0 && (
            <>
              <span className="text-sm text-muted-foreground">Start with a gap:</span>
              {topGaps.map((skillId) => (
                <button
                  key={skillId}
                  type="button"
                  onClick={() => startNew(skillId)}
                  aria-label={`Start a story for ${getSkillName(skillId)}`}
                  className="rounded-full border border-destructive/30 bg-destructive/8 px-3 py-1 text-sm text-destructive hover:bg-destructive/15 focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2"
                >
                  {getSkillName(skillId)}
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {editingId && (
        <div className="space-y-4 rounded-xl border border-foam/30 bg-foam/5 p-5">
          <div className="flex items-center justify-between">
            <h2
              ref={editorHeadingRef}
              tabIndex={-1}
              className="text-lg font-semibold text-foreground focus-visible:outline-hidden"
            >
              {editingId === 'new' ? 'New story' : 'Edit story'}
            </h2>
            <button
              type="button"
              onClick={cancelEdit}
              aria-label="Close editor"
              className="rounded p-1 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-1 text-xs leading-relaxed text-muted-foreground">
            <p>Tell it in the order you would say it out loud:</p>
            <ol className="list-inside list-decimal space-y-0.5 pl-2">
              <li>
                <strong className="text-foreground">The situation</strong> (the hook): what was
                going on, in a sentence.
              </li>
              <li>
                <strong className="text-foreground">What you did</strong> (the play).
              </li>
              <li>
                <strong className="text-foreground">What came of it</strong> (the proof).
              </li>
            </ol>
            <p>
              Give it a short name too (the trigger), so it comes back to mind in the room. If you
              know STAR: Situation and Task are the hook, Action is the play, Result is the proof.
            </p>
            {editingId === 'new' && (
              <p className="text-foreground">
                Not saved yet. It stays here if you switch tabs; press Save to keep it.
              </p>
            )}
          </div>

          {student ? (
            <details className="rounded-lg border border-gold/30 bg-gold/5 px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium text-foreground">
                No work experience yet? Build from what you have.
              </summary>
              <div className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
                <p>Stories do not need a job title behind them. These all count:</p>
                <ul className="list-inside list-disc space-y-1 pl-2">
                  <li>
                    <strong>Class projects:</strong> what you made, the part you owned, the decision
                    you made when the plan broke.
                  </li>
                  <li>
                    <strong>Group work:</strong> the time you lined up everyone's schedules, split
                    the work, or rescued a project a week before it was due.
                  </li>
                  <li>
                    <strong>Campus and part-time jobs:</strong> handling a rush, an unhappy
                    customer, training the new hire.
                  </li>
                  <li>
                    <strong>Clubs and volunteering:</strong> the event you organized, the budget you
                    kept, the members you recruited.
                  </li>
                </ul>
                <p>
                  Proof without business numbers: a grade, the size of the job (people, hours,
                  budget), a before and after, classmates using what you made, or what an instructor
                  said.
                </p>
              </div>
            </details>
          ) : (
            <details className="rounded-lg border border-gold/30 bg-gold/5 px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium text-foreground">
                Where to find stories from your work
              </summary>
              <div className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
                <p>The everyday parts of a job make good stories. Look at:</p>
                <ul className="list-inside list-disc space-y-1 pl-2">
                  <li>
                    <strong>A shift that went wrong:</strong> a no-show, a late truck, a register
                    down at the rush, and what you did.
                  </li>
                  <li>
                    <strong>A schedule:</strong> one you built, fixed, or kept together when people
                    called out.
                  </li>
                  <li>
                    <strong>Customers:</strong> a complaint you turned around, or a regular you
                    kept.
                  </li>
                  <li>
                    <strong>Inventory and counts:</strong> a count that would not match until you
                    found why.
                  </li>
                  <li>
                    <strong>A process you fixed:</strong> how it worked before, what you changed,
                    and who uses it now.
                  </li>
                  <li>
                    <strong>People:</strong> someone you trained, coached, or had a hard
                    conversation with.
                  </li>
                </ul>
                <p>Say it in the words this posting uses, but only for work you really did.</p>
              </div>
            </details>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="story-primary-skill"
                className="mb-1 block text-sm font-medium text-foreground"
              >
                Primary skill <span aria-hidden="true">*</span>
                <span className="sr-only">(required)</span>
              </label>
              <SkillSelect
                id="story-primary-skill"
                required
                aria-describedby={canSave ? undefined : 'story-save-missing'}
                value={formData.primarySkillId ?? null}
                onChange={(skillId) => setFormData({ ...formData, primarySkillId: skillId ?? '' })}
                placeholder="Select skill..."
                className="w-full"
                first={postingSkillIds}
              />
            </div>
            <fieldset>
              <legend className="mb-1 block text-sm font-medium text-foreground">
                How ready is it?
              </legend>
              <div className="grid gap-1">
                {READINESS.map((option) => {
                  const checked = (formData.readiness ?? readinessOf(formData)) === option.id;
                  return (
                    <label
                      key={option.id}
                      className={cn(
                        'flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                        checked
                          ? 'border-foam/50 bg-foam/10 text-foreground'
                          : 'border-border/40 bg-overlay/20 text-muted-foreground hover:border-border/60'
                      )}
                    >
                      <input
                        type="radio"
                        name="story-readiness"
                        value={option.id}
                        checked={checked}
                        onChange={() =>
                          setFormData({
                            ...formData,
                            readiness: option.id,
                            confidence: option.confidence,
                          })
                        }
                        className="mt-0.5 accent-foam"
                      />
                      <span>
                        <span className="font-medium text-foreground">{option.label}</span>
                        <span className="block text-xs">{option.hint}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </div>

          <div>
            <p className="mb-1 block text-sm font-medium text-foreground">
              Other skills this story shows
            </p>
            <p className="mb-1 text-xs text-muted-foreground">
              One story often shows more than one skill. Tag each one so the story comes up for more
              questions.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {(formData.otherSkillIds ?? []).map((skillId) => (
                <span
                  key={skillId}
                  className="flex items-center gap-1 rounded-full bg-foam/15 px-2 py-0.5 text-xs text-foam"
                >
                  {getSkillName(skillId)}
                  <button
                    type="button"
                    aria-label={`Remove skill ${getSkillName(skillId)}`}
                    onClick={() =>
                      setFormData({
                        ...formData,
                        otherSkillIds: (formData.otherSkillIds ?? []).filter(
                          (id) => id !== skillId
                        ),
                      })
                    }
                    className="inline-flex min-h-6 min-w-6 items-center justify-center text-foam hover:text-foreground"
                  >
                    &times;
                  </button>
                </span>
              ))}
              <SkillSelect
                value={null}
                onChange={(skillId) => skillId && addOtherSkill(skillId)}
                placeholder="+ Add skill..."
                aria-label="Add secondary skill"
                className="h-8 text-xs"
                exclude={[formData.primarySkillId ?? '', ...(formData.otherSkillIds ?? [])]}
                resetAfterSelect
                first={postingSkillIds}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="story-trigger"
                className="mb-1 block text-sm font-medium text-foreground"
              >
                A short name for it (trigger)
              </label>
              <p className="mb-1 text-xs text-muted-foreground">
                A few words that bring this story back to mind.
              </p>
              <input
                id="story-trigger"
                type="text"
                value={formData.trigger ?? ''}
                onChange={(e) => setFormData({ ...formData, trigger: e.target.value })}
                placeholder={examples.trigger}
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="story-hook"
                className="mb-1 block text-sm font-medium text-foreground"
              >
                The situation (hook)
              </label>
              <p className="mb-1 text-xs text-muted-foreground">
                What was going on, or what was wrong, in a sentence.
              </p>
              <input
                id="story-hook"
                type="text"
                value={formData.hook ?? ''}
                onChange={(e) => setFormData({ ...formData, hook: e.target.value })}
                placeholder={examples.hook}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="story-play"
              className="mb-1 flex items-center justify-between text-sm font-medium text-foreground"
            >
              <span>
                What you did (play) <span aria-hidden="true">*</span>
                <span className="sr-only">(required)</span>
              </span>
              {playSentences > 4 && (
                <span className="flex items-center gap-1 text-xs text-gold">
                  <WarningIcon className="h-3 w-3" />
                  Keep it under 4 sentences
                </span>
              )}
            </label>
            <p className="mb-1 text-xs text-muted-foreground">
              The heart of the story: what you did and decided. Say "I", not "we". {ANSWER_RULE}
            </p>
            <textarea
              id="story-play"
              required
              aria-describedby={canSave ? undefined : 'story-save-missing'}
              value={formData.play ?? ''}
              onChange={(e) => setFormData({ ...formData, play: e.target.value })}
              placeholder="What exactly did you do, and what did you decide?"
              rows={4}
              className={cn(
                'w-full rounded-lg border bg-overlay/30 px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2',
                playSentences > 4 ? 'border-gold/50' : 'border-border/50'
              )}
            />
            {playIsPlaceholder && (
              <p className="mt-1 text-sm text-foreground">{nonAnswerFollowUp(formData.play)}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="story-proof"
              className="mb-1 flex items-center justify-between text-sm font-medium text-foreground"
            >
              <span>What came of it (proof)</span>
              {!hasNumbers && formData.proof && formData.proof.length > 10 && (
                <span className="flex items-center gap-1 text-xs text-gold">
                  <LightbulbIcon className="h-3 w-3" />
                  Is there a number you can stand behind?
                </span>
              )}
            </label>
            <p className="mb-1 text-xs text-muted-foreground">{examples.proofHint}</p>
            <textarea
              id="story-proof"
              value={formData.proof ?? ''}
              onChange={(e) => setFormData({ ...formData, proof: e.target.value })}
              placeholder={examples.proof}
              rows={3}
              className={inputClass}
            />
          </div>

          <div className="space-y-2 rounded-lg border border-border/40 bg-overlay/15 p-4">
            <h3 className="text-sm font-medium text-foreground">Questions this story answers</h3>
            <p className="text-xs text-muted-foreground">
              Attach the interview questions you would answer with this story. They show up in the
              packet and on the HUD, the one-screen cheat sheet for the call, so you practice from
              the question.
            </p>

            {attachedPrompts.length > 0 && (
              <ul className="space-y-1">
                {attachedPrompts.map((idOrText) => (
                  <li
                    key={idOrText}
                    className="flex items-start justify-between gap-2 rounded-lg bg-foam/10 px-3 py-1.5 text-sm text-foreground"
                  >
                    <span>{resolveQuestionText(idOrText)}</span>
                    <button
                      type="button"
                      aria-label={`Detach question: ${resolveQuestionText(idOrText)}`}
                      onClick={() => detachQuestion(idOrText)}
                      className="inline-flex min-h-6 min-w-6 items-center justify-center text-muted-foreground hover:text-destructive"
                    >
                      &times;
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {coveredSkillIds.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Pick a primary skill to see likely questions.
              </p>
            )}

            {visibleSkillSuggestions.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Likely for {coveredSkillIds.map((id) => getSkillName(id)).join(', ')}
                </p>
                <div className="flex flex-col items-start gap-1">
                  {visibleSkillSuggestions.map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => attachQuestion(q.id)}
                      className="rounded-lg px-2 py-1 text-left text-xs text-foam hover:bg-foam/10 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
                    >
                      + {q.text}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGeneralQuestions(!showGeneralQuestions)}
              aria-expanded={showGeneralQuestions}
              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              {showGeneralQuestions
                ? 'Hide general questions'
                : 'Show general questions (resume walkthrough, strengths...)'}
            </button>
            {generalSuggestions.length > 0 && (
              <div className="flex flex-col items-start gap-1">
                {generalSuggestions.map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => attachQuestion(q.id)}
                    className="rounded-lg px-2 py-1 text-left text-xs text-foam hover:bg-foam/10 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
                  >
                    + {q.text}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <input
                type="text"
                aria-label="Add your own interview question"
                value={customQuestion}
                onChange={(e) => setCustomQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    attachQuestion(customQuestion.trim());
                    setCustomQuestion('');
                  }
                }}
                placeholder="Add your own question..."
                className="min-w-0 flex-[1_1_12rem] rounded-lg border border-border/50 bg-overlay/30 px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
              />
              <button
                type="button"
                onClick={() => {
                  attachQuestion(customQuestion.trim());
                  setCustomQuestion('');
                }}
                disabled={!customQuestion.trim()}
                className="rounded-lg border border-border/50 bg-overlay/30 px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-overlay/50 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
              >
                Add
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-lg border border-border/50 bg-overlay/30 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-overlay/50 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveStory}
              data-guide="story-save"
              disabled={!canSave}
              aria-describedby={canSave ? undefined : 'story-save-missing'}
              className="rounded-lg bg-foam px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-foam/90 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
            >
              {editingId === 'new' && currentPacket ? 'Save and add to packet' : 'Save story'}
            </button>
          </div>
          {!canSave && (
            <p id="story-save-missing" className="text-xs text-muted-foreground">
              {!formData.primarySkillId && !formData.play
                ? 'To save, choose the skill this story proves and write what you did.'
                : !formData.primarySkillId
                  ? 'To save, choose the skill this story proves.'
                  : playIsPlaceholder
                    ? `To save, say a little more about what you did. ${ANSWER_RULE}`
                    : 'To save, write what you did.'}
            </p>
          )}
        </div>
      )}

      {!editingId && recentStories.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Recent stories
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {recentStories.map((story) => (
              <div
                key={story.id}
                className="rounded-xl border border-border/30 bg-overlay/15 p-4"
                data-guide="story-card"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="rounded-full bg-foam/15 px-2 py-0.5 text-xs font-medium text-foam">
                      {getSkillName(story.primarySkillId)}
                    </span>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {story.trigger || 'Untitled'}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {story.hook || story.play}
                    </p>
                    {story.questionPrompts.length > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Answers {story.questionPrompts.length}{' '}
                        {story.questionPrompts.length === 1 ? 'question' : 'questions'}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs text-muted-foreground">{readinessLabel(story)}</span>
                    <button
                      type="button"
                      onClick={() => {
                        focusAfterRender(editorHeadingRef);
                        // Older stories may hold their proof only in the short line.
                        setEditor({
                          editingId: story.id,
                          formData: { ...story, proof: story.proof || story.proofSnippet },
                        });
                        setCustomQuestion('');
                        setShowGeneralQuestions(false);
                      }}
                      className="rounded-lg border border-border/50 bg-overlay/30 px-2 py-1 text-xs text-foreground transition-colors hover:bg-overlay/50 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
                    >
                      Edit <span className="sr-only">story: {story.trigger || 'Untitled'}</span>
                    </button>
                    {currentPacket && (
                      <button
                        type="button"
                        onClick={() =>
                          setData(toggleStoryInPacket(data, currentPacket.id, story.id))
                        }
                        className={cn(
                          'rounded-lg border px-2 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2',
                          currentPacket.topStoryIds.includes(story.id)
                            ? 'border-foam/50 bg-foam/15 text-foam hover:border-foam'
                            : 'border-border/50 bg-overlay/30 text-foreground hover:bg-overlay/50'
                        )}
                      >
                        {currentPacket.topStoryIds.includes(story.id)
                          ? 'In packet'
                          : 'Add to packet'}
                        <span className="sr-only">: {story.trigger || 'Untitled'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {data.stories.length > recentStories.length && (
            <p className="text-xs text-muted-foreground">
              {data.stories.length - recentStories.length} older{' '}
              {data.stories.length - recentStories.length === 1 ? 'story is' : 'stories are'} in the
              Library tab.
            </p>
          )}
        </div>
      )}

      {!editingId && data.stories.length === 0 && (
        <div className="rounded-xl border border-dashed border-border/40 p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-foam/10">
            <PencilIcon className="h-6 w-6 text-foam" />
          </div>
          <p className="text-sm font-medium text-foreground">No stories yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {currentRole
              ? 'Start with a gap above, or press "+ New story".'
              : 'Stories work best against a real posting, so the skills it asks for become your list.'}
          </p>
          {!currentRole && (
            <button
              type="button"
              onClick={onGoToDecode}
              className="mt-3 rounded-lg border border-border/50 bg-overlay/30 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-overlay/50 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
            >
              Decode a job first
            </button>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            {student
              ? 'No work experience yet? Class projects, internships, club events, part-time jobs, and volunteering all produce stories.'
              : 'Any job produces stories: a hard shift, a schedule you fixed, a customer you kept, a count that finally matched.'}
          </p>
        </div>
      )}
    </div>
  );
}
