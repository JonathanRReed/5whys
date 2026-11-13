import * as React from 'react';
import { remapQualifications } from '../../lib/application-desk';
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
  hiringCondition,
  isSourceSpan,
  type PostingRequirement,
  type PostingSection,
  parsePosting,
  requirementIdMap,
  requirementsFromBullets,
  restoreRequirement,
  SAMPLE_POSTING,
  type SetAsideReason,
  setRequirementSection,
} from '../../lib/posting';
import { POSTING_HANDOFF_KEY } from '../../lib/posting-handoff';
import { cn } from '../../lib/utils';
import { withViewTransition } from '../../lib/view-transition';
import Announcer, { useAnnouncer } from '../shared/Announcer';
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

/**
 * One mark color per section, so the specimen and the list read as one key.
 * Each section also has its own underline style, so the key does not depend
 * on telling the colors apart.
 */
const SECTION_MARK: Record<PostingSection, string> = {
  required: 'bg-foam/22',
  preferred: 'bg-gold/22',
  responsibility: 'bg-iris/22',
  unclassified: 'bg-foreground/10',
};

const SECTION_LINE: Record<PostingSection, string> = {
  required: 'decoration-foam decoration-solid',
  preferred: 'decoration-gold decoration-dashed',
  responsibility: 'decoration-iris decoration-dotted',
  unclassified: 'decoration-muted-foreground decoration-double',
};

const SECTION_DOT: Record<PostingSection, string> = {
  required: 'bg-foam',
  preferred: 'bg-gold',
  responsibility: 'bg-iris',
  unclassified: 'bg-muted-foreground',
};

const SECTION_ORDER: PostingSection[] = ['required', 'preferred', 'responsibility', 'unclassified'];

/** A requirement, cut short enough to sit inside a button's name. */
function shortText(text: string): string {
  return text.length > 60 ? `${text.slice(0, 57).trimEnd()}...` : text;
}

/** Says so when a line is about who may be hired rather than what they can do. */
function ConditionNote({ text }: { text: string }) {
  const condition = hiringCondition(text);
  if (!condition) return null;
  return (
    <p className="text-xs leading-relaxed text-muted-foreground">
      <span className="font-medium text-foreground">{condition.label}. </span>
      {condition.note}
    </p>
  );
}

