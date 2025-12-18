import * as React from 'react';
import { cn } from '../../lib/utils';
import {
    type GlowUpData,
    type DecodedRole,
    type DecodedBullet,
    type Story,
    type InterviewPacket,
    loadData,
    saveData,
    exportJSON,
    clearAllData,
    createRole,
    updateRole,
    createStory,
    updateStory,
    deleteStory,
    createPacket,
    updatePacket,
    generateId,
    getSkillFrequencyMap,
    getTopGaps,
    getUnusedStories,
} from '../../lib/glowup-store';
import {
    SKILL_BANK,
    getSkillName,
    detectSkillsFromText,
    QUESTION_BANK,
    getQuestionsForSkill,
    SUGGESTED_QUESTIONS_TO_ASK,
} from '../../lib/glowup-banks';
import InterviewHUD from './InterviewHUD';

// ============================================================================
// Types
// ============================================================================

type Tab = 'decode' | 'stories' | 'vault' | 'packet';

// ============================================================================
// Main Component
// ============================================================================

export default function InterviewGlowUpWorkspace() {
    const [data, setData] = React.useState<GlowUpData | null>(null);
    const [activeTab, setActiveTab] = React.useState<Tab>('decode');
    const [showHUD, setShowHUD] = React.useState(false);

    // Load data on mount
    React.useEffect(() => {
        setData(loadData());
    }, []);

    // Save data on change
    React.useEffect(() => {
        if (data) {
            saveData(data);
        }
    }, [data]);

    if (!data) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="text-muted-foreground">Loading...</div>
            </div>
        );
    }

    const currentRole = data.roles.find(r => r.id === data.currentRoleId);
    const currentPacket = data.packets.find(p => p.id === data.currentPacketId);

    // Show HUD overlay
    if (showHUD && currentPacket) {
        return (
            <InterviewHUD
                packet={currentPacket}
                stories={data.stories}
                role={currentRole}
                onClose={() => setShowHUD(false)}
            />
        );
    }

    const tabs: { id: Tab; label: string; icon: string }[] = [
        { id: 'decode', label: 'Decode JD', icon: '🔍' },
        { id: 'stories', label: 'Build Stories', icon: '✏️' },
        { id: 'vault', label: 'Vault', icon: '🗄️' },
        { id: 'packet', label: 'Packet', icon: '📋' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                        Interview Workspace
                    </h1>
                    <p className="mt-1 text-muted-foreground">
                        Decode → Build Stories → Save to Vault → Create Packet
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={exportJSON}
                        className="rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-[hsl(var(--overlay)/0.5)] hover:text-foreground"
                    >
                        Export JSON
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            if (confirm('Clear all data? This cannot be undone.')) {
                                clearAllData();
                                setData(loadData());
                            }
                        }}
                        className="rounded-lg border border-[hsl(var(--destructive)/0.3)] bg-[hsl(var(--destructive)/0.08)] px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-[hsl(var(--destructive)/0.15)]"
                    >
                        Clear Data
                    </button>
                </div>
            </div>

            {/* Privacy Notice */}
            <div className="flex items-center gap-2 rounded-lg border border-[hsl(var(--foam)/0.25)] bg-[hsl(var(--foam)/0.05)] px-4 py-2 text-sm text-muted-foreground">
                <svg className="h-4 w-4 flex-shrink-0 text-[hsl(var(--foam))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span><strong>No data leaves your browser.</strong> Everything is stored locally.</span>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2 border-b border-[hsl(var(--border)/0.3)] pb-2">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
                            activeTab === tab.id
                                ? 'bg-[hsl(var(--foam)/0.15)] text-foreground shadow-sm'
                                : 'text-muted-foreground hover:bg-[hsl(var(--overlay)/0.3)] hover:text-foreground'
                        )}
                    >
                        <span>{tab.icon}</span>
                        <span>{tab.label}</span>
                    </button>
                ))}
                {currentPacket && (
                    <button
                        type="button"
                        onClick={() => setShowHUD(true)}
                        className="ml-auto flex items-center gap-2 rounded-lg bg-[hsl(var(--foam))] px-4 py-2 text-sm font-semibold text-[hsl(var(--background))] shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
                    >
                        <span>🎯</span>
                        <span>Launch HUD</span>
                    </button>
                )}
            </div>

            {/* Tab Content */}
            <div className="rounded-2xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.2)] p-6">
                {activeTab === 'decode' && (
                    <DecodeSection
                        data={data}
                        setData={setData}
                        currentRole={currentRole}
                    />
                )}
                {activeTab === 'stories' && (
                    <StoriesSection
                        data={data}
                        setData={setData}
                        currentRole={currentRole}
                    />
                )}
                {activeTab === 'vault' && (
                    <VaultSection
                        data={data}
                        setData={setData}
                        currentPacket={currentPacket}
                    />
                )}
                {activeTab === 'packet' && (
                    <PacketSection
                        data={data}
                        setData={setData}
                        currentRole={currentRole}
                        currentPacket={currentPacket}
                        onLaunchHUD={() => setShowHUD(true)}
                    />
                )}
            </div>
        </div>
    );
}

