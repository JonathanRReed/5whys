/**
 * Interview Glow Up - Local Storage Persistence Layer
 * 
 * All data is stored locally in the browser. No data leaves your browser.
 * 
 * UPGRADE PATH NOTE:
 * If the Story Vault grows large (100+ stories), consider migrating to IndexedDB
 * for better performance. Use idb-keyval or Dexie.js for a simple migration path.
 * The data structure is already JSON-serializable for easy migration.
 */

// ============================================================================
// Types
// ============================================================================

export type BulletStatus = 'active' | 'ignored';

export interface DecodedBullet {
    id: string;
    text: string;
    status: BulletStatus;
    primarySkillId: string | null;
    secondarySkillIds: string[];
    suggestion?: { skillId: string; confidence: number }[];
}

export interface DecodedRole {
    id: string;
    jobTitle: string;
    company: string;
    jdUrl?: string;
    rawJdText: string;
    bullets: DecodedBullet[];
    createdAt: number;
    updatedAt: number;
}

export interface Story {
    id: string;
    primarySkillId: string;
    otherSkillIds: string[];
    // Tiered glance system
    trigger: string;       // 1-3 words
    hook: string;          // ~25 words (or 140-char legacy hook)
    proofSnippet: string;  // ~10 words
    play: string;
    proof: string;
    confidence: number;    // 1-100
    questionPrompts: string[];
    tags: string[];
    successRate?: { usedCount: number; positiveCount: number };
    lastUsedAt?: number;
    createdAt: number;
    updatedAt: number;
}

export type PacketMode = 'prep' | 'review' | 'hud';

export interface CompanyIntel {
    keywords: string[];        // 3 keywords for HUD top bar
    notes: string;
    links: string[];
}

export interface InterviewPacket {
    id: string;
    roleId: string;
    mode: PacketMode;
    topStoryIds: string[];      // v1.3 default target = 5
    customQuestions: string[];
    notes: string;              // mission/fit/why-us combined
    panicAnswer?: string;       // Generic safe story if stumped
    companyIntel?: CompanyIntel;
    createdAt: number;
    updatedAt: number;
}

export interface GlowUpData {
    version: number;
    roles: DecodedRole[];
    stories: Story[];
    packets: InterviewPacket[];
    currentRoleId: string | null;
    currentPacketId: string | null;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'interview-glow-up-data';
const CURRENT_VERSION = 1;

// ============================================================================
// Default State
// ============================================================================

export function createDefaultData(): GlowUpData {
    return {
        version: CURRENT_VERSION,
        roles: [],
        stories: [],
        packets: [],
        currentRoleId: null,
        currentPacketId: null,
    };
}

// ============================================================================
// Storage Operations
// ============================================================================

export function loadData(): GlowUpData {
    if (typeof window === 'undefined') {
        return createDefaultData();
    }

    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return createDefaultData();
        }

        const parsed = JSON.parse(raw) as GlowUpData;

        // Version migration (future-proofing)
        if (parsed.version !== CURRENT_VERSION) {
            return migrateData(parsed);
        }

        return parsed;
    } catch (error) {
        console.error('[GlowUp] Failed to load data:', error);
        return createDefaultData();
    }
}

export function saveData(data: GlowUpData): void {
    if (typeof window === 'undefined') return;

    try {
        const json = JSON.stringify(data);
        localStorage.setItem(STORAGE_KEY, json);
    } catch (error) {
        console.error('[GlowUp] Failed to save data:', error);
    }
}

export function clearAllData(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
}

// ============================================================================
// Export/Import
// ============================================================================

