import * as React from 'react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { SESSION_LIMIT } from '../../utils/storage';
import type { PracticeReflection } from '../../utils/storage';

type Props = {
  reflection: PracticeReflection;
  onReflectionField: (key: keyof PracticeReflection, value: string) => void;
  onSaveSession: () => void;
  onResetReview: () => void;
  sessionsAtCapacity: boolean;
  draftEmpty: boolean;
};

const REFLECTION_FIELDS = [
  {
    key: 'wins' as const,
    label: 'What worked',
    placeholder: 'One line that landed, or a moment that felt natural',
    maxLength: 240,
  },
  {
    key: 'nervesNote' as const,
    label: 'Where nerves showed up',
    placeholder: 'Rushed the opener, forgot the question, talked too fast',
    maxLength: 240,
  },
  {
    key: 'nextFocus' as const,
    label: 'One fix for next rep',
    placeholder: 'The single thing to change next time',
    maxLength: 240,
  },
  {
    key: 'humanNote' as const,
    label: 'Other notes',
    placeholder: 'Anything else future you should know',
    maxLength: 500,
  },
];

export default function ReflectionPanel({
  reflection,
  onReflectionField,
  onSaveSession,
  onResetReview,
  sessionsAtCapacity,
  draftEmpty,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {REFLECTION_FIELDS.map(({ key, label, placeholder, maxLength }) => (
          <div key={key} className="grid gap-2">
            <Label htmlFor={`reflection-${key}`}>{label}</Label>
            <Textarea
              id={`reflection-${key}`}
              value={reflection[key].slice(0, maxLength)}
              maxLength={maxLength}
              onChange={(event) => onReflectionField(key, event.target.value.slice(0, maxLength))}
              placeholder={placeholder}
              className="min-h-[72px] bg-[hsl(var(--overlay)/0.3)] border-[hsl(var(--border)/0.6)] text-sm text-[hsl(var(--foreground))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))]"
            />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={onSaveSession}
          disabled={draftEmpty}
          className="bg-[hsl(var(--gold))] text-[hsl(var(--background))] hover:bg-[hsl(var(--gold)/0.8)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
        >
          Save Session
        </Button>
        <Button
          variant="outline"
          className="border-[hsl(var(--border)/0.6)] text-[hsl(var(--foreground))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
          onClick={onResetReview}
        >
          Reset Review
        </Button>
        {draftEmpty ? (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Write your intro draft above to save this rep. The history stores your actual words.
          </p>
        ) : null}
        {sessionsAtCapacity ? (
          <div className="rounded-lg border border-[hsl(var(--gold)/0.4)] bg-[hsl(var(--gold)/0.1)] px-3 py-2">
            <p className="text-xs text-[hsl(var(--gold))]">
              You have saved {SESSION_LIMIT} sessions. New ones will replace the oldest.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
