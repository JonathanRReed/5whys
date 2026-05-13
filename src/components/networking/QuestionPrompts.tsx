import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import scenarioData from '../../data/networking-scenarios.json';

type QuestionTemplate = {
  id: string;
  label: string;
  prompt: string;
};

type Props = {
  questionTemplates: QuestionTemplate[];
  scenarioId: string | undefined;
  onCopy: (value: string, key: string) => void;
  copiedKey: string | null;
};

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--overlay)/0.4)]">
        <svg className="h-6 w-6 text-[hsl(var(--iris))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
        </svg>
      </div>
      <p className="mt-3 text-sm font-medium text-[hsl(var(--foreground))]">No scenario selected</p>
      <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Select a scenario above to generate question prompts.</p>
    </div>
  );
}

export default function QuestionPrompts({ questionTemplates, scenarioId, onCopy, copiedKey }: Props) {
  if (!scenarioId) {
    return (
      <Card className="border-[hsl(var(--border)/0.6)] bg-[hsl(var(--overlay)/0.28)]">
        <CardHeader className="space-y-2">
          <CardTitle className="text-[hsl(var(--iris))]">Question prompts</CardTitle>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">End every rep with a thoughtful ask.</p>
        </CardHeader>
        <CardContent>
          <EmptyState />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[hsl(var(--border)/0.6)] bg-[hsl(var(--overlay)/0.28)]">
      <CardHeader className="space-y-2">
        <CardTitle className="text-[hsl(var(--iris))]">Question prompts</CardTitle>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">End every rep with a thoughtful ask.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {questionTemplates.length ? (
          questionTemplates.map((template) => {
            const key = `question-${template.id}-${scenarioId}`;
            const isCopied = copiedKey === key;
            return (
              <div
                key={template.id}
                className="flex items-start justify-between gap-3 rounded-2xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--background)/0.6)] p-4"
              >
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--iris))]">{template.label}</p>
                  <p className="mt-2 text-sm text-[hsl(var(--foreground))]">{template.prompt}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-[hsl(var(--iris))] hover:text-[hsl(var(--iris))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
                  onClick={() => onCopy(template.prompt, key)}
                >
                  {isCopied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Document your go-to questions.</p>
        )}
        {questionTemplates.length > 0 && (
          <p className="text-xs text-[hsl(var(--muted-foreground)/0.7)]">
            Tip: Customize the scenario fields above to get more relevant suggestions.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
