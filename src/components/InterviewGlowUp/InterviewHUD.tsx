import * as React from 'react';
import { cn } from '../../lib/utils';
import type { Story, InterviewPacket, DecodedRole } from '../../lib/glowup-store';
import { getSkillName } from '../../lib/glowup-banks';

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
    const packetStories = stories.filter(s => packet.topStoryIds.includes(s.id));

    // Filter stories by search
    const displayStories = React.useMemo(() => {
        if (!searchQuery.trim()) return packetStories;

        const lower = searchQuery.toLowerCase();
        return stories.filter(s =>
            s.trigger.toLowerCase().includes(lower) ||
            s.hook.toLowerCase().includes(lower) ||
            s.play.toLowerCase().includes(lower) ||
            s.proof.toLowerCase().includes(lower) ||
            getSkillName(s.primarySkillId).toLowerCase().includes(lower) ||
            s.tags.some(t => t.toLowerCase().includes(lower))
        );
    }, [searchQuery, packetStories, stories]);

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
                    setSelectedIndex(i => Math.max(0, i - 1));
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedIndex(i => Math.min(displayStories.length - 1, i + 1));
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
            className="fixed inset-0 z-50 flex flex-col bg-[#0a0a0c] text-white outline-none print:relative print:bg-white print:text-black"
        >
            {/* Top Bar */}
            <header className="flex items-center justify-between border-b border-white/10 bg-[#111114] px-6 py-4 print:bg-gray-100 print:border-gray-300">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onClose}
                        className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white print:hidden"
                        aria-label="Close HUD"
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    <div>
                        <h1 className="text-lg font-bold text-white print:text-black">
                            {role?.company ?? 'Interview'} — {role?.jobTitle ?? 'Packet'}
                        </h1>
                        <div className="mt-1 flex gap-2">
                            {keywords.map((kw, i) => (
                                <span
                                    key={i}
                                    className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs font-medium text-cyan-300 print:bg-cyan-100 print:text-cyan-800"
                                >
                                    {kw}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3 text-sm text-white/50 print:hidden">
                    <kbd className="rounded bg-white/10 px-2 py-0.5">Space</kbd> Search
                    <kbd className="rounded bg-white/10 px-2 py-0.5">↑↓</kbd> Navigate
                    <kbd className="rounded bg-white/10 px-2 py-0.5">Enter</kbd> Expand
                    <kbd className="rounded bg-white/10 px-2 py-0.5">P</kbd> Panic
                    <kbd className="rounded bg-white/10 px-2 py-0.5">Esc</kbd> Close
                </div>
            </header>

            {/* Main Content */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left Column - Stories */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Search Bar */}
                    {searchOpen && (
                        <div className="mb-4 print:hidden">
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search stories by skill, keyword..."
                                className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-lg text-white placeholder:text-white/40 focus:border-cyan-400 focus:outline-none"
                                autoFocus
                            />
                        </div>
                    )}

                    {/* Panic Mode */}
                    {panicMode && packet.panicAnswer && (
                        <div className="mb-6 rounded-xl border-2 border-amber-500/50 bg-amber-500/10 p-6">
                            <div className="mb-2 flex items-center gap-2">
                                <span className="text-2xl">🆘</span>
                                <span className="text-lg font-bold text-amber-400">PANIC ANSWER</span>
                            </div>
                            <p className="text-lg leading-relaxed text-white">{packet.panicAnswer}</p>
                        </div>
                    )}

                    {/* Stories List */}
                    <div className="space-y-3">
                        {displayStories.length === 0 ? (
                            <div className="rounded-xl border border-white/10 p-8 text-center text-white/50">
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
                                                ? 'border-cyan-400/50 bg-cyan-500/10 shadow-lg shadow-cyan-500/10'
                                                : 'border-white/10 bg-white/5 hover:bg-white/10',
                                            isExpanded && 'border-cyan-400'
                                        )}
                                    >
                                        {/* Glance View */}
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs font-semibold text-cyan-300">
                                                        {getSkillName(story.primarySkillId)}
                                                    </span>
                                                    <span className="text-xs text-white/40">{story.confidence}%</span>
                                                </div>
                                                <p className="mt-2 text-lg font-semibold text-white">
                                                    {story.trigger || 'Untitled'}
                                                </p>
                                                <p className="mt-1 text-white/70">{story.hook}</p>
                                                <p className="mt-2 text-sm font-medium text-cyan-400">
                                                    📊 {story.proofSnippet}
                                                </p>
                                            </div>
                                            <div className="text-white/30">
                                                {isExpanded ? (
                                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                                    </svg>
                                                ) : (
                                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                )}
                                            </div>
                                        </div>

                                        {/* Expanded View */}
                                        {isExpanded && (
                                            <div className="mt-4 border-t border-white/10 pt-4">
                                                <div className="space-y-4">
                                                    <div>
                                                        <p className="text-xs font-semibold uppercase tracking-wider text-white/40">Play</p>
                                                        <p className="mt-1 text-white/90 leading-relaxed">{story.play}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-semibold uppercase tracking-wider text-white/40">Proof</p>
                                                        <p className="mt-1 text-cyan-300 leading-relaxed">{story.proof}</p>
                                                    </div>
                                                    {story.questionPrompts.length > 0 && (
                                                        <div>
                                                            <p className="text-xs font-semibold uppercase tracking-wider text-white/40">Answers</p>
                                                            <ul className="mt-1 space-y-1">
                                                                {story.questionPrompts.map((q, i) => (
                                                                    <li key={i} className="text-sm text-white/70">• {q}</li>
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
                <div className="w-80 flex-shrink-0 border-l border-white/10 bg-[#0d0d10] p-6 print:bg-gray-50 print:border-gray-300">
                    <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/50 print:text-gray-600">
                        Questions to Ask
                    </h2>
                    <ul className="space-y-3">
                        {packet.customQuestions.filter(Boolean).map((q, i) => (
                            <li
                                key={i}
                                className="flex items-start gap-2 text-white/80 print:text-gray-800"
                            >
                                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-cyan-400" />
                                <span className="text-sm leading-relaxed">{q}</span>
                            </li>
                        ))}
                    </ul>

                    {packet.customQuestions.filter(Boolean).length === 0 && (
                        <p className="text-sm text-white/40">No questions added yet.</p>
                    )}

                    {/* Notes */}
                    {packet.notes && (
                        <div className="mt-8">
                            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/50 print:text-gray-600">
                                Notes
                            </h2>
                            <p className="text-sm leading-relaxed text-white/70 print:text-gray-700">
                                {packet.notes}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Panic Slot (always visible reminder) */}
            {!panicMode && packet.panicAnswer && (
                <footer className="border-t border-white/10 bg-[#111114] px-6 py-3 print:hidden">
                    <button
                        onClick={() => setPanicMode(true)}
                        className="flex items-center gap-2 text-sm text-amber-400/70 hover:text-amber-400"
                    >
                        <span>🆘</span>
                        <span>Press <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-xs">P</kbd> for panic answer</span>
                    </button>
                </footer>
            )}
        </div>
    );
}
