import * as React from 'react';
import { getSkillName, SKILL_BANK } from '../../lib/glowup-banks';
import {
  deleteStory,
  type GlowUpData,
  type InterviewPacket,
  readinessLabel,
  toggleStoryInPacket,
  updatePacket,
} from '../../lib/glowup-store';
import { cn } from '../../lib/utils';
import ConfirmButton from '../shared/ConfirmButton';
import { ArchiveIcon, CheckIcon } from './icons';
import SkillSelect from './SkillSelect';

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
    stories = stories.filter(
      (s) => s.primarySkillId === skillFilter || s.otherSkillIds.includes(skillFilter)
    );
  }
  if (filter) {
    const lower = filter.toLowerCase();
    stories = stories.filter(
      (s) =>
        s.play.toLowerCase().includes(lower) ||
        s.proof.toLowerCase().includes(lower) ||
        s.hook.toLowerCase().includes(lower) ||
        s.trigger.toLowerCase().includes(lower)
    );
  }
  if (showUnused && currentPacket) {
    const usedIds = new Set(currentPacket.topStoryIds);
    stories = stories.filter((s) => !usedIds.has(s.id));
  }

  const handleBatchAddToPacket = () => {
    if (!currentPacket || selectedIds.size === 0) return;

    const newIds = Array.from(selectedIds).filter((id) => !currentPacket.topStoryIds.includes(id));
    const updatedData = updatePacket(data, currentPacket.id, {
      topStoryIds: [...currentPacket.topStoryIds, ...newIds],
    });
    const finalData = {
      ...updatedData,
      stories: updatedData.stories.map((s) =>
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
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search stories..."
          className="flex-1 min-w-[200px] rounded-lg border border-border/50 bg-overlay/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
        />
        <SkillSelect
          value={skillFilter || null}
          onChange={(skillId) => setSkillFilter(skillId ?? '')}
          placeholder="All skills"
          aria-label="Filter stories by skill"
        />
        {currentPacket && (
          <button
            type="button"
            onClick={() => setShowUnused(!showUnused)}
            className={cn(
              'rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2',
              showUnused
                ? 'border-foam/50 bg-foam/15 text-foam'
                : 'border-border/50 bg-overlay/30 text-muted-foreground hover:text-foreground'
            )}
          >
            Unused only
          </button>
        )}
      </div>

      {selectedIds.size > 0 && currentPacket && (
        <div className="flex items-center gap-3 rounded-lg bg-foam/10 p-3">
          <span className="text-sm text-foreground">{selectedIds.size} selected</span>
          <button
            type="button"
            onClick={handleBatchAddToPacket}
            className="rounded-lg bg-foam px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-foam/90 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
          >
            Add to Packet
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="rounded-lg border border-border/50 bg-overlay/30 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-overlay/50 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
          >
            Clear
          </button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stories.map((story) => {
          const inPacket = currentPacket?.topStoryIds.includes(story.id);
          return (
            <div
              key={story.id}
              className={cn(
                'rounded-xl border p-4 transition-colors',
                inPacket ? 'border-foam/50 bg-foam/8' : 'border-border/30 bg-overlay/15'
              )}
            >
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  aria-label={`Select story: ${story.trigger || 'Untitled'}`}
                  checked={selectedIds.has(story.id)}
                  onChange={(e) => {
                    const newSet = new Set(selectedIds);
                    if (e.target.checked) newSet.add(story.id);
                    else newSet.delete(story.id);
                    setSelectedIds(newSet);
                  }}
                  className="mt-1 h-4 w-4 rounded accent-foam"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-foam/15 px-2 py-0.5 text-xs font-medium text-foam">
                      {getSkillName(story.primarySkillId)}
                    </span>
                    {inPacket && (
                      <span className="flex items-center gap-1 text-xs text-foam">
                        <CheckIcon className="h-3 w-3" />
                        in packet
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {story.trigger || 'Untitled'}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                    {story.hook || story.play}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">{readinessLabel(story)}</span>
                    {currentPacket && (
                      <button
                        type="button"
                        onClick={() =>
                          setData(toggleStoryInPacket(data, currentPacket.id, story.id))
                        }
                        className={cn(
                          'rounded-lg border px-3 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2',
                          inPacket
                            ? 'border-foam/50 bg-foam/15 text-foam hover:bg-foam/25'
                            : 'border-border/50 bg-overlay/30 text-foreground hover:bg-overlay/50'
                        )}
                      >
                        {inPacket ? 'Remove from packet' : 'Add to packet'}
                      </button>
                    )}
                    <ConfirmButton
                      confirmLabel="Delete for good?"
                      onConfirm={() => setData(deleteStory(data, story.id))}
                      aria-label={`Delete story: ${story.trigger || 'Untitled'}`}
                      className="px-3 py-1 text-xs"
                    >
                      Delete
                    </ConfirmButton>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {stories.length === 0 && (
        <div className="rounded-xl border border-dashed border-border/40 p-8 text-center">
          {data.stories.length === 0 ? (
            <>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-foam/10">
                <ArchiveIcon className="h-6 w-6 text-foam" />
              </div>
              <p className="text-sm font-medium text-foreground">Your library is empty</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Every story you write lands here. Use it to search, filter by skill, and select them
                for your packet.
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
