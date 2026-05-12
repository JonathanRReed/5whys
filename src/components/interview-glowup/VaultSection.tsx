import * as React from 'react';
import { cn } from '../../lib/utils';
import {
  type GlowUpData,
  type InterviewPacket,
  updatePacket,
  deleteStory,
} from '../../lib/glowup-store';
import {
  SKILL_BANK,
  getSkillName,
} from '../../lib/glowup-banks';
import { CheckIcon } from './icons';

type Props = {
  data: GlowUpData;
  setData: React.Dispatch<React.SetStateAction<GlowUpData | null>>;
  currentPacket: InterviewPacket | undefined;
};

export default function VaultSection({ data, setData, currentPacket }: Props) {
  const [filter, setFilter] = React.useState('');
  const [skillFilter, setSkillFilter] = React.useState('');
  const [showUnused, setShowUnused] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  let stories = [...data.stories].sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0));

  if (skillFilter) {
    stories = stories.filter(s =>
      s.primarySkillId === skillFilter || s.otherSkillIds.includes(skillFilter)
    );
  }
  if (filter) {
    const lower = filter.toLowerCase();
    stories = stories.filter(s =>
      s.play.toLowerCase().includes(lower) ||
      s.proof.toLowerCase().includes(lower) ||
      s.hook.toLowerCase().includes(lower) ||
      s.trigger.toLowerCase().includes(lower)
    );
  }
  if (showUnused && currentPacket) {
    const usedIds = new Set(currentPacket.topStoryIds);
    stories = stories.filter(s => !usedIds.has(s.id));
  }

  const handleBatchAddToPacket = () => {
    if (!currentPacket || selectedIds.size === 0) return;

    const newIds = Array.from(selectedIds).filter(id => !currentPacket.topStoryIds.includes(id));
    setData(updatePacket(data, currentPacket.id, {
      topStoryIds: [...currentPacket.topStoryIds, ...newIds],
    }));

    const updatedStories = data.stories.map(s =>
      newIds.includes(s.id) ? { ...s, lastUsedAt: Date.now() } : s
    );
    setData(prev => prev ? { ...prev, stories: updatedStories } : prev);
    setSelectedIds(new Set());
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Search stories..."
          className="flex-1 min-w-[200px] rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
        />
        <select
          value={skillFilter}
          onChange={e => setSkillFilter(e.target.value)}
          className="rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-3 py-2 text-sm text-foreground"
        >
          <option value="">All skills</option>
          {SKILL_BANK.map(skill => (
            <option key={skill.id} value={skill.id}>{skill.name}</option>
          ))}
        </select>
        {currentPacket && (
          <button
            type="button"
            onClick={() => setShowUnused(!showUnused)}
            className={cn(
              'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
              showUnused
                ? 'border-[hsl(var(--foam)/0.5)] bg-[hsl(var(--foam)/0.15)] text-[hsl(var(--foam))]'
                : 'border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] text-muted-foreground hover:text-foreground'
            )}
          >
            Unused only
          </button>
        )}
      </div>

      {selectedIds.size > 0 && currentPacket && (
        <div className="flex items-center gap-3 rounded-lg bg-[hsl(var(--foam)/0.1)] p-3">
          <span className="text-sm text-foreground">{selectedIds.size} selected</span>
          <button
            type="button"
            onClick={handleBatchAddToPacket}
            className="rounded-lg bg-[hsl(var(--foam))] px-3 py-1.5 text-sm font-semibold text-[hsl(var(--background))]"
          >
            Add to Packet
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stories.map(story => {
          const inPacket = currentPacket?.topStoryIds.includes(story.id);
          return (
            <div
              key={story.id}
              className={cn(
                'rounded-xl border p-4 transition-colors',
                inPacket
                  ? 'border-[hsl(var(--foam)/0.5)] bg-[hsl(var(--foam)/0.08)]'
                  : 'border-[hsl(var(--border)/0.3)] bg-[hsl(var(--overlay)/0.15)]'
              )}
            >
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={selectedIds.has(story.id)}
                  onChange={e => {
                    const newSet = new Set(selectedIds);
                    if (e.target.checked) newSet.add(story.id);
                    else newSet.delete(story.id);
                    setSelectedIds(newSet);
                  }}
                  className="mt-1 h-4 w-4 rounded accent-[hsl(var(--foam))]"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[hsl(var(--foam)/0.15)] px-2 py-0.5 text-xs font-medium text-[hsl(var(--foam))]">
                      {getSkillName(story.primarySkillId)}
                    </span>
                    {inPacket && (
                      <span className="flex items-center gap-1 text-xs text-[hsl(var(--foam))]">
                        <CheckIcon className="h-3 w-3" />
                        in packet
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm font-medium text-foreground">{story.trigger || 'Untitled'}</p>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{story.hook || story.play}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Confidence: {story.confidence}%</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Delete this story?')) {
                          setData(deleteStory(data, story.id));
                        }
                      }}
                      className="text-xs text-destructive hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {stories.length === 0 && (
        <div className="rounded-xl border border-dashed border-[hsl(var(--border)/0.4)] p-8 text-center">
          <p className="text-muted-foreground">
            {data.stories.length === 0
              ? 'No stories in vault. Build some first!'
              : 'No stories match your filters.'}
          </p>
        </div>
      )}
    </div>
  );
}
