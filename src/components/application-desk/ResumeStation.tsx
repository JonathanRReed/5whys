import * as React from 'react';
import { setResumeSelection, updateBulletsFlow } from '../../lib/application-desk';
import { readResumeRewrites, readResumeText } from '../../lib/career-bridge';
import { deskRequirements } from '../../lib/desk-checks';
import { loadFeature, reportFeatureFailure } from '../../lib/lazy-feature';
import { extractRequirementTerms, findTermMatches } from '../../lib/posting';
import type { ResumeDoc, ResumeLine } from '../../lib/resume-doc';
import { listedLineIds } from '../../lib/resume-doc/editor-text';
import { joinParts } from '../../lib/resume-doc/layout';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import type { DeskState } from './useDesk';

/** A bullet with the rest of its wrapped lines joined on. */
type Bullet = {
  id: string;
  text: string;
  /** The line as the resume has it, reduced to its words. */
  key: string;
  requirements: string[];
};

function bulletsOf(doc: ResumeDoc): { id: string; text: string }[] {
  const byId = new Map(doc.lines.map((line) => [line.id, line]));
  const tails = new Map<string, ResumeLine[]>();
  for (const line of doc.lines) {
    if (!line.continuationOf) continue;
    tails.set(line.continuationOf, [...(tails.get(line.continuationOf) ?? []), line]);
  }
  // A skills or certifications list is made of list items too, but its lines
  // are not things done: they are never offered as bullets to include.
  const listed = listedLineIds(doc);
  return doc.extractionOrder
    .map((id) => byId.get(id))
    .filter((line): line is ResumeLine =>
      Boolean(line?.bullet && !line.continuationOf && !listed.has(line.id))
    )
    .map((line) => ({
      id: line.id,
      // A pasted resume keeps its typed dash or dot; the list draws its own.
      text: joinParts([line, ...(tails.get(line.id) ?? [])].map((part) => part.text)).replace(
        /^[-–•*◦○●▪·]\s+/,
        ''
      ),
    }));
}

