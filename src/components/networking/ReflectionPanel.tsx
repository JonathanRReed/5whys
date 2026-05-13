import * as React from 'react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { SESSION_LIMIT } from '../../utils/storage';

type Props = {
  reflection: string;
  onReflectionChange: (value: string) => void;
  onSaveSession: () => void;
  onResetReview: () => void;
  sessionsAtCapacity: boolean;
};

export default function ReflectionPanel({
  reflection,
  onReflectionChange,
  onSaveSession,
  onResetReview,
  sessionsAtCapacity,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="reflection">Reflection</Label>
          <span className="text-xs text-muted-foreground">{reflection.length}/500</span>
        </div>
        <Textarea
          id="reflection"
          value={reflection.slice(0, 500)}
          onChange={(event) => onReflectionChange(event.target.value.slice(0, 500))}
          placeholder="Notes to future you…"
          className="min-h-[100px] bg-[hsl(var(--overlay)/0.3)] border-[hsl(var(--border)/0.6)] text-sm text-[hsl(var(--foreground))] focus:ring-2 focus:ring-[hsl(var(--foam))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))]"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          onClick={onSaveSession}
          className="bg-[hsl(var(--gold))] text-[hsl(var(--background))] hover:bg-[hsl(var(--gold)/0.8)] focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
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
