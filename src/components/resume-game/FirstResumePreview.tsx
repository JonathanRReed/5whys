import type * as React from 'react';
import { type ResumeDraft, resumeOutline } from '../../lib/resume-game/first-resume';
import ResumeFileActions from './ResumeFile';

/**
 * The resume as it is being built: the same parts, in the same order, as the
 * text that will go into the Resume Game. Plain on purpose, like the page a
 * hiring manager will see.
 */
export default function FirstResumePreview({ draft, text }: { draft: ResumeDraft; text: string }) {
  const outline = resumeOutline(draft);
  const empty = !text.trim();
  return (
    <aside
      aria-labelledby="first-resume-preview-title"
      className="min-w-0 space-y-4 lg:sticky lg:top-24 lg:self-start"
    >
      <h3 id="first-resume-preview-title" className="text-lg font-semibold">
        Your resume so far
      </h3>
      <div
        data-testid="first-resume-preview"
        className="min-h-48 space-y-4 break-words rounded-2xl border border-border/40 bg-overlay/15 p-5 text-sm leading-relaxed"
      >
        {empty ? (
          <p className="text-muted-foreground">It appears here as you type.</p>
        ) : (
          <>
            {(outline.name || outline.contact) && (
              <div className="space-y-1">
                {outline.name && <p className="text-lg font-semibold">{outline.name}</p>}
                {outline.contact && <p className="text-muted-foreground">{outline.contact}</p>}
              </div>
            )}
            {outline.education && (
              <PreviewSection title="Education">
                <p>{outline.education}</p>
              </PreviewSection>
            )}
            {outline.experiences.length > 0 && (
              <PreviewSection title="Experience">
                {outline.experiences.map((experience, index) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: experiences have fixed positions
                  <div key={index} className="space-y-1">
                    {experience.heading && <p className="font-medium">{experience.heading}</p>}
                    {experience.bullets.length > 0 && (
                      <ul className="list-disc space-y-1 pl-5">
                        {experience.bullets.map((bullet, bulletIndex) => (
                          // biome-ignore lint/suspicious/noArrayIndexKey: bullets can repeat
                          <li key={bulletIndex}>{bullet}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </PreviewSection>
            )}
            {outline.skills && (
              <PreviewSection title="Skills">
                <p>{outline.skills}</p>
              </PreviewSection>
            )}
          </>
        )}
      </div>
      <ResumeFileActions text={text} headingLevel="h3" heading="Save a copy now">
        <p className="text-sm leading-relaxed text-muted-foreground">
          A Word file or a PDF of what is above, made on this device. You can also save it after the
          Resume Game scores it.
        </p>
      </ResumeFileActions>
    </aside>
  );
}

function PreviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="border-b border-border/40 pb-1 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {title}
      </h4>
      {children}
    </section>
  );
}
