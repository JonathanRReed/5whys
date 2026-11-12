import * as React from 'react';
import { setResumeSelection } from '../../lib/application-desk';
import {
  extractRequirementTerms,
  findTermMatches,
  requirementsFromBullets,
} from '../../lib/posting';
import type { ResumeDoc, ResumeLine } from '../../lib/resume-doc';
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
      text: [line, ...(tails.get(line.id) ?? [])].map((part) => part.text.trim()).join(' '),
    }));
}

/**
 * One master resume, tailored per application: choose which of its bullets
 * go into the copy for this role. Nothing here edits the resume itself; the
 * selection is all an application keeps.
 */
export default function ResumeStation({ desk }: { desk: DeskState }) {
  const { application, role, changeDesks } = desk;
  const [doc, setDoc] = React.useState<ResumeDoc | null | undefined>(undefined);
  const [notice, setNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void import('../../lib/local-db').then(async ({ getResumeDoc }) => {
      const saved = await getResumeDoc<ResumeDoc>();
      if (!cancelled) setDoc(saved?.doc ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const confirmed = React.useMemo(
    () => requirementsFromBullets(role?.bullets ?? []).filter((r) => r.status === 'confirmed'),
    [role?.bullets]
  );
  const bullets: Bullet[] = React.useMemo(() => {
    if (!doc) return [];
    const terms = confirmed.map((r) => ({ text: r.text, terms: extractRequirementTerms(r.text) }));
    return bulletsOf(doc).map((bullet) => ({
      ...bullet,
      requirements: terms
        .filter((entry) => findTermMatches(entry.terms, bullet.text).length > 0)
        .map((entry) => entry.text),
    }));
  }, [doc, confirmed]);

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
            : 'Upload your resume as a PDF or Word file in the Resume Game. Then come back here to choose which bullets go into the copy for this role.'}
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

  const download = async () => {
    try {
      const { toDocx, checkExport } = await import('../../lib/resume-doc');
      const bytes = await toDocx(doc, { bulletLineIds: selected });
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

      <div className="space-y-2 border-t border-border/40 pt-5">
        <Button type="button" onClick={download} disabled={selected.size === 0}>
          Download the resume for this role (.docx)
        </Button>
        <p role="status" className="min-h-5 text-sm text-foreground">
          {notice}
        </p>
      </div>
    </div>
  );
}
