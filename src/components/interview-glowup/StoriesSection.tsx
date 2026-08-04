import * as React from 'react';
import { cn } from '../../lib/utils';
import {
  type GlowUpData,
  type DecodedRole,
  type Story,
  createStory,
  updateStory,
  getTopGaps,
} from '../../lib/glowup-store';
import {
  SKILL_BANK,
  getSkillName,
  getQuestionsForSkill,
  getGeneralQuestions,
  resolveQuestionText,
  type QuestionPrompt,
} from '../../lib/glowup-banks';
import { WarningIcon, LightbulbIcon, XIcon, PencilIcon } from './icons';

type Props = {
  data: GlowUpData;
  setData: React.Dispatch<React.SetStateAction<GlowUpData>>;
  currentRole: DecodedRole | undefined;
};

const MAX_SKILL_SUGGESTIONS = 8;

export default function StoriesSection({ data, setData, currentRole }: Props) {
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [formData, setFormData] = React.useState<Partial<Story>>({});
  const [customQuestion, setCustomQuestion] = React.useState('');
  const [showGeneralQuestions, setShowGeneralQuestions] = React.useState(false);

  const recentStories = [...data.stories].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);

  const startNew = (skillId?: string) => {
    setEditingId('new');
    setCustomQuestion('');
    setShowGeneralQuestions(false);
    setFormData({
      primarySkillId: skillId ?? '',
      otherSkillIds: [],
      trigger: '',
      hook: '',
      proofSnippet: '',
      play: '',
      proof: '',
      confidence: 70,
      questionPrompts: [],
      tags: [],
    });
  };

  const saveStory = () => {
    if (!formData.primarySkillId || !formData.play) return;

    if (editingId === 'new') {
      setData(createStory(data, formData as Omit<Story, 'id' | 'createdAt' | 'updatedAt'>));
    } else if (editingId) {
      setData(updateStory(data, editingId, formData));
    }
    setEditingId(null);
    setFormData({});
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({});
  };

  const playSentences = (formData.play ?? '').split(/[.!?]+/).filter((s) => s.trim()).length;
  const hasNumbers = /[$%#0-9]/.test(formData.proof ?? '');
  const topGaps = currentRole ? getTopGaps(data, currentRole.bullets) : [];

  // Questions likely to surface the skills this story covers
  const attachedPrompts = formData.questionPrompts ?? [];
  const coveredSkillIds = [formData.primarySkillId, ...(formData.otherSkillIds ?? [])].filter(
    (id): id is string => Boolean(id)
  );
  const skillQuestionSuggestions: QuestionPrompt[] = [];
  for (const skillId of coveredSkillIds) {
    for (const q of getQuestionsForSkill(skillId)) {
      if (
        !attachedPrompts.includes(q.id) &&
        !skillQuestionSuggestions.some((x) => x.id === q.id)
      ) {
        skillQuestionSuggestions.push(q);
      }
    }
  }
  const visibleSkillSuggestions = skillQuestionSuggestions.slice(0, MAX_SKILL_SUGGESTIONS);
  const generalSuggestions = showGeneralQuestions
    ? getGeneralQuestions().filter((q) => !attachedPrompts.includes(q.id))
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
    'w-full rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2';

  return (
    <div className="space-y-6">
      {!editingId && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => startNew()}
            className="rounded-lg bg-[hsl(var(--foam))] px-4 py-2 text-sm font-semibold text-[hsl(var(--background))] transition-colors hover:bg-[hsl(var(--foam)/0.9)] focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
          >
            + New Story
          </button>
          {topGaps.length > 0 && (
            <>
              <span className="text-sm text-muted-foreground">Start with gap:</span>
              {topGaps.map((skillId) => (
                <button
                  key={skillId}
                  type="button"
                  onClick={() => startNew(skillId)}
                  className="rounded-full border border-[hsl(var(--destructive)/0.3)] bg-[hsl(var(--destructive)/0.08)] px-3 py-1 text-sm text-destructive hover:bg-[hsl(var(--destructive)/0.15)] focus-visible:ring-2 focus-visible:ring-[hsl(var(--destructive))] focus-visible:ring-offset-2"
                >
                  {getSkillName(skillId)}
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {editingId && (
        <div className="space-y-4 rounded-xl border border-[hsl(var(--foam)/0.3)] bg-[hsl(var(--foam)/0.05)] p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">
              {editingId === 'new' ? 'New Story' : 'Edit Story'}
            </h3>
            <button
              type="button"
              onClick={cancelEdit}
              aria-label="Close editor"
              className="rounded p-1 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            Know STAR? It maps cleanly: Situation and Task become your Trigger and Hook, Action is
            your Play, Result is your Proof.
          </p>

          <details className="rounded-lg border border-[hsl(var(--gold)/0.3)] bg-[hsl(var(--gold)/0.05)] px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-foreground">
              No work experience yet? Build from what you have.
            </summary>
            <div className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
              <p>Stories do not need a job title behind them. These all count:</p>
              <ul className="list-inside list-disc space-y-1 pl-2">
                <li>
                  <strong>Class projects:</strong> what you built, the part you owned, the decision
                  you made when the plan broke.
                </li>
                <li>
                  <strong>Group work:</strong> the time you coordinated four schedules, split the
                  work, or salvaged a project a week before the deadline.
                </li>
                <li>
                  <strong>Part-time jobs:</strong> handling a rush, an angry customer, training the
                  new hire.
                </li>
                <li>
                  <strong>Clubs and volunteering:</strong> the event you organized, the budget you
                  managed, the members you recruited.
                </li>
              </ul>
              <p>
                Proof without business metrics: a grade, the scope (people, hours, budget), a
                before and after state, classmates adopting your work, or instructor feedback.
                "Professor used our project as next semester's example" is a receipt.
              </p>
            </div>
          </details>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Primary Skill *
              </label>
              <select
                value={formData.primarySkillId ?? ''}
                onChange={(e) => setFormData({ ...formData, primarySkillId: e.target.value })}
                className={inputClass}
              >
                <option value="">Select skill...</option>
                {SKILL_BANK.map((skill) => (
                  <option key={skill.id} value={skill.id}>
                    {skill.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Confidence (1-100)
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={formData.confidence ?? 70}
                onChange={(e) => setFormData({ ...formData, confidence: Number(e.target.value) })}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Other skills this story shows
            </label>
            <p className="mb-1 text-xs text-muted-foreground">
              One story usually proves 2-3 skills. Tag them so the story surfaces for more
              questions.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {(formData.otherSkillIds ?? []).map((skillId) => (
                <span
                  key={skillId}
                  className="flex items-center gap-1 rounded-full bg-[hsl(var(--foam)/0.15)] px-2 py-0.5 text-xs text-[hsl(var(--foam))]"
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
                    className="text-[hsl(var(--foam)/0.7)] hover:text-[hsl(var(--foam))]"
                  >
                    &times;
                  </button>
                </span>
              ))}
              <select
                aria-label="Add secondary skill"
                value=""
                onChange={(e) => addOtherSkill(e.target.value)}
                className="rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-2 py-1 text-xs text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
              >
                <option value="">+ Add skill...</option>
                {SKILL_BANK.filter(
                  (s) =>
                    s.id !== formData.primarySkillId &&
                    !(formData.otherSkillIds ?? []).includes(s.id)
                ).map((skill) => (
                  <option key={skill.id} value={skill.id}>
                    {skill.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Trigger (1-3 words)
              </label>
              <p className="mb-1 text-xs text-muted-foreground">
                A short label you use to recall this story quickly.
              </p>
              <input
                type="text"
                value={formData.trigger ?? ''}
                onChange={(e) => setFormData({ ...formData, trigger: e.target.value })}
                placeholder="API redesign, capstone demo"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Hook (~25 words)
              </label>
              <p className="mb-1 text-xs text-muted-foreground">
                The setup: what was the situation or problem?
              </p>
              <input
                type="text"
                value={formData.hook ?? ''}
                onChange={(e) => setFormData({ ...formData, hook: e.target.value })}
                placeholder="Our legacy API kept failing, or: our group project was a week behind..."
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Proof Snippet (~10 words)
              </label>
              <p className="mb-1 text-xs text-muted-foreground">
                The result in one line: a number, a grade, a before and after.
              </p>
              <input
                type="text"
                value={formData.proofSnippet ?? ''}
                onChange={(e) => setFormData({ ...formData, proofSnippet: e.target.value })}
                placeholder="40% faster, or: shipped on time, top grade in section"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 flex items-center justify-between text-sm font-medium text-foreground">
              <span>Play (What You Did) *</span>
              {playSentences > 4 && (
                <span className="flex items-center gap-1 text-xs text-[hsl(var(--gold))]">
                  <WarningIcon className="h-3 w-3" />
                  Keep it under 4 sentences
                </span>
              )}
            </label>
            <p className="mb-1 text-xs text-muted-foreground">
              The core of your story: your actions, decisions, and approach. "I", not "we".
            </p>
            <textarea
              value={formData.play ?? ''}
              onChange={(e) => setFormData({ ...formData, play: e.target.value })}
              placeholder="What was the challenge? What exactly did you do?"
              rows={4}
              className={cn(
                'w-full rounded-lg border bg-[hsl(var(--overlay)/0.3)] px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2',
                playSentences > 4
                  ? 'border-[hsl(var(--gold)/0.5)]'
                  : 'border-[hsl(var(--border)/0.5)]'
              )}
            />
          </div>

          <div>
            <label className="mb-1 flex items-center justify-between text-sm font-medium text-foreground">
              <span>Proof (The Receipt)</span>
              {!hasNumbers && formData.proof && formData.proof.length > 10 && (
                <span className="flex items-center gap-1 text-xs text-[hsl(var(--gold))]">
                  <LightbulbIcon className="h-3 w-3" />
                  Can you quantify this?
                </span>
              )}
            </label>
            <p className="mb-1 text-xs text-muted-foreground">
              Numbers, feedback quotes, or concrete evidence. No business metrics? Grades, scope,
              before and after states, and instructor feedback count too.
            </p>
            <textarea
              value={formData.proof ?? ''}
              onChange={(e) => setFormData({ ...formData, proof: e.target.value })}
              placeholder="Time saved, revenue, a grade, adoption by classmates, specific praise..."
              rows={3}
              className={inputClass}
            />
          </div>

          <div className="space-y-2 rounded-lg border border-[hsl(var(--border)/0.4)] bg-[hsl(var(--overlay)/0.15)] p-4">
            <h4 className="text-sm font-medium text-foreground">Questions this story answers</h4>
            <p className="text-xs text-muted-foreground">
              Attach the interview questions you would answer with this story. They show up in the
              HUD and the packet so you rehearse question-first.
            </p>

            {attachedPrompts.length > 0 && (
              <ul className="space-y-1">
                {attachedPrompts.map((idOrText) => (
                  <li
                    key={idOrText}
                    className="flex items-start justify-between gap-2 rounded-lg bg-[hsl(var(--foam)/0.1)] px-3 py-1.5 text-sm text-foreground"
                  >
                    <span>{resolveQuestionText(idOrText)}</span>
                    <button
                      type="button"
                      aria-label={`Detach question: ${resolveQuestionText(idOrText)}`}
                      onClick={() => detachQuestion(idOrText)}
                      className="text-muted-foreground hover:text-destructive"
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
                      className="rounded-lg px-2 py-1 text-left text-xs text-[hsl(var(--foam))] hover:bg-[hsl(var(--foam)/0.1)] focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
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
                    className="rounded-lg px-2 py-1 text-left text-xs text-[hsl(var(--foam))] hover:bg-[hsl(var(--foam)/0.1)] focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
                  >
                    + {q.text}
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <input
                type="text"
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
                className="flex-1 rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
              />
              <button
                type="button"
                onClick={() => {
                  attachQuestion(customQuestion.trim());
                  setCustomQuestion('');
                }}
                disabled={!customQuestion.trim()}
                className="rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-[hsl(var(--overlay)/0.5)] disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
              >
                Add
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-[hsl(var(--overlay)/0.5)] focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveStory}
              disabled={!formData.primarySkillId || !formData.play}
              className="rounded-lg bg-[hsl(var(--foam))] px-4 py-2 text-sm font-semibold text-[hsl(var(--background))] transition-colors hover:bg-[hsl(var(--foam)/0.9)] disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
            >
              Save Story
            </button>
          </div>
        </div>
      )}

      {!editingId && recentStories.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Recent Stories
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {recentStories.map((story) => (
              <div
                key={story.id}
                className="rounded-xl border border-[hsl(var(--border)/0.3)] bg-[hsl(var(--overlay)/0.15)] p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="rounded-full bg-[hsl(var(--foam)/0.15)] px-2 py-0.5 text-xs font-medium text-[hsl(var(--foam))]">
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
                    <span className="text-xs text-muted-foreground">{story.confidence}%</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(story.id);
                        setFormData(story);
                        setCustomQuestion('');
                        setShowGeneralQuestions(false);
                      }}
                      className="rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-2 py-1 text-xs text-foreground transition-colors hover:bg-[hsl(var(--overlay)/0.5)] focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!editingId && data.stories.length === 0 && (
        <div className="rounded-xl border border-dashed border-[hsl(var(--border)/0.4)] p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--foam)/0.1)]">
            <PencilIcon className="h-6 w-6 text-[hsl(var(--foam))]" />
          </div>
          <p className="text-sm font-medium text-foreground">No stories yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Click "+ New Story" to build your first Play + Proof story. Know STAR? Situation and
            Task map to the Trigger and Hook, Action is the Play, Result is the Proof.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            No work experience yet? Class projects, internships, club events, part-time jobs, and
            volunteering all produce stories. Start with a gap from Decode to target the role's
            needs.
          </p>
        </div>
      )}
    </div>
  );
}
