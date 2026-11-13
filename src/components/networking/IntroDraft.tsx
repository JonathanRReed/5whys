import * as React from 'react';
import { describeShape, draftShape } from '../../lib/networking-advice';
import type { ReflectionForReuse } from '../career-5whys/outcome';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { useClipboard } from './useClipboard';

const DRAFT_MAX_LENGTH = 1500;
const WORDS_PER_MINUTE = 140;

type Props = {
  draft: string;
  onDraftChange: (value: string) => void;
  /** A written message: count sentences and questions, not seconds aloud. */
  written?: boolean;
  /** A finished Five Whys reflection the visitor can add to the draft. */
  reflection?: ReflectionForReuse | null;
};

function countWords(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function estimateSpokenSeconds(words: number) {
  if (words === 0) return 0;
  return Math.max(5, Math.round(((words / WORDS_PER_MINUTE) * 60) / 5) * 5);
}

export default function IntroDraft({ draft, onDraftChange, written = false, reflection }: Props) {
  const words = countWords(draft);
  const spokenSeconds = estimateSpokenSeconds(words);
  const shape = draftShape(draft);
  const reflectionAdded = Boolean(reflection && draft.includes(reflection.statement));
  const [reflectionOpen, setReflectionOpen] = React.useState(true);
  // Adds the statement on its own line at the end. It never replaces the draft.
  const addReflection = () => {
    if (!reflection || reflectionAdded) return;
    const current = draft.trimEnd();
    onDraftChange(
      (current ? `${current}\n${reflection.statement}` : reflection.statement).slice(
        0,
        DRAFT_MAX_LENGTH
      )
    );
  };
  const { copiedKey, copyStatus, handleCopy } = useClipboard();
  const copyKey = `intro-draft:${draft}`;
  const isCopied = copiedKey === copyKey;
  const copyFeedback = copyStatus?.key === copyKey ? copyStatus : null;

  return (
    <Card className="border-gold/50 bg-overlay/30">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-gold">Your intro, your words</CardTitle>
          {draft.trim().length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleCopy(draft, copyKey)}
              className="h-8 border-gold/40 text-xs text-gold hover:bg-gold/15 hover:text-gold focus-visible:ring-2 focus-visible:ring-foam"
            >
              {isCopied ? 'Copied' : 'Copy draft'}
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          The sample lines are scaffolding. This box is the practice. Write the intro you would
          actually say, then run the timer and say it out loud.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="intro-draft">Draft</Label>
            <span className="text-xs text-muted-foreground">
              {words === 0
                ? 'Nothing yet'
                : written
                  ? `${describeShape(shape)}, ${words} ${words === 1 ? 'word' : 'words'} (${draft.length}/${DRAFT_MAX_LENGTH})`
                  : `${words} ${words === 1 ? 'word' : 'words'}, about ${spokenSeconds}s aloud (${draft.length}/${DRAFT_MAX_LENGTH})`}
            </span>
          </div>
          <Textarea
            id="intro-draft"
            value={draft}
            maxLength={DRAFT_MAX_LENGTH}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder="Opener, who you are, one honest value line, one question. Your words, not the samples."
            className="min-h-[180px] bg-overlay/30 border-border/60 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-foam"
          />
        </div>
        {reflection && reflectionOpen && (
          <div
            className="space-y-2 rounded-xl border border-foam/40 bg-foam/5 p-3 text-sm"
            data-guide="intro-reflection"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              From your Five Whys
            </p>
            <p className="text-foreground">{reflection.statement}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addReflection}
                disabled={reflectionAdded}
                className="border-foam/50"
              >
                {reflectionAdded ? 'In your draft' : 'Add to the end of my draft'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setReflectionOpen(false)}
              >
                Hide
              </Button>
            </div>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Your draft saves as you type, and every rep you save keeps a copy, so the history shows
          how the intro changes. If a line only works with someone else's achievements in it, cut
          it.
        </p>
        <div aria-live="polite" className="sr-only" role="status">
          {copyFeedback ? (
            <span key={copyFeedback.attempt}>
              {copyFeedback.succeeded
                ? 'Copied intro draft to clipboard.'
                : 'Could not copy intro draft. Select the draft and copy it manually.'}
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
