import * as React from 'react';
import { cn } from '../../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { WHY_COUNT } from './shared';

type WhyStepperProps = {
  responses: string[];
  sequentialCount: number;
};

export default function WhyStepper({ responses, sequentialCount }: WhyStepperProps) {
  return (
    <>
      <Card className="bg-card/98 border-border/55 text-foreground">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-foreground">Depth tracker</CardTitle>
          <p className="text-sm text-muted-foreground">
            Each answer explores the previous one; it does not prove a single root cause.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3">
            {Array.from({ length: WHY_COUNT }).map((_, index) => {
              const isFilled = index < sequentialCount;
              const isCurrent = index === sequentialCount;
              return (
                <React.Fragment key={index}>
                  <div
                    role="img"
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors',
                      isFilled
                        ? 'border-primary bg-primary/20 text-foreground'
                        : isCurrent
                          ? 'border-primary bg-primary/15 text-primary'
                          : 'border-border/50 text-muted-foreground'
                    )}
                    aria-current={isCurrent ? 'step' : undefined}
                    aria-label={`Depth ${index + 1}: ${
                      isFilled ? 'Completed' : isCurrent ? 'Current step' : 'Pending'
                    }`}
                  >
                    {index + 1}
                  </div>
                  {index < WHY_COUNT - 1 && (
                    <div
                      className={cn(
                        'w-px flex-1',
                        isFilled
                          ? 'bg-linear-to-b from-primary via-primary/50 to-transparent'
                          : 'bg-border/50'
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

      <Card className="bg-card/98 border-border/55 text-foreground">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">Logic tree</CardTitle>
          <p className="text-sm text-muted-foreground">
            Your answers in order. Each one is built on the one above it.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {responses.map((response, index) => {
            const isFocus = index === sequentialCount - 1 && response.trim().length > 0;
            const isNext = index === sequentialCount;
            return (
              <div key={index} className="relative pl-6">
                {index !== 0 && (
                  <span className="absolute left-2 top-0 h-full w-px bg-border/50" aria-hidden />
                )}
                <div className="relative rounded-xl border border-border/50 bg-overlay/20 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                      Why {index + 1}
                    </p>
                    {isFocus && (
                      <span className="rounded-full border border-primary/60 bg-primary/15 px-2.5 py-0.5 text-xs text-foreground">
                        Latest answer
                      </span>
                    )}
                    {isNext && (
                      <span className="rounded-full border border-border/60 px-2.5 py-0.5 text-xs text-muted-foreground">
                        Answer this next
                      </span>
                    )}
                  </div>
                  <p
                    className={cn(
                      'mt-2 line-clamp-4 text-sm break-words',
                      response.trim().length ? 'text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {response.trim().length ? response : 'No answer yet'}
                  </p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </>
  );
}
