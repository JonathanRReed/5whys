import { cn } from '../../lib/utils';
import type { NetworkingPracticeVersion } from '../../utils/storage';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Textarea } from '../ui/textarea';

type Props = {
  currentVersion: NetworkingPracticeVersion | undefined;
  onFieldChange: (field: 'title' | 'who' | 'where' | 'what' | 'notes', value: string) => void;
};

const FIELDS = [
  {
    field: 'who' as const,
    title: 'WHO',
    icon: '\u{1F9D1}\u{200D}\u{1F4BC}',
    srLabel: 'Audience or person you are speaking with',
    ariaLabel: 'Who you are speaking with',
    accent: 'gold',
    helpText:
      "Name or describe the person. Examples: 'VP of Engineering at Stripe', 'Former coworker now at Notion', 'Hiring manager for the PM role'",
  },
  {
    field: 'where' as const,
    title: 'WHERE',
    icon: '\u{1F4CD}',
    srLabel: 'Location or setting of the conversation',
    ariaLabel: 'Where the networking conversation happens',
    accent: 'love',
    helpText:
      "Describe the context. Examples: 'Coffee chat over Zoom', 'Industry conference hallway', 'LinkedIn voice message'",
  },
  {
    field: 'what' as const,
    title: 'WHAT',
    icon: '\u{23F3}',
    srLabel: 'Goal or question you want to ask',
    ariaLabel: 'What you want to ask or share',
    accent: 'foam',
    helpText:
      "Your specific goal. Examples: 'Ask about team culture', 'Request referral to hiring manager', 'Learn about their transition from IC to manager'",
  },
] as const;

const ACCENT_STYLES = {
  gold: { card: 'border-gold/60', title: 'text-gold' },
  love: { card: 'border-love/60', title: 'text-love' },
  foam: { card: 'border-foam/60', title: 'text-foam' },
} as const;

export default function ScenarioEditor({ currentVersion, onFieldChange }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {FIELDS.map(({ field, title, icon, srLabel, ariaLabel, accent, helpText }) => (
        <Card
          key={field}
          className={cn(ACCENT_STYLES[accent].card, 'bg-overlay/40 text-foreground')}
        >
          <CardHeader className="pb-2">
            <CardTitle className={cn('flex items-center gap-2', ACCENT_STYLES[accent].title)}>
              <span className="text-2xl" aria-hidden="true">
                {icon}
              </span>
              <span className="sr-only">{srLabel}</span>
              {title}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            <Textarea
              aria-label={ariaLabel}
              value={currentVersion?.[field] ?? ''}
              onChange={(event) => onFieldChange(field, event.target.value)}
              className="min-h-[140px] bg-overlay/30 border-border/50 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-foam"
            />
            <p className="text-xs text-muted-foreground leading-relaxed">{helpText}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
