import * as React from 'react';
import {
  loadApplicationDesks,
  remapLinkedDesks,
  saveApplicationDesks,
} from '../../lib/application-desk';
import { readTrackedApplications, rolesForApplications } from '../../lib/career-bridge';
import {
  type Audience,
  getSkillName,
  postingRepeatedTerms,
  usesStudentExamples,
} from '../../lib/glowup-banks';
import {
  createRole,
  type DecodedBullet,
  type DecodedRole,
  ensurePacketForRole,
  type GlowUpData,
  getTopGaps,
  POSTING_ENGINE_VERSION,
  skillCounts,
  switchRole,
  updateRole,
} from '../../lib/glowup-store';
import {
  bulletsFromRequirements,
  decodePostingToBullets,
  hiringCondition,
  type PostingSection,
  parsePosting as readPosting,
  redecodeRequirements,
  requirementsFromBullets,
  requirementToBullet,
  SAMPLE_POSTING,
  type SetAsideReason,
} from '../../lib/posting';
import { cn } from '../../lib/utils';
import Announcer, { useAnnouncer } from '../shared/Announcer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { PartyIcon, SearchIcon } from './icons';
import SkillSelect from './SkillSelect';

type Props = {
  data: GlowUpData;
  setData: React.Dispatch<React.SetStateAction<GlowUpData>>;
  currentRole: DecodedRole | undefined;
  audience?: Audience;
  /** Whether the last change reached storage. The workspace does the saving. */
  saveState?: SaveState;
};

export type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

type RoleFields = Pick<
  DecodedRole,
  'jobTitle' | 'company' | 'jdUrl' | 'rawJdText' | 'parsedJdText' | 'postingEngineVersion'
>;

/** How each posting section is named beside a line. */
const SECTION_LABELS: Record<PostingSection, string> = {
  required: 'Required',
  preferred: 'Nice to have',
  responsibility: 'Duty',
  unclassified: 'Not sorted, so not counted',
};

/** Why a line was set aside, in words. Headings are never listed. */
const SET_ASIDE_LABELS: Partial<Record<SetAsideReason, string>> = {
  'too-short': 'Too short to read as a requirement',
  boilerplate: 'Legal or benefits text',
  'header-line': 'A title or location line',
  'job-details': 'Pay, hours, or another job detail',
  'outside-requirements': 'Under a heading such as About us or Benefits',
  'group-lead': 'Introduces a list',
  'over-limit': 'Past the number of lines read',
  'application-logistics': 'How or when to apply',
  'company-description': 'About the employer',
  'role-summary': 'A summary of the role',
  pitch: 'Selling the job',
  description: 'Reads as neither a requirement nor a duty',
};

/** Gaps shown before "Show all". */
const GAPS_SHOWN = 5;

/** A title for the role when none was typed: the first short line of the posting. */
function deriveTitle(rawJdText: string): string {
  const first = rawJdText
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0 && line.split(/\s+/).length <= 8);
  return first
    ? first
        .replace(/[|–—-].*$/, '')
        .trim()
        .slice(0, 80)
    : '';
}

/**
 * Lines that are filler in nearly every posting. A short line is not filler:
 * "CPR certified" or "Spanish language skills" is often the hardest
 * requirement on the page.
 */
const FILLER_LINE =
  /\b(?:other (?:related )?duties as (?:assigned|needed|required)|duties (?:may|are subject to) change|not (?:an |intended to be an )?(?:exhaustive|all-inclusive) list|as (?:assigned|directed) by (?:a |your )?(?:supervisor|manager))\b/i;

export function isFillerLine(text: string): boolean {
  return FILLER_LINE.test(text);
}

/** A requirement, cut short enough to sit inside a control's name. */
function shortText(text: string): string {
  return text.length > 60 ? `${text.slice(0, 57).trimEnd()}...` : text;
}

const EMPTY_FIELDS: RoleFields = { jobTitle: '', company: '', jdUrl: '', rawJdText: '' };

/**
 * Move the qualification rows of every application on this posting to their
 * requirements' new ids, after the posting is decoded again. Written only
 * when a row actually moved or went.
 */
