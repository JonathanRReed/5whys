/**
 * The application desk: per-application working state for the stations that
 * are not owned by another tool (the posting lives on the decoded Glow Up
 * role, the master resume in the Resume Game).
 *
 * One localStorage key, keyed by application id. `career-applications`
 * stays thin and never copies anything from here. The key is part of the
 * backup contract: studio-backup.ts and career-bridge.ts list it.
 *
 * Reading never writes. `loadApplicationDesks` normalizes whatever is stored
 * (a hand-edited backup, a partial record from an older build) into the full
 * shape in memory; only `saveApplicationDesks` persists.
 */

import {
  type ApplicationsData,
  daysUntilDeadline,
  isDeadline,
  loadApplications,
  removeApplication,
  saveApplications,
} from './applications';
import { generateId } from './glowup-store';

export const APPLICATION_DESK_KEY = 'career-application-desk';
const CURRENT_VERSION = 1;

// ============================================================================
// Types
// ============================================================================

export type QualificationStatus = 'have' | 'not-yet' | 'maybe' | 'unset';

export const QUALIFICATION_STATUSES: readonly QualificationStatus[] = [
  'have',
  'not-yet',
  'maybe',
  'unset',
];

/** One row of the qualifications table, for one confirmed requirement. */
export interface QualificationRow {
  /** The requirement's id in the posting engine. */
  requirementId: string;
  status: QualificationStatus;
  /** How I will show it, or how I will get it. */
  plan: string;
  updatedAt: number;
}

/** One step of the action plan below the qualifications table. */
export interface ActionStep {
  id: string;
  text: string;
  /** 'YYYY-MM-DD', or null when the step has no date. */
  due: string | null;
  done: boolean;
  createdAt: number;
}

/** A bullet in the bullets flow: a master-resume bullet, or text not yet added to it. */
export interface BulletSlot {
  /**
   * Id of the resume line this bullet follows in the copy tailored for this
   * role, or null for the default place (after the last bullet of the most
   * recent job). The resume itself is never edited from the desk.
   */
  bulletId: string | null;
  text: string;
  /**
   * Whether the bullet goes into the copy tailored for this role. True for a
   * new desk. Absent in desks saved before it was recorded: there a bullet
   * was in the copy only when it had a place, so that is what it still means.
   */
  included: boolean;
}

/** The guided bullets flow: one experience, its impact, two bullets, a reflection. */
export interface BulletsFlow {
  experience: string;
  impact: string;
  bullets: [BulletSlot, BulletSlot];
  reflection: string;
}

export type MessageKind = 'linkedin' | 'follow-up-email' | 'intro-call';

export const MESSAGE_KINDS: readonly MessageKind[] = ['linkedin', 'follow-up-email', 'intro-call'];

/**
 * What produced a saved message: the rule-based template, the browser's own
 * model, a model this site hosts, or the student's own writing or edit.
 */
export type MessageSource = 'rules' | 'browser-model' | 'site-model' | 'student';

export const MESSAGE_SOURCES: readonly MessageSource[] = [
  'rules',
  'browser-model',
  'site-model',
  'student',
];

export interface MessageVariant {
  text: string;
  source: MessageSource;
  savedAt: number;
}

/** The four-part letter and the messages derived from its opener. */
export interface LetterDraft {
  hook: string;
  whyYou: string;
  whyThem: string;
  closingAsk: string;
  /** Who the letter is addressed to: a name or a team. Empty until written. */
  recipient: string;
  /** The student's name as it should appear under the letter. */
  sender: string;
  messages: Record<MessageKind, MessageVariant | null>;
}

export type LetterPart = 'hook' | 'whyYou' | 'whyThem' | 'closingAsk';

/** Every text field of the letter, including who it is to and from. */
export type LetterField = LetterPart | 'recipient' | 'sender';

export type PayPeriod = 'hour' | 'week' | 'month' | 'year';

export const PAY_PERIODS: readonly PayPeriod[] = ['hour', 'week', 'month', 'year'];

/** The worksheet amounts that can be written as a share of base pay, such as "5%". */
export type PercentField = 'guaranteedBonus' | 'variablePay';

export const PERCENT_FIELDS: readonly PercentField[] = ['guaranteedBonus', 'variablePay'];

/**
 * The offer worksheet. Every number is what the student typed, or null when
 * they have not. Bonus and variable pay are amounts over the weeks entered:
 * a year for a full-year job, the whole placement for a shorter one. They are
 * labeled that way where they are typed, so nothing is prorated or guessed.
 */
