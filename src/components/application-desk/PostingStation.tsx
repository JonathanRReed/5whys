import * as React from 'react';
import { updateApplication } from '../../lib/applications';
import { detectSkillsFromText } from '../../lib/glowup-banks';
import {
  createRole,
  type DecodedBullet,
  POSTING_ENGINE_VERSION,
  updateRole,
} from '../../lib/glowup-store';
import {
  addRequirement,
  bulletsFromRequirements,
  carryOverDecisions,
  confirmAllSuggested,
  confirmRequirement,
  confirmsByDefault,
  dismissRequirement,
  findVaguePhrases,
  isSourceSpan,
  type PostingRequirement,
  type PostingSection,
  parsePosting,
  requirementsFromBullets,
  restoreRequirement,
  SAMPLE_POSTING,
  setRequirementSection,
} from '../../lib/posting';
import { cn } from '../../lib/utils';
import { withViewTransition } from '../../lib/view-transition';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import type { DeskState } from './useDesk';

const SECTION_LABEL: Record<PostingSection, string> = {
  required: 'Required',
  preferred: 'Preferred',
  responsibility: 'What you would do',
  unclassified: 'Not sorted yet',
};

/** One mark color per section, so the specimen and the list read as one key. */
const SECTION_MARK: Record<PostingSection, string> = {
  required: 'bg-foam/22 decoration-foam',
  preferred: 'bg-gold/22 decoration-gold',
  responsibility: 'bg-iris/22 decoration-iris',
  unclassified: 'bg-foreground/10 decoration-muted-foreground',
};

const SECTION_DOT: Record<PostingSection, string> = {
  required: 'bg-foam',
  preferred: 'bg-gold',
  responsibility: 'bg-iris',
  unclassified: 'bg-muted-foreground',
};

const SECTION_ORDER: PostingSection[] = ['required', 'preferred', 'responsibility', 'unclassified'];

/** Glow Up expects skill suggestions on each requirement; add them where missing. */
function withSkills(bullets: DecodedBullet[]): DecodedBullet[] {
  return bullets.map((bullet) => {
    if (bullet.suggestion?.length || bullet.primarySkillId) return bullet;
    const suggestions = detectSkillsFromText(bullet.text);
    return {
      ...bullet,
      primarySkillId: suggestions[0]?.skillId ?? null,
      secondarySkillIds: suggestions.slice(1).map((s) => s.skillId),
      suggestion: suggestions,
    };
  });
}

