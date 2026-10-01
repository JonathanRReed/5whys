import * as React from 'react';
import type { BulletRecord } from '../../lib/resume-game';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';

type Props = {
  bullets: BulletRecord[];
  onApply: (lines: string[]) => void;
};

export default function ReviewLines({ bullets, onApply }: Props) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const lines = draft
    .split('\n')
    .map((line) => line.replace(/^\s*[-•*◦○●▪–—]\s*/, '').trim())
    .filter(Boolean);

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setDraft(bullets.map((bullet) => bullet.original).join('\n'));
          setOpen(true);
        }}
      >
        Review detected lines
      </Button>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border/40 bg-card/65 p-6">
      <div className="space-y-2">
        <Label htmlFor="review-achievement-lines">Achievement lines to review</Label>
        <p id="review-lines-help" className="text-sm text-muted-foreground">
          Keep one complete achievement per line. Join wrapped text, remove headings, or add
          a line the scanner missed. Your pasted resume stays unchanged. Applying replaces
          the current bullet edits, so export those first if you want to keep them.
        </p>
        <Textarea
          id="review-achievement-lines"
          aria-describedby="review-lines-help"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={8}
          className="text-base"
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          disabled={lines.length === 0}
          onClick={() => {
            onApply(lines);
            setOpen(false);
          }}
        >
          Apply reviewed lines
        </Button>
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
          Cancel line review
        </Button>
      </div>
    </section>
  );
}
