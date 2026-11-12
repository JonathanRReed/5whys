import * as React from 'react';
import { setResumeSelection, updateBulletsFlow } from '../../lib/application-desk';
import { readResumeRewrites } from '../../lib/career-bridge';
import { loadFeature, reportFeatureFailure } from '../../lib/lazy-feature';
import {
  extractRequirementTerms,
  findTermMatches,
  requirementsFromBullets,
} from '../../lib/posting';
import type { ResumeDoc, ResumeLine } from '../../lib/resume-doc';
import { joinParts } from '../../lib/resume-doc/layout';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import type { DeskState } from './useDesk';

/** A bullet with the rest of its wrapped lines joined on. */
type Bullet = { id: string; text: string; requirements: string[] };

function bulletsOf(doc: ResumeDoc): { id: string; text: string }[] {
  const byId = new Map(doc.lines.map((line) => [line.id, line]));
  const tails = new Map<string, ResumeLine[]>();
  for (const line of doc.lines) {
    if (!line.continuationOf) continue;
    tails.set(line.continuationOf, [...(tails.get(line.continuationOf) ?? []), line]);
  }
  return doc.extractionOrder
    .map((id) => byId.get(id))
    .filter((line): line is ResumeLine => Boolean(line?.bullet && !line.continuationOf))
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
 * Whether a saved document is the resume in the text: most of its bullets
 * still appear there. Edits to a few lines keep the document; a different
 * resume does not.
 */
export function sameResume(doc: ResumeDoc, resumeText: string): boolean {
  const text = resumeText.replace(/\s+/g, ' ').toLowerCase();
  const bullets = bulletsOf(doc)
    .map((bullet) => wordsOf(bullet.text).slice(0, 40))
    .filter((start) => start.length >= 12);
  if (bullets.length === 0) return true;
  const found = bullets.filter((start) => text.includes(start)).length;
  return found * 2 >= bullets.length;
}

/**
 * One master resume, tailored per application: choose which of its bullets
 * go into the copy for this role. Nothing here edits the resume itself; the
 * selection is all an application keeps.
 */
export default function ResumeStation({ desk }: { desk: DeskState }) {
  const { application, role, resumeText, changeDesks } = desk;
  const [doc, setDoc] = React.useState<ResumeDoc | null | undefined>(undefined);
  const [notice, setNotice] = React.useState<string | null>(null);
  // Lines rewritten in the Resume Game replace their originals in this copy.
  const [rewrites, setRewrites] = React.useState<{ original: string; improved: string }[]>([]);
  React.useEffect(() => setRewrites(readResumeRewrites()), []);

  React.useEffect(() => {
    let cancelled = false;
    void loadFeature(import('../../lib/local-db'))
      .then(async ({ getResumeDoc }) => {
        const saved = await getResumeDoc<ResumeDoc>();
        if (cancelled) return;
        // An uploaded file is kept until it is replaced. If the visitor has
        // since pasted a different resume, the pasted one is the resume.
        if (saved && (!resumeText.trim() || sameResume(saved.doc, resumeText))) {
          setDoc(saved.doc);
          return;
        }
        // No uploaded file: a resume pasted into the Resume Game still counts.
        if (resumeText.trim()) {
          const { fromText } = await loadFeature(import('../../lib/resume-doc'));
          if (!cancelled) setDoc(fromText(resumeText));
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

  const confirmed = React.useMemo(
    () => requirementsFromBullets(role?.bullets ?? []).filter((r) => r.status === 'confirmed'),
    [role?.bullets]
  );
  const bullets: Bullet[] = React.useMemo(() => {
    if (!doc) return [];
    const terms = confirmed.map((r) => ({ text: r.text, terms: extractRequirementTerms(r.text) }));
    const reworded = new Map(rewrites.map((r) => [wordsOf(r.original), r.improved.trim()]));
    return bulletsOf(doc).map((bullet) => ({
      ...bullet,
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
        <Button asChild>
          <a href={`/resume-game/?application=${encodeURIComponent(appId)}`}>
            Open the Resume Game
          </a>
        </Button>
      </div>
    );
  }

  const saved = desk.desk.resumeSelection?.bulletIds ?? null;
  const known = new Set(bullets.map((b) => b.id));
  const selected = new Set(saved ? saved.filter((id) => known.has(id)) : bullets.map((b) => b.id));
  const matching = bullets.filter((b) => b.requirements.length > 0);

  const choose = (ids: string[] | null) =>
    changeDesks((data) => setResumeSelection(data, appId, ids));
  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    choose(bullets.filter((b) => next.has(b.id)).map((b) => b.id));
  };

  // Bullets written on the Bullets station. They join this copy only.
  const written = desk.desk.bullets.bullets
    .map((slot, index) => ({ index: index as 0 | 1, text: slot.text.trim(), after: slot.bulletId }))
    .filter((slot) => slot.text);
  const defaultAfter = (bullets.find((b) => selected.has(b.id)) ?? bullets[0]).id;
  const place = (index: 0 | 1, after: string | null) =>
    changeDesks((data) =>
      updateBulletsFlow(data, appId, { bullet: { index, slot: { bulletId: after ?? '' } } })
    );
  const addedBullets = written
    .filter((slot) => slot.after !== null)
    .map((slot) => ({
      afterLineId: slot.after && known.has(slot.after) ? slot.after : defaultAfter,
      text: slot.text,
    }));

  const download = async () => {
    try {
      const { toDocx, checkExport } = await loadFeature(import('../../lib/resume-doc'));
      const bytes = await toDocx(doc, { bulletLineIds: selected, addedBullets, rewrites });
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
          {selected.size} of {bullets.length} bullets included. {matching.length} mention a
          confirmed requirement.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={matching.length === 0}
            onClick={() => choose(matching.map((b) => b.id))}
          >
            Only the ones that match
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => choose(null)}>
            Include everything
          </Button>
        </div>
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
            These go into the copy for this role only. To keep one for every application, add it to
            your resume in the Resume Game.
          </p>
          <ul className="space-y-2">
            {written.map((slot) => {
              const on = slot.after !== null;
              const after = slot.after && known.has(slot.after) ? slot.after : defaultAfter;
              return (
                <li
                  key={slot.index}
                  className={cn(
                    'space-y-2 rounded-xl border p-3 transition-colors',
                    on ? 'border-lichen/50 bg-lichen/6' : 'border-border/40'
                  )}
                >
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(event) => place(slot.index, event.target.checked ? after : null)}
                      className="mt-1 h-4 w-4 accent-[hsl(var(--lichen))]"
                    />
                    <span
                      className={cn(
                        'min-w-0 text-sm leading-relaxed',
                        !on && 'text-muted-foreground'
                      )}
                    >
                      {slot.text}
                    </span>
                  </label>
                  {on && (
                    <label className="flex flex-wrap items-center gap-2 pl-7 text-xs text-muted-foreground">
                      <span>
                        Place it after
                        <span className="sr-only"> (for: {slot.text.slice(0, 60)})</span>
                      </span>
                      <select
                        value={after}
                        onChange={(event) => place(slot.index, event.target.value)}
                        className="h-9 max-w-full min-w-0 flex-1 rounded-md border border-border/50 bg-transparent px-1.5 text-sm text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                      >
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