export default function PostingStation({ desk }: { desk: DeskState }) {
  const { application, role, changeGlow, changeApplications } = desk;
  const [draft, setDraft] = React.useState('');
  const [editing, setEditing] = React.useState(false);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [own, setOwn] = React.useState('');

  const sourceText = role?.parsedJdText ?? role?.rawJdText ?? '';
  const requirements = React.useMemo(
    () => requirementsFromBullets(role?.bullets ?? []),
    [role?.bullets]
  );
  const vague = React.useMemo(() => findVaguePhrases(sourceText), [sourceText]);

  React.useEffect(() => {
    setDraft(role?.rawJdText ?? '');
  }, [role?.rawJdText]);

  if (!application) return null;
  const showEditor = editing || !role || !sourceText.trim();

  const saveRequirements = (next: PostingRequirement[]) => {
    if (!role || next === requirements) return;
    changeGlow((data) =>
      updateRole(data, role.id, {
        bullets: withSkills(bulletsFromRequirements(next, role.bullets)),
      })
    );
  };

  const decode = () => {
    const text = draft.trim();
    if (!text) return;
    const parsed = parsePosting(text);
    const next = role
      ? carryOverDecisions(requirements, parsed.requirements, sourceText, parsed.text)
      : parsed.requirements;
    const bullets = withSkills(bulletsFromRequirements(next, role?.bullets ?? []));
    const fields = {
      rawJdText: text,
      parsedJdText: parsed.text,
      bullets,
      postingEngineVersion: POSTING_ENGINE_VERSION,
    };
    withViewTransition(() => {
      if (role) {
        changeGlow((data) => updateRole(data, role.id, fields));
      } else {
        const data = changeGlow((current) =>
          createRole(current, {
            jobTitle: application.title,
            company: application.company,
            ...fields,
          })
        );
        const roleId = data.currentRoleId;
        if (roleId) {
          changeApplications((apps) => updateApplication(apps, application.id, { roleId }));
        }
      }
      setEditing(false);
    });
  };

  if (showEditor) {
    return (
      <div className="max-w-3xl space-y-4" data-guide="posting-editor">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Paste the posting</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Paste the whole job description once. Every other station on this desk works from it,
            and it stays on this device.
          </p>
        </div>
        <label className="block space-y-2">
          <span className="text-sm text-muted-foreground">Job description</span>
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={14}
            placeholder="Paste the full posting here, headings and all."
            className="text-base"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={decode} disabled={!draft.trim()}>
            Decode the posting
          </Button>
          {!draft.trim() && (
            <Button
              type="button"
              variant="outline"
              data-guide="posting-sample"
              onClick={() => setDraft(SAMPLE_POSTING)}
            >
              Use a sample posting
            </Button>
          )}
          {role && sourceText.trim() && (
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>
              Keep the current one
            </Button>
          )}
        </div>
      </div>
    );
  }

  const live = requirements.filter((r) => r.status !== 'dismissed');
  const dismissed = requirements.filter((r) => r.status === 'dismissed');
  const suggested = live.filter((r) => r.status === 'suggested').length;
  // The button confirms only these; duties and unsorted lines wait for the student.
  const confirmable = live.filter((r) => r.status === 'suggested' && confirmsByDefault(r)).length;
  const confirmed = live.filter((r) => r.status === 'confirmed').length;

  // The posting, cut into plain text and the sentences requirements came from.
  const marks = live
    .filter((r) => isSourceSpan(r.span, sourceText))
    .sort((a, b) => (a.span?.start ?? 0) - (b.span?.start ?? 0));
  const pieces: React.ReactNode[] = [];
  let cursor = 0;
  for (const requirement of marks) {
    const span = requirement.span;
    if (!span || span.start < cursor) continue;
    if (span.start > cursor) pieces.push(sourceText.slice(cursor, span.start));
    pieces.push(
      <mark
        key={requirement.id}
        id={`mark-${requirement.id}`}
        className={cn(
          'rounded-[3px] px-0.5 text-foreground transition-colors',
          SECTION_MARK[requirement.section],
          requirement.status === 'suggested' && 'underline decoration-dotted underline-offset-4',
          activeId === requirement.id && 'ring-2 ring-gold/70'
        )}
        style={{ viewTransitionName: `req-${requirement.id.replace(/[^a-zA-Z0-9_-]/g, '')}` }}
        onMouseEnter={() => setActiveId(requirement.id)}
        onMouseLeave={() => setActiveId(null)}
      >
        {sourceText.slice(span.start, span.end)}
      </mark>
    );
    cursor = span.end;
  }
  if (cursor < sourceText.length) pieces.push(sourceText.slice(cursor));

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold">The posting</h2>
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
            Edit the text
          </Button>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {SECTION_ORDER.map((section) => (
            <li key={section} className="flex items-center gap-1.5">
              <span className={cn('h-2 w-2 rounded-full', SECTION_DOT[section])} />
              {SECTION_LABEL[section]}
            </li>
          ))}
        </ul>
        <div
          className="max-h-[36rem] overflow-y-auto rounded-xl border border-border/40 bg-card/60 p-5 text-sm leading-7 whitespace-pre-wrap lg:sticky lg:top-24"
          data-testid="posting-specimen"
        >
          {pieces}
        </div>
      </div>

      <div className="min-w-0 space-y-6" data-guide="posting-requirements">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">What it asks for</h3>
          <p className="text-sm leading-relaxed text-muted-foreground" data-testid="posting-count">
            {confirmed} confirmed, {suggested} to review. Confirm the ones that matter, dismiss what
            is not a real requirement, and sort any we could not place.
          </p>
          {confirmable > 0 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => saveRequirements(confirmAllSuggested(requirements))}
            >
              Confirm the required and preferred ones ({confirmable})
            </Button>
          )}
        </div>

        {SECTION_ORDER.map((section) => {
          const items = live.filter((r) => r.section === section);
          if (!items.length) return null;
          return (
            <section key={section} className="space-y-2">
              <h4 className="flex items-center gap-2 font-sans text-sm font-medium text-muted-foreground">
                <span className={cn('h-2 w-2 rounded-full', SECTION_DOT[section])} />
                {SECTION_LABEL[section]}
              </h4>
              <ul className="space-y-2">
                {items.map((requirement) => (
                  <li
                    key={requirement.id}
                    id={`req-${requirement.id}`}
                    onMouseEnter={() => setActiveId(requirement.id)}
                    onMouseLeave={() => setActiveId(null)}
                    className={cn(
                      'space-y-2 rounded-xl border p-3 transition-colors',
                      requirement.status === 'confirmed'
                        ? 'border-foam/45 bg-foam/6'
                        : 'border-border/40',
                      activeId === requirement.id && 'border-gold/70'
                    )}
                  >
                    <p className="text-sm leading-relaxed text-foreground">{requirement.text}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {requirement.status === 'confirmed' ? (
                        <span className="text-xs font-medium text-foam">Confirmed</span>
                      ) : (
                        <Button
                          type="button"
                          size="xs"
                          onClick={() =>
                            saveRequirements(confirmRequirement(requirements, requirement.id))
                          }
                        >
                          Confirm
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        onClick={() =>
                          saveRequirements(dismissRequirement(requirements, requirement.id))
                        }
                      >
                        Dismiss
                      </Button>
                      <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="sr-only">Section for: {requirement.text}</span>
                        <select
                          value={requirement.section}
                          onChange={(event) =>
                            saveRequirements(
                              setRequirementSection(
                                requirements,
                                requirement.id,
                                event.target.value as PostingSection
                              )
                            )
                          }
                          className="h-7 rounded-md border border-border/50 bg-transparent px-1.5 text-xs text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {SECTION_ORDER.map((option) => (
                            <option key={option} value={option}>
                              {SECTION_LABEL[option]}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            saveRequirements(addRequirement(requirements, own, { section: 'required' }));
            setOwn('');
          }}
        >
          <label className="min-w-0 flex-1">
            <span className="sr-only">Add a requirement the posting implies</span>
            <Input
              value={own}
              onChange={(event) => setOwn(event.target.value)}
              placeholder="Add one we missed"
              className="text-base"
            />
          </label>
          <Button type="submit" variant="outline" disabled={!own.trim()}>
            Add
          </Button>
        </form>

        {dismissed.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">
              {dismissed.length} dismissed
            </summary>
            <ul className="mt-2 space-y-1">
              {dismissed.map((requirement) => (
                <li key={requirement.id} className="flex items-start justify-between gap-3">
                  <span className="text-muted-foreground">{requirement.text}</span>
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    onClick={() =>
                      saveRequirements(restoreRequirement(requirements, requirement.id))
                    }
                  >
                    Restore
                  </Button>
                </li>
              ))}
            </ul>
          </details>
        )}

        {vague.length > 0 && (
          <section className="space-y-2 border-t border-border/40 pt-5">
            <h3 className="text-lg font-semibold">Worth asking about</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              These phrases can mean different things at different employers. A posting cannot tell
              you which, so here are questions you could ask.
            </p>
            <ul className="space-y-3">
              {[...new Map(vague.map((hit) => [hit.id, hit])).values()].map((hit) => (
                <li key={hit.id} className="text-sm">
                  <p className="font-medium text-foreground">"{hit.text}"</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
                    {hit.phrase.questions.map((question) => (
                      <li key={question}>{question}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
