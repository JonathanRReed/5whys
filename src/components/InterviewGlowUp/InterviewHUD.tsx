import * as React from 'react';
import { cn } from '../../lib/utils';
import type { Story, InterviewPacket, DecodedRole } from '../../lib/glowup-store';
import { getSkillName } from '../../lib/glowup-banks';
import { ChartIcon, WarningIcon } from '../interview-glowup/icons';

// ============================================================================
// Types
// ============================================================================

interface InterviewHUDProps {
  packet: InterviewPacket;
  stories: Story[];
  role: DecodedRole | undefined;
  onClose: () => void;
}

// ============================================================================
// HUD Component
// ============================================================================

export default function InterviewHUD({ packet, stories, role, onClose }: InterviewHUDProps) {
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [panicMode, setPanicMode] = React.useState(false);

  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Get packet stories
  const topStoryIdSet = React.useMemo(() => new Set(packet.topStoryIds), [packet.topStoryIds]);
  const packetStories = stories.filter((s) => topStoryIdSet.has(s.id));

  // Pre-compute lowercase search index
  const searchIndex = React.useMemo(() => {
    return stories.map((s) => ({
      id: s.id,
      trigger: s.trigger.toLowerCase(),
      hook: s.hook.toLowerCase(),
      play: s.play.toLowerCase(),
      proof: s.proof.toLowerCase(),
      skill: getSkillName(s.primarySkillId).toLowerCase(),
      tags: s.tags.map((t) => t.toLowerCase()),
    }));
  }, [stories]);

  // Filter stories by search
  const displayStories = React.useMemo(() => {
    if (!searchQuery.trim()) return packetStories;

    const lower = searchQuery.toLowerCase();
    return packetStories.filter((s) => {
      const idx = searchIndex.find((i) => i.id === s.id);
      if (!idx) return false;
      return (
        idx.trigger.includes(lower) ||
        idx.hook.includes(lower) ||
        idx.play.includes(lower) ||
        idx.proof.includes(lower) ||
        idx.skill.includes(lower) ||
        idx.tags.some((t) => t.includes(lower))
      );
    });
  }, [packetStories, searchQuery, searchIndex]);

  // Focus management
  React.useEffect(() => {
    containerRef.current?.focus();
  }, []);

  React.useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
    }
  }, [searchOpen]);

  // Keyboard handling
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') {
          setSearchOpen(false);
          setSearchQuery('');
          containerRef.current?.focus();
        }
        return;
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          setSearchOpen(true);
          break;
        case 'Escape':
          if (searchOpen) {
            setSearchOpen(false);
            setSearchQuery('');
          } else if (expandedId) {
            setExpandedId(null);
          } else {
            onClose();
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(0, i - 1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(displayStories.length - 1, i + 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (displayStories[selectedIndex]) {
            setExpandedId(
              expandedId === displayStories[selectedIndex].id
                ? null
                : displayStories[selectedIndex].id
            );
          }
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          setPanicMode(!panicMode);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen, expandedId, displayStories, selectedIndex, panicMode, onClose]);

  // Keep selected index in bounds
  React.useEffect(() => {
    if (selectedIndex >= displayStories.length) {
      setSelectedIndex(Math.max(0, displayStories.length - 1));
    }
  }, [displayStories.length, selectedIndex]);

  const keywords = packet.companyIntel?.keywords ?? [];

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="fixed inset-0 z-50 flex flex-col bg-[hsl(var(--background))] text-[hsl(var(--foreground))] outline-none print:relative print:bg-white print:text-black"
    >
      {/* Top Bar */}
      <header className="flex items-center justify-between border-b border-[hsl(var(--border)/0.4)] bg-[hsl(var(--card))] px-6 py-4 print:bg-gray-100 print:border-gray-300">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-[hsl(var(--muted-foreground)/0.9)] hover:bg-[hsl(var(--overlay)/0.25)] hover:text-[hsl(var(--foreground))] print:hidden"
            aria-label="Close HUD"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-bold text-[hsl(var(--foreground))] print:text-black">
              {role?.company ?? 'Interview'}: {role?.jobTitle ?? 'Packet'}
            </h1>
            <div className="mt-1 flex gap-2">
              {keywords.map((kw, i) => (
                <span
                  key={i}
                  className="rounded-full bg-[hsl(var(--iris)/0.2)] px-2 py-0.5 text-xs font-medium text-[hsl(var(--iris))] print:bg-cyan-100 print:text-cyan-800"
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-3 text-sm text-[hsl(var(--muted-foreground))] print:hidden">
          <kbd className="rounded bg-[hsl(var(--overlay)/0.25)] px-2 py-0.5">Space</kbd> Search
          <kbd className="rounded bg-[hsl(var(--overlay)/0.25)] px-2 py-0.5">↑↓</kbd> Navigate
          <kbd className="rounded bg-[hsl(var(--overlay)/0.25)] px-2 py-0.5">Enter</kbd> Expand
          <kbd className="rounded bg-[hsl(var(--overlay)/0.25)] px-2 py-0.5">P</kbd> Panic
          <kbd className="rounded bg-[hsl(var(--overlay)/0.25)] px-2 py-0.5">Esc</kbd> Close
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* Left Column - Stories */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Search Bar */}
          {searchOpen && (
            <div className="mb-4 print:hidden">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search stories by skill, keyword..."
                className="w-full rounded-xl border border-[hsl(var(--border)/0.8)] bg-[hsl(var(--overlay)/0.15)] px-4 py-3 text-lg text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground)/0.6)] focus:border-[hsl(var(--iris))] focus:outline-none"
                autoFocus
              />
            </div>
          )}

          {/* Panic Mode */}
          {panicMode && packet.panicAnswer && (
            <div className="mb-6 rounded-xl border-2 border-[hsl(var(--destructive)/0.5)] bg-[hsl(var(--destructive)/0.1)] p-4 md:p-6">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <WarningIcon className="h-6 w-6 text-[hsl(var(--destructive))]" />
                <span className="text-lg font-bold text-[hsl(var(--destructive))]">
                  PANIC ANSWER
                </span>
              </div>
              <p className="text-lg leading-relaxed text-[hsl(var(--foreground))]">
                {packet.panicAnswer}
              </p>
            </div>
          )}

          {/* Stories List */}
          <div className="space-y-3">
            {displayStories.length === 0 ? (
              <div className="rounded-xl border border-[hsl(var(--border)/0.4)] p-8 text-center text-[hsl(var(--muted-foreground))]">
                {searchQuery ? 'No stories match your search' : 'No stories in packet'}
              </div>
            ) : (
              displayStories.map((story, index) => {
                const isSelected = index === selectedIndex;
                const isExpanded = expandedId === story.id;

                return (
                  <div
                    key={story.id}
                    onClick={() => {
                      setSelectedIndex(index);
                      setExpandedId(isExpanded ? null : story.id);
                    }}
                    className={cn(
                      'cursor-pointer rounded-xl border p-4 transition-all',
                      isSelected
                        ? 'border-[hsl(var(--iris)/0.5)] bg-[hsl(var(--iris)/0.1)] shadow-lg shadow-[hsl(var(--iris)/0.1)]'
                        : 'border-[hsl(var(--border)/0.4)] bg-[hsl(var(--overlay)/0.15)] hover:bg-[hsl(var(--overlay)/0.25)]',
                      isExpanded && 'border-[hsl(var(--iris))]'
                    )}
                  >
                    {/* Glance View */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-[hsl(var(--iris)/0.2)] px-2 py-0.5 text-xs font-semibold text-[hsl(var(--iris))]">
                            {getSkillName(story.primarySkillId)}
                          </span>
                          <span className="text-xs text-[hsl(var(--muted-foreground)/0.6)]">
                            {story.confidence}%
                          </span>
                        </div>
                        <p className="mt-2 text-lg font-semibold text-[hsl(var(--foreground))]">
                          {story.trigger || 'Untitled'}
                        </p>
                        <p className="mt-1 text-[hsl(var(--muted-foreground)/0.9)]">{story.hook}</p>
                        <p className="mt-2 text-sm font-medium text-[hsl(var(--iris))]">
                          <ChartIcon className="h-4 w-4 inline" /> {story.proofSnippet}
                        </p>
                      </div>
                      <div className="text-[hsl(var(--muted-foreground)/0.5)]">
                        {isExpanded ? (
                          <svg
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 15l7-7 7 7"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        )}
                      </div>
                    </div>

                    {/* Expanded View */}
                    {isExpanded && (
                      <div className="mt-4 border-t border-[hsl(var(--border)/0.4)] pt-4">
                        <div className="space-y-4">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground)/0.6)]">
                              Play
                            </p>
                            <p className="mt-1 text-[hsl(var(--foreground))] leading-relaxed">
                              {story.play}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground)/0.6)]">
                              Proof
                            </p>
                            <p className="mt-1 text-[hsl(var(--foam))] leading-relaxed">
                              {story.proof}
                            </p>
                          </div>
                          {story.questionPrompts.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground)/0.6)]">
                                Answers
                              </p>
                              <ul className="mt-1 space-y-1">
                                {story.questionPrompts.map((q, i) => (
                                  <li
                                    key={i}
                                    className="text-sm text-[hsl(var(--muted-foreground)/0.9)]"
                                  >
                                    • {q}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column - Questions to Ask */}
        <div className="w-full md:w-80 flex-shrink-0 border-l border-[hsl(var(--border)/0.4)] bg-[hsl(var(--overlay)/0.2)] p-6 print:bg-gray-50 print:border-gray-300">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] print:text-gray-600">
            Questions to Ask
          </h2>
          <ul className="space-y-3">
            {packet.customQuestions.filter(Boolean).map((q, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-[hsl(var(--foreground)/0.8)] print:text-gray-800"
              >
                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-[hsl(var(--iris))]" />
                <span className="text-sm leading-relaxed">{q}</span>
              </li>
            ))}
          </ul>

          {packet.customQuestions.filter(Boolean).length === 0 && (
            <p className="text-sm text-[hsl(var(--muted-foreground)/0.6)]">
              No questions added yet.
            </p>
          )}

          {/* Notes */}
          {packet.notes && (
            <div className="mt-8">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] print:text-gray-600">
                Notes
              </h2>
              <p className="text-sm leading-relaxed text-[hsl(var(--muted-foreground)/0.9)] print:text-gray-700">
                {packet.notes}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Panic Slot (always visible reminder) */}
      {!panicMode && packet.panicAnswer && (
        <footer className="border-t border-[hsl(var(--border)/0.4)] bg-[hsl(var(--card))] px-6 py-3 print:hidden">
          <button
            onClick={() => setPanicMode(true)}
            className="flex items-center gap-2 text-sm text-[hsl(var(--destructive)/0.7)] hover:text-[hsl(var(--destructive))]"
          >
            <WarningIcon className="h-4 w-4" />
            <span>
              Press{' '}
              <kbd className="rounded bg-[hsl(var(--overlay)/0.25)] px-1.5 py-0.5 text-xs">P</kbd>{' '}
              for panic answer
            </span>
          </button>
        </footer>
      )}
    </div>
  );
}
