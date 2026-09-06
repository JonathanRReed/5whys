import * as React from 'react';
import {
  detectSkillsFromText,
  extractRequirementLines,
  getRepeatedTerms,
  getSkillName,
  SKILL_BANK,
} from '../../lib/glowup-banks';
import {
  createRole,
  type DecodedBullet,
  type DecodedRole,
  ensurePacketForRole,
  type GlowUpData,
  generateId,
  getSkillFrequencyMap,
  getTaggedBulletCount,
  getTopGaps,
  switchRole,
  updateRole,
} from '../../lib/glowup-store';
import { isStudentLike, readProfile } from '../../lib/profile';
import { cn } from '../../lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { PartyIcon, SearchIcon } from './icons';
import SkillSelect from './SkillSelect';

type Props = {
  data: GlowUpData;
  setData: React.Dispatch<React.SetStateAction<GlowUpData>>;
  currentRole: DecodedRole | undefined;
};

type RoleFields = Pick<DecodedRole, 'jobTitle' | 'company' | 'jdUrl' | 'rawJdText'>;

/** A title for the role when none was typed: the first short line of the JD. */
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

const EMPTY_FIELDS: RoleFields = { jobTitle: '', company: '', jdUrl: '', rawJdText: '' };

export default function DecodeSection({ data, setData, currentRole }: Props) {
  const student = isStudentLike(readProfile());
  // Before a role exists, edits live here; the first keystroke creates the
  // role and from then on every field is read from and written to the store.
  const [pending, setPending] = React.useState<RoleFields>(EMPTY_FIELDS);
  const [selectedBullets, setSelectedBullets] = React.useState<Set<string>>(new Set());
  const [skippedCount, setSkippedCount] = React.useState<number | null>(null);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);

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
      bullets: nextBullets ?? [],
    });
    setData(ensurePacketForRole(created, created.currentRoleId as string));
    setPending(EMPTY_FIELDS);
  };

  const setBullets = (next: DecodedBullet[]) => commit({}, next);

  const parseJD = () => {
    if (!fields.rawJdText.trim()) return;
    const { requirements, skippedCount: skipped } = extractRequirementLines(fields.rawJdText);
    const parsed: DecodedBullet[] = requirements.map((line) => {
      const suggestions = detectSkillsFromText(line);
      return {
        id: generateId(),
        text: line,
        status: 'active' as const,
        primarySkillId: suggestions[0]?.skillId ?? null,
        secondarySkillIds: suggestions.slice(1).map((s) => s.skillId),
        suggestion: suggestions,
      };
    });
    setSkippedCount(skipped);
    const title = fields.jobTitle.trim() ? {} : { jobTitle: deriveTitle(fields.rawJdText) };
    commit(title, parsed);
  };

  const startNewRole = () => {
    setPending(EMPTY_FIELDS);
    setSkippedCount(null);
    setData({ ...data, currentRoleId: null, currentPacketId: null });
  };

  // Frequency, totals, and gaps all read the same saved bullets.
  const skillFreq = getSkillFrequencyMap(bullets);
  const taggedBullets = getTaggedBulletCount(bullets);
  const topGaps = getTopGaps(data, bullets);

  const repeatedTerms = React.useMemo(
    () => (fields.rawJdText.trim() ? getRepeatedTerms(fields.rawJdText) : []),
    [fields.rawJdText]
  );

  // Legacy saved roles may still contain very short lines; flag them.
  const isNoise = (text: string) => text.split(/\s+/).length < 4;

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
          {data.roles.length > 1 && (
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
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {currentRole
            ? savedAt
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
            placeholder={student ? 'e.g., Marketing Intern' : 'e.g., Product Analyst'}
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
            placeholder={student ? 'e.g., City Parks Department' : 'e.g., Acme Corp'}
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
          Paste the whole thing. The requirement lines are pulled out, headings and boilerplate are
          skipped, and each line gets a suggested skill tag.
        </p>
        <textarea
          id="jd-text"
          value={fields.rawJdText}
          onChange={(e) => commit({ rawJdText: e.target.value })}
          placeholder="Paste the entire posting here: responsibilities, requirements, nice-to-haves..."
          rows={8}
          className={inputClass}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={parseJD}
            disabled={!fields.rawJdText.trim()}
            className="rounded-lg bg-foam px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-foam/90 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
          >
            {bullets.length > 0 ? 'Parse again' : 'Parse the requirements'}
          </button>
          {bullets.length > 0 && (
            <span className="text-xs text-muted-foreground">
              Parsing again replaces the tags below.
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
            Paste a job posting above and parse it. The skills it tests become the list your stories
            need to cover.
          </p>
        </div>
      )}

      {repeatedTerms.length > 0 && (
        <div className="rounded-xl border border-border/30 bg-overlay/15 p-4">
          <h4 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Repeated phrases
          </h4>
          <p className="mb-3 text-xs text-muted-foreground">
            Phrases that keep showing up in the posting. If a phrase repeats, expect a question
            about it: prepare a story that covers it.
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
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Requirements ({bullets.length})
              </h3>
              {skippedCount !== null && skippedCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  Skipped {skippedCount} {skippedCount === 1 ? 'line' : 'lines'} of headings,
                  benefits, and boilerplate.
                </p>
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
                  Ignore
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
                    : isNoise(bullet.text)
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
                <div className="flex-1 space-y-2">
                  <p
                    className={cn(
                      'text-sm',
                      bullet.status === 'ignored'
                        ? 'text-muted-foreground line-through'
                        : 'text-foreground'
                    )}
                  >
                    {bullet.text}
                    {isNoise(bullet.text) && bullet.status !== 'ignored' && (
                      <span className="ml-2 rounded bg-gold/20 px-1.5 py-0.5 text-xs text-gold">
                        noise?
                      </span>
                    )}
                  </p>
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
                      aria-label="Skill this requirement tests"
                      className="h-8 text-xs"
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
                            aria-label={
                              s.matchedKeywords && s.matchedKeywords.length > 0
                                ? `Tag as ${getSkillName(s.skillId)}, matched on ${s.matchedKeywords.join(', ')}`
                                : `Tag as ${getSkillName(s.skillId)}`
                            }
                            className="rounded-full bg-foam/15 px-2 py-0.5 text-xs text-foam transition-colors hover:bg-foam/25 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
                          >
                            {getSkillName(s.skillId)}
                            {s.matchedKeywords && s.matchedKeywords.length > 0 && (
                              <span className="text-foam/70" aria-hidden="true">
                                {' '}
                                &middot; {s.matchedKeywords[0]}
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
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {skillFreq.size > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-border/30 bg-overlay/15 p-4">
            <h4 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              What this job tests
            </h4>
            <p className="mb-3 text-xs text-muted-foreground">
              Share of tagged requirements that mention each skill.
            </p>
            <div className="space-y-2">
              {Array.from(skillFreq.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8)
                .map(([skillId, count]) => {
                  const pct = taggedBullets > 0 ? Math.round((count / taggedBullets) * 100) : 0;
                  return (
                    <div key={skillId} className="flex items-center gap-2">
                      <span className="w-24 truncate text-sm text-foreground">
                        {getSkillName(skillId)}
                      </span>
                      <div className="flex-1 h-2 rounded-full bg-overlay/40">
                        <div
                          className="h-full rounded-full bg-foam"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <span className="w-10 text-right text-xs text-muted-foreground">{pct}%</span>
                    </div>
                  );
                })}
            </div>
          </div>
          <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-4">
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-destructive">
              Skills with no story yet
            </h4>
            {topGaps.length === 0 ? (
              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                Every tagged skill has a story. <PartyIcon className="h-4 w-4" />
              </p>
            ) : (
              <ul className="space-y-1">
                {topGaps.map((skillId) => (
                  <li key={skillId} className="flex items-center gap-2 text-sm text-foreground">
                    <span className="h-2 w-2 rounded-full bg-destructive" />
                    {getSkillName(skillId)}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Next: open Build stories. Each gap has a start button there.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
