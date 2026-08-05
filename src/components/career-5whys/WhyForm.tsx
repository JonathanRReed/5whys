import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import { condenseAnswer, getAnswerNudge, type TrackExample } from './shared';

type WhyFormProps = {
  responses: string[];
  sequentialCount: number;
  prompts: readonly string[];
  example: TrackExample;
  exampleOpen: Record<number, boolean>;
  onResponseChange: (index: number, value: string) => void;
  onToggleExample: (index: number) => void;
};

export default function WhyForm({
  responses,
  sequentialCount,
  prompts,
  example,
  exampleOpen,
  onResponseChange,
  onToggleExample,
}: WhyFormProps) {
  return (
    <>
      {responses.map((response, index) => {
        const prompt = prompts[index];
        const isExampleVisible = exampleOpen[index];
        const locked = index > sequentialCount;
        const previousAnswer = index > 0 ? (responses[index - 1] ?? '') : '';
        const nudge = locked ? null : getAnswerNudge(response, previousAnswer);
        const exampleAnswer = example.answers[index] ?? '';
        const examplePrevious = index > 0 ? condenseAnswer(example.answers[index - 1] ?? '') : '';
        return (
          <Card
            key={index}
            className="bg-[hsl(var(--card)/0.98)] border-[hsl(var(--border)/0.55)] text-[hsl(var(--foreground))] shadow-inner shadow-[hsl(var(--background)/0.16)]"
          >
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">
                  Depth {index + 1}
                </p>
                <CardTitle className="text-lg text-[hsl(var(--foreground))]">{prompt}</CardTitle>
              </div>
              <span className="rounded-full border border-[hsl(var(--border)/0.5)] px-4 py-1 text-xs text-[hsl(var(--muted-foreground))]">
                {response.trim().length ? 'Captured' : 'Pending'}
              </span>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                aria-label={`Depth ${index + 1} response`}
                value={response}
                onChange={(event) => onResponseChange(index, event.target.value)}
                placeholder="Document your reasoning. Be specific and concrete."
                disabled={locked}
                className="min-h-[120px] resize-none border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2 disabled:opacity-60"
              />
              {locked && (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Complete the previous depth before continuing.
                </p>
              )}
              {nudge && <p className="text-xs leading-relaxed text-[hsl(var(--gold))]">{nudge}</p>}
              <Button
                type="button"
                variant="ghost"
                onClick={() => onToggleExample(index)}
                aria-expanded={isExampleVisible}
                className="w-full justify-between rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-[hsl(var(--overlay)/0.5)] focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
              >
                Show a worked example
                <span aria-hidden>{isExampleVisible ? '−' : '+'}</span>
              </Button>
              {isExampleVisible && (
                <div className="space-y-3 rounded-xl border border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.05)] p-4 text-sm text-[hsl(var(--foreground))]">
                  <p className="text-xs uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
                    {example.persona}
                  </p>
                  {index > 0 && examplePrevious && (
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      Their depth {index} answer, condensed: "{examplePrevious}"
                    </p>
                  )}
                  <p className="leading-relaxed">{exampleAnswer}</p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}
