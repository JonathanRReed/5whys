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
} from '../../lib/glowup-banks';
import { WarningIcon, LightbulbIcon, XIcon } from './icons';

type Props = {
  data: GlowUpData;
  setData: React.Dispatch<React.SetStateAction<GlowUpData>>;
  currentRole: DecodedRole | undefined;
};

export default function StoriesSection({ data, setData, currentRole }: Props) {
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [formData, setFormData] = React.useState<Partial<Story>>({});

  const recentStories = [...data.stories]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 5);

  const startNew = (skillId?: string) => {
    setEditingId('new');
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

  const playSentences = (formData.play ?? '').split(/[.!?]+/).filter(s => s.trim()).length;
  const hasNumbers = /[$%#0-9]/.test(formData.proof ?? '');
  const topGaps = currentRole ? getTopGaps(data, currentRole) : [];

  return (
    <div className="space-y-6">
      {!editingId && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => startNew()}
            className="rounded-lg bg-[hsl(var(--foam))] px-4 py-2 text-sm font-semibold text-[hsl(var(--background))] transition-colors hover:bg-[hsl(var(--foam)/0.9)]"
          >
            + New Story
          </button>
          {topGaps.length > 0 && (
            <>
              <span className="text-sm text-muted-foreground">Start with gap:</span>
              {topGaps.map(skillId => (
                <button
                  key={skillId}
                  type="button"
                  onClick={() => startNew(skillId)}
                  className="rounded-full border border-[hsl(var(--destructive)/0.3)] bg-[hsl(var(--destructive)/0.08)] px-3 py-1 text-sm text-destructive hover:bg-[hsl(var(--destructive)/0.15)]"
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
              className="text-muted-foreground hover:text-foreground"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Primary Skill *</label>
              <select
                value={formData.primarySkillId ?? ''}
                onChange={e => setFormData({ ...formData, primarySkillId: e.target.value })}
                className="w-full rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-3 py-2 text-foreground"
              >
                <option value="">Select skill...</option>
                {SKILL_BANK.map(skill => (
                  <option key={skill.id} value={skill.id}>{skill.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Confidence (1-100)</label>
              <input
                type="number"
                min={1}
                max={100}
                value={formData.confidence ?? 70}
                onChange={e => setFormData({ ...formData, confidence: Number(e.target.value) })}
                className="w-full rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-3 py-2 text-foreground"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Trigger (1-3 words)</label>
              <input
                type="text"
                value={formData.trigger ?? ''}
                onChange={e => setFormData({ ...formData, trigger: e.target.value })}
                placeholder="API redesign"
                className="w-full rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-3 py-2 text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Hook (~25 words)</label>
              <input
                type="text"
                value={formData.hook ?? ''}
                onChange={e => setFormData({ ...formData, hook: e.target.value })}
                placeholder="We needed to replace the legacy API..."
                className="w-full rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-3 py-2 text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Proof Snippet (~10 words)</label>
              <input
                type="text"
                value={formData.proofSnippet ?? ''}
                onChange={e => setFormData({ ...formData, proofSnippet: e.target.value })}
                placeholder="40% faster, zero downtime"
                className="w-full rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-3 py-2 text-foreground placeholder:text-muted-foreground"
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
            <textarea
              value={formData.play ?? ''}
              onChange={e => setFormData({ ...formData, play: e.target.value })}
              placeholder="What was the challenge? What exactly did you do?"
              rows={4}
              className={cn(
                'w-full rounded-lg border bg-[hsl(var(--overlay)/0.3)] px-3 py-2 text-foreground placeholder:text-muted-foreground',
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
            <textarea
              value={formData.proof ?? ''}
              onChange={e => setFormData({ ...formData, proof: e.target.value })}
              placeholder="Numbers, time saved, revenue, or specific praise..."
              rows={3}
              className="w-full rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-3 py-2 text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-lg border border-[hsl(var(--border)/0.5)] px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-[hsl(var(--overlay)/0.3)] hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveStory}
              disabled={!formData.primarySkillId || !formData.play}
              className="rounded-lg bg-[hsl(var(--foam))] px-4 py-2 text-sm font-semibold text-[hsl(var(--background))] disabled:opacity-50"
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
            {recentStories.map(story => (
              <div
                key={story.id}
                className="rounded-xl border border-[hsl(var(--border)/0.3)] bg-[hsl(var(--overlay)/0.15)] p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="rounded-full bg-[hsl(var(--foam)/0.15)] px-2 py-0.5 text-xs font-medium text-[hsl(var(--foam))]">
                      {getSkillName(story.primarySkillId)}
                    </span>
                    <p className="mt-2 text-sm font-medium text-foreground">{story.trigger || 'Untitled'}</p>
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{story.hook || story.play}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs text-muted-foreground">{story.confidence}%</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(story.id);
                        setFormData(story);
                      }}
                      className="text-xs text-[hsl(var(--foam))] hover:underline"
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
          <p className="text-muted-foreground">No stories yet. Create your first one!</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Template: "I [action]ed [what], which resulted in [metric]."
          </p>
        </div>
      )}
    </div>
  );
}
