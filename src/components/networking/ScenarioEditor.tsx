import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Textarea } from '../ui/textarea';
import type { NetworkingPracticeVersion } from '../../utils/storage';

type Props = {
  currentVersion: NetworkingPracticeVersion | undefined;
  onFieldChange: (field: 'title' | 'who' | 'where' | 'what' | 'notes', value: string) => void;
};

export default function ScenarioEditor({ currentVersion, onFieldChange }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="border-[hsl(var(--gold)/0.6)] bg-[hsl(var(--overlay)/0.4)] text-[hsl(var(--foreground))]">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-[hsl(var(--gold))]">
            <span className="text-2xl">&#x1F9D1;&#x200D;&#x1F4BC;</span>
            WHO
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Textarea
            aria-label="Who you are speaking with"
            value={currentVersion?.who ?? ''}
            onChange={(event) => onFieldChange('who', event.target.value)}
            className="min-h-[140px] bg-[hsl(var(--overlay)/0.3)] border-[hsl(var(--gold)/0.4)] text-sm text-[hsl(var(--foreground))] focus:border-[hsl(var(--gold))]"
          />
        </CardContent>
      </Card>

      <Card className="border-[hsl(var(--love)/0.6)] bg-[hsl(var(--overlay)/0.4)] text-[hsl(var(--foreground))]">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-[hsl(var(--love))]">
            <span className="text-2xl">&#x1F4CD;</span>
            WHERE
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Textarea
            aria-label="Where the networking conversation happens"
            value={currentVersion?.where ?? ''}
            onChange={(event) => onFieldChange('where', event.target.value)}
            className="min-h-[140px] bg-[hsl(var(--overlay)/0.3)] border-[hsl(var(--love)/0.4)] text-sm text-[hsl(var(--foreground))] focus:border-[hsl(var(--love))]"
          />
        </CardContent>
      </Card>

      <Card className="border-[hsl(var(--foam)/0.6)] bg-[hsl(var(--overlay)/0.4)] text-[hsl(var(--foreground))]">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-[hsl(var(--foam))]">
            <span className="text-2xl">&#x23F3;</span>
            WHAT
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Textarea
            aria-label="What you want to ask or share"
            value={currentVersion?.what ?? ''}
            onChange={(event) => onFieldChange('what', event.target.value)}
            className="min-h-[140px] bg-[hsl(var(--overlay)/0.3)] border-[hsl(var(--foam)/0.4)] text-sm text-[hsl(var(--foreground))] focus:border-[hsl(var(--foam))]"
          />
        </CardContent>
      </Card>
    </div>
  );
}
