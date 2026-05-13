import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import type { BulletRecord } from '../../lib/resume-game';

type Props = {
  averageScore: number;
  quantifiedBullets: number;
  totalBullets: number;
  verbCoverage: number;
  onExportMarkdown: () => void;
  onExportDocx: () => void;
};

export default function Scoreboard({
  averageScore,
  quantifiedBullets,
  totalBullets,
  verbCoverage,
  onExportMarkdown,
  onExportDocx,
}: Props) {
  return (
    <Card className="backdrop-blur-lg">
      <CardHeader>
        <CardTitle className="text-xl">Scoreboard</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-[hsl(var(--foam)/0.6)] bg-gradient-to-br from-[hsl(var(--foam)/0.15)] to-[hsl(var(--overlay)/0.3)] p-4 text-center ring-1 ring-[hsl(var(--foam)/0.3)]">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Avg score</p>
          <p className="text-4xl font-bold text-[hsl(var(--foam))]">{averageScore}</p>
        </div>
        <div className="rounded-2xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.35)] p-4 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Quantified</p>
          <p className="text-3xl font-semibold text-[hsl(var(--foam))]">
            {quantifiedBullets}/{totalBullets}
          </p>
        </div>
        <div className="rounded-2xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.35)] p-4 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Verb coverage</p>
          <p className="text-3xl font-semibold text-[hsl(var(--iris))]">{verbCoverage}%</p>
        </div>
        <div className="rounded-2xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.35)] p-4 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Total bullets</p>
          <p className="text-3xl font-semibold">{totalBullets}</p>
        </div>
        <div className="flex flex-wrap gap-3 md:col-span-4">
          <Button type="button" variant="outline" onClick={onExportMarkdown} className="focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2">
            Export Markdown
          </Button>
          <Button type="button" variant="outline" onClick={onExportDocx} className="focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2">
            Export DOCX
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