/** A line reduced to its words, to match a rewrite to the line it replaces. */
function wordsOf(text: string): string {
  return text
    .replace(/^\s*[-–•*◦○●▪·o]\s+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * A pasted resume often has no bullet marks. The lines the Resume Game reads
 * as achievements are its bullets, so they can be chosen here too.
 */
export function withAchievementLines(doc: ResumeDoc, achievements: readonly string[]): ResumeDoc {
  const found = new Set(achievements.map(wordsOf));
  if (found.size === 0) return doc;
  return {
    ...doc,
    lines: doc.lines.map((line) =>
      !line.bullet && !line.continuationOf && found.has(wordsOf(line.text))
        ? { ...line, bullet: true }
        : line
    ),
  };
}

/**
 * Whether a saved document still says what the resume text says: every line
 * of it is in the text. A correction typed into the Resume Game (an email
 * address, a date, a bullet) is not in the document, so once the two differ
 * the text is the resume and the copy for a role is built from it.
 */
export function sameResume(doc: ResumeDoc, resumeText: string): boolean {
  const text = wordsOf(resumeText);
  return doc.lines.every((line) => {
    const words = wordsOf(line.text);
    // A line that wraps after a hyphen is joined without a space in the text.
    return words.length < 4 || /-$/.test(words) || text.includes(words);
  });
}

/** The words of a line, for telling a corrected line from a different one. */
function tokens(key: string): Set<string> {
  return new Set(key.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
}

/**
 * How much two lines share: the words in common over the longer line's
 * words. "Built a spreadsheet tracking 30 volunteers" and the same line with
 * 45 share five of six.
 */
function overlap(a: string, b: string): number {
  const left = tokens(a);
  const right = tokens(b);
  const size = Math.max(left.size, right.size);
  if (size === 0) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / size;
}

/** At least this share of words in common makes a line the same line, edited. */
const SAME_LINE = 0.6;

/**
 * Which bullets a saved choice covers in the resume as it is now, and whether
 * the choice had to be dropped. The choice is matched on the bullets' words,
 * because line ids are positions and stop naming the same bullets once the
 * resume is edited. A bullet whose words were corrected (a number, a word) is
 * still the same bullet when most of its words are unchanged. Only when none
 * of the chosen bullets can be found is it a different resume: nothing has
 * been chosen for it yet, so every bullet is included and `reset` says so.
 */
export function matchSelection(
  bullets: readonly { id: string; key: string }[],
  saved: { bulletIds: string[]; bulletTexts?: string[] } | null
): { ids: string[]; reset: boolean } {
  const all = bullets.map((b) => b.id);
  if (!saved) return { ids: all, reset: false };
  if (!saved.bulletTexts) {
    const known = new Set(all);
    return { ids: saved.bulletIds.filter((id) => known.has(id)), reset: false };
  }
  if (saved.bulletTexts.length === 0) return { ids: [], reset: false };
  const chosen = new Set<string>();
  const pending: string[] = [];
  for (const text of saved.bulletTexts) {
    const exact = bullets.find((b) => b.key === text && !chosen.has(b.id));
    if (exact) chosen.add(exact.id);
    else pending.push(text);
  }
  // Each edited line takes the unclaimed bullet closest to it, if close enough.
  for (const text of pending) {
    let best: { id: string; score: number } | null = null;
    for (const bullet of bullets) {
      if (chosen.has(bullet.id)) continue;
      const score = overlap(text, bullet.key);
      if (score >= SAME_LINE && (!best || score > best.score)) best = { id: bullet.id, score };
    }
    if (best) chosen.add(best.id);
  }
  if (chosen.size === 0) return { ids: all, reset: true };
  return { ids: all.filter((id) => chosen.has(id)), reset: false };
}

/** A role's header line: it carries a year, or says it is current. */
const DATED = /\b(?:19|20)\d{2}\b|\b(?:present|current|now)\b/i;

/**
 * Where a bullet written on the desk goes by default: after the last bullet
 * of the most recent job, which is the first dated role under an experience
 * section. Never under skills, education or a summary. With no experience
 * section, after the last bullet outside those sections; null when there is
 * no such bullet.
 *
 * `bulletIds` are the bullets that can be chosen, by their first line.
 */
export function defaultPlacement(doc: ResumeDoc, bulletIds: readonly string[]): string | null {
  const choosable = new Set(bulletIds);
  const byId = new Map(doc.lines.map((line) => [line.id, line]));
  for (const section of doc.sections.filter((s) => s.kind === 'experience')) {
    let inRole = false;
    let last: string | null = null;
    let anyBullet: string | null = null;
    for (const id of section.lineIds) {
      const line = byId.get(id);
      if (!line || line.continuationOf) continue;
      if (choosable.has(id)) {
        anyBullet ??= id;
        if (inRole || !last) last = id;
        continue;
      }
      if (!line.bullet && DATED.test(line.text)) {
        // The next dated role starts: the first one is finished.
        if (inRole && last) return last;
        inRole = true;
        last = null;
      }
    }
    if (last) return last;
    if (anyBullet) return anyBullet;
  }
  const excluded = new Set(
    doc.sections
      .filter((s) => s.kind === 'skills' || s.kind === 'education' || s.kind === 'summary')
      .flatMap((s) => s.lineIds)
  );
  const outside = bulletIds.filter((id) => !excluded.has(id));
  return outside.at(-1) ?? null;
}

/** The bullet ids a saved choice covers now. See `matchSelection`. */
export function selectedIds(
  bullets: readonly { id: string; key: string }[],
  saved: { bulletIds: string[]; bulletTexts?: string[] } | null
): string[] {
  return matchSelection(bullets, saved).ids;
}

/**
 * One master resume, tailored per application: choose which of its bullets
 * go into the copy for this role. Nothing here edits the resume itself; the
 * selection is all an application keeps.
 */
export default function ResumeStation({ desk }: { desk: DeskState }) {
  // The resume and its rewrites are read again when another tab saves them
  // and when this tab comes back into view (see useDesk). Lines rewritten in
  // the Resume Game replace their originals in this copy.
  const { application, role, resumeText, rewrites, changeDesks } = desk;
  const [doc, setDoc] = React.useState<ResumeDoc | null | undefined>(undefined);
  const [notice, setNotice] = React.useState<string | null>(null);
  // "Only the ones that match" would leave this few bullets: asked about in place.
  const [narrowing, setNarrowing] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void loadFeature(import('../../lib/local-db'))
      .then(async ({ getResumeDoc }) => {
        const saved = await getResumeDoc<ResumeDoc>();
        if (cancelled) return;
        // An uploaded file is kept until it is replaced. If the visitor has
        // since pasted a different resume, the pasted one is the resume.
        const { docMatchesText } = await loadFeature(import('../../lib/resume-doc'));
        if (cancelled) return;
        // The saved copy keeps the repairs made in the Resume Game (one
        // column, contact details, headings). It is used while the text is
        // still what the file was read as; once the visitor edits the text,
        // the text is the resume.
        if (
          saved &&
          (!resumeText.trim() ||
            docMatchesText(saved.doc, resumeText) ||
            sameResume(saved.doc, resumeText))
        ) {
          setDoc(saved.doc);
          return;
        }
        // No uploaded file: a resume pasted into the Resume Game still counts.
        if (resumeText.trim()) {
          const { fromText } = await loadFeature(import('../../lib/resume-doc'));
          const { detectResumeStructure } = await loadFeature(import('../../lib/resume-game'));
          if (!cancelled) {
            setDoc(
              withAchievementLines(fromText(resumeText), detectResumeStructure(resumeText).bullets)
            );
          }
        } else {
          setDoc(null);
        }
      })
      .catch((error) => {
        reportFeatureFailure(error);
        if (!cancelled) setDoc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [resumeText]);

  // Conditions of hiring (an age, a licence, work authorization) are never
  // shown as something a bullet answers.
  const confirmed = React.useMemo(
    () => deskRequirements(role?.bullets ?? []).requirements,
    [role?.bullets]
  );
  const bullets: Bullet[] = React.useMemo(() => {
    if (!doc) return [];
    const terms = confirmed.map((r) => ({ text: r.text, terms: extractRequirementTerms(r.text) }));
    const reworded = new Map(rewrites.map((r) => [wordsOf(r.original), r.improved.trim()]));
    return bulletsOf(doc).map((bullet) => ({
      ...bullet,
      key: wordsOf(bullet.text),
      text: reworded.get(wordsOf(bullet.text)) ?? bullet.text,
      requirements: terms
        .filter((entry) => findTermMatches(entry.terms, bullet.text).length > 0)
        .map((entry) => entry.text),
    }));
  }, [doc, confirmed, rewrites]);

  if (!application) return null;
  const appId = application.id;

  if (doc === undefined)
    return <p className="text-sm text-muted-foreground">Looking for your resume.</p>;
  if (!doc || bullets.length === 0) {
    return (
      <div className="max-w-[62ch] space-y-3">
        <h2 className="text-2xl font-semibold">Tailor your resume to this role</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {doc
            ? 'Your uploaded resume has no bullets we could read. Check it in the machine view first.'
            : 'Add your resume in the Resume Game: paste it, or upload a PDF or Word file. Then come back here to choose which bullets go into the copy for this role.'}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Button asChild className="min-h-11">
            <a href={`/resume-game/?application=${encodeURIComponent(appId)}`}>
              Open the Resume Game
            </a>
          </Button>
          {!doc && (
            <Button asChild variant="outline" className="min-h-11">
              <a href={`/resume-game/?start=blank&application=${encodeURIComponent(appId)}`}>
                No resume yet? Build one
              </a>
            </Button>
          )}
        </div>
      </div>
    );
  }

  const known = new Set(bullets.map((b) => b.id));
  const match = matchSelection(bullets, desk.desk.resumeSelection);
  const selected = new Set(match.ids);
  const matching = bullets.filter((b) => b.requirements.length > 0);

  const choose = (ids: string[] | null) => {
    const chosen = ids && new Set(ids);
    changeDesks((data) =>
      setResumeSelection(
        data,
        appId,
        ids,
        chosen ? bullets.filter((b) => chosen.has(b.id)).map((b) => b.key) : undefined
      )
    );
  };
  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    choose(bullets.filter((b) => next.has(b.id)).map((b) => b.id));
  };

  // Bullets written on the Bullets station. They join this copy only, and
  // are in it unless the visitor took one out.
  const written = desk.desk.bullets.bullets
    .map((slot, index) => ({
      index: index as 0 | 1,
      text: slot.text.trim(),
      after: slot.bulletId,
      included: slot.included,
    }))
    .filter((slot) => slot.text);
  // The last bullet of the most recent job. A resume with no job on it (only
  // school, say) has none: bullets written here then get an Experience
  // section of their own, instead of landing under Education.
  const jobAnchor = defaultPlacement(
    doc,
    bullets.map((b) => b.id)
  );
  const NEW_SECTION = '';
  const defaultAfter = jobAnchor ?? NEW_SECTION;
  const placeOf = (after: string | null) => (after && known.has(after) ? after : defaultAfter);
  const headingsAreCapitals = doc.sections.some((section) => {
    const heading = doc.lines.find((line) => line.id === section.headingLineId)?.text ?? '';
    return /[A-Z]/.test(heading) && heading === heading.toUpperCase();
  });
  const looseHeading = headingsAreCapitals ? 'EXPERIENCE' : 'Experience';
  const place = (index: 0 | 1, slot: { bulletId?: string; included?: boolean }) =>
    changeDesks((data) => updateBulletsFlow(data, appId, { bullet: { index, slot } }));
  const addedBullets = written
    .filter((slot) => slot.included)
    .map((slot) => ({ afterLineId: placeOf(slot.after), text: slot.text }));
  const shortAfterNarrowing = matching.length < 3;

  const download = async () => {
    // Another tab may have corrected the resume since this list was drawn.
    // Build the file only from the resume as it is saved now.
    const savedRewrites = readResumeRewrites();
    if (
      readResumeText() !== resumeText ||
      savedRewrites.length !== rewrites.length ||
      savedRewrites.some(
        (r, i) => r.original !== rewrites[i].original || r.improved !== rewrites[i].improved
      )
    ) {
      desk.refresh();
      setNotice(
        'Your resume changed in another tab, so nothing was downloaded. The list now shows the saved resume. Check it, then download again.'
      );
      return;
    }
    try {
      const { toDocx, checkExport } = await loadFeature(import('../../lib/resume-doc'));
      // Only the bullets the visitor can choose are filtered. A skills or
      // certifications list is made of list lines too, and it stays whole.
      const keep = new Set([...selected, ...listedLineIds(doc)]);
      const bytes = await toDocx(doc, {
        bulletLineIds: keep,
        addedBullets,
        rewrites,
        looseHeading,
      });
      const url = URL.createObjectURL(
        new Blob([bytes as BlobPart], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        })
      );
      const link = document.createElement('a');
      const slug = `${application.title} ${application.company}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      link.href = url;
      link.download = `resume-${slug || 'tailored'}.docx`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      const check = await checkExport(bytes);
      setNotice(
        check.ok
          ? 'Saved. We read the new file back and found nothing to fix in how it reads.'
          : 'Saved. Reading it back shows something to fix. Open the machine view in the Resume Game.'
      );
    } catch {
      setNotice('The file could not be written. Nothing was changed.');
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Tailor your resume to this role</h2>
        <p className="max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
          You have one resume. For this application, choose which of its bullets to include. A
          bullet marked with a requirement mentions something this posting asks for.
        </p>
        <p className="text-sm text-foreground" data-testid="resume-selection-count">
          {selected.size} of {bullets.length} bullets included
          {addedBullets.length > 0 ? `, plus ${addedBullets.length} written on this desk` : ''}.{' '}
          {matching.length} mention a confirmed requirement.
        </p>
        {match.reset && (
          <p className="rounded-lg bg-gold/12 px-3 py-2 text-sm text-foreground" role="status">
            None of the bullets you chose for this role are in your resume now, so every bullet is
            included again. Check the list before you download.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={matching.length === 0}
            aria-expanded={shortAfterNarrowing ? narrowing : undefined}
            onClick={() => {
              if (shortAfterNarrowing) setNarrowing(true);
              else choose(matching.map((b) => b.id));
            }}
          >
            Only the ones that match ({matching.length})
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setNarrowing(false);
              choose(null);
            }}
          >
            Include everything
          </Button>
        </div>
        {narrowing && (
          <div
            className="max-w-[68ch] space-y-2 rounded-lg bg-gold/12 px-3 py-2 text-sm text-foreground"
            role="status"
          >
            <p>
              That would leave {matching.length} {matching.length === 1 ? 'bullet' : 'bullets'} in
              the copy for this role. A resume that short can look empty, and a bullet that does not
              use the posting's words can still show the same work.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setNarrowing(false);
                  choose(matching.map((b) => b.id));
                }}
              >
                Keep only {matching.length === 1 ? 'that one' : `those ${matching.length}`}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setNarrowing(false)}>
                Keep what is included now
              </Button>
            </div>
          </div>
        )}
      </div>

      <ul className="space-y-2">
        {bullets.map((bullet) => {
          const on = selected.has(bullet.id);
          return (
            <li
              key={bullet.id}
              className={cn(
                'rounded-xl border p-3 transition-colors',
                on ? 'border-lichen/50 bg-lichen/6' : 'border-border/40'
              )}
            >
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(event) => toggle(bullet.id, event.target.checked)}
                  className="mt-1 h-4 w-4 accent-[hsl(var(--lichen))]"
                />
                <span className="min-w-0 space-y-1">
                  <span
                    className={cn('block text-sm leading-relaxed', !on && 'text-muted-foreground')}
                  >
                    {bullet.text}
                  </span>
                  {bullet.requirements.slice(0, 2).map((requirement) => (
                    <span key={requirement} className="block text-xs text-lichen">
                      Answers: {requirement}
                    </span>
                  ))}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {written.length > 0 && (
        <section aria-labelledby="desk-written-heading" className="space-y-2">
          <h3 id="desk-written-heading" className="text-lg font-semibold">
            Written on this desk
          </h3>
          <p className="max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
            {written.every((slot) => slot.included)
              ? `${written.length === 1 ? 'This bullet is' : 'Both are'} in the copy for this role, ${jobAnchor ? 'after the last bullet of your most recent job' : 'under an Experience heading of their own, because this resume lists no job yet'}. Untick one to leave it out, or choose where it goes.`
              : 'A ticked bullet is in the copy for this role. Tick one to put it back.'}{' '}
            To keep one for every application, add it to your resume in the Resume Game.
          </p>
          <ul className="space-y-2">
            {written.map((slot) => {
              const on = slot.included;
              const after = placeOf(slot.after);
              return (
                <li
                  key={slot.index}
                  className={cn(
                    'space-y-2 rounded-xl border transition-colors',
                    on ? 'border-lichen/50 bg-lichen/6' : 'border-border/40'
                  )}
                >
                  <label className="flex min-h-12 cursor-pointer items-start gap-3 p-3">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(event) => place(slot.index, { included: event.target.checked })}
                      className="mt-0.5 h-6 w-6 shrink-0 accent-[hsl(var(--lichen))]"
                    />
                    <span
                      className={cn(
                        'min-w-0 text-sm leading-relaxed',
                        !on && 'text-muted-foreground'
                      )}
                    >
                      {slot.text}
                      <span className="sr-only">
                        {on ? ' (in the copy for this role)' : ' (left out)'}
                      </span>
                    </span>
                  </label>
                  {on && (
                    <label className="flex flex-wrap items-center gap-2 px-3 pb-3 text-xs text-muted-foreground sm:pl-12">
                      <span>
                        Place it after
                        <span className="sr-only"> (for: {slot.text.slice(0, 60)})</span>
                      </span>
                      <select
                        value={after}
                        onChange={(event) => place(slot.index, { bulletId: event.target.value })}
                        className="h-10 max-w-full min-w-0 flex-1 rounded-md border border-border/50 bg-transparent px-1.5 text-sm text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {!jobAnchor && (
                          <option value={NEW_SECTION}>A new Experience section</option>
                        )}
                        {bullets.map((bullet) => (
                          <option key={bullet.id} value={bullet.id}>
                            {bullet.text.length > 70
                              ? `${bullet.text.slice(0, 67).trimEnd()}...`
                              : bullet.text}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="space-y-2 border-t border-border/40 pt-5">
        <Button
          type="button"
          onClick={download}
          disabled={selected.size === 0 && addedBullets.length === 0}
          className="h-auto min-h-9 max-w-full whitespace-normal py-2 text-left"
        >
          Download the resume for this role (.docx)
        </Button>
        <p role="status" className="min-h-5 text-sm text-foreground">
          {notice}
        </p>
      </div>
    </div>
  );
}
