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

import { localDate } from './local-date';
import { isRealAnswer } from './non-answer';
import { hiringCondition } from './posting/conditions';
import {
  isPostingSection,
  isSourceSpan,
  type PostingSection,
  type RequirementOrigin,
  type SourceSpan,
} from './posting/types';

// ============================================================================
// Types
// ============================================================================

export type BulletStatus = 'active' | 'ignored';

/** How ready a story is to be told out loud. Three honest states, no percentage. */
export type Readiness = 'rough' | 'solid' | 'rehearsed';

export const READINESS: { id: Readiness; label: string; hint: string; confidence: number }[] = [
  {
    id: 'rough',
    label: 'Rough',
    hint: 'Notes only. You would stumble telling it.',
    confidence: 30,
  },
  {
    id: 'solid',
    label: 'Solid',
    hint: 'You can tell it, but you have not said it out loud.',
    confidence: 60,
  },
  {
    id: 'rehearsed',
    label: 'Rehearsed',
    hint: 'Said out loud at least twice. Ready.',
    confidence: 90,
  },
];

export function readinessOf(story: { readiness?: Readiness; confidence?: number }): Readiness {
  if (story.readiness) return story.readiness;
  const c = story.confidence ?? 60;
  return c <= 40 ? 'rough' : c <= 75 ? 'solid' : 'rehearsed';
}

export function readinessLabel(story: { readiness?: Readiness; confidence?: number }): string {
  const id = readinessOf(story);
  return READINESS.find((r) => r.id === id)?.label ?? 'Solid';
}

export interface DecodedBullet {
  id: string;
  text: string;
  status: BulletStatus;
  primarySkillId: string | null;
  secondarySkillIds: string[];
  /**
   * Skill suggestions from detection. matchedKeywords lists the exact JD
   * terms that triggered each suggestion. Older saved data may lack
   * matchedKeywords (it previously stored a fabricated confidence number),
   * so consumers should guard for undefined.
   */
  suggestion?: { skillId: string; matchedKeywords?: string[] }[];
  /**
   * Posting section from the posting engine. Absent in saves made before the
   * engine; loadData fills `unclassified`.
   */
  section?: PostingSection;
  /**
   * Offsets of the source sentence in the role's `parsedJdText`. Null when
   * unknown (older saves) or when the student wrote the line.
   */
  sourceSpan?: SourceSpan | null;
  /** The student confirmed this requirement. loadData fills false. */
  confirmed?: boolean;
  /** Who wrote the line. loadData fills `parsed`, which every older save is. */
  origin?: RequirementOrigin;
}

export interface DecodedRole {
  id: string;
  jobTitle: string;
  company: string;
  jdUrl?: string;
  rawJdText: string;
  /** Exact source used for requirement analysis; absent in legacy saves. */
  parsedJdText?: string;
  bullets: DecodedBullet[];
  /**
   * Which posting parser produced the bullets: POSTING_ENGINE_VERSION for
   * the section-aware engine, absent for the original line-based decode, so
   * the interface can offer to re-sort an older role. loadData leaves it
   * absent rather than filling it, so an older save exports unchanged.
   */
  postingEngineVersion?: number;
  createdAt: number;
  updatedAt: number;
}

/** Stamp for roles decoded by src/lib/posting. */
export const POSTING_ENGINE_VERSION = 1;