/** Why the sorter left a line out, in a few plain words. */
const SET_ASIDE_LABEL: Record<Exclude<SetAsideReason, 'heading'>, string> = {
  'too-short': 'Too short to be a requirement',
  boilerplate: 'Legal or benefits text',
  'header-line': 'Title or location',
  'job-details': 'A detail of the job',
  'outside-requirements': 'Under a heading that is not about requirements',
  'group-lead': 'Introduces the lines under it',
  'over-limit': 'Past the limit for one posting',
  'application-logistics': 'How or when to apply',
  'company-description': 'About the employer',
  'role-summary': 'A summary of the role',
  pitch: 'Selling the job',
  description: 'Reads as description',
};

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
  const { application, role, changeGlow, changeApplications, changeDesks } = desk;
  const [draft, setDraft] = React.useState('');
  const [editing, setEditing] = React.useState(false);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [own, setOwn] = React.useState('');
  const [announcement, announce] = useAnnouncer();
  // After an action replaces the control that had focus, the id of the
  // element that takes it. Applied once that element is on the page.
  const pendingFocus = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!pendingFocus.current) return;
    const target = document.getElementById(pendingFocus.current);
    if (!target) return;
    pendingFocus.current = null;
    target.focus();
  });

  const sourceText = role?.parsedJdText ?? role?.rawJdText ?? '';
  const requirements = React.useMemo(
    () => requirementsFromBullets(role?.bullets ?? []),
    [role?.bullets]
  );
  const vague = React.useMemo(() => findVaguePhrases(sourceText), [sourceText]);
  // Lines the sorter left out, minus headings and any the visitor has since added.
  const setAside = React.useMemo(() => {
    if (!sourceText.trim()) return [];
    const kept = new Set(requirements.map((r) => r.text.trim()));
    return parsePosting(sourceText).setAside.filter(
      (line) => line.reason !== 'heading' && line.text.trim() && !kept.has(line.text.trim())
    );
  }, [sourceText, requirements]);

  React.useEffect(() => {
    setDraft(role?.rawJdText ?? '');
  }, [role?.rawJdText]);

  // A posting pasted into the homepage demo is waiting in this tab: use it for
  // an application that has no posting yet, once.
  const hasPosting = Boolean(role?.rawJdText?.trim());
  React.useEffect(() => {
    if (!application || hasPosting) return;
    try {
      const waiting = window.sessionStorage.getItem(POSTING_HANDOFF_KEY);
      if (!waiting?.trim()) return;
      window.sessionStorage.removeItem(POSTING_HANDOFF_KEY);
      setDraft(waiting);
    } catch {
      // Storage is blocked: the visitor pastes the posting here instead.
    }
  }, [application, hasPosting]);

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

  /** The count line under "What it asks for", for the status message. */
  const countLine = (list: PostingRequirement[]) => {
    const kept = list.filter((r) => r.status !== 'dismissed');
    const done = kept.filter((r) => r.status === 'confirmed').length;
    const left = kept.filter((r) => r.status === 'suggested').length;
    return `${done} confirmed, ${left} to review.`;
  };

  /** Save, then say what changed and put focus on `focusId` if given. */
  const act = (next: PostingRequirement[], said: string, focusId?: string) => {
    if (focusId) pendingFocus.current = focusId;
    saveRequirements(next);
    announce(`${said} ${countLine(next)}`);
  };

  const decode = () => {
    const text = draft.trim();
    if (!text) return;
    const parsed = parsePosting(text);
    const next = role
      ? carryOverDecisions(requirements, parsed.requirements, sourceText, parsed.text)
      : parsed.requirements;
    const bullets = withSkills(bulletsFromRequirements(next, role?.bullets ?? []));
    // Where you stand on each requirement follows the requirement, not its
    // place in the text.
    if (role && desk.desk.qualifications.length > 0) {
      const moved = requirementIdMap(requirements, parsed.requirements, sourceText, parsed.text);
      const parsedIds = new Set(requirements.filter((r) => r.origin === 'parsed').map((r) => r.id));
      changeDesks((data) => remapQualifications(data, application.id, moved, parsedIds));
    }
    pendingFocus.current = 'desk-posting-heading';
    announce(`Posting decoded. ${countLine(next)}`);
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
          <h2
            id="desk-paste-heading"
            tabIndex={-1}
            className="text-2xl font-semibold focus-visible:outline-hidden"
          >
            Paste the posting
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Paste the whole job description once. Every other station on this desk works from it,
            and it stays on this device.
          </p>
        </div>
        <label className="block space-y-2">
          <span className="text-sm text-muted-foreground">Job description</span>
          <Textarea
            id="desk-posting-text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={14}
            placeholder="Paste the full posting here, headings and all."
            className="text-base"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            id="desk-decode"
            type="button"
            onClick={decode}
            disabled={!draft.trim()}
            aria-describedby={draft.trim() ? undefined : 'desk-decode-needs'}
          >
            Decode the posting
          </Button>
          {!draft.trim() && (
            <Button
              type="button"
              variant="outline"
              data-guide="posting-sample"
              onClick={() => {
                // This button goes away once there is text; Decode is next.
                pendingFocus.current = 'desk-decode';
                setDraft(SAMPLE_POSTING);
              }}
            >
              Use a sample posting
            </Button>
          )}
          {role && sourceText.trim() && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                pendingFocus.current = 'desk-posting-heading';
                setEditing(false);
              }}
            >
              Keep the current one
            </Button>
          )}
        </div>
        {!draft.trim() && (
          <p id="desk-decode-needs" className="text-xs text-muted-foreground">
            Paste a posting, or use the sample, to decode it.
          </p>
        )}
        <Announcer message={announcement} />
      </div>
    );
  }

  const live = requirements.filter((r) => r.status !== 'dismissed');
  const dismissed = requirements.filter((r) => r.status === 'dismissed');
  const suggested = live.filter((r) => r.status === 'suggested').length;
  // The button confirms only these; duties and unsorted lines wait for the student.
  const confirmable = live.filter((r) => r.status === 'suggested' && confirmsByDefault(r)).length;
  const confirmed = live.filter((r) => r.status === 'confirmed').length;
  // In the order the list shows them, so a dismissed line hands focus to the
  // one below it, or the heading when it was the last.
  const shown = SECTION_ORDER.flatMap((section) => live.filter((r) => r.section === section));
  const nextFocusAfter = (id: string) => {
    const index = shown.findIndex((r) => r.id === id);
    const next = shown[index + 1] ?? shown[index - 1];
    return next ? `confirm-${next.id}` : 'desk-asks-heading';
  };

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
          'rounded-[3px] px-0.5 text-foreground underline underline-offset-4 transition-colors',
          SECTION_MARK[requirement.section],
          SECTION_LINE[requirement.section],
          requirement.status === 'confirmed' && 'decoration-2',
          activeId === requirement.id && 'ring-2 ring-gold/70'
        )}
        style={{ viewTransitionName: `req-${requirement.id.replace(/[^a-zA-Z0-9_-]/g, '')}` }}
        onMouseEnter={() => setActiveId(requirement.id)}
        onMouseLeave={() => setActiveId(null)}
      >
        <span className="sr-only">{SECTION_LABEL[requirement.section]}: </span>
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
          <h2
            id="desk-posting-heading"
            tabIndex={-1}
            className="text-2xl font-semibold focus-visible:outline-hidden"
          >
            The posting
          </h2>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              pendingFocus.current = 'desk-posting-text';
              setEditing(true);
            }}
          >
            Edit the text
          </Button>
        </div>
        <ul
          aria-label="Key to the highlights"
          className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"
        >
          {SECTION_ORDER.map((section) => (
            <li key={section} className="flex items-center gap-1.5">
              <span
                className={cn('forced-fill h-2 w-2 rounded-full', SECTION_DOT[section])}
                aria-hidden="true"
              />
              <span className={cn('underline underline-offset-4', SECTION_LINE[section])}>
                {SECTION_LABEL[section]}
              </span>
            </li>
          ))}
        </ul>
        {/* Named, so a browser that puts the scroller in the Tab order announces it. */}
        <section
          aria-label="The posting, highlighted"
          className="max-h-[36rem] overflow-y-auto rounded-xl border border-border/40 bg-card/60 p-5 text-sm leading-7 whitespace-pre-wrap lg:sticky lg:top-24"
          data-testid="posting-specimen"
        >
          {pieces}
        </section>
      </div>

      <div className="min-w-0 space-y-6" data-guide="posting-requirements">
        <Announcer message={announcement} />
        <div className="space-y-2">
          <h3
            id="desk-asks-heading"
            tabIndex={-1}
            className="text-lg font-semibold focus-visible:outline-hidden"
          >
            What it asks for
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground" data-testid="posting-count">
            {confirmed} confirmed, {suggested} to review. Confirm the ones that matter, dismiss what
            is not a real requirement, and sort any we could not place.
          </p>
          {confirmable > 0 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                act(confirmAllSuggested(requirements), 'Confirmed.', 'desk-asks-heading')
              }
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
                <span
                  className={cn('forced-fill h-2 w-2 rounded-full', SECTION_DOT[section])}
                  aria-hidden="true"
                />
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
                    <ConditionNote text={requirement.text} />
                    <div className="flex flex-wrap items-center gap-2">
                      {/* A toggle, so focus stays here and a second press undoes it. */}
                      <Button
                        id={`confirm-${requirement.id}`}
                        type="button"
                        size="xs"
                        variant={requirement.status === 'confirmed' ? 'outline' : 'default'}
                        aria-pressed={requirement.status === 'confirmed'}
                        className="max-sm:min-h-11 max-sm:px-3"
                        onClick={() =>
                          requirement.status === 'confirmed'
                            ? act(
                                restoreRequirement(requirements, requirement.id),
                                'Back to review.'
                              )
                            : act(confirmRequirement(requirements, requirement.id), 'Confirmed.')
                        }
                      >
                        {requirement.status === 'confirmed' ? 'Confirmed' : 'Confirm'}
                        <span className="sr-only">: {shortText(requirement.text)}</span>
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        className="max-sm:min-h-11 max-sm:px-3"
                        onClick={() =>
                          act(
                            dismissRequirement(requirements, requirement.id),
                            'Dismissed.',
                            nextFocusAfter(requirement.id)
                          )
                        }
                      >
                        Dismiss<span className="sr-only">: {shortText(requirement.text)}</span>
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
                          className="h-7 max-sm:h-11 rounded-md border border-border/50 bg-transparent px-1.5 text-xs text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
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
            act(addRequirement(requirements, own, { section: 'required' }), 'Added.');
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
                      act(
                        restoreRequirement(requirements, requirement.id),
                        'Restored.',
                        `confirm-${requirement.id}`
                      )
                    }
                  >
                    Restore<span className="sr-only">: {shortText(requirement.text)}</span>
                  </Button>
                </li>
              ))}
            </ul>
          </details>
        )}

        {setAside.length > 0 && (
          <details className="text-sm" data-testid="set-aside">
            <summary className="cursor-pointer text-muted-foreground">
              {setAside.length} {setAside.length === 1 ? 'line' : 'lines'} set aside as not a
              requirement
            </summary>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              If one of these is something the job asks of you, add it and it joins the list above.
            </p>
            <ul className="mt-2 space-y-2">
              {setAside.map((line) => (
                <li key={line.start} className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="text-muted-foreground">{line.text.trim()}</span>
                    <span className="block text-xs text-muted-foreground">
                      {SET_ASIDE_LABEL[line.reason as Exclude<SetAsideReason, 'heading'>]}
                    </span>
                  </span>
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    onClick={() =>
                      act(
                        addRequirement(requirements, line.text, {
                          section: 'unclassified',
                          status: 'suggested',
                        }),
                        'Added to the list.',
                        'desk-asks-heading'
                      )
                    }
                  >
                    Add<span className="sr-only">: {shortText(line.text.trim())}</span>
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