export function exportJSON(): void {
    const data = loadData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `interview-glow-up-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function importJSON(file: File): Promise<GlowUpData> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target?.result as string) as GlowUpData;
                saveData(data);
                resolve(data);
            } catch (error) {
                reject(new Error('Invalid JSON file'));
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

// ============================================================================
// Data Migration (placeholder for future versions)
// ============================================================================

function migrateData(oldData: GlowUpData): GlowUpData {
    // For now, just return with updated version
    // Add migration logic here as schema evolves
    return {
        ...oldData,
        version: CURRENT_VERSION,
    };
}

// ============================================================================
// ID Generation
// ============================================================================

export function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ============================================================================
// CRUD Helpers
// ============================================================================

export function createRole(data: GlowUpData, role: Omit<DecodedRole, 'id' | 'createdAt' | 'updatedAt'>): GlowUpData {
    const now = Date.now();
    const newRole: DecodedRole = {
        ...role,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
    };
    return {
        ...data,
        roles: [...data.roles, newRole],
        currentRoleId: newRole.id,
    };
}

export function updateRole(data: GlowUpData, roleId: string, updates: Partial<DecodedRole>): GlowUpData {
    return {
        ...data,
        roles: data.roles.map(r =>
            r.id === roleId
                ? { ...r, ...updates, updatedAt: Date.now() }
                : r
        ),
    };
}

export function deleteRole(data: GlowUpData, roleId: string): GlowUpData {
    return {
        ...data,
        roles: data.roles.filter(r => r.id !== roleId),
        currentRoleId: data.currentRoleId === roleId ? null : data.currentRoleId,
        packets: data.packets.filter(p => p.roleId !== roleId),
    };
}

export function createStory(data: GlowUpData, story: Omit<Story, 'id' | 'createdAt' | 'updatedAt'>): GlowUpData {
    const now = Date.now();
    const newStory: Story = {
        ...story,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
    };
    return {
        ...data,
        stories: [...data.stories, newStory],
    };
}

export function updateStory(data: GlowUpData, storyId: string, updates: Partial<Story>): GlowUpData {
    return {
        ...data,
        stories: data.stories.map(s =>
            s.id === storyId
                ? { ...s, ...updates, updatedAt: Date.now() }
                : s
        ),
    };
}

export function deleteStory(data: GlowUpData, storyId: string): GlowUpData {
    return {
        ...data,
        stories: data.stories.filter(s => s.id !== storyId),
        packets: data.packets.map(p => ({
            ...p,
            topStoryIds: p.topStoryIds.filter(id => id !== storyId),
        })),
    };
}

export function createPacket(data: GlowUpData, packet: Omit<InterviewPacket, 'id' | 'createdAt' | 'updatedAt'>): GlowUpData {
    const now = Date.now();
    const newPacket: InterviewPacket = {
        ...packet,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
    };
    return {
        ...data,
        packets: [...data.packets, newPacket],
        currentPacketId: newPacket.id,
    };
}

export function updatePacket(data: GlowUpData, packetId: string, updates: Partial<InterviewPacket>): GlowUpData {
    return {
        ...data,
        packets: data.packets.map(p =>
            p.id === packetId
                ? { ...p, ...updates, updatedAt: Date.now() }
                : p
        ),
    };
}

export function deletePacket(data: GlowUpData, packetId: string): GlowUpData {
    return {
        ...data,
        packets: data.packets.filter(p => p.id !== packetId),
        currentPacketId: data.currentPacketId === packetId ? null : data.currentPacketId,
    };
}

// ============================================================================
// Query Helpers
// ============================================================================

export function getStoriesBySkill(data: GlowUpData, skillId: string): Story[] {
    return data.stories.filter(s =>
        s.primarySkillId === skillId || s.otherSkillIds.includes(skillId)
    );
}

export function getUnusedStories(data: GlowUpData, packetId: string): Story[] {
    const packet = data.packets.find(p => p.id === packetId);
    if (!packet) return data.stories;

    const usedIds = new Set(packet.topStoryIds);
    return data.stories.filter(s => !usedIds.has(s.id));
}

export function getSkillFrequencyMap(role: DecodedRole): Map<string, number> {
    const freq = new Map<string, number>();

    for (const bullet of role.bullets) {
        if (bullet.status === 'ignored') continue;

        if (bullet.primarySkillId) {
            freq.set(bullet.primarySkillId, (freq.get(bullet.primarySkillId) || 0) + 1);
        }
        for (const skillId of bullet.secondarySkillIds) {
            freq.set(skillId, (freq.get(skillId) || 0) + 1);
        }
    }

    return freq;
}

export function getTopGaps(data: GlowUpData, role: DecodedRole, count: number = 3): string[] {
    const freq = getSkillFrequencyMap(role);
    const storySkills = new Set<string>();

    for (const story of data.stories) {
        storySkills.add(story.primarySkillId);
        story.otherSkillIds.forEach(id => storySkills.add(id));
    }

    // Skills required by JD but with no stories
    const gaps: [string, number][] = [];
    for (const [skillId, frequency] of freq) {
        if (!storySkills.has(skillId)) {
            gaps.push([skillId, frequency]);
        }
    }

    // Sort by frequency (highest first)
    gaps.sort((a, b) => b[1] - a[1]);

    return gaps.slice(0, count).map(([skillId]) => skillId);
}
