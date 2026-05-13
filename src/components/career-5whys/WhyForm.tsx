import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';

type WhyFormProps = {
  responses: string[];
  sequentialCount: number;
  prompts: readonly string[];
  hints: readonly string[];
  hintOpen: Record<number, boolean>;
  onResponseChange: (index: number, value: string) => void;
  onToggleHint: (index: number) => void;
};

export default function WhyForm({
  responses,
  sequentialCount,
  prompts,
  hints,
  hintOpen,
  onResponseChange,
  onToggleHint,
}: WhyFormProps) {
  return (
    <>
      {responses.map((response, index) => {
        const hint = hints[index];
        const prompt = prompts[index];
        const isHintVisible = hintOpen[index];
        const locked = index > sequentialCount;
        return (
          <Card
            key={index}
            className="bg-[hsl(var(--card)/0.98)] border-[hsl(var(--border)/0.55)] text-[hsl(var(--foreground))] shadow-inner shadow-[hsl(var(--background)/0.16)]"
          >
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">Depth {index + 1}</p>
                <CardTitle className="text-lg text-[hsl(var(--foreground))]">{prompt}</CardTitle>
              </div>
              <span className="rounded-full border border-[hsl(var(--border)/0.5)] px-4 py-1 text-xs text-[hsl(var(--muted-foreground))]">
                {response.trim().length ? 'Captured' : 'Pending'}
              </span>
            </CardHeader>
            <CardContent className="space-y-4">
              {index > 0 && responses[index - 1].trim().length > 0 && (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Build on: {responses[index - 1]}</p>
              )}
              <Textarea
                aria-label={`Depth ${index + 1} response`}
                value={response}
                onChange={(event) => onResponseChange(index, event.target.value)}
                placeholder="Document your reasoning. Be specific and concrete."
                disabled={locked}
                className="min-h-[120px] resize-none border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-[hsl(var(--foam))] disabled:opacity-60"
              />
              {locked && (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Complete the previous depth before continuing.
                </p>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={() => onToggleHint(index)}
                aria-expanded={isHintVisible}
                className="w-full justify-between rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-[hsl(var(--overlay)/0.5)] focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
              >
                Show example reasoning
                <span aria-hidden>{isHintVisible ? '\u2212' : '+'}</span>
              </Button>
              {isHintVisible && (
                <div className="rounded-xl border border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.05)] p-4 text-sm text-[hsl(var(--foreground))]">
                  {hint}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}
