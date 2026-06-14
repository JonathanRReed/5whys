import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Textarea } from '../ui/textarea';
import type { NetworkingPracticeVersion } from '../../utils/storage';

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

export default function ScenarioEditor({ currentVersion, onFieldChange }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {FIELDS.map(({ field, title, icon, srLabel, ariaLabel, accent, helpText }) => (
        <Card
          key={field}
          className={`border-[hsl(var(--${accent})/0.6)] bg-[hsl(var(--overlay)/0.4)] text-[hsl(var(--foreground))]`}
        >
          <CardHeader className="pb-2">
            <CardTitle className={`flex items-center gap-2 text-[hsl(var(--${accent}))]`}>
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
              className="min-h-[140px] bg-[hsl(var(--overlay)/0.3)] border-[hsl(var(--border)/0.5)] text-sm text-[hsl(var(--foreground))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))]"
            />
            <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
              {helpText}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
