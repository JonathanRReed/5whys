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
  scenarioId: string;
  onCopy: (value: string, key: string) => void;
  copiedKey: string | null;
};

export default function QuestionPrompts({ questionTemplates, scenarioId, onCopy, copiedKey }: Props) {
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
                  className="text-[hsl(var(--iris))] hover:text-[hsl(var(--iris))]"
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
      </CardContent>
    </Card>
  );
}
