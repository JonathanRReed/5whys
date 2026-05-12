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
        <Label htmlFor="reflection">Reflection</Label>
        <Textarea
          id="reflection"
          value={reflection}
          onChange={(event) => onReflectionChange(event.target.value)}
          placeholder="Notes to future you…"
          className="min-h-[100px] bg-[hsl(var(--overlay)/0.3)] border-[hsl(var(--border)/0.6)] text-sm text-[hsl(var(--foreground))] focus:border-[hsl(var(--iris))]"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={onSaveSession} className="bg-[hsl(var(--gold))] text-[hsl(var(--background))] hover:bg-[hsl(var(--gold)/0.8)]">
          Save Session
        </Button>
        <Button
          variant="outline"
          className="border-[hsl(var(--border)/0.6)] text-[hsl(var(--foreground))]"
          onClick={onResetReview}
        >
          Reset Review
        </Button>
        {sessionsAtCapacity ? (
          <span className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">
            History at capacity-new saves replace the oldest ({SESSION_LIMIT} max).
          </span>
        ) : null}
      </div>
    </div>
  );
}