export interface OfferWorksheet {
  basePay: number | null;
  /**
   * The top of a posted range, when base pay was given as one ("44k to 48k").
   * `basePay` holds the bottom. Absent when the pay is a single figure.
   */
  basePayTo?: number;
  payPeriod: PayPeriod | null;
  guaranteedBonus: number | null;
  variablePay: number | null;
  hoursPerWeek: number | null;
  weeksPerYear: number | null;
  /**
   * Hours a week expected beyond the regular hours, paid at time and a half.
   * Only counted for hourly pay; a salary does not earn overtime here.
   */
  overtimeHoursPerWeek: number | null;
  notes: string;
  /** Where the comparison wage came from, in the student's words or the pay page's label. */
  wageSource: string;
  /** 'YYYY-MM-DD' the wage source was consulted. */
  wageSourceDate: string | null;
  /**
   * An amount the student typed as a percentage of yearly base pay, such as
   * 5 for "5%". The amount field still holds what it came to; this keeps the
   * relationship, so a corrected base pay corrects the bonus too, after a
   * reload as well. Absent in worksheets saved before it was recorded.
   */
  percentOfBase?: Partial<Record<PercentField, number>>;
  /**
   * The currency symbol typed with the base pay, such as "€". Absent means
   * dollars, as in worksheets saved before other currencies were read.
   */
  currency?: string;
  /**
   * Money paid once, such as a signing or relocation bonus. It is counted in
   * the first year only and never added to a yearly figure. Absent when none.
   */
  oneTimeBonus?: number;
  /** True when the visitor has this offer in hand, not just a posted rate. */
  received?: boolean;
  /** 'YYYY-MM-DD' the visitor must answer the offer by. */
  answerBy?: string;
  /** When the worksheet was last changed (ms), so Pay can open on the offer worked on last. */
  editedAt?: number;
}

/** Currency symbols the worksheet reads and shows results in. */
export const CURRENCY_SYMBOLS = ['$', '€', '£', '₹', '₦', '¥'] as const;
export type CurrencySymbol = (typeof CURRENCY_SYMBOLS)[number];
export const isCurrencySymbol = (value: unknown): value is CurrencySymbol =>
  typeof value === 'string' && (CURRENCY_SYMBOLS as readonly string[]).includes(value);

/** Which master-resume bullets to include when exporting for this role. */
export interface ResumeSelection {
  bulletIds: string[];
  /**
   * The chosen bullets by their words. Line ids are positions in the resume,
   * so they stop meaning the same bullets once the resume is edited; the
   * words still do. Absent on selections saved before this was recorded.
   */
  bulletTexts?: string[];
  updatedAt: number;
}

export interface ApplicationDesk {
  qualifications: QualificationRow[];
  actionPlan: ActionStep[];
  bullets: BulletsFlow;
  letter: LetterDraft;
  /** Ticks for the manual before-you-send items, keyed by item id. */
  checklist: Record<string, boolean>;
  offer: OfferWorksheet;
  /** Null until the student picks; the export decides what that means. */
  resumeSelection: ResumeSelection | null;
  updatedAt: number;
}

export interface ApplicationDeskData {
  version: number;
  desks: Record<string, ApplicationDesk>;
}

// ============================================================================
// Defaults
// ============================================================================

export function createDefaultDeskData(): ApplicationDeskData {
  return { version: CURRENT_VERSION, desks: {} };
}

const emptySlot = (): BulletSlot => ({ bulletId: null, text: '', included: true });

export function createEmptyDesk(now = 0): ApplicationDesk {
  return {
    qualifications: [],
    actionPlan: [],
    bullets: { experience: '', impact: '', bullets: [emptySlot(), emptySlot()], reflection: '' },
    letter: {
      hook: '',
      whyYou: '',
      whyThem: '',
      closingAsk: '',
      recipient: '',
      sender: '',
      messages: { linkedin: null, 'follow-up-email': null, 'intro-call': null },
    },
    checklist: {},
    offer: {
      basePay: null,
      payPeriod: null,
      guaranteedBonus: null,
      variablePay: null,
      hoursPerWeek: null,
      weeksPerYear: null,
      overtimeHoursPerWeek: null,
      notes: '',
      wageSource: '',
      wageSourceDate: null,
    },
    resumeSelection: null,
    updatedAt: now,
  };
}

// ============================================================================
// Normalization: tolerate hand-edited and partial data
// ============================================================================

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

const time = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/** A finite, non-negative amount; numeric strings from a hand edit are accepted. */
const amount = (value: unknown): number | null => {
  const n = typeof value === 'string' && value.trim() ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;
};

const date = (value: unknown): string | null => (isDeadline(value) ? value : null);

/** Keys that would reach Object.prototype when used as a plain property name. */
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function normalizeQualification(value: unknown, now: number): QualificationRow | null {
  if (!isRecord(value)) return null;
  const requirementId = text(value.requirementId);
  if (!requirementId) return null;
  return {
    requirementId,
    status: QUALIFICATION_STATUSES.includes(value.status as QualificationStatus)
      ? (value.status as QualificationStatus)
      : 'unset',
    plan: text(value.plan),
    updatedAt: time(value.updatedAt, now),
  };
}

function normalizeStep(value: unknown, now: number): ActionStep | null {
  if (!isRecord(value)) return null;
  const stepText = text(value.text);
  if (!stepText.trim()) return null;
  return {
    id: text(value.id) || generateId(),
    text: stepText,
    due: date(value.due),
    done: value.done === true,
    createdAt: time(value.createdAt, now),
  };
}

function normalizeSlot(value: unknown): BulletSlot {
  // Saved before a bullet could be included without a place: written text
  // with no place was left out of the copy, and stays out until the visitor
  // ticks it. An empty slot takes the new default.
  if (typeof value === 'string') return { bulletId: null, text: value, included: !value.trim() };
  if (!isRecord(value)) return emptySlot();
  const bulletId = text(value.bulletId) || null;
  const slotText = text(value.text);
  return {
    bulletId,
    text: slotText,
    included:
      typeof value.included === 'boolean' ? value.included : bulletId !== null || !slotText.trim(),
  };
}

