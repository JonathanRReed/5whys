import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

type WhySummaryProps = {
  whyStatement: string;
  sequentialConfidence: number;
  theme: string;
  alignment: string;
  derivedTheme: string;
  derivedAlignment: string;
  onThemeChange: (theme: string) => void;
  onAlignmentChange: (alignment: string) => void;
  children?: React.ReactNode;
};

export default function WhySummary({
  whyStatement,
  sequentialConfidence,
  theme,
  alignment,
  derivedTheme,
  derivedAlignment,
  onThemeChange,
  onAlignmentChange,
  children,
}: WhySummaryProps) {
  return (
    <Card className="bg-gradient-to-br from-[hsl(var(--iris)/0.2)] via-transparent to-[hsl(var(--primary)/0.2)] border-[hsl(var(--border)/0.5)] text-[hsl(var(--foreground))] backdrop-blur-lg">
      <CardHeader>
        <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">Completion summary</p>
        <CardTitle className="text-2xl font-semibold text-[hsl(var(--foreground))]">Why Statement</CardTitle>
        <div className="text-sm text-[hsl(var(--muted-foreground))]">Confidence {sequentialConfidence}%</div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-2xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] p-5 text-lg leading-relaxed text-[hsl(var(--foreground))]">
          {whyStatement}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label
              htmlFor="career-theme"
              className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]"
            >
              Theme
            </Label>
            <Input
              id="career-theme"
              value={theme}
              onChange={(event) => onThemeChange(event.target.value)}
              placeholder={derivedTheme}
              className="mt-2 bg-[hsl(var(--overlay)/0.3)] border-[hsl(var(--border)/0.5)] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
            />
          </div>
          <div>
            <Label
              htmlFor="career-alignment"
              className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]"
            >
              Alignment
            </Label>
            <Input
              id="career-alignment"
              value={alignment}
              onChange={(event) => onAlignmentChange(event.target.value)}
              placeholder={derivedAlignment}
              className="mt-2 bg-[hsl(var(--overlay)/0.3)] border-[hsl(var(--border)/0.5)] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
            />
          </div>
        </div>

        {children}
      </CardContent>
    </Card>
  );
}