function remapDesksFor(
  roleId: string,
  roles: Parameters<typeof rolesForApplications>[1],
  moved: ReadonlyMap<string, string>,
  parsedIds: ReadonlySet<string>
): void {
  // The applications the desk shows this posting for: a saved link, or the
  // same title match the desk and the dashboard use.
  const applications = readTrackedApplications();
  const links = rolesForApplications(applications, roles);
  const linked = applications.filter((a) => links.get(a.id)?.roleId === roleId).map((a) => a.id);
  if (linked.length === 0) return;
  const desks = loadApplicationDesks();
  const next = remapLinkedDesks(desks, linked, moved, parsedIds);
  const changed = linked.some(
    (id) => desks.desks[id] && next.desks[id]?.qualifications !== desks.desks[id].qualifications
  );
  if (changed) saveApplicationDesks(next);
}

export default function DecodeSection({
  data,
  setData,
  currentRole,
  audience = 'student',
  saveState = 'idle',
}: Props) {
  const student = usesStudentExamples(audience);
  // Before a role exists, edits live here; the first keystroke creates the
  // role and from then on every field is read from and written to the store.
  const [pending, setPending] = React.useState<RoleFields>(EMPTY_FIELDS);
  const [selectedBullets, setSelectedBullets] = React.useState<Set<string>>(new Set());
  const [savedAt, setSavedAt] = React.useState<number | null>(null);
  const [showAllGaps, setShowAllGaps] = React.useState(false);
  const [announcement, announce] = useAnnouncer();
  const parseButtonRef = React.useRef<HTMLButtonElement>(null);

  const fields: RoleFields = currentRole
    ? {
        jobTitle: currentRole.jobTitle,
        company: currentRole.company,
        jdUrl: currentRole.jdUrl ?? '',
        rawJdText: currentRole.rawJdText,
      }
    : pending;
  const bullets = currentRole?.bullets ?? [];

  const commit = (partial: Partial<RoleFields>, nextBullets?: DecodedBullet[]) => {
    setSavedAt(Date.now());
    if (currentRole) {
      setData(
        updateRole(data, currentRole.id, {
          ...partial,
          ...(nextBullets ? { bullets: nextBullets } : {}),
        })
      );
      return;
    }
    const merged = { ...pending, ...partial };
    setPending(merged);
    // Autosave: the role exists as soon as there is anything to keep.
    if (!merged.jobTitle && !merged.company && !merged.rawJdText && !nextBullets) return;
    const created = createRole(data, {
      jobTitle: merged.jobTitle,
      company: merged.company,
      jdUrl: merged.jdUrl || undefined,
      rawJdText: merged.rawJdText,
      parsedJdText: merged.parsedJdText,
      ...(merged.postingEngineVersion ? { postingEngineVersion: merged.postingEngineVersion } : {}),
      bullets: nextBullets ?? [],
    });
    setData(ensurePacketForRole(created, created.currentRoleId as string));
    setPending(EMPTY_FIELDS);
  };

  const setBullets = (next: DecodedBullet[]) => commit({}, next);

  // The same posting engine as the Application Desk, so every line carries
  // its section (required, nice to have, duty) and the rehearsal room can
  // tell a requirement from the employer's address.
  const parsePosting = () => {
    if (!fields.rawJdText.trim()) return;
    const decoded = decodePostingToBullets(fields.rawJdText);
    const { parsed } = decoded;
    let parsedBullets = decoded.bullets;
    if (currentRole && bullets.length > 0) {
      // Parsing again keeps what was decided, here or on the Application
      // Desk: each confirmation, dismissal and edit follows its line, and
      // where the visitor stands on each requirement follows it too, on every
      // application that uses this posting.
      const redecoded = redecodeRequirements(
        requirementsFromBullets(bullets),
        currentRole.parsedJdText ?? currentRole.rawJdText ?? '',
        parsed.requirements,
        parsed.text
      );
      parsedBullets = bulletsFromRequirements(redecoded.requirements, bullets);
      remapDesksFor(currentRole.id, data.roles, redecoded.moved, redecoded.parsedIds);
    }
    const setAside = parsed.setAside.filter((line) => line.reason !== 'heading').length;
    announce(
      `Lines from the posting (${parsedBullets.length}).${setAside > 0 ? ` Set aside ${setAside} ${setAside === 1 ? 'line' : 'lines'} that are not requirements.` : ''}`
    );
    const title = fields.jobTitle.trim() ? {} : { jobTitle: deriveTitle(fields.rawJdText) };
    commit(
      { ...title, parsedJdText: parsed.text, postingEngineVersion: POSTING_ENGINE_VERSION },
      parsedBullets
    );
  };

  const startNewRole = () => {
    setPending(EMPTY_FIELDS);
    setData({ ...data, currentRoleId: null, currentPacketId: null });
  };

  // Counts, totals, and gaps all read the same requirement lines.
  const { counts: tested, total: requirementTotal } = skillCounts(bullets);
  const postingSkillIds = tested.map((entry) => entry.skillId);
  const topGaps = getTopGaps(data, bullets);

  const repeatedTerms = React.useMemo(
    () =>
      fields.rawJdText.trim()
        ? postingRepeatedTerms(fields.rawJdText, {
            company: fields.company,
            jobTitle: fields.jobTitle,
          })
        : [],
    [fields.rawJdText, fields.company, fields.jobTitle]
  );

  const activeCount = bullets.filter((b) => b.status === 'active').length;

  // What the parser set aside, read again from the text it parsed, so the
  // list survives a reload and a real duty can be brought back.
  const parsedSource = currentRole?.parsedJdText ?? '';
  const setAsideLines = React.useMemo(() => {
    if (bullets.length === 0 || !parsedSource.trim()) return [];
    const kept = new Set(bullets.map((b) => b.text));
    return readPosting(parsedSource).setAside.filter(
      (line) => line.reason !== 'heading' && !kept.has(line.text)
    );
  }, [parsedSource, bullets]);

  const bringBack = (line: (typeof setAsideLines)[number]) => {
    const taken = new Set(bullets.map((b) => b.id));
    let n = 1;
    while (taken.has(`back-${n}`)) n++;
    const bullet = requirementToBullet({
      id: `back-${n}`,
      text: line.text,
      section: 'responsibility',
      status: 'suggested',
      // The visitor's own decision, like a line they added: "Parse again"
      // keeps it, where a parsed line the parser no longer finds is dropped.
      origin: 'student',
      span: { start: line.start, end: line.end },
    });
    // Back in the posting's own order.
    const after = bullets.findIndex((b) => (b.sourceSpan?.start ?? -1) > line.start);
    const next = [...bullets];
    next.splice(after === -1 ? next.length : after, 0, bullet);
    setBullets(next);
    announce(`Brought back as a duty: ${shortText(line.text)}`);
  };

  const handleBulkTag = (skillId: string) => {
    setBullets(
      bullets.map((b) => (selectedBullets.has(b.id) ? { ...b, primarySkillId: skillId } : b))
    );
    setSelectedBullets(new Set());
  };

  const handleBulkIgnore = () => {
    setBullets(
      bullets.map((b) => (selectedBullets.has(b.id) ? { ...b, status: 'ignored' as const } : b))
    );
    setSelectedBullets(new Set());
  };

  const inputClass =
    'w-full rounded-lg border border-border/50 bg-overlay/30 px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2';

  return (
    <div className="space-y-6">
      {/* Which role, and the autosave state */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* After "Decode another job", the saved role must stay one choice away. */}
          {(data.roles.length > 1 || (!currentRole && data.roles.length > 0)) && (
            <Select
              value={currentRole?.id ?? undefined}
              onValueChange={(value) => value && setData(switchRole(data, value))}
            >
              <SelectTrigger aria-label="Switch role" className="border-border/50 bg-overlay/30">
                <SelectValue placeholder="New role" />
              </SelectTrigger>
              <SelectContent className="border border-border/60 bg-popover">
                {data.roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.jobTitle || 'Untitled role'}
                    {role.company ? ` at ${role.company}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {currentRole && (
            <button
              type="button"
              onClick={startNewRole}
              className="rounded-lg border border-border/50 bg-overlay/30 px-3 py-2 text-sm text-foreground transition-colors hover:bg-overlay/50 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
            >
              Decode another job
            </button>
          )}
        </div>
        <Announcer message={announcement} />
        <p
          className={cn(
            'text-xs',
            saveState === 'failed' ? 'font-medium text-destructive' : 'text-muted-foreground'
          )}
          aria-live="polite"
        >
          {saveState === 'failed'
            ? 'Not saved: this browser refused the last change'
            : currentRole
              ? saveState === 'saving'
                ? 'Saving'
                : savedAt && saveState === 'saved'
                  ? 'Saved'
                  : 'Saved in this browser'
              : 'Saves as soon as you type'}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="job-title" className="mb-1 block text-sm font-medium text-foreground">
            Job title
          </label>
          <input
            id="job-title"
            type="text"
            value={fields.jobTitle}
            onChange={(e) => commit({ jobTitle: e.target.value })}
            placeholder={
              student ? 'For example, Marketing intern' : 'For example, Operations coordinator'
            }
            className={inputClass}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Leave it blank and the first line of the posting is used.
          </p>
        </div>
        <div>
          <label htmlFor="company" className="mb-1 block text-sm font-medium text-foreground">
            Company
          </label>
          <input
            id="company"
            type="text"
            value={fields.company}
            onChange={(e) => commit({ company: e.target.value })}
            placeholder={
              student ? 'For example, City Parks Department' : 'For example, Riverside Supply'
            }
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label htmlFor="jd-url" className="mb-1 block text-sm font-medium text-foreground">
          Posting link (optional)
        </label>
        <input
          id="jd-url"
          type="url"
          value={fields.jdUrl}
          onChange={(e) => commit({ jdUrl: e.target.value })}
          placeholder="https://..."
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="jd-text" className="mb-1 block text-sm font-medium text-foreground">
          Paste the job posting
        </label>
        <p className="mb-1 text-xs text-muted-foreground">
          Paste the whole thing. Each line is sorted into required, nice to have, or a duty, the
          address, pay, and legal text are set aside, and each line gets a suggested skill.
        </p>
        <textarea
          id="jd-text"
          value={fields.rawJdText}
          onChange={(e) => commit({ rawJdText: e.target.value })}
          placeholder="Paste the whole posting here: what you would do, what they ask for, what is nice to have..."
          rows={8}
          className={inputClass}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            ref={parseButtonRef}
            type="button"
            onClick={parsePosting}
            data-guide="decode-parse"
            disabled={!fields.rawJdText.trim()}
            className="rounded-lg bg-foam px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-foam/90 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
          >
            {bullets.length > 0 ? 'Parse again' : 'Parse the requirements'}
          </button>
          {!fields.rawJdText.trim() && (
            <button
              type="button"
              data-guide="decode-sample"
              onClick={() => {
                commit({ rawJdText: SAMPLE_POSTING });
                // This button goes away once there is text; the next step is Parse.
                window.requestAnimationFrame(() => parseButtonRef.current?.focus());
              }}
              className="rounded-lg border border-border/50 bg-overlay/30 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-overlay/50 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
            >
              Use a sample posting
            </button>
          )}
          {bullets.length > 0 && (
            <span className="text-xs text-muted-foreground">
              Parsing again keeps your choices on lines that did not change.
            </span>
          )}
        </div>
      </div>

      {bullets.length === 0 && fields.rawJdText.trim() === '' && (
        <div className="rounded-xl border border-dashed border-border/40 p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-foam/10">
            <SearchIcon className="h-6 w-6 text-foam" />
          </div>
          <p className="text-sm font-medium text-foreground">No posting decoded yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Paste a job posting above and press "Parse the requirements". The skills it asks for
            become the list your stories need to cover.
          </p>
        </div>
      )}

      {repeatedTerms.length > 0 && (
        <div className="rounded-xl border border-border/30 bg-overlay/15 p-4">
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Repeated phrases
          </h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Phrases the posting keeps using, leaving out the employer's name and the job title. If a
            phrase repeats, expect a question about it and have a story ready.
          </p>
          <div className="flex flex-wrap gap-2">
            {repeatedTerms.map(({ term, count }) => (
              <span key={term} className="rounded-full bg-foam/12 px-2.5 py-1 text-xs text-foam">
                {term} <span className="font-semibold">&times;{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {bullets.length > 0 && (
        <div className="space-y-4" data-guide="decode-requirements">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Lines from the posting ({bullets.length})
              </h2>
              {requirementTotal !== bullets.length && (
                <p className="text-xs text-muted-foreground" data-testid="lines-counted">
                  {requirementTotal} of {bullets.length} are counted below as required, nice to
                  have, or a duty.
                  {bullets.some((b) => b.confirmed === true && b.status !== 'ignored')
                    ? ' Only the lines confirmed on the Application Desk are counted.'
                    : ''}
                  {bullets.length - activeCount > 0
                    ? ` ${bullets.length - activeCount} ${bullets.length - activeCount === 1 ? 'is' : 'are'} ignored.`
                    : ''}
                  {activeCount - requirementTotal > 0 &&
                  !bullets.some((b) => b.confirmed === true && b.status !== 'ignored')
                    ? ` ${activeCount - requirementTotal} ${activeCount - requirementTotal === 1 ? 'is' : 'are'} not sorted into a section.`
                    : ''}
                </p>
              )}
              {setAsideLines.length > 0 && (
                <details className="mt-1 text-xs text-muted-foreground" data-testid="set-aside">
                  <summary className="cursor-pointer">
                    Set aside {setAsideLines.length} {setAsideLines.length === 1 ? 'line' : 'lines'}{' '}
                    as pay, benefits, legal text, or not a requirement
                  </summary>
                  <p className="mt-2">Bring one back if it is a real duty.</p>
                  <ul className="mt-2 space-y-2">
                    {setAsideLines.map((line) => (
                      <li
                        key={`${line.start}-${line.end}`}
                        className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border/30 p-2"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-foreground">{line.text}</span>
                          <span className="block">
                            {SET_ASIDE_LABELS[line.reason] ?? 'Set aside'}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => bringBack(line)}
                          className="rounded-lg border border-border/50 bg-overlay/30 px-3 py-1 text-xs text-foreground transition-colors hover:bg-overlay/50 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
                        >
                          Bring back<span className="sr-only">: {shortText(line.text)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
            {selectedBullets.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {selectedBullets.size} selected
                </span>
                <SkillSelect
                  value={null}
                  onChange={(skillId) => skillId && handleBulkTag(skillId)}
                  placeholder="Tag all as..."
                  aria-label="Tag selected requirements"
                  className="h-8 text-sm"
                  resetAfterSelect
                />
                <button
                  type="button"
                  onClick={handleBulkIgnore}
                  className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive transition-colors hover:bg-destructive/15 focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2"
                >
                  Ignore <span className="sr-only">the {selectedBullets.size} selected</span>
                </button>
              </div>
            )}
          </div>
          <div className="max-h-96 space-y-2 overflow-y-auto rounded-lg border border-border/30 bg-overlay/15 p-3">
            {bullets.map((bullet) => (
              <div
                key={bullet.id}
                className={cn(
                  'flex items-start gap-3 rounded-lg border p-3 transition-colors',
                  bullet.status === 'ignored'
                    ? 'border-border/20 bg-overlay/10 opacity-50'
                    : isFillerLine(bullet.text)
                      ? 'border-gold/30 bg-gold/5'
                      : 'border-border/30 bg-overlay/20'
                )}
              >
                <input
                  type="checkbox"
                  aria-label={`Select requirement: ${bullet.text.substring(0, 50)}`}
                  checked={selectedBullets.has(bullet.id)}
                  onChange={(e) => {
                    const newSet = new Set(selectedBullets);
                    if (e.target.checked) newSet.add(bullet.id);
                    else newSet.delete(bullet.id);
                    setSelectedBullets(newSet);
                  }}
                  className="mt-1 h-4 w-4 rounded border-border accent-foam"
                />
                <div className="min-w-0 flex-1 space-y-2">
                  {bullet.section && (
                    <p className="text-xs text-muted-foreground">
                      {SECTION_LABELS[bullet.section]}
                    </p>
                  )}
                  <p
                    className={cn(
                      'text-sm',
                      bullet.status === 'ignored'
                        ? 'text-muted-foreground line-through'
                        : 'text-foreground'
                    )}
                  >
                    {bullet.text}
                    {isFillerLine(bullet.text) && bullet.status !== 'ignored' && (
                      <span className="ml-2 rounded bg-gold/20 px-1.5 py-0.5 text-xs text-foreground">
                        often filler
                      </span>
                    )}
                  </p>
                  {hiringCondition(bullet.text) && bullet.status !== 'ignored' && (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {hiringCondition(bullet.text)?.label}.
                      </span>{' '}
                      A condition of the job, not a skill. It needs no story, and the Rehearsal Room
                      will not ask you to prove it.
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <SkillSelect
                      value={bullet.primarySkillId}
                      onChange={(skillId) =>
                        setBullets(
                          bullets.map((b) =>
                            b.id === bullet.id ? { ...b, primarySkillId: skillId } : b
                          )
                        )
                      }
                      placeholder="Pick a skill..."
                      aria-label={`Skill this requirement tests: ${shortText(bullet.text)}`}
                      className="h-8 text-xs"
                      first={postingSkillIds}
                    />
                    {bullet.suggestion && bullet.suggestion.length > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">Suggested:</span>
                        {bullet.suggestion.slice(0, 2).map((s) => (
                          <button
                            key={s.skillId}
                            type="button"
                            onClick={() => {
                              setBullets(
                                bullets.map((b) =>
                                  b.id === bullet.id ? { ...b, primarySkillId: s.skillId } : b
                                )
                              );
                            }}
                            title={
                              s.matchedKeywords && s.matchedKeywords.length > 0
                                ? `Matched on ${s.matchedKeywords.join(', ')}`
                                : undefined
                            }
                            className="inline-flex min-h-6 items-center rounded-full bg-foam/15 px-2 py-0.5 text-xs text-foam underline-offset-2 transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
                          >
                            {/* The name starts with the visible words, so voice control can say them. */}
                            <span className="sr-only">Tag as </span>
                            {getSkillName(s.skillId)}
                            {s.matchedKeywords && s.matchedKeywords.length > 0 && (
                              <span className="text-foam">
                                {' '}
                                <span aria-hidden="true">&middot;</span> {s.matchedKeywords[0]}
                                {s.matchedKeywords.length > 1 &&
                                  ` +${s.matchedKeywords.length - 1}`}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setBullets(
                          bullets.map((b) =>
                            b.id === bullet.id
                              ? { ...b, status: b.status === 'ignored' ? 'active' : 'ignored' }
                              : b
                          )
                        );
                      }}
                      className="ml-auto rounded-lg border border-border/50 bg-overlay/30 px-3 py-1 text-xs text-foreground transition-colors hover:bg-overlay/50 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
                    >
                      {bullet.status === 'ignored' ? 'Restore' : 'Ignore'}
                      <span className="sr-only">: {shortText(bullet.text)}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {bullets.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-border/30 bg-overlay/15 p-4">
            <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              What this job tests
            </h3>
            <p className="mb-3 text-xs text-muted-foreground" data-testid="tests-denominator">
              {requirementTotal > 0
                ? `Counted over the ${requirementTotal} ${requirementTotal === 1 ? 'line' : 'lines'} sorted as required, nice to have, or a duty. One line can test several skills, so the counts do not add up to ${requirementTotal}.`
                : 'None of these lines is sorted as a requirement yet. Parse the posting again to sort them.'}
            </p>
            <ul className="space-y-2">
              {tested.slice(0, 8).map(({ skillId, count }) => (
                <li key={skillId} className="space-y-1">
                  <p className="flex justify-between gap-2 text-sm text-foreground">
                    <span className="min-w-0">{getSkillName(skillId)}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {count} of {requirementTotal}{' '}
                      {requirementTotal === 1 ? 'requirement' : 'requirements'}
                    </span>
                  </p>
                  <div className="h-2 rounded-full bg-overlay/40" aria-hidden="true">
                    <div
                      className="forced-fill h-full rounded-full bg-foam"
                      style={{ width: `${(count / Math.max(1, requirementTotal)) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-destructive">
              Skills with no story yet
            </h3>
            {topGaps.length === 0 ? (
              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                Every tagged skill has a story. <PartyIcon className="h-4 w-4" />
              </p>
            ) : (
              <ul className="space-y-1" data-testid="decode-gaps">
                {(showAllGaps ? topGaps : topGaps.slice(0, GAPS_SHOWN)).map((skillId) => (
                  <li key={skillId} className="flex items-center gap-2 text-sm text-foreground">
                    <span className="h-2 w-2 rounded-full bg-destructive" />
                    {getSkillName(skillId)}
                  </li>
                ))}
              </ul>
            )}
            {topGaps.length > GAPS_SHOWN && (
              <button
                type="button"
                aria-expanded={showAllGaps}
                onClick={() => setShowAllGaps((open) => !open)}
                className="mt-2 inline-flex min-h-6 items-center rounded px-1 text-sm text-foam underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
              >
                {showAllGaps ? 'Show fewer' : `Show all ${topGaps.length}`}
              </button>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Most often tested first. Counts every story in your library, packed or not. Next: open
              Build stories. Each gap has a start button there.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
