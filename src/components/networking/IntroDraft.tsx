import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';

const DRAFT_MAX_LENGTH = 1500;
const WORDS_PER_MINUTE = 140;

type Props = {
  draft: string;
  onDraftChange: (value: string) => void;
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

export default function IntroDraft({ draft, onDraftChange }: Props) {
  const words = countWords(draft);
  const spokenSeconds = estimateSpokenSeconds(words);

  return (
    <Card className="border-[hsl(var(--gold)/0.5)] bg-[hsl(var(--overlay)/0.3)]">
      <CardHeader className="space-y-2">
        <CardTitle className="text-[hsl(var(--gold))]">Your intro, your words</CardTitle>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          The sample lines are scaffolding. This box is the practice. Write the intro you would
          actually say, then run the timer and say it out loud.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="intro-draft">Draft</Label>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              {words === 0
                ? 'Nothing yet'
                : `${words} ${words === 1 ? 'word' : 'words'}, about ${spokenSeconds}s aloud`}
            </span>
          </div>
          <Textarea
            id="intro-draft"
            value={draft}
            maxLength={DRAFT_MAX_LENGTH}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder="Opener, who you are, one honest value line, one question. Your words, not the samples."
            className="min-h-[180px] bg-[hsl(var(--overlay)/0.3)] border-[hsl(var(--border)/0.6)] text-sm text-[hsl(var(--foreground))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))]"
          />
        </div>
        <p className="text-xs text-[hsl(var(--muted-foreground)/0.8)]">
          This draft is saved with every session, so the history shows how your intro changes
          between reps. If a line only works with someone else's achievements in it, cut it.
        </p>
      </CardContent>
    </Card>
  );
}