export interface Story {
  id: string;
  primarySkillId: string;
  otherSkillIds: string[];
  // Tiered glance system
  trigger: string; // 1-3 words
  hook: string; // ~25 words (or 140-char legacy hook)
  proofSnippet: string; // ~10 words
  play: string;
  proof: string;
  /** Kept for older saves; the UI uses readiness (see readinessOf). */
  confidence: number; // 1-100
  readiness?: Readiness;
  questionPrompts: string[];
  tags: string[];
  successRate?: { usedCount: number; positiveCount: number };
  lastUsedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export type PacketMode = 'prep' | 'review' | 'hud';

export interface CompanyIntel {
  keywords: string[]; // 3 keywords for HUD top bar
  notes: string;
  links: string[];
}

export interface InterviewPacket {
  id: string;
  roleId: string;
  mode: PacketMode;
  topStoryIds: string[]; // v1.3 default target = 5
  customQuestions: string[];
  notes: string; // mission/fit/why-us combined
  panicAnswer?: string; // Generic safe story if stumped
  companyIntel?: CompanyIntel;
  /**
   * Freeform paste-back from the visitor's own AI (the BYO flow builds the
   * prompt locally; nothing is sent anywhere by this site). Stored verbatim
   * and never parsed, merged, or scored.
   */
  aiQuestions?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * An answer from the rehearsal room the visitor chose to keep. Written only
 * when they press Keep, so a visit that only practised writes nothing.
 */
export interface KeptAnswer {
  id: string;
  /** The role it was practised for, or null when no posting was decoded. */
  roleId: string | null;
  question: string;
  /** The bank question, when it came from the bank. */
  questionId?: string;
  /** The posting line the question tested, verbatim, when there was one. */
  requirement?: string | null;
  /** Skills the question tests, so a story drafted from it starts tagged. */
  skillIds: string[];
  text: string;
  /** Whether it was typed or spoken (a corrected transcript). */
  mode: 'typed' | 'spoken';
  createdAt: number;
  updatedAt: number;
}

export interface GlowUpData {
  version: number;
  roles: DecodedRole[];
  stories: Story[];
  packets: InterviewPacket[];
  /** Answers kept from the rehearsal room. Absent in older saves. */
  answers?: KeptAnswer[];
  currentRoleId: string | null;
  currentPacketId: string | null;
}

// ============================================================================
// Constants
// ============================================================================

export const STORAGE_KEY = 'interview-glow-up-data';
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
    if (!parsed || typeof parsed !== 'object') {
      return createDefaultData();
    }

    // Version migration (future-proofing)
    if (parsed.version !== CURRENT_VERSION) {
      return normalizeData(migrateData(parsed));
    }

    return normalizeData(parsed);
  } catch (error) {
    console.error('[GlowUp] Failed to load data:', error);
    return createDefaultData();
  }
}

/** The workspace exactly as storage holds it, unparsed, to tell whether another tab wrote it. */
export function readStoredJson(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Write the workspace. Returns false when the browser refused (storage full
 * or blocked), so the page never says "Saved" for an edit that was not kept.
 */
export function saveData(data: GlowUpData): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const json = JSON.stringify(data);
    localStorage.setItem(STORAGE_KEY, json);
    return true;
  } catch (error) {
    console.error('[GlowUp] Failed to save data:', error);
    return false;
  }
}

