import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { cn } from '../../lib/utils';
import { WHY_COUNT } from './shared';

type WhyStepperProps = {
  responses: string[];
  sequentialCount: number;
};

export default function WhyStepper({ responses, sequentialCount }: WhyStepperProps) {
  return (
    <>
      <Card className="bg-[hsl(var(--card)/0.98)] border-[hsl(var(--border)/0.55)] text-[hsl(var(--foreground))]">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-[hsl(var(--foreground))]">Depth tracker</CardTitle>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Each layer validates the one above it.</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3">
            {Array.from({ length: WHY_COUNT }).map((_, index) => {
              const isFilled = index < sequentialCount;
              const isCurrent = index === sequentialCount;
              return (
                <React.Fragment key={index}>
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors',
                      isFilled
                        ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.2)] text-[hsl(var(--foreground))]'
                        : isCurrent
                        ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))]'
                        : 'border-[hsl(var(--border)/0.5)] text-[hsl(var(--muted-foreground))]'
                    )}
                    aria-current={isCurrent ? 'step' : undefined}
                  >
                    {index + 1}
                  </div>
                  {index < WHY_COUNT - 1 && (
                    <div
                      className={cn(
                        'w-px flex-1',
                        isFilled
                          ? 'bg-gradient-to-b from-[hsl(var(--primary))] via-[hsl(var(--primary)/0.5)] to-transparent'
                          : 'bg-[hsl(var(--border)/0.5)]'
                      )}
                      style={{ minHeight: '32px' }}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[hsl(var(--card)/0.98)] border-[hsl(var(--border)/0.55)] text-[hsl(var(--foreground))]">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">Logic tree</CardTitle>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">See how each answer branches from the previous one.</p>
        </CardHeader>
        <CardContent className="space-y-5">
          {responses.map((response, index) => {
            const previous = responses[index - 1];
            const isFocus = index === sequentialCount - 1 && response.trim().length > 0;
            return (
              <div key={index} className="relative pl-6">
                {index !== 0 && (
                  <span className="absolute left-2 top-0 h-full w-px bg-[hsl(var(--border)/0.5)]" aria-hidden />
                )}
                <div className="relative rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.2)] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">Why {index + 1}</p>
                  <p className="mt-2 text-sm text-[hsl(var(--foreground))]">
                    {response.trim().length ? response : 'Awaiting insight'}
                  </p>
                  {isFocus && (
                    <span className="absolute -top-2 right-3 rounded-full border border-[hsl(var(--primary)/0.6)] bg-[hsl(var(--primary)/0.2)] px-3 py-0.5 text-[10px] uppercase tracking-widest text-[hsl(var(--primary))]">
                      current node
                    </span>
                  )}
                  {previous && !response && (
                    <span className="mt-2 block text-[10px] uppercase tracking-wide text-[hsl(var(--iris))/0.8]">
                      add continuation
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </>
  );
}
