import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import type { Scenario } from './useNetworkingPractice';

const ACCENTS = [
  'text-[hsl(var(--foam))]',
  'text-[hsl(var(--gold))]',
  'text-[hsl(var(--love))]',
  'text-[hsl(var(--iris))]',
] as const;

type Props = {
  currentScenario: Scenario | undefined;
  onCopy: (value: string, key: string) => void;
  copiedKey: string | null;
};

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--overlay)/0.4)]">
        <svg
          className="h-6 w-6 text-[hsl(var(--foam))]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
          />
        </svg>
      </div>
      <p className="mt-3 text-sm font-medium text-[hsl(var(--foreground))]">No scenario selected</p>
      <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
        Select a scenario above to see its sample lines.
      </p>
    </div>
  );
}

export default function ConversationIngredients({ currentScenario, onCopy, copiedKey }: Props) {
  const ingredients = currentScenario?.ingredients ?? [];

  return (
    <Card className="border-[hsl(var(--border)/0.6)] bg-[hsl(var(--overlay)/0.28)]">
      <CardHeader className="space-y-2">
        <CardTitle className="text-[hsl(var(--love))]">Sample lines</CardTitle>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          A fictional speaker runs this scenario. Steal the structure, not the sentences. Only say
          things that are true for you.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {!currentScenario ? (
          <EmptyState />
        ) : ingredients.length ? (
          <>
            {ingredients.map((ingredient, index) => {
              const key = `ingredient-${ingredient.id}-${currentScenario.id}`;
              const isCopied = copiedKey === key;
              const accent = ACCENTS[index % ACCENTS.length];
              return (
                <div
                  key={ingredient.id}
                  className="rounded-2xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--background)/0.6)] p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <p className={`text-xs uppercase tracking-[0.3em] ${accent}`}>
                        {ingredient.label}
                      </p>
                      <p className="mt-2 text-sm text-[hsl(var(--foreground))]">
                        {ingredient.line}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-[hsl(var(--border)/0.5)] text-[hsl(var(--foreground))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
                      onClick={() => onCopy(ingredient.line, key)}
                    >
                      {isCopied ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                </div>
              );
            })}
            <p className="text-xs text-[hsl(var(--muted-foreground)/0.7)]">
              No achievements to cite? Look for the honest lines: preparation, curiosity, and
              specific interest in the other person's work all count as value.
            </p>
          </>
        ) : (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            This scenario has no sample lines yet. Draft your own below.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