export function clearAllData(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

// ============================================================================
// Export/Import
// ============================================================================

/**
 * Download the workspace as a backup file. Pass the data on screen when it
 * may be newer than what storage holds, for example after a failed save.
 */
export function exportJSON(current?: GlowUpData): void {
  const data = current ?? loadData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `interview-glow-up-backup-${localDate()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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

/**
 * Hand-edited backups and older saves can arrive with whole collections,
 * per-record arrays, or string fields missing, and the sections iterate and
 * call string methods on those fields blind. One missing `otherSkillIds`
 * used to take the whole workspace down. Fill in the shape; leave the
 * content alone.
 */
function normalizeData(data: GlowUpData): GlowUpData {
  const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
  const asString = (value: unknown): string => (typeof value === 'string' ? value : '');
  const asNumber = (value: unknown): number => (typeof value === 'number' ? value : 0);
  return {
    ...data,
    roles: asArray<DecodedRole>(data.roles).map(({ postingEngineVersion, ...role }) => ({
      ...role,
      // Absent means the original line-based decode; only a malformed value is dropped.
      ...(typeof postingEngineVersion === 'number' ? { postingEngineVersion } : {}),
      jobTitle: asString(role.jobTitle),
      company: asString(role.company),
      rawJdText: asString(role.rawJdText),
      createdAt: asNumber(role.createdAt),
      updatedAt: asNumber(role.updatedAt),
      bullets: asArray<DecodedBullet>(role.bullets).map((bullet) => ({
        ...bullet,
        text: asString(bullet.text),
        status: bullet.status === 'ignored' ? 'ignored' : 'active',
        primarySkillId: typeof bullet.primarySkillId === 'string' ? bullet.primarySkillId : null,
        secondarySkillIds: asArray<string>(bullet.secondarySkillIds),
        suggestion: asArray<{ skillId?: unknown; matchedKeywords?: unknown }>(bullet.suggestion)
          .filter((s) => s && typeof s === 'object')
          .map((s) => ({
            skillId: asString(s.skillId),
            matchedKeywords: asArray<string>(s.matchedKeywords),
          })),
        section: isPostingSection(bullet.section) ? bullet.section : 'unclassified',
        sourceSpan: isSourceSpan(bullet.sourceSpan) ? bullet.sourceSpan : null,
        confirmed: bullet.confirmed === true,
        origin: bullet.origin === 'student' ? 'student' : 'parsed',
      })),
    })),
    stories: asArray<Story>(data.stories).map((story) => ({
      ...story,
      primarySkillId: asString(story.primarySkillId),
      otherSkillIds: asArray<string>(story.otherSkillIds),
      trigger: asString(story.trigger),
      hook: asString(story.hook),
      proofSnippet: asString(story.proofSnippet),
      play: asString(story.play),
      proof: asString(story.proof),
      confidence: asNumber(story.confidence) || 60,
      questionPrompts: asArray<string>(story.questionPrompts),
      tags: asArray<string>(story.tags),
      createdAt: asNumber(story.createdAt),
      updatedAt: asNumber(story.updatedAt),
    })),
    packets: asArray<InterviewPacket>(data.packets).map((packet) => ({
      ...packet,
      roleId: asString(packet.roleId),
      mode: packet.mode === 'review' || packet.mode === 'hud' ? packet.mode : 'prep',
      topStoryIds: asArray<string>(packet.topStoryIds),
      customQuestions: asArray<string>(packet.customQuestions),
      notes: asString(packet.notes),
      ...(packet.companyIntel && typeof packet.companyIntel === 'object'
        ? {
            companyIntel: {
              keywords: asArray<string>(packet.companyIntel.keywords),
              notes: asString(packet.companyIntel.notes),
              links: asArray<string>(packet.companyIntel.links),
            },
          }
        : {}),
      createdAt: asNumber(packet.createdAt),
      updatedAt: asNumber(packet.updatedAt),
    })),
    // Absent stays absent, so an older save exports unchanged.
    ...(Array.isArray(data.answers)
      ? {
          answers: asArray<KeptAnswer>(data.answers)
            .filter((a) => a && typeof a === 'object' && typeof a.id === 'string')
            .map((answer) => ({
              ...answer,
              roleId: typeof answer.roleId === 'string' ? answer.roleId : null,
              question: asString(answer.question),
              requirement: typeof answer.requirement === 'string' ? answer.requirement : null,
              skillIds: asArray<string>(answer.skillIds).filter((id) => typeof id === 'string'),
              text: asString(answer.text),
              mode: answer.mode === 'spoken' ? 'spoken' : 'typed',
              createdAt: asNumber(answer.createdAt),
              updatedAt: asNumber(answer.updatedAt),
            })),
        }
      : {}),
    currentRoleId: typeof data.currentRoleId === 'string' ? data.currentRoleId : null,
    currentPacketId: typeof data.currentPacketId === 'string' ? data.currentPacketId : null,
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

export function createRole(
  data: GlowUpData,
  role: Omit<DecodedRole, 'id' | 'createdAt' | 'updatedAt'>
): GlowUpData {
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

export function updateRole(
  data: GlowUpData,
  roleId: string,
  updates: Partial<DecodedRole>
): GlowUpData {
  return {
    ...data,
    roles: data.roles.map((r) =>
      r.id === roleId ? { ...r, ...updates, updatedAt: Date.now() } : r
    ),
  };
}

export function createStory(
  data: GlowUpData,
  story: Omit<Story, 'id' | 'createdAt' | 'updatedAt'>
): GlowUpData {
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

export function updateStory(
  data: GlowUpData,
  storyId: string,
  updates: Partial<Story>
): GlowUpData {
  return {
    ...data,
    stories: data.stories.map((s) =>
      s.id === storyId ? { ...s, ...updates, updatedAt: Date.now() } : s
    ),
  };
}

export function deleteStory(data: GlowUpData, storyId: string): GlowUpData {
  return {
    ...data,
    stories: data.stories.filter((s) => s.id !== storyId),
    packets: data.packets.map((p) => ({
      ...p,
      topStoryIds: p.topStoryIds.filter((id) => id !== storyId),
    })),
  };
}

export function createPacket(
  data: GlowUpData,
  packet: Omit<InterviewPacket, 'id' | 'createdAt' | 'updatedAt'>
): GlowUpData {
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

export function updatePacket(
  data: GlowUpData,
  packetId: string,
  updates: Partial<InterviewPacket>
): GlowUpData {
  return {
    ...data,
    packets: data.packets.map((p) =>
      p.id === packetId ? { ...p, ...updates, updatedAt: Date.now() } : p
    ),
  };
}

// ============================================================================
// Query Helpers
// ============================================================================

/** Sections that hold requirements, in the order the room asks about them. */
const REQUIREMENT_SECTIONS: readonly PostingSection[] = ['required', 'responsibility', 'preferred'];

/**
 * The lines of a posting that count as requirements. When the visitor has
 * confirmed any, only those; otherwise the lines sorted as required, a duty,
 * or preferred. Never a dismissed or ignored line, and never an unsorted one
 * (a header, an address, a description of the employer). Ordered required,
 * duties, preferred, then anything confirmed from another section, keeping
 * posting order within each.
 */
export function requirementBullets(bullets: readonly DecodedBullet[]): DecodedBullet[] {
  // A condition of hiring (age, licence, work authorization) is not a skill
  // to tell a story about or be asked to prove.
  const live = bullets.filter((b) => b.status !== 'ignored' && !hiringCondition(b.text));
  const confirmed = live.filter((b) => b.confirmed === true);
  const pool = confirmed.length > 0 ? confirmed : live;
  const rank = (b: DecodedBullet) => {
    const index = REQUIREMENT_SECTIONS.indexOf(b.section ?? 'unclassified');
    return index === -1 ? REQUIREMENT_SECTIONS.length : index;
  };
  return pool
    .filter((b) => confirmed.length > 0 || rank(b) < REQUIREMENT_SECTIONS.length)
    .map((b, order) => ({ b, order }))
    .sort((x, y) => rank(x.b) - rank(y.b) || x.order - y.order)
    .map(({ b }) => b);
}

/**
 * Skill frequency across a set of bullets. Takes the bullet array directly so
 * callers can pass either a saved role's bullets or the unsaved editor state;
 * frequency and totals must always come from the same source.
 */
export function getSkillFrequencyMap(bullets: DecodedBullet[]): Map<string, number> {
  const freq = new Map<string, number>();

  for (const bullet of bullets) {
    if (bullet.status === 'ignored') continue;
    // One line counts once per skill, however it is tagged.
    const skills = new Set(
      [bullet.primarySkillId, ...(bullet.secondarySkillIds ?? [])].filter((id): id is string =>
        Boolean(id)
      )
    );
    for (const skillId of skills) freq.set(skillId, (freq.get(skillId) || 0) + 1);
  }

  return freq;
}

export interface SkillCount {
  skillId: string;
  /** Requirement lines that test this skill. */
  count: number;
}

/**
 * What a posting tests, as counts over its requirement lines: "Scheduling,
 * 4 of 15 requirements". One line can test several skills, so the counts
 * are not shares and do not add up to the total.
 */
export function skillCounts(bullets: readonly DecodedBullet[]): {
  counts: SkillCount[];
  total: number;
} {
  const requirements = requirementBullets(bullets);
  const freq = getSkillFrequencyMap(requirements);
  const counts = [...freq.entries()]
    .map(([skillId, count]) => ({ skillId, count }))
    .sort((a, b) => b.count - a.count);
  return { counts, total: requirements.length };
}

/**
 * Skills the posting tests that no story in the library covers yet, the
 * most often tested first. Every gap by default: a senior posting can test
 * eight skills, and hiding all but three hid the one that mattered.
 */
export function getTopGaps(
  data: GlowUpData,
  bullets: DecodedBullet[],
  count: number = Number.POSITIVE_INFINITY
): string[] {
  const freq = getSkillFrequencyMap(requirementBullets(bullets));
  const storySkills = new Set<string>();

  for (const story of data.stories) {
    // "idk" is not a story yet, so it cannot close a gap.
    if (!isRealAnswer(story.play)) continue;
    storySkills.add(story.primarySkillId);
    for (const id of story.otherSkillIds) storySkills.add(id);
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

// ============================================================================
// Kept rehearsal answers
// ============================================================================

/** Keep an answer from the rehearsal room. Returns the data and the kept answer. */
export function keepAnswer(
  data: GlowUpData,
  answer: Omit<KeptAnswer, 'id' | 'createdAt' | 'updatedAt'>
): { data: GlowUpData; answer: KeptAnswer } {
  const now = Date.now();
  const kept: KeptAnswer = { ...answer, id: generateId(), createdAt: now, updatedAt: now };
  return { data: { ...data, answers: [...(data.answers ?? []), kept] }, answer: kept };
}

export function deleteAnswer(data: GlowUpData, answerId: string): GlowUpData {
  return { ...data, answers: (data.answers ?? []).filter((a) => a.id !== answerId) };
}

/**
 * Keep an answer straight into storage, for a page that does not hold the
 * workspace (the rehearsal room). Reads the store fresh, so it never writes
 * back an older copy over work saved in another tab. Null when the browser
 * refused the write.
 */
export function storeKeptAnswer(
  answer: Omit<KeptAnswer, 'id' | 'createdAt' | 'updatedAt'>
): KeptAnswer | null {
  const { data, answer: kept } = keepAnswer(loadData(), answer);
  return saveData(data) ? kept : null;
}

/** Change a kept answer's words in storage, reading the store fresh. */
export function updateStoredAnswer(answerId: string, text: string): boolean {
  const data = loadData();
  const answers = data.answers ?? [];
  if (!answers.some((a) => a.id === answerId)) return false;
  return saveData({
    ...data,
    answers: answers.map((a) => (a.id === answerId ? { ...a, text, updatedAt: Date.now() } : a)),
  });
}

/** Remove a kept answer from storage, reading the store fresh. */
export function removeStoredAnswer(answerId: string): boolean {
  const data = loadData();
  if (!(data.answers ?? []).some((a) => a.id === answerId)) return true;
  return saveData(deleteAnswer(data, answerId));
}

// ============================================================================
// Two tabs, one store: merging instead of overwriting
// ============================================================================

type Keyed = { id: string };

/**
 * One collection, three ways: what this tab started from (`base`), what it
 * holds now (`ours`), and what storage holds now (`theirs`). A record this
 * tab changed keeps this tab's version; every other record takes storage's,
 * including records another tab added or deleted. A record this tab deleted
 * stays deleted unless another tab changed it meanwhile.
 */
function mergeRecords<T extends Keyed>(base: T[], ours: T[], theirs: T[]): T[] {
  const json = (value: unknown) => JSON.stringify(value);
  const baseById = new Map(base.map((r) => [r.id, r]));
  const oursById = new Map(ours.map((r) => [r.id, r]));
  const theirsIds = new Set(theirs.map((r) => r.id));
  const merged: T[] = [];
  for (const record of theirs) {
    const before = baseById.get(record.id);
    const mine = oursById.get(record.id);
    if (!mine) {
      // Deleted here: stays deleted unless it changed elsewhere since.
      if (before && json(before) === json(record)) continue;
      merged.push(record);
      continue;
    }
    const changedHere = !before || json(before) !== json(mine);
    merged.push(changedHere ? mine : record);
  }
  for (const record of ours) {
    if (theirsIds.has(record.id)) continue;
    // New here. A record that was in the base but is gone from storage was
    // deleted elsewhere: it comes back only if this tab changed it.
    const before = baseById.get(record.id);
    if (!before || json(before) !== json(record)) merged.push(record);
  }
  return merged;
}

/**
 * Merge this tab's edits onto what storage holds now, record by record, so
 * an edit in one tab never erases a newer edit, a desk change, or a backup
 * import saved by another. Pure.
 */
export function mergeGlowUp(base: GlowUpData, ours: GlowUpData, theirs: GlowUpData): GlowUpData {
  const pick = <K extends 'currentRoleId' | 'currentPacketId'>(key: K) =>
    ours[key] !== base[key] ? ours[key] : theirs[key];
  const answers = mergeRecords(base.answers ?? [], ours.answers ?? [], theirs.answers ?? []);
  const merged: GlowUpData = {
    ...theirs,
    roles: mergeRecords(base.roles, ours.roles, theirs.roles),
    stories: mergeRecords(base.stories, ours.stories, theirs.stories),
    packets: mergeRecords(base.packets, ours.packets, theirs.packets),
    currentRoleId: pick('currentRoleId'),
    currentPacketId: pick('currentPacketId'),
  };
  if (answers.length > 0 || theirs.answers || ours.answers) merged.answers = answers;
  // A current id must point at something that still exists.
  if (merged.currentRoleId && !merged.roles.some((r) => r.id === merged.currentRoleId)) {
    merged.currentRoleId = null;
  }
  if (merged.currentPacketId && !merged.packets.some((p) => p.id === merged.currentPacketId)) {
    merged.currentPacketId = null;
  }
  return merged;
}

// ============================================================================
// Flow helpers: one packet per role, stories added from their cards
// ============================================================================

/** The packet for a role, created on demand so "add to packet" always has a target. */
export function ensurePacketForRole(data: GlowUpData, roleId: string): GlowUpData {
  const existing = data.packets.find((p) => p.roleId === roleId);
  if (existing) {
    return data.currentPacketId === existing.id ? data : { ...data, currentPacketId: existing.id };
  }
  return createPacket(data, {
    roleId,
    mode: 'prep',
    topStoryIds: [],
    customQuestions: [],
    notes: '',
    panicAnswer: '',
    companyIntel: { keywords: [], notes: '', links: [] },
  });
}

/** Make a role current and point at its packet. */
export function switchRole(data: GlowUpData, roleId: string): GlowUpData {
  if (!data.roles.some((r) => r.id === roleId)) return data;
  return ensurePacketForRole({ ...data, currentRoleId: roleId }, roleId);
}

export function toggleStoryInPacket(
  data: GlowUpData,
  packetId: string,
  storyId: string
): GlowUpData {
  const packet = data.packets.find((p) => p.id === packetId);
  if (!packet) return data;
  const inPacket = packet.topStoryIds.includes(storyId);
  const topStoryIds = inPacket
    ? packet.topStoryIds.filter((id) => id !== storyId)
    : [...packet.topStoryIds, storyId];
  const updated = updatePacket(data, packetId, { topStoryIds });
  return {
    ...updated,
    stories: updated.stories.map((s) =>
      s.id === storyId && !inPacket ? { ...s, lastUsedAt: Date.now() } : s
    ),
  };
}

/**
 * Before a link opens the interview tools for one application, make that
 * application's role the current one, so they open on its posting and packet
 * and not the last role worked on. Reads the store fresh and writes only when
 * the role exists and is not already current.
 */
export function openRole(roleId: string | null | undefined): void {
  if (!roleId) return;
  const data = loadData();
  if (data.currentRoleId === roleId) return;
  const next = switchRole(data, roleId);
  if (next !== data) saveData(next);
}
