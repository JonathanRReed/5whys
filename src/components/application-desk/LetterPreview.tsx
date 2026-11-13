import * as React from 'react';
import type { LetterDraft } from '../../lib/application-desk';
import { findPlaceholders, fullLetter } from '../../lib/desk-checks';
import { loadFeature, reportFeatureFailure } from '../../lib/lazy-feature';
import { Button } from '../ui/button';

/** A file name from the role and company: "letter-marketing-intern-northwind.docx". */
export function letterFileName(title: string, company: string): string {
  const slug = `${title} ${company}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `letter-${slug || 'application'}.docx`;
}

/**
 * The whole letter as it would be sent, greeting to sign-off, read only.
 * Copy and Word download sit under it, so what is copied is what is shown.
 */
export default function LetterPreview({
  letter,
  title,
  company,
  headingId,
}: {
  letter: LetterDraft;
  title: string;
  company: string;
  headingId: string;
}) {
  const text = fullLetter(letter);
  const [copiedText, setCopiedText] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState('');
  const copied = Boolean(text) && copiedText === text;
  const left = text ? findPlaceholders(text) : [];

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <h3 id={headingId} className="text-lg font-semibold">
        The whole letter
      </h3>
      {text ? (
        <div
          className="space-y-3 rounded-xl border border-border/40 p-4 text-sm leading-relaxed text-foreground"
          data-testid="letter-preview"
        >
          {text.split(/\n{2,}/).map((paragraph, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: paragraphs of one letter, in order
            <p key={index} className="whitespace-pre-line break-words">
              {paragraph}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nothing written yet. The letter appears here as you write its four parts.
        </p>
      )}
      {left.length > 0 && (
        <p className="text-sm text-foreground">
          Still to replace before it goes: {left.slice(0, 3).join(', ')}.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          disabled={!text}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopiedText(text);
            } catch {
              setCopiedText(null);
            }
          }}
        >
          {copied ? 'Letter copied' : 'Copy the letter'}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!text}
          onClick={async () => {
            try {
              const { downloadLetter } = await loadFeature(import('../../lib/letter-docx'));
              await downloadLetter(text, letterFileName(title, company));
              setNotice('Saved as a Word file. Check your downloads.');
            } catch (cause) {
              reportFeatureFailure(cause);
              setNotice('The file could not be written.');
            }
          }}
        >
          Download as .docx
        </Button>
      </div>
      <p role="status" className="min-h-5 text-sm text-muted-foreground">
        {notice}
      </p>
    </section>
  );
}
