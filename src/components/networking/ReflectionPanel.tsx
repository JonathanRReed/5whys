import type { PracticeReflection } from '../../utils/storage';
import { SESSION_LIMIT } from '../../utils/storage';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';

type Props = {
  reflection: PracticeReflection;
  onReflectionField: (key: keyof PracticeReflection, value: string) => void;
  onSaveSession: () => void;
  onResetReview: () => void;
  sessionsAtCapacity: boolean;
  draftEmpty: boolean;
  ratingsTouched: boolean;
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
  ratingsTouched,
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
              className="min-h-[72px] bg-overlay/30 border-border/60 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-foam"
            />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={onSaveSession}
          disabled={draftEmpty}
          className="bg-gold text-background hover:bg-gold/80 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
        >
          Save this rep
        </Button>
        <Button
          variant="outline"
          className="border-border/60 text-foreground focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
          onClick={onResetReview}
        >
          Reset
        </Button>
        {draftEmpty ? (
          <p className="text-xs text-muted-foreground">
            Write your intro above to save this rep. The history stores your actual words.
          </p>
        ) : !ratingsTouched ? (
          <p className="text-xs text-muted-foreground">
            Move at least one slider so the rep is rated before it is saved.
          </p>
        ) : null}
        {sessionsAtCapacity ? (
          <div className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-2">
            <p className="text-xs text-gold">
              You have saved {SESSION_LIMIT} sessions. New ones will replace the oldest.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
