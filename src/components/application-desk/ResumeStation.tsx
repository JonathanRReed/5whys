import * as React from 'react';
import { setResumeSelection, updateBulletsFlow } from '../../lib/application-desk';
import { readResumeRewrites, readResumeText } from '../../lib/career-bridge';
import { deskRequirements } from '../../lib/desk-checks';
import { loadFeature, reportFeatureFailure } from '../../lib/lazy-feature';
import { extractRequirementTerms, findTermMatches } from '../../lib/posting';
import type { ResumeDoc, ResumeLine } from '../../lib/resume-doc';
import { listedLineIds } from '../../lib/resume-doc/editor-text';
import { copyLines, rewrittenLines, toPrintModel } from '../../lib/resume-doc/export';
import { joinParts } from '../../lib/resume-doc/layout';
import {
  addedBulletsFor,
  type Placement,
  placeableRewrites,
  placeBullet,
  repeatedLines,
  resumeRoles,
  roleOf,
  withAchievementLines,
  wordsOf,
} from '../../lib/resume-doc/tailor';
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

export { withAchievementLines };

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

/** The bullet ids a saved choice covers now. See `matchSelection`. */
export function selectedIds(
  bullets: readonly { id: string; key: string }[],
  saved: { bulletIds: string[]; bulletTexts?: string[] } | null
): string[] {
  return matchSelection(bullets, saved).ids;
}

/** A line shortened for a list or a menu, at a word. */
function short(text: string, max = 70): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 3);
  const space = cut.lastIndexOf(' ');
  return `${(space > max / 2 ? cut.slice(0, space) : cut).trimEnd()}...`;
}

/** "one", "two", or the number: for counts in a sentence. */
function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** A bullet written on the Bullets station, as this station shows it. */
type WrittenBullet = {
  index: 0 | 1;
  text: string;
  saved: string | null;
  included: boolean;
  placement: Placement;
  requirements: string[];
};

/**
 * One master resume, tailored per application: choose which of its bullets
 * go into the copy for this role. Nothing here edits the resume itself; the
 * selection is all an application keeps.
 *
 * Everything this station says about the copy (which wording a line has,
 * which job a written bullet is under, what repeats, what is left out) is
 * read from the same model the file is written from, so the page and the
 * file cannot disagree.
 */