// ============================================================================
// Decode Section
// ============================================================================

interface DecodeSectionProps {
    data: GlowUpData;
    setData: React.Dispatch<React.SetStateAction<GlowUpData | null>>;
    currentRole: DecodedRole | undefined;
}

function DecodeSection({ data, setData, currentRole }: DecodeSectionProps) {
    const [jobTitle, setJobTitle] = React.useState(currentRole?.jobTitle ?? '');
    const [company, setCompany] = React.useState(currentRole?.company ?? '');
    const [jdUrl, setJdUrl] = React.useState(currentRole?.jdUrl ?? '');
    const [rawJdText, setRawJdText] = React.useState(currentRole?.rawJdText ?? '');
    const [bullets, setBullets] = React.useState<DecodedBullet[]>(currentRole?.bullets ?? []);
    const [selectedBullets, setSelectedBullets] = React.useState<Set<string>>(new Set());

    // Parse JD into bullets
    const parseJD = () => {
        if (!rawJdText.trim()) return;

        const lines = rawJdText
            .split(/\n/)
            .map(line => line.trim())
            .filter(line => line.length > 0);

        const parsed: DecodedBullet[] = [];

        for (const line of lines) {
            // Remove common bullet prefixes
            const cleanLine = line
                .replace(/^[\•\-\*\◦\○\●]\s*/, '')
                .replace(/^\d+[\.\)]\s*/, '')
                .trim();

            if (!cleanLine) continue;

            // Detect skills
            const suggestions = detectSkillsFromText(cleanLine);

            parsed.push({
                id: generateId(),
                text: cleanLine,
                status: 'active',
                primarySkillId: suggestions[0]?.skillId ?? null,
                secondarySkillIds: suggestions.slice(1).map(s => s.skillId),
                suggestion: suggestions,
            });
        }

        setBullets(parsed);
    };

    // Save role
    const saveRole = () => {
        if (!jobTitle.trim()) return;

        if (currentRole) {
            setData(updateRole(data, currentRole.id, {
                jobTitle,
                company,
                jdUrl: jdUrl || undefined,
                rawJdText,
                bullets,
            }));
        } else {
            setData(createRole(data, {
                jobTitle,
                company,
                jdUrl: jdUrl || undefined,
                rawJdText,
                bullets,
            }));
        }
    };

    // Skill frequency
    const skillFreq = currentRole ? getSkillFrequencyMap(currentRole) : new Map();
    const totalBullets = bullets.filter(b => b.status === 'active' && b.primarySkillId).length;
    const topGaps = currentRole ? getTopGaps(data, currentRole) : [];

    // Is this a noise line?
    const isNoise = (text: string) => text.split(/\s+/).length < 4;

    // Bulk actions
    const handleBulkTag = (skillId: string) => {
        setBullets(bullets.map(b =>
            selectedBullets.has(b.id)
                ? { ...b, primarySkillId: skillId }
                : b
        ));
        setSelectedBullets(new Set());
    };

    const handleBulkIgnore = () => {
        setBullets(bullets.map(b =>
            selectedBullets.has(b.id)
                ? { ...b, status: 'ignored' as const }
                : b
        ));
        setSelectedBullets(new Set());
    };

    return (
        <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">Job Title</label>
                    <input
                        type="text"
                        value={jobTitle}
                        onChange={e => setJobTitle(e.target.value)}
                        placeholder="e.g., Senior Software Engineer"
                        className="w-full rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-[hsl(var(--foam))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--foam))]"
                    />
                </div>
                <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">Company</label>
                    <input
                        type="text"
                        value={company}
                        onChange={e => setCompany(e.target.value)}
                        placeholder="e.g., Acme Corp"
                        className="w-full rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-[hsl(var(--foam))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--foam))]"
                    />
                </div>
            </div>

            <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Job Description URL (optional)</label>
                <input
                    type="url"
                    value={jdUrl}
                    onChange={e => setJdUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-[hsl(var(--foam))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--foam))]"
                />
            </div>

            <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Paste Full Job Description</label>
                <textarea
                    value={rawJdText}
                    onChange={e => setRawJdText(e.target.value)}
                    placeholder="Paste the entire job description here. Include bullet points, requirements, responsibilities..."
                    rows={8}
                    className="w-full rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-[hsl(var(--foam))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--foam))]"
                />
                <div className="mt-2 flex gap-2">
                    <button
                        type="button"
                        onClick={parseJD}
                        className="rounded-lg bg-[hsl(var(--foam))] px-4 py-2 text-sm font-semibold text-[hsl(var(--background))] transition-colors hover:bg-[hsl(var(--foam)/0.9)]"
                    >
                        Parse Bullets
                    </button>
                    <button
                        type="button"
                        onClick={saveRole}
                        disabled={!jobTitle.trim()}
                        className="rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-[hsl(var(--overlay)/0.5)] disabled:opacity-50"
                    >
                        Save Role
                    </button>
                </div>
            </div>

            {/* Bullets Table */}
            {bullets.length > 0 && (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-lg font-semibold text-foreground">Parsed Bullets ({bullets.length})</h3>
                        {selectedBullets.size > 0 && (
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">{selectedBullets.size} selected</span>
                                <select
                                    onChange={e => {
                                        if (e.target.value) handleBulkTag(e.target.value);
                                    }}
                                    className="rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-2 py-1 text-sm text-foreground"
                                    defaultValue=""
                                >
                                    <option value="">Bulk tag...</option>
                                    {SKILL_BANK.map(skill => (
                                        <option key={skill.id} value={skill.id}>{skill.name}</option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={handleBulkIgnore}
                                    className="rounded-lg border border-[hsl(var(--destructive)/0.3)] bg-[hsl(var(--destructive)/0.1)] px-2 py-1 text-sm text-destructive"
                                >
                                    Ignore
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="max-h-96 space-y-2 overflow-y-auto rounded-lg border border-[hsl(var(--border)/0.3)] bg-[hsl(var(--overlay)/0.15)] p-3">
                        {bullets.map(bullet => (
                            <div
                                key={bullet.id}
                                className={cn(
                                    'flex items-start gap-3 rounded-lg border p-3 transition-colors',
                                    bullet.status === 'ignored'
                                        ? 'border-[hsl(var(--border)/0.2)] bg-[hsl(var(--overlay)/0.1)] opacity-50'
                                        : isNoise(bullet.text)
                                            ? 'border-[hsl(var(--gold)/0.3)] bg-[hsl(var(--gold)/0.05)]'
                                            : 'border-[hsl(var(--border)/0.3)] bg-[hsl(var(--overlay)/0.2)]'
                                )}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedBullets.has(bullet.id)}
                                    onChange={e => {
                                        const newSet = new Set(selectedBullets);
                                        if (e.target.checked) {
                                            newSet.add(bullet.id);
                                        } else {
                                            newSet.delete(bullet.id);
                                        }
                                        setSelectedBullets(newSet);
                                    }}
                                    className="mt-1 h-4 w-4 rounded border-[hsl(var(--border))] accent-[hsl(var(--foam))]"
                                />
                                <div className="flex-1 space-y-2">
                                    <p className={cn(
                                        'text-sm',
                                        bullet.status === 'ignored' ? 'text-muted-foreground line-through' : 'text-foreground'
                                    )}>
                                        {bullet.text}
                                        {isNoise(bullet.text) && bullet.status !== 'ignored' && (
                                            <span className="ml-2 rounded bg-[hsl(var(--gold)/0.2)] px-1.5 py-0.5 text-xs text-[hsl(var(--gold))]">
                                                noise?
                                            </span>
                                        )}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <select
                                            value={bullet.primarySkillId ?? ''}
                                            onChange={e => {
                                                setBullets(bullets.map(b =>
                                                    b.id === bullet.id
                                                        ? { ...b, primarySkillId: e.target.value || null }
                                                        : b
                                                ));
                                            }}
                                            className="rounded border border-[hsl(var(--border)/0.4)] bg-[hsl(var(--overlay)/0.3)] px-2 py-1 text-xs text-foreground"
                                        >
                                            <option value="">Select skill...</option>
                                            {SKILL_BANK.map(skill => (
                                                <option key={skill.id} value={skill.id}>{skill.name}</option>
                                            ))}
                                        </select>
                                        {bullet.suggestion && bullet.suggestion.length > 0 && (
                                            <div className="flex items-center gap-1">
                                                <span className="text-xs text-muted-foreground">Suggested:</span>
                                                {bullet.suggestion.slice(0, 2).map(s => (
                                                    <button
                                                        key={s.skillId}
                                                        type="button"
                                                        onClick={() => {
                                                            setBullets(bullets.map(b =>
                                                                b.id === bullet.id
                                                                    ? { ...b, primarySkillId: s.skillId }
                                                                    : b
                                                            ));
                                                        }}
                                                        className="rounded-full bg-[hsl(var(--foam)/0.15)] px-2 py-0.5 text-xs text-[hsl(var(--foam))] hover:bg-[hsl(var(--foam)/0.25)]"
                                                    >
                                                        {getSkillName(s.skillId)} ({s.confidence}%)
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setBullets(bullets.map(b =>
                                                    b.id === bullet.id
                                                        ? { ...b, status: b.status === 'ignored' ? 'active' : 'ignored' }
                                                        : b
                                                ));
                                            }}
                                            className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                                        >
                                            {bullet.status === 'ignored' ? 'Restore' : 'Ignore'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Skill Frequency & Gaps */}
            {skillFreq.size > 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-[hsl(var(--border)/0.3)] bg-[hsl(var(--overlay)/0.15)] p-4">
                        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                            Skill Frequency Map
                        </h4>
                        <div className="space-y-2">
                            {Array.from(skillFreq.entries())
                                .sort((a, b) => b[1] - a[1])
                                .slice(0, 8)
                                .map(([skillId, count]) => {
                                    const pct = totalBullets > 0 ? Math.round((count / totalBullets) * 100) : 0;
                                    return (
                                        <div key={skillId} className="flex items-center gap-2">
                                            <span className="w-24 truncate text-sm text-foreground">{getSkillName(skillId)}</span>
                                            <div className="flex-1 h-2 rounded-full bg-[hsl(var(--overlay)/0.4)]">
                                                <div
                                                    className="h-full rounded-full bg-[hsl(var(--foam))]"
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                            <span className="w-10 text-right text-xs text-muted-foreground">{pct}%</span>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>

                    <div className="rounded-xl border border-[hsl(var(--destructive)/0.25)] bg-[hsl(var(--destructive)/0.05)] p-4">
                        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-destructive">
                            Top 3 Gaps (No Stories Yet)
                        </h4>
                        {topGaps.length === 0 ? (
                            <p className="text-sm text-muted-foreground">All skills covered! 🎉</p>
                        ) : (
                            <ul className="space-y-1">
                                {topGaps.map(skillId => (
                                    <li key={skillId} className="flex items-center gap-2 text-sm text-foreground">
                                        <span className="h-2 w-2 rounded-full bg-destructive" />
                                        {getSkillName(skillId)}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// Stories Section
// ============================================================================

interface StoriesSectionProps {
    data: GlowUpData;
    setData: React.Dispatch<React.SetStateAction<GlowUpData | null>>;
    currentRole: DecodedRole | undefined;
}

function StoriesSection({ data, setData, currentRole }: StoriesSectionProps) {
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

    // Validation warnings
    const playSentences = (formData.play ?? '').split(/[.!?]+/).filter(s => s.trim()).length;
    const hasNumbers = /[$%#0-9]/.test(formData.proof ?? '');

    // Suggested skills from current role gaps
    const topGaps = currentRole ? getTopGaps(data, currentRole) : [];

    return (
        <div className="space-y-6">
            {/* Quick Start */}
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

            {/* Story Form */}
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
                            ✕
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

                    {/* Glance Fields */}
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
                                placeholder="Led migration of legacy API..."
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
                                <span className="text-xs text-[hsl(var(--gold))]">⚠️ Keep it under 4 sentences</span>
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
                                <span className="text-xs text-[hsl(var(--gold))]">💡 Can you quantify this?</span>
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

            {/* Recent Stories */}
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

// ============================================================================
// Vault Section
// ============================================================================

interface VaultSectionProps {
    data: GlowUpData;
    setData: React.Dispatch<React.SetStateAction<GlowUpData | null>>;
    currentPacket: InterviewPacket | undefined;
}

function VaultSection({ data, setData, currentPacket }: VaultSectionProps) {
    const [filter, setFilter] = React.useState('');
    const [skillFilter, setSkillFilter] = React.useState('');
    const [showUnused, setShowUnused] = React.useState(false);
    const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

    let stories = [...data.stories].sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0));

    // Apply filters
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

        // Update lastUsedAt for added stories
        const updatedStories = data.stories.map(s =>
            newIds.includes(s.id) ? { ...s, lastUsedAt: Date.now() } : s
        );
        setData(prev => prev ? { ...prev, stories: updatedStories } : prev);
        setSelectedIds(new Set());
    };

    return (
        <div className="space-y-4">
            {/* Filters */}
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

            {/* Batch Actions */}
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

            {/* Stories Grid */}
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
                                            <span className="text-xs text-[hsl(var(--foam))]">✓ in packet</span>
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

// ============================================================================
// Packet Section
// ============================================================================

interface PacketSectionProps {
    data: GlowUpData;
    setData: React.Dispatch<React.SetStateAction<GlowUpData | null>>;
    currentRole: DecodedRole | undefined;
    currentPacket: InterviewPacket | undefined;
    onLaunchHUD: () => void;
}

function PacketSection({ data, setData, currentRole, currentPacket, onLaunchHUD }: PacketSectionProps) {
    const [mode, setMode] = React.useState<'prep' | 'review'>('prep');

    // Create packet if none exists
    const createNewPacket = () => {
        if (!currentRole) return;

        setData(createPacket(data, {
            roleId: currentRole.id,
            mode: 'prep',
            topStoryIds: [],
            customQuestions: [],
            notes: '',
            panicAnswer: '',
            companyIntel: {
                keywords: [],
                notes: '',
                links: [],
            },
        }));
    };

    if (!currentRole) {
        return (
            <div className="rounded-xl border border-dashed border-[hsl(var(--border)/0.4)] p-8 text-center">
                <p className="text-muted-foreground">Decode a job description first to create a packet.</p>
            </div>
        );
    }

    if (!currentPacket) {
        return (
            <div className="rounded-xl border border-dashed border-[hsl(var(--border)/0.4)] p-8 text-center">
                <p className="text-muted-foreground">No packet yet for this role.</p>
                <button
                    type="button"
                    onClick={createNewPacket}
                    className="mt-4 rounded-lg bg-[hsl(var(--foam))] px-4 py-2 text-sm font-semibold text-[hsl(var(--background))]"
                >
                    Create Interview Packet
                </button>
            </div>
        );
    }

    const packetStories = data.stories.filter(s => currentPacket.topStoryIds.includes(s.id));

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3 className="text-lg font-semibold text-foreground">
                        {currentRole.company} — {currentRole.jobTitle}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        {packetStories.length} stories in packet (target: 5)
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setMode('prep')}
                        className={cn(
                            'rounded-lg px-3 py-1.5 text-sm font-medium',
                            mode === 'prep'
                                ? 'bg-[hsl(var(--foam)/0.15)] text-[hsl(var(--foam))]'
                                : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        Prep
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode('review')}
                        className={cn(
                            'rounded-lg px-3 py-1.5 text-sm font-medium',
                            mode === 'review'
                                ? 'bg-[hsl(var(--iris)/0.15)] text-[hsl(var(--iris))]'
                                : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        Review
                    </button>
                    <button
                        type="button"
                        onClick={onLaunchHUD}
                        className="rounded-lg bg-[hsl(var(--foam))] px-3 py-1.5 text-sm font-semibold text-[hsl(var(--background))]"
                    >
                        🎯 HUD
                    </button>
                </div>
            </div>

            {/* Prep Mode - Full editing */}
            {mode === 'prep' && (
                <div className="space-y-6">
                    {/* Company Intel */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Company Intel</h4>
                        <div>
                            <label className="mb-1 block text-sm text-muted-foreground">3 Keywords (for HUD header)</label>
                            <input
                                type="text"
                                value={currentPacket.companyIntel?.keywords.join(', ') ?? ''}
                                onChange={e => {
                                    const keywords = e.target.value.split(',').map(k => k.trim()).filter(Boolean).slice(0, 3);
                                    setData(updatePacket(data, currentPacket.id, {
                                        companyIntel: { ...currentPacket.companyIntel!, keywords },
                                    }));
                                }}
                                placeholder="e.g., growth, developer productivity, AI-first"
                                className="w-full rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-3 py-2 text-sm text-foreground"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm text-muted-foreground">Notes (mission/fit/why-us)</label>
                            <textarea
                                value={currentPacket.notes}
                                onChange={e => setData(updatePacket(data, currentPacket.id, { notes: e.target.value }))}
                                placeholder="Why are you excited about this role? What makes you a good fit?"
                                rows={3}
                                className="w-full rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-3 py-2 text-sm text-foreground"
                            />
                        </div>
                    </div>

                    {/* Panic Answer */}
                    <div>
                        <label className="mb-1 block text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                            Panic Answer (generic safe story)
                        </label>
                        <textarea
                            value={currentPacket.panicAnswer ?? ''}
                            onChange={e => setData(updatePacket(data, currentPacket.id, { panicAnswer: e.target.value }))}
                            placeholder="A generic story you can use if you completely blank..."
                            rows={2}
                            className="w-full rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-3 py-2 text-sm text-foreground"
                        />
                    </div>

                    {/* Questions to Ask */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Questions to Ask</h4>
                        <div className="space-y-2">
                            {(currentPacket.customQuestions.length > 0 ? currentPacket.customQuestions : ['']).map((q, i) => (
                                <div key={i} className="flex gap-2">
                                    <input
                                        type="text"
                                        value={q}
                                        onChange={e => {
                                            const updated = [...currentPacket.customQuestions];
                                            updated[i] = e.target.value;
                                            setData(updatePacket(data, currentPacket.id, { customQuestions: updated }));
                                        }}
                                        placeholder="Your question..."
                                        className="flex-1 rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-3 py-2 text-sm text-foreground"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const updated = currentPacket.customQuestions.filter((_, j) => j !== i);
                                            setData(updatePacket(data, currentPacket.id, { customQuestions: updated }));
                                        }}
                                        className="text-muted-foreground hover:text-destructive"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={() => {
                                    setData(updatePacket(data, currentPacket.id, {
                                        customQuestions: [...currentPacket.customQuestions, ''],
                                    }));
                                }}
                                className="text-sm text-[hsl(var(--foam))] hover:underline"
                            >
                                + Add question
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                            <span className="text-xs text-muted-foreground">Suggestions:</span>
                            {SUGGESTED_QUESTIONS_TO_ASK.slice(0, 4).map((q, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => {
                                        if (!currentPacket.customQuestions.includes(q)) {
                                            setData(updatePacket(data, currentPacket.id, {
                                                customQuestions: [...currentPacket.customQuestions, q],
                                            }));
                                        }
                                    }}
                                    className="rounded-full bg-[hsl(var(--overlay)/0.4)] px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                                >
                                    + {q.slice(0, 30)}...
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Review Mode - Hooks only */}
            {mode === 'review' && (
                <div className="space-y-4">
                    {packetStories.length === 0 ? (
                        <p className="text-center text-muted-foreground">No stories in packet. Add from the Vault.</p>
                    ) : (
                        packetStories.map(story => (
                            <div
                                key={story.id}
                                className="rounded-xl border border-[hsl(var(--border)/0.3)] bg-[hsl(var(--overlay)/0.15)] p-4"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <span className="rounded-full bg-[hsl(var(--foam)/0.15)] px-2 py-0.5 text-xs font-medium text-[hsl(var(--foam))]">
                                        {getSkillName(story.primarySkillId)}
                                    </span>
                                    <span className="text-xs text-muted-foreground">{story.confidence}%</span>
                                </div>
                                <p className="mt-2 font-medium text-foreground">{story.trigger}</p>
                                <p className="mt-1 text-sm text-muted-foreground">{story.hook}</p>
                                <p className="mt-2 text-sm font-medium text-[hsl(var(--foam))]">{story.proofSnippet}</p>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Print button */}
            <div className="flex justify-center pt-4">
                <button
                    type="button"
                    onClick={() => window.print()}
                    className="rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-[hsl(var(--overlay)/0.5)] hover:text-foreground"
                >
                    🖨️ Print / Export PDF
                </button>
            </div>
        </div>
    );
}
