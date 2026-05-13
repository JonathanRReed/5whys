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
import { CheckIcon, ArchiveIcon } from './icons';

type Props = {
  data: GlowUpData;
  setData: React.Dispatch<React.SetStateAction<GlowUpData>>;
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
    const updatedData = updatePacket(data, currentPacket.id, {
      topStoryIds: [...currentPacket.topStoryIds, ...newIds],
    });
    const finalData = {
      ...updatedData,
      stories: updatedData.stories.map(s =>
        newIds.includes(s.id) ? { ...s, lastUsedAt: Date.now() } : s
      ),
    };
    setData(finalData);
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
          className="flex-1 min-w-[200px] rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
        />
        <select
          value={skillFilter}
          onChange={e => setSkillFilter(e.target.value)}
          className="rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
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
              'rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2',
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
            className="rounded-lg bg-[hsl(var(--foam))] px-4 py-2 text-sm font-semibold text-[hsl(var(--background))] transition-colors hover:bg-[hsl(var(--foam)/0.9)] focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
          >
            Add to Packet
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-[hsl(var(--overlay)/0.5)] focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
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
                  aria-label={`Select story: ${story.trigger || 'Untitled'}`}
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
                      aria-label={`Delete story: ${story.trigger || 'Untitled'}`}
                      className="rounded-lg border border-[hsl(var(--destructive)/0.3)] bg-[hsl(var(--destructive)/0.1)] px-3 py-1 text-xs text-destructive transition-colors hover:bg-[hsl(var(--destructive)/0.15)] focus-visible:ring-2 focus-visible:ring-[hsl(var(--destructive))] focus-visible:ring-offset-2"
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
          {data.stories.length === 0 ? (
            <>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--foam)/0.1)]">
                <ArchiveIcon className="h-6 w-6 text-[hsl(var(--foam))]" />
              </div>
              <p className="text-sm font-medium text-foreground">Your vault is empty</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Go to Build Stories to create STAR stories, then come back to organize and select them for your packet.
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">No stories match your filters.</p>
          )}
        </div>
      )}
    </div>
  );
}