export default function ResumeStation({ desk }: { desk: DeskState }) {
  // The resume and its rewrites are read again when another tab saves them
  // and when this tab comes back into view (see useDesk). Lines rewritten in
  // the Resume Game replace their originals in this copy.
  const { application, role, resumeText, rewrites, changeDesks } = desk;
  const [doc, setDoc] = React.useState<ResumeDoc | null | undefined>(undefined);
  const [notice, setNotice] = React.useState<string | null>(null);
  // "Only the ones that match": what it would leave is shown before it is done.
  const [narrowing, setNarrowing] = React.useState(false);
  // The copy line by line is drawn only while the visitor reads it.
  const [reading, setReading] = React.useState(false);

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
  const answers = React.useMemo(() => {
    const terms = confirmed.map((r) => ({ text: r.text, terms: extractRequirementTerms(r.text) }));
    return (text: string) =>
      terms
        .filter((entry) => findTermMatches(entry.terms, text).length > 0)
        .map((entry) => entry.text);
  }, [confirmed]);

  // The resume as the file has it: its jobs, and the wording of each line.
  const copy = React.useMemo(() => {
    if (!doc) return null;
    const placeable = placeableRewrites(doc, rewrites);
    const order = new Map(copyLines(doc).map((line, index) => [line.id, index]));
    return {
      roles: resumeRoles(doc),
      rewrites: placeable.rewrites,
      unplacedRewrites: placeable.unplaced,
      wording: rewrittenLines(doc, placeable.rewrites),
      order,
    };
  }, [doc, rewrites]);

  const bullets: Bullet[] = React.useMemo(() => {
    if (!doc || !copy) return [];
    return bulletsOf(doc)
      .map((bullet) => {
        // The line as the copy will have it: the Resume Game wording when the
        // visitor rewrote this line (this one, not another with the same words).
        const text = copy.wording.get(bullet.id) ?? bullet.text;
        return {
          ...bullet,
          key: wordsOf(bullet.text),
          text,
          // What the posting asks for is matched on the line as it will be sent.
          requirements: answers(text),
        };
      })
      .sort(
        (a, b) =>
          (copy.order.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
          (copy.order.get(b.id) ?? Number.MAX_SAFE_INTEGER)
      );
  }, [doc, copy, answers]);

  if (!application) return null;
  const appId = application.id;

  if (doc === undefined)
    return <p className="text-sm text-muted-foreground">Looking for your resume.</p>;
  if (!doc || !copy || bullets.length === 0) {
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

  const { roles } = copy;
  const match = matchSelection(bullets, desk.desk.resumeSelection);
  const selected = new Set(match.ids);
  const matching = bullets.filter((b) => b.requirements.length > 0);
  const byId = new Map(bullets.map((b) => [b.id, b]));

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
  // are in it unless the visitor took one out. Each goes under the job the
  // visitor chose, or the one it names; never under a job by default.
  const written: WrittenBullet[] = desk.desk.bullets.bullets
    .map((slot, index) => {
      const text = slot.text.trim();
      return {
        index: index as 0 | 1,
        text,
        saved: slot.bulletId,
        included: slot.included,
        placement: placeBullet(text, slot.bulletId, roles),
        requirements: answers(text),
      };
    })
    .filter((slot) => slot.text);
  const headingsAreCapitals = doc.sections.some((section) => {
    const heading = doc.lines.find((line) => line.id === section.headingLineId)?.text ?? '';
    return /[A-Z]/.test(heading) && heading === heading.toUpperCase();
  });
  const looseHeading = headingsAreCapitals ? 'EXPERIENCE' : 'Experience';
  const place = (index: 0 | 1, slot: { bulletId?: string; included?: boolean }) =>
    changeDesks((data) => updateBulletsFlow(data, appId, { bullet: { index, slot } }));
  const included = written.filter((slot) => slot.included);
  const placed = included.filter((slot) => slot.placement.kind !== 'unplaced');
  const addedBullets = addedBulletsFor(placed);
  // The exporter numbers added bullets `added-<n>` in this order.
  const slotOfAdded = new Map(placed.map((slot, n) => [`added-${n}`, slot]));
  // Only the bullets the visitor can choose are filtered. A skills or
  // certifications list is made of list lines too, and it stays whole.
  const keep = new Set([...selected, ...listedLineIds(doc)]);
  const options = { bulletLineIds: keep, addedBullets, rewrites: copy.rewrites, looseHeading };
  const model = toPrintModel(doc, options);
  const repeats = repeatedLines(model.paragraphs);
  const repeatOf = new Map(
    repeats.flatMap((repeat) => {
      const slot = slotOfAdded.get(repeat.addedId);
      return slot ? [[slot.index, repeat] as const] : [];
    })
  );
  /** Where a line of the copy is, in the visitor's words. */
  const whereIs = (id: string): string => {
    const added = slotOfAdded.get(id);
    if (added) return `bullet ${added.index + 1} written on this desk`;
    const found = roleOf(roles, id);
    return found ? `a line under ${found.label}` : 'a line in your resume';
  };
  const leftOut = bullets.filter((b) => !selected.has(b.id));
  const reworded = bullets.filter((b) => selected.has(b.id) && copy.wording.has(b.id));
  const kept = bullets.filter((b) => selected.has(b.id));
  const emptiedRoles = (ids: ReadonlySet<string>) =>
    roles.filter(
      (r) => r.bulletIds.length > 0 && r.bulletIds.every((id) => !ids.has(id) && byId.has(id))
    );
  const fewMatch = matching.length < 3;

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
      const bytes = await toDocx(doc, options);
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
      const name = `resume-${slug || 'tailored'}.docx`;
      link.href = url;
      link.download = name;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      const check = await checkExport(bytes);
      // Reading the file back checks how it parses, not what it says. Only
      // the visitor can tell that every line is true and in its place.
      setNotice(
        check.ok
          ? `Saved ${name}. Open it and read it once before you send it.`
          : `Saved ${name}. Reading it back shows something to fix in how it reads: open the machine view in the Resume Game. Read the file once before you send it.`
      );
    } catch {
      setNotice('The file could not be written. Nothing was changed.');
    }
  };

  // The list, grouped under the job each line is in, in the order of the copy.
  const groups: { label: string; items: Bullet[] }[] = [];
  for (const bullet of bullets) {
    const label = roleOf(roles, bullet.id)?.label ?? '';
    const last = groups.at(-1);
    if (last && last.label === label) last.items.push(bullet);
    else groups.push({ label, items: [bullet] });
  }

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
        {fewMatch && (
          <p className="max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
            {matching.length === 0
              ? 'None of your lines names something this posting asks for yet.'
              : `Only ${plural(matching.length, 'line names', 'lines name')} something this posting asks for.`}{' '}
            Keep everything, and use the Bullets station to write two that do.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {!fewMatch && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-expanded={narrowing}
              aria-controls="resume-narrowing"
              onClick={() => setNarrowing(true)}
            >
              Only the ones that match ({matching.length})
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={leftOut.length === 0}
            onClick={() => {
              setNarrowing(false);
              choose(null);
            }}
          >
            Include everything
          </Button>
        </div>
        {narrowing && !fewMatch && (
          <div
            id="resume-narrowing"
            className="max-w-[68ch] space-y-2 rounded-lg bg-gold/12 px-3 py-2 text-sm text-foreground"
            role="status"
          >
            <p>
              That keeps {plural(matching.length, 'bullet', 'bullets')} from your resume and leaves
              out {plural(bullets.length - matching.length, 'bullet', 'bullets')}. These would stay:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              {matching.map((b) => (
                <li key={b.id}>{short(b.text, 90)}</li>
              ))}
            </ul>
            {emptiedRoles(new Set(matching.map((b) => b.id))).map((r) => (
              <p key={r.id}>{r.label} would have no bullets under it.</p>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setNarrowing(false);
                  choose(matching.map((b) => b.id));
                }}
              >
                Keep only these {matching.length}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setNarrowing(false)}>
                Keep what is included now
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {groups.map((group) => (
          <section key={`${group.label}-${group.items[0].id}`} className="space-y-2">
            {group.label && (
              <h3 className="text-sm font-semibold text-foreground">{group.label}</h3>
            )}
            <ul className="space-y-2">
              {group.items.map((bullet) => {
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
                          className={cn(
                            'block text-sm leading-relaxed',
                            !on && 'text-muted-foreground'
                          )}
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
          </section>
        ))}
      </div>

      {written.length > 0 && (
        <section aria-labelledby="desk-written-heading" className="space-y-2">
          <h3 id="desk-written-heading" className="text-lg font-semibold">
            Written on this desk
          </h3>
          <p className="max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
            A ticked bullet goes into the copy for this role, under the part of your resume you
            choose. To keep one for every application, add it to your resume in the Resume Game.
          </p>
          <ul className="space-y-2">
            {written.map((slot) => {
              const on = slot.included;
              const where = slot.placement;
              const repeat = repeatOf.get(slot.index);
              const selectId = `desk-bullet-place-${slot.index}`;
              const selectValue =
                where.kind === 'unplaced' || where.kind === 'new-section' ? '' : where.role.id;
              const anchor =
                where.kind === 'chosen' && where.afterLineId !== where.role.lastLineId
                  ? byId.get(where.afterLineId)
                  : undefined;
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
                    <span className="min-w-0 space-y-1">
                      <span
                        className={cn(
                          'block text-sm leading-relaxed',
                          !on && 'text-muted-foreground'
                        )}
                      >
                        {slot.text}
                        <span className="sr-only">
                          {on ? ' (in the copy for this role)' : ' (left out)'}
                        </span>
                      </span>
                      {slot.requirements.slice(0, 2).map((requirement) => (
                        <span key={requirement} className="block text-xs text-lichen">
                          Answers: {requirement}
                        </span>
                      ))}
                    </span>
                  </label>
                  {on && (
                    <div className="space-y-2 px-3 pb-3 sm:pl-12">
                      {roles.length > 0 ? (
                        <div className="space-y-1">
                          <label htmlFor={selectId} className="block text-sm text-muted-foreground">
                            Which part of your resume is this from?
                            <span className="sr-only"> (for: {short(slot.text, 60)})</span>
                          </label>
                          <select
                            id={selectId}
                            value={selectValue}
                            onChange={(event) =>
                              event.target.value &&
                              place(slot.index, { bulletId: event.target.value })
                            }
                            className="h-auto min-h-10 w-full max-w-full min-w-0 rounded-md border border-border/50 bg-transparent px-1.5 py-1 text-sm text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {selectValue === '' && <option value="">Choose a place</option>}
                            {roles.map((r) => (
                              <option key={r.id} value={r.id}>
                                {short(r.label)}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : null}
                      <p
                        className={cn(
                          'text-xs leading-relaxed',
                          where.kind === 'unplaced'
                            ? 'rounded-md bg-gold/12 px-2 py-1 text-foreground'
                            : 'text-muted-foreground'
                        )}
                        data-testid={`desk-bullet-place-note-${slot.index}`}
                      >
                        {where.kind === 'unplaced'
                          ? 'Not in the file until you choose where it goes.'
                          : where.kind === 'new-section'
                            ? `Your resume lists no job yet, so it goes under a heading of its own, "${looseHeading}", at the end.`
                            : where.kind === 'guessed'
                              ? `Under ${where.role.label}, because it names ${where.words.join(' ')}. Change it if it belongs somewhere else.`
                              : where.kind === 'only'
                                ? `Under ${where.role.label}, the one job on your resume.`
                                : anchor
                                  ? selected.has(anchor.id)
                                    ? `Under ${where.role.label}, right after "${short(anchor.text, 60)}".`
                                    : `Under ${where.role.label}, in place of "${short(anchor.text, 60)}".`
                                  : `Under ${where.role.label}, after its last line.`}
                      </p>
                      {repeat && (
                        <div
                          className="space-y-2 rounded-md bg-gold/12 px-2 py-2 text-sm text-foreground"
                          data-testid={`desk-bullet-repeat-${slot.index}`}
                        >
                          <p>
                            This says much the same as {whereIs(repeat.otherId)}: "
                            {short(repeat.otherText, 110)}". If both describe the same work, keep
                            one.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {byId.has(repeat.otherId) && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  place(slot.index, { bulletId: repeat.otherId });
                                  toggle(repeat.otherId, false);
                                }}
                              >
                                Use this one in its place
                              </Button>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => place(slot.index, { included: false })}
                            >
                              Leave this one out
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section
        aria-labelledby="resume-copy-heading"
        className="space-y-3 border-t border-border/40 pt-5"
        data-testid="resume-copy-summary"
      >
        <h3 id="resume-copy-heading" className="text-lg font-semibold">
          What the file holds
        </h3>
        <ul className="max-w-[68ch] list-disc space-y-1 pl-5 text-sm leading-relaxed">
          <li>
            {kept.length} of {plural(bullets.length, 'bullet', 'bullets')} from your resume
            {reworded.length > 0
              ? `, ${reworded.length === kept.length ? (kept.length === 1 ? 'in' : 'all in') : `${reworded.length} of them in`} the wording you wrote in the Resume Game`
              : ''}
            .
          </li>
          {placed.map((slot) => (
            <li key={`placed-${slot.index}`}>
              Bullet {slot.index + 1} written on this desk,{' '}
              {slot.placement.kind === 'new-section'
                ? `under a new "${looseHeading}" heading at the end`
                : `under ${slot.placement.kind === 'unplaced' ? '' : slot.placement.role.label}`}
              .
            </li>
          ))}
          {included
            .filter((slot) => slot.placement.kind === 'unplaced')
            .map((slot) => (
              <li key={`unplaced-${slot.index}`} className="text-foreground">
                Not in it: bullet {slot.index + 1} written on this desk, until you choose where it
                goes.
              </li>
            ))}
          {written
            .filter((slot) => !slot.included)
            .map((slot) => (
              <li key={`out-${slot.index}`}>
                Not in it: bullet {slot.index + 1} written on this desk, which you left out.
              </li>
            ))}
          {leftOut.length > 0 && (
            <li>
              Not in it, from your resume:
              <ul className="list-[circle] pl-5">
                {leftOut.map((b) => (
                  <li key={b.id}>{short(b.text, 90)}</li>
                ))}
              </ul>
            </li>
          )}
          {copy.unplacedRewrites.map((rewrite) => (
            <li key={`${rewrite.original}-${rewrite.improved}`}>
              "{short(rewrite.original, 60)}" is in it as first written. That line appears more than
              once in your resume, and your Resume Game wording does not say which one it replaces.
            </li>
          ))}
          {repeats.length > 0 && (
            <li className="text-foreground">
              {repeats.length === 1
                ? 'One bullet written on this desk says much the same as another line in the file.'
                : `${repeats.length} bullets written on this desk say much the same as another line in the file.`}{' '}
              The note under each one above says which.
            </li>
          )}
          <li>The rest of your resume (name, contact, education, skills) is in it as written.</li>
        </ul>
        <details
          className="max-w-[68ch] rounded-lg border border-border/40 px-3 py-2"
          onToggle={(event) => setReading(event.currentTarget.open)}
        >
          <summary className="cursor-pointer text-sm font-medium text-foreground">
            Read the file line by line
          </summary>
          {reading && (
            <div
              className="mt-3 space-y-1 text-sm leading-relaxed"
              data-testid="resume-copy-preview"
            >
              {model.paragraphs.map((paragraph) => (
                <p
                  key={paragraph.lineId}
                  className={cn(
                    paragraph.kind === 'heading' && 'pt-2 font-semibold uppercase tracking-wide',
                    (paragraph.kind === 'name' || paragraph.kind === 'title') && 'font-semibold',
                    paragraph.kind === 'bullet' && 'pl-4 -indent-3',
                    slotOfAdded.has(paragraph.lineId) && 'text-lichen'
                  )}
                >
                  {paragraph.kind === 'bullet' ? `• ${paragraph.text}` : paragraph.text}
                  {slotOfAdded.has(paragraph.lineId) && (
                    <span className="text-xs text-muted-foreground"> (written on this desk)</span>
                  )}
                </p>
              ))}
            </div>
          )}
        </details>
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
      </section>
    </div>
  );
}
