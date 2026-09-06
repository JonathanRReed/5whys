import type * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { WHY_COUNT } from './shared';

type WhySummaryProps = {
  whyStatement: string;
  chain: string[];
  isComplete: boolean;
  sequentialCount: number;
  nextStep: string;
  children?: React.ReactNode;
};

export default function WhySummary({
  whyStatement,
  chain,
  isComplete,
  sequentialCount,
  nextStep,
  children,
}: WhySummaryProps) {
  return (
    <Card className="border-foam/40 bg-overlay/25 text-foreground">
      <CardHeader>
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Session summary</p>
        <CardTitle className="text-2xl font-semibold text-foreground">Why Statement</CardTitle>
        <div className="text-sm text-muted-foreground">
          {isComplete
            ? 'Chain complete: all 5 layers answered'
            : `Depth progress: ${sequentialCount} of ${WHY_COUNT} layers answered`}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-2xl border border-border/50 bg-overlay/30 p-5 text-lg leading-relaxed text-foreground">
          {whyStatement}
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Evidence trail</p>
          {chain.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Your chain appears here as you answer, one condensed reason per layer.
            </p>
          ) : (
            <ol className="mt-3 space-y-2">
              {chain.map((item, index) => (
                <li key={index} className="flex items-start gap-3 text-sm">
                  <span
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/50 bg-primary/10 text-xs font-semibold text-foreground"
                    aria-hidden
                  >
                    {index + 1}
                  </span>
                  <span className="leading-relaxed text-foreground">
                    {item}
                    {index < chain.length - 1 && (
                      <span aria-hidden className="ml-2 text-muted-foreground">
                        ↓
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Test this by</p>
          {isComplete && nextStep ? (
            <p className="mt-2 rounded-xl border border-gold/35 bg-gold/8 p-4 text-sm leading-relaxed text-foreground">
              {nextStep}
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Finish all five layers to get one concrete next step derived from your answers.
            </p>
          )}
        </div>

        {children}
      </CardContent>
    </Card>
  );
}