function normalizeVariant(value: unknown, now: number): MessageVariant | null {
  if (!isRecord(value)) return null;
  const variantText = text(value.text);
  if (!variantText.trim()) return null;
  return {
    text: variantText,
    source: MESSAGE_SOURCES.includes(value.source as MessageSource)
      ? (value.source as MessageSource)
      : 'student',
    savedAt: time(value.savedAt, now),
  };
}

/** Typed percentages, kept only when each is a finite share that is not negative. */
function normalizePercents(value: unknown): Partial<Record<PercentField, number>> | null {
  if (!isRecord(value)) return null;
  const out: Partial<Record<PercentField, number>> = {};
  for (const field of PERCENT_FIELDS) {
    const share = amount(value[field]);
    if (share !== null) out[field] = share;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** First entry wins when a list repeats an id. */
function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function normalizeDesk(value: unknown, now = Date.now()): ApplicationDesk {
  const desk = createEmptyDesk(now);
  if (!isRecord(value)) return desk;

  if (Array.isArray(value.qualifications)) {
    desk.qualifications = uniqueBy(
      value.qualifications
        .map((row) => normalizeQualification(row, now))
        .filter((row): row is QualificationRow => row !== null),
      (row) => row.requirementId
    );
  }
  if (Array.isArray(value.actionPlan)) {
    desk.actionPlan = uniqueBy(
      value.actionPlan
        .map((step) => normalizeStep(step, now))
        .filter((step): step is ActionStep => step !== null),
      (step) => step.id
    );
  }
  if (isRecord(value.bullets)) {
    const b = value.bullets;
    const slots = Array.isArray(b.bullets) ? b.bullets : [];
    desk.bullets = {
      experience: text(b.experience),
      impact: text(b.impact),
      bullets: [normalizeSlot(slots[0]), normalizeSlot(slots[1])],
      reflection: text(b.reflection),
    };
  }
  if (isRecord(value.letter)) {
    const l = value.letter;
    const messages = isRecord(l.messages) ? l.messages : {};
    desk.letter = {
      hook: text(l.hook),
      whyYou: text(l.whyYou),
      whyThem: text(l.whyThem),
      closingAsk: text(l.closingAsk),
      recipient: text(l.recipient),
      sender: text(l.sender),
      messages: {
        linkedin: normalizeVariant(messages.linkedin, now),
        'follow-up-email': normalizeVariant(messages['follow-up-email'], now),
        'intro-call': normalizeVariant(messages['intro-call'], now),
      },
    };
  }
  if (isRecord(value.checklist)) {
    for (const [id, ticked] of Object.entries(value.checklist)) {
      if (!UNSAFE_KEYS.has(id) && typeof ticked === 'boolean') desk.checklist[id] = ticked;
    }
  }
  if (isRecord(value.offer)) {
    const o = value.offer;
    desk.offer = {
      basePay: amount(o.basePay),
      payPeriod: PAY_PERIODS.includes(o.payPeriod as PayPeriod) ? (o.payPeriod as PayPeriod) : null,
      guaranteedBonus: amount(o.guaranteedBonus),
      variablePay: amount(o.variablePay),
      hoursPerWeek: amount(o.hoursPerWeek),
      weeksPerYear: amount(o.weeksPerYear),
      overtimeHoursPerWeek: amount(o.overtimeHoursPerWeek),
      notes: text(o.notes),
      wageSource: text(o.wageSource),
      wageSourceDate: date(o.wageSourceDate),
    };
    const percents = normalizePercents(o.percentOfBase);
    if (percents) desk.offer.percentOfBase = percents;
    if (isCurrencySymbol(o.currency) && o.currency !== '$') desk.offer.currency = o.currency;
    const top = amount(o.basePayTo);
    if (top !== null && desk.offer.basePay !== null && top > desk.offer.basePay) {
      desk.offer.basePayTo = top;
    }
    const once = amount(o.oneTimeBonus);
    if (once !== null && once > 0) desk.offer.oneTimeBonus = once;
    if (o.received === true) desk.offer.received = true;
    const answerBy = date(o.answerBy);
    if (answerBy) desk.offer.answerBy = answerBy;
    if (typeof o.editedAt === 'number' && Number.isFinite(o.editedAt)) {
      desk.offer.editedAt = o.editedAt;
    }
  }
  if (isRecord(value.resumeSelection) && Array.isArray(value.resumeSelection.bulletIds)) {
    desk.resumeSelection = {
      bulletIds: [
        ...new Set(
          value.resumeSelection.bulletIds.filter(
            (id): id is string => typeof id === 'string' && !!id
          )
        ),
      ],
      ...(Array.isArray(value.resumeSelection.bulletTexts)
        ? {
            bulletTexts: [
              ...new Set(
                value.resumeSelection.bulletTexts.filter(
                  (entry): entry is string => typeof entry === 'string' && !!entry
                )
              ),
            ],
          }
        : {}),
      updatedAt: time(value.resumeSelection.updatedAt, now),
    };
  }
  desk.updatedAt = time(value.updatedAt, now);
  return desk;
}

export function normalizeDeskData(value: unknown, now = Date.now()): ApplicationDeskData {
  const data = createDefaultDeskData();
  if (!isRecord(value) || !isRecord(value.desks)) return data;
  for (const [id, desk] of Object.entries(value.desks)) {
    if (!id || UNSAFE_KEYS.has(id)) continue;
    data.desks[id] = normalizeDesk(desk, now);
  }
  return data;
}

// ============================================================================
// Storage
// ============================================================================

/** Read and normalize. Never writes, even when the stored data needed repair. */
export function loadApplicationDesks(): ApplicationDeskData {
  if (typeof window === 'undefined') return createDefaultDeskData();
  try {
    const raw = window.localStorage.getItem(APPLICATION_DESK_KEY);
    if (!raw) return createDefaultDeskData();
    return normalizeDeskData(JSON.parse(raw));
  } catch {
    return createDefaultDeskData();
  }
}

/** Persist. Returns false when the browser refused, so the interface can say so. */
export function saveApplicationDesks(data: ApplicationDeskData): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(APPLICATION_DESK_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Pure updates. Each returns the next data object; callers persist it.
// ============================================================================

/** The desk for an application, or an empty one. Does not add it to `data`. */
export function getDesk(data: ApplicationDeskData, applicationId: string): ApplicationDesk {
  return data.desks[applicationId] ?? createEmptyDesk();
}

/** Apply `change` to one application's desk, creating it when missing. */
export function updateDesk(
  data: ApplicationDeskData,
  applicationId: string,
  change: (desk: ApplicationDesk) => ApplicationDesk
): ApplicationDeskData {
  if (!applicationId || UNSAFE_KEYS.has(applicationId)) return data;
  const next = change(getDesk(data, applicationId));
  return {
    ...data,
    desks: { ...data.desks, [applicationId]: { ...next, updatedAt: Date.now() } },
  };
}

/**
 * After a posting is decoded again, move each qualification row to its
 * requirement's new id. `parsedIds` are the ids the posting's own
 * requirements had before; a row for one that is no longer in the posting is
 * dropped, so it cannot land on whatever requirement now has its old id.
 */
export function remapQualifications(
  data: ApplicationDeskData,
  applicationId: string,
  map: ReadonlyMap<string, string>,
  parsedIds: ReadonlySet<string>
): ApplicationDeskData {
  return updateDesk(data, applicationId, (desk) => {
    const seen = new Set<string>();
    const qualifications = desk.qualifications.flatMap((row) => {
      const moved = parsedIds.has(row.requirementId)
        ? map.get(row.requirementId)
        : row.requirementId;
      if (!moved || seen.has(moved)) return [];
      seen.add(moved);
      return [moved === row.requirementId ? row : { ...row, requirementId: moved }];
    });
    const same =
      qualifications.length === desk.qualifications.length &&
      qualifications.every((row, index) => row === desk.qualifications[index]);
    return same ? desk : { ...desk, qualifications };
  });
}

export function setQualification(
  data: ApplicationDeskData,
  applicationId: string,
  requirementId: string,
  changes: Partial<Pick<QualificationRow, 'status' | 'plan'>>
): ApplicationDeskData {
  if (!requirementId) return data;
  return updateDesk(data, applicationId, (desk) => {
    const now = Date.now();
    const existing = desk.qualifications.find((row) => row.requirementId === requirementId);
    const status =
      changes.status && QUALIFICATION_STATUSES.includes(changes.status)
        ? changes.status
        : (existing?.status ?? 'unset');
    const row: QualificationRow = {
      requirementId,
      status,
      plan: typeof changes.plan === 'string' ? changes.plan : (existing?.plan ?? ''),
      updatedAt: now,
    };
    return {
      ...desk,
      qualifications: existing
        ? desk.qualifications.map((r) => (r.requirementId === requirementId ? row : r))
        : [...desk.qualifications, row],
    };
  });
}

/** Drop a row, for a requirement the student dismissed. */
export function removeQualification(
  data: ApplicationDeskData,
  applicationId: string,
  requirementId: string
): ApplicationDeskData {
  if (!data.desks[applicationId]) return data;
  return updateDesk(data, applicationId, (desk) => ({
    ...desk,
    qualifications: desk.qualifications.filter((row) => row.requirementId !== requirementId),
  }));
}

export function addActionStep(
  data: ApplicationDeskData,
  applicationId: string,
  fields: { text: string; due?: string | null }
): { data: ApplicationDeskData; step: ActionStep | null } {
  const stepText = fields.text.trim();
  if (!stepText) return { data, step: null };
  const step: ActionStep = {
    id: generateId(),
    text: stepText,
    due: date(fields.due),
    done: false,
    createdAt: Date.now(),
  };
  return {
    data: updateDesk(data, applicationId, (desk) => ({
      ...desk,
      actionPlan: [...desk.actionPlan, step],
    })),
    step,
  };
}

export function updateActionStep(
  data: ApplicationDeskData,
  applicationId: string,
  stepId: string,
  changes: Partial<Pick<ActionStep, 'text' | 'due' | 'done'>>
): ApplicationDeskData {
  const desk = data.desks[applicationId];
  if (!desk?.actionPlan.some((step) => step.id === stepId)) return data;
  return updateDesk(data, applicationId, (current) => ({
    ...current,
    actionPlan: current.actionPlan.map((step) =>
      step.id === stepId
        ? {
            ...step,
            ...(typeof changes.text === 'string' && changes.text.trim()
              ? { text: changes.text.trim() }
              : {}),
            ...('due' in changes ? { due: date(changes.due) } : {}),
            ...(typeof changes.done === 'boolean' ? { done: changes.done } : {}),
          }
        : step
    ),
  }));
}

export function removeActionStep(
  data: ApplicationDeskData,
  applicationId: string,
  stepId: string
): ApplicationDeskData {
  if (!data.desks[applicationId]) return data;
  return updateDesk(data, applicationId, (desk) => ({
    ...desk,
    actionPlan: desk.actionPlan.filter((step) => step.id !== stepId),
  }));
}

export function updateBulletsFlow(
  data: ApplicationDeskData,
  applicationId: string,
  changes: Partial<Pick<BulletsFlow, 'experience' | 'impact' | 'reflection'>> & {
    /** Replace one of the two bullets. */
    bullet?: { index: 0 | 1; slot: Partial<BulletSlot> };
  }
): ApplicationDeskData {
  return updateDesk(data, applicationId, (desk) => {
    const bullets: [BulletSlot, BulletSlot] = [desk.bullets.bullets[0], desk.bullets.bullets[1]];
    if (changes.bullet && (changes.bullet.index === 0 || changes.bullet.index === 1)) {
      const current = bullets[changes.bullet.index];
      const { bulletId, text: slotText, included } = changes.bullet.slot;
      bullets[changes.bullet.index] = {
        bulletId: bulletId === undefined ? current.bulletId : bulletId || null,
        text: typeof slotText === 'string' ? slotText : current.text,
        included: typeof included === 'boolean' ? included : current.included,
      };
    }
    return {
      ...desk,
      bullets: {
        experience:
          typeof changes.experience === 'string' ? changes.experience : desk.bullets.experience,
        impact: typeof changes.impact === 'string' ? changes.impact : desk.bullets.impact,
        bullets,
        reflection:
          typeof changes.reflection === 'string' ? changes.reflection : desk.bullets.reflection,
      },
    };
  });
}

export function updateLetter(
  data: ApplicationDeskData,
  applicationId: string,
  changes: Partial<Record<LetterField, string>>
): ApplicationDeskData {
  return updateDesk(data, applicationId, (desk) => {
    const letter = { ...desk.letter };
    for (const part of [
      'hook',
      'whyYou',
      'whyThem',
      'closingAsk',
      'recipient',
      'sender',
    ] as const) {
      const value = changes[part];
      if (typeof value === 'string') letter[part] = value;
    }
    return { ...desk, letter };
  });
}

/** Save one derived message with what produced it. Empty text clears it. */
export function saveMessageVariant(
  data: ApplicationDeskData,
  applicationId: string,
  kind: MessageKind,
  variant: { text: string; source: MessageSource }
): ApplicationDeskData {
  if (!MESSAGE_KINDS.includes(kind)) return data;
  const next: MessageVariant | null = variant.text.trim()
    ? {
        text: variant.text,
        source: MESSAGE_SOURCES.includes(variant.source) ? variant.source : 'student',
        savedAt: Date.now(),
      }
    : null;
  return updateDesk(data, applicationId, (desk) => ({
    ...desk,
    letter: { ...desk.letter, messages: { ...desk.letter.messages, [kind]: next } },
  }));
}

export function setChecklistTick(
  data: ApplicationDeskData,
  applicationId: string,
  itemId: string,
  ticked: boolean
): ApplicationDeskData {
  if (!itemId || UNSAFE_KEYS.has(itemId)) return data;
  return updateDesk(data, applicationId, (desk) => ({
    ...desk,
    checklist: { ...desk.checklist, [itemId]: ticked },
  }));
}

export type OfferChanges = Partial<
  Omit<
    OfferWorksheet,
    | 'percentOfBase'
    | 'currency'
    | 'basePayTo'
    | 'oneTimeBonus'
    | 'received'
    | 'answerBy'
    | 'editedAt'
  >
> & {
  /** A symbol records the currency typed with the base pay; null or "$" returns to dollars. */
  currency?: string | null;
  /** The top of a range; null when the base pay is one figure. */
  basePayTo?: number | null;
  /** A one-time amount; null or zero clears it. */
  oneTimeBonus?: number | null;
  received?: boolean | null;
  /** 'YYYY-MM-DD', or null to clear. */
  answerBy?: string | null;
  /** A number records the field as typed as that percentage; null clears it. */
  percentOfBase?: Partial<Record<PercentField, number | null>>;
};

/**
 * The worksheet with `changes` applied. Numbers are kept only when finite and
 * not negative; anything else, including null, clears the field.
 */
export function applyOfferChanges(current: OfferWorksheet, changes: OfferChanges): OfferWorksheet {
  const offer = { ...current };
  for (const field of [
    'basePay',
    'guaranteedBonus',
    'variablePay',
    'hoursPerWeek',
    'weeksPerYear',
    'overtimeHoursPerWeek',
  ] as const) {
    if (field in changes) offer[field] = amount(changes[field]);
  }
  if ('payPeriod' in changes) {
    offer.payPeriod =
      changes.payPeriod && PAY_PERIODS.includes(changes.payPeriod) ? changes.payPeriod : null;
  }
  if (typeof changes.notes === 'string') offer.notes = changes.notes;
  if (typeof changes.wageSource === 'string') offer.wageSource = changes.wageSource;
  if ('wageSourceDate' in changes) offer.wageSourceDate = date(changes.wageSourceDate);
  if ('currency' in changes) {
    if (isCurrencySymbol(changes.currency) && changes.currency !== '$') {
      offer.currency = changes.currency;
    } else delete offer.currency;
  }
  if ('basePayTo' in changes) {
    const top = amount(changes.basePayTo);
    if (top !== null) offer.basePayTo = top;
    else delete offer.basePayTo;
  }
  // A range needs a top above its bottom; a changed bottom can undo it.
  if (
    offer.basePayTo !== undefined &&
    (offer.basePay === null || offer.basePayTo <= offer.basePay)
  ) {
    delete offer.basePayTo;
  }
  if ('oneTimeBonus' in changes) {
    const once = amount(changes.oneTimeBonus);
    if (once !== null && once > 0) offer.oneTimeBonus = once;
    else delete offer.oneTimeBonus;
  }
  if ('received' in changes) {
    if (changes.received === true) offer.received = true;
    else delete offer.received;
  }
  if ('answerBy' in changes) {
    const answerBy = date(changes.answerBy);
    if (answerBy) offer.answerBy = answerBy;
    else delete offer.answerBy;
  }
  if (changes.percentOfBase) {
    const percents = { ...offer.percentOfBase };
    for (const field of PERCENT_FIELDS) {
      if (!(field in changes.percentOfBase)) continue;
      const share = amount(changes.percentOfBase[field]);
      if (share === null) delete percents[field];
      else percents[field] = share;
    }
    if (Object.keys(percents).length > 0) offer.percentOfBase = percents;
    else delete offer.percentOfBase;
  }
  return offer;
}

/** Change one application's worksheet. See `applyOfferChanges`. */
export function updateOfferWorksheet(
  data: ApplicationDeskData,
  applicationId: string,
  changes: OfferChanges
): ApplicationDeskData {
  return updateDesk(data, applicationId, (desk) => ({
    ...desk,
    offer: { ...applyOfferChanges(desk.offer, changes), editedAt: Date.now() },
  }));
}

/** Choose the master-resume bullets for this role's export. Null returns to "not chosen". */
export function setResumeSelection(
  data: ApplicationDeskData,
  applicationId: string,
  bulletIds: string[] | null,
  /** The same bullets by their words, so the choice survives an edited resume. */
  bulletTexts?: string[]
): ApplicationDeskData {
  return updateDesk(data, applicationId, (desk) => ({
    ...desk,
    resumeSelection:
      bulletIds === null
        ? null
        : {
            bulletIds: [...new Set(bulletIds.filter((id) => typeof id === 'string' && !!id))],
            ...(bulletTexts
              ? { bulletTexts: [...new Set(bulletTexts.filter((entry) => !!entry))] }
              : {}),
            updatedAt: Date.now(),
          },
  }));
}

/** Drop an application's desk. */
export function removeDesk(data: ApplicationDeskData, applicationId: string): ApplicationDeskData {
  if (!(applicationId in data.desks)) return data;
  const desks = { ...data.desks };
  delete desks[applicationId];
  return { ...data, desks };
}

/** Drop desks whose application no longer exists. */
export function pruneDesks(
  data: ApplicationDeskData,
  applicationIds: Iterable<string>
): ApplicationDeskData {
  const keep = new Set(applicationIds);
  const stale = Object.keys(data.desks).filter((id) => !keep.has(id));
  if (stale.length === 0) return data;
  return stale.reduce(removeDesk, data);
}

/**
 * Stop tracking an application and delete its desk work. The decoded role
 * and the stories stay, as before. The application is removed first, so a
 * failure on the second write leaves only an unreachable desk, which the
 * dashboard readers ignore and the next removal or prune clears.
 *
 * Returns the saved applications so the caller can re-render.
 */
export function deleteApplication(applicationId: string): ApplicationsData {
  const applications = removeApplication(loadApplications(), applicationId);
  saveApplications(applications);
  const desks = loadApplicationDesks();
  if (applicationId in desks.desks) saveApplicationDesks(removeDesk(desks, applicationId));
  return applications;
}

// ============================================================================
// Derived readers for the dashboard and the desk
// ============================================================================

export type DeskStationId =
  | 'qualifications'
  | 'bullets'
  | 'resume'
  | 'letter'
  | 'before-you-send'
  | 'pay';

const filled = (value: string): boolean => value.trim().length > 0;

/**
 * Which desk-owned stations hold anything the student entered. The posting
 * and interview stations live in the Glow Up store and are not reported here.
 * The action plan counts toward qualifications, where it is shown.
 */
export function stationsWithContent(desk: ApplicationDesk): Record<DeskStationId, boolean> {
  const { bullets, letter, offer } = desk;
  return {
    qualifications:
      desk.qualifications.some((row) => row.status !== 'unset' || filled(row.plan)) ||
      desk.actionPlan.length > 0,
    bullets:
      filled(bullets.experience) ||
      filled(bullets.impact) ||
      filled(bullets.reflection) ||
      bullets.bullets.some((slot) => filled(slot.text)),
    resume: desk.resumeSelection !== null,
    letter:
      filled(letter.hook) ||
      filled(letter.whyYou) ||
      filled(letter.whyThem) ||
      filled(letter.closingAsk) ||
      MESSAGE_KINDS.some((kind) => letter.messages[kind] !== null),
    'before-you-send': Object.values(desk.checklist).some(Boolean),
    pay:
      offer.basePay !== null ||
      offer.payPeriod !== null ||
      offer.guaranteedBonus !== null ||
      offer.variablePay !== null ||
      offer.hoursPerWeek !== null ||
      offer.weeksPerYear !== null ||
      filled(offer.notes) ||
      filled(offer.wageSource) ||
      offer.wageSourceDate !== null ||
      offer.oneTimeBonus !== undefined ||
      offer.received === true ||
      offer.answerBy !== undefined,
  };
}

/** Station content for each listed application, empty for one with no desk yet. */
export function stationsByApplication(
  data: ApplicationDeskData,
  applicationIds: Iterable<string>
): Record<string, Record<DeskStationId, boolean>> {
  const out: Record<string, Record<DeskStationId, boolean>> = {};
  for (const id of applicationIds) {
    if (UNSAFE_KEYS.has(id)) continue;
    out[id] = stationsWithContent(getDesk(data, id));
  }
  return out;
}

export interface DatedActionStep {
  applicationId: string;
  stepId: string;
  text: string;
  /** 'YYYY-MM-DD'. */
  due: string;
  /** Whole days until the date, negative once it has passed. */
  daysUntil: number;
  done: boolean;
}

/**
 * Dated action steps across applications, soonest first. Only applications
 * in `applicationIds` are read, so a desk left behind by a removed
 * application never surfaces. Finished steps are left out unless asked for.
 */
export function datedActionSteps(
  data: ApplicationDeskData,
  applicationIds: Iterable<string>,
  options: { includeDone?: boolean; now?: Date } = {}
): DatedActionStep[] {
  const now = options.now ?? new Date();
  const steps: DatedActionStep[] = [];
  for (const applicationId of new Set(applicationIds)) {
    const desk = data.desks[applicationId];
    if (!desk || UNSAFE_KEYS.has(applicationId)) continue;
    for (const step of desk.actionPlan) {
      if (!step.due || (step.done && !options.includeDone)) continue;
      const daysUntil = daysUntilDeadline(step.due, now);
      if (daysUntil === null) continue;
      steps.push({
        applicationId,
        stepId: step.id,
        text: step.text,
        due: step.due,
        daysUntil,
        done: step.done,
      });
    }
  }
  // 'YYYY-MM-DD' sorts as a date; ties keep application, then plan, order.
  return steps.sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0));
}

// ============================================================================
// Pay normalization for the offer worksheet
// ============================================================================

const positive = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const validPay = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

/**
 * A monthly figure converts to weekly as twelve months over fifty-two weeks,
 * the payroll convention for translating a monthly salary to a weekly one.
 * This is a calendar conversion, not an assumption about the student's
 * schedule: hours and weeks worked are never filled in.
 */
const MONTHS_PER_YEAR = 12;
const WEEKS_PER_CALENDAR_YEAR = 52;

/**
 * Pay for one week at this rate, or null when an input it needs is missing.
 * An hourly rate needs hours per week; a yearly figure needs weeks per year.
 */
function weeklyPay(
  pay: number | null | undefined,
  period: PayPeriod | null | undefined,
  hoursPerWeek: number | null | undefined,
  weeksPerYear: number | null | undefined
): number | null {
  if (!validPay(pay) || !period) return null;
  switch (period) {
    case 'hour':
      return positive(hoursPerWeek) ? pay * hoursPerWeek : null;
    case 'week':
      return pay;
    case 'month':
      return (pay * MONTHS_PER_YEAR) / WEEKS_PER_CALENDAR_YEAR;
    case 'year':
      return positive(weeksPerYear) ? pay / weeksPerYear : null;
    default:
      return null;
  }
}

/**
 * The hourly equivalent of a rate, from the hours and weeks the student
 * entered. Null when any input it needs is missing; never assumes a
 * forty-hour week or a fifty-two-week year.
 */
export function hourlyEquivalent(
  pay: number | null | undefined,
  period: PayPeriod | null | undefined,
  hoursPerWeek: number | null | undefined,
  weeksPerYear: number | null | undefined
): number | null {
  if (period === 'hour') return validPay(pay) ? pay : null;
  if (!positive(hoursPerWeek)) return null;
  const weekly = weeklyPay(pay, period, hoursPerWeek, weeksPerYear);
  return weekly === null ? null : weekly / hoursPerWeek;
}

/**
 * Pay over the weeks worked in a year at this rate. Null when any input it
 * needs is missing. A yearly figure is returned as entered.
 */
export function annualEquivalent(
  pay: number | null | undefined,
  period: PayPeriod | null | undefined,
  hoursPerWeek: number | null | undefined,
  weeksPerYear: number | null | undefined
): number | null {
  if (period === 'year') return validPay(pay) ? pay : null;
  if (!positive(weeksPerYear)) return null;
  const weekly = weeklyPay(pay, period, hoursPerWeek, weeksPerYear);
  return weekly === null ? null : weekly * weeksPerYear;
}

/** Overtime is counted at time and a half, the usual rate for hourly work in the US. */
export const OVERTIME_MULTIPLIER = 1.5;

export interface OfferEquivalents {
  /** Base pay per hour, or null. */
  hourly: number | null;
  /** Base pay for one week, without overtime, or null. */
  weekly: number | null;
  /**
   * Base pay for one month, without overtime, or null. A salary is divided by
   * twelve; other rates count 52 weeks over 12 months, the same calendar
   * conversion the worksheet uses for a monthly rate.
   */
  monthly: number | null;
  /** Base pay over the weeks entered (a year for a salary), without overtime, or null. */
  annualBase: number | null;
  /**
   * Overtime over the same weeks, at time and a half. Zero when none applies.
   * Overtime depends on the hours given, so it is never part of the base.
   */
  overtimeAnnual: number;
  /** Base plus the guaranteed bonus. Null when the base is unknown. */
  annualGuaranteed: number | null;
  /**
   * Guaranteed pay plus the pay that is not promised: variable pay if all of
   * it were paid, and any overtime. Null when the base is unknown.
   */
  annualWithVariable: number | null;
  /** The one-time amount, or zero. It is never part of a yearly figure. */
  oneTime: number;
  /**
   * The first year (or the whole placement): guaranteed pay plus the one-time
   * amount. Null when the base is unknown. Equal to `annualGuaranteed` when
   * there is no one-time amount.
   */
  firstYear: number | null;
  /** Inputs the student still needs to enter for the missing figures. */
  missing: Array<'basePay' | 'payPeriod' | 'hoursPerWeek' | 'weeksPerYear'>;
}

/**
 * Normalize the worksheet to hourly and annual figures. A bonus or variable
 * amount left blank adds nothing, because a blank on an offer means none was
 * offered; the base itself is never guessed.
 */
export function offerEquivalents(offer: OfferWorksheet): OfferEquivalents {
  const { basePay, payPeriod, hoursPerWeek, weeksPerYear } = offer;
  // A figure too large to count is no figure: it is shown as missing, never
  // as infinity.
  const finite = (value: number | null): number | null =>
    value !== null && Number.isFinite(value) ? value : null;
  const hourly = finite(hourlyEquivalent(basePay, payPeriod, hoursPerWeek, weeksPerYear));
  const regular = finite(annualEquivalent(basePay, payPeriod, hoursPerWeek, weeksPerYear));
  // Overtime only exists for hourly pay, at time and a half.
  const overtimeAnnual =
    payPeriod === 'hour' &&
    basePay !== null &&
    positive(offer.overtimeHoursPerWeek) &&
    positive(weeksPerYear)
      ? (finite(basePay * OVERTIME_MULTIPLIER * offer.overtimeHoursPerWeek * weeksPerYear) ?? 0)
      : 0;
  // A share typed as a percentage follows the base pay it is a share of.
  const extra = (field: PercentField): number => {
    const share = offer.percentOfBase?.[field];
    if (typeof share === 'number' && regular !== null) return (share / 100) * regular;
    return offer[field] ?? 0;
  };
  const annualBase = regular;
  const annualGuaranteed =
    annualBase === null ? null : finite(annualBase + extra('guaranteedBonus'));
  const annualWithVariable =
    annualGuaranteed === null
      ? null
      : finite(annualGuaranteed + extra('variablePay') + overtimeAnnual);
  const weekly = finite(weeklyPay(basePay, payPeriod, hoursPerWeek, weeksPerYear));
  const monthly =
    payPeriod === 'year'
      ? validPay(basePay)
        ? finite(basePay / MONTHS_PER_YEAR)
        : null
      : weekly === null
        ? null
        : finite((weekly * WEEKS_PER_CALENDAR_YEAR) / MONTHS_PER_YEAR);
  const oneTime = positive(offer.oneTimeBonus) ? offer.oneTimeBonus : 0;
  const firstYear = annualGuaranteed === null ? null : finite(annualGuaranteed + oneTime);

  // Whatever the period, one of the two figures needs hours and one needs
  // weeks, so a complete worksheet always has both.
  const missing: OfferEquivalents['missing'] = [];
  if (basePay === null) missing.push('basePay');
  if (payPeriod === null) missing.push('payPeriod');
  if (!positive(hoursPerWeek)) missing.push('hoursPerWeek');
  if (!positive(weeksPerYear)) missing.push('weeksPerYear');
  return {
    hourly,
    weekly,
    monthly,
    annualBase,
    overtimeAnnual,
    annualGuaranteed,
    annualWithVariable,
    oneTime,
    firstYear,
    missing,
  };
}

/**
 * The figures for both ends of a posted range: `low` from the base pay, and
 * `high` from the top of the range, or null when the pay is one figure. A
 * bonus typed as a percentage follows each end; an amount stays the same.
 */
export function offerRange(offer: OfferWorksheet): {
  low: OfferEquivalents;
  high: OfferEquivalents | null;
} {
  const low = offerEquivalents(offer);
  const top = offer.basePayTo;
  const high =
    typeof top === 'number' && offer.basePay !== null && top > offer.basePay
      ? offerEquivalents({ ...offer, basePay: top })
      : null;
  return { low, high };
}

/** How the extras on a worksheet are named: "a year", or "for the 10 weeks" on a shorter job. */
export function extrasPhrase(offer: Pick<OfferWorksheet, 'payPeriod' | 'weeksPerYear'>): string {
  const period = periodPhrase(offer);
  return period === 'a year' ? 'a year' : period.replace(/^over /, 'for the ');
}

/**
 * How the total over the weeks entered is named: "a year" for a salary or a
 * full year of weeks, otherwise the number of weeks typed ("over 10 weeks"),
 * so a summer job is never called a year.
 */
export function periodPhrase(offer: Pick<OfferWorksheet, 'payPeriod' | 'weeksPerYear'>): string {
  const weeks = offer.weeksPerYear;
  if (offer.payPeriod === 'year' || weeks === null || weeks >= WEEKS_PER_CALENDAR_YEAR) {
    return 'a year';
  }
  return `over ${weeks} ${weeks === 1 ? 'week' : 'weeks'}`;
}
