import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import type { SignalReport } from '../../lib/resume-game';

type Props = {
  averageScore: number;
  quantifiedBullets: number;
  totalBullets: number;
  verbCoverage: number;
  signalReport: SignalReport;
  onExportMarkdown: () => void;
  onExportDocx: () => void;
};

export default function Scoreboard({
  averageScore,
  quantifiedBullets,
  totalBullets,
  verbCoverage,
  signalReport,
  onExportMarkdown,
  onExportDocx,
}: Props) {
  const quantifiedPercent =
    totalBullets > 0 ? Math.round((quantifiedBullets / totalBullets) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Scoreboard</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Primary metric, largest and most prominent */}
        <div className="rounded-2xl border border-[hsl(var(--foam)/0.6)] bg-gradient-to-br from-[hsl(var(--foam)/0.15)] to-[hsl(var(--overlay)/0.3)] p-6 text-center ring-1 ring-[hsl(var(--foam)/0.3)]">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Average bullet score
          </p>
          <p
            className="mt-1 text-5xl font-bold text-[hsl(var(--foam))]"
            aria-label={`Average score: ${averageScore} out of 100`}
          >
            {averageScore}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">out of 100</p>
        </div>

        {/* Secondary metrics */}
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.35)] p-3 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Quantified</p>
            <p className="text-2xl font-semibold text-[hsl(var(--foam))]">{quantifiedPercent}%</p>
            <p className="text-[10px] text-muted-foreground">
              {quantifiedBullets}/{totalBullets} bullets
            </p>
          </div>
          <div className="rounded-xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.35)] p-3 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Verb coverage
            </p>
            <p className="text-2xl font-semibold text-[hsl(var(--iris))]">{verbCoverage}%</p>
            <p className="text-[10px] text-muted-foreground">With action verbs</p>
          </div>
          <div className="rounded-xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.35)] p-3 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Signal</p>
            <p className="text-2xl font-semibold text-[hsl(var(--love))]">
              {signalReport.visible}%
            </p>
            <p className="text-[10px] text-muted-foreground">Strength</p>
          </div>
          <div className="rounded-xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.35)] p-3 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Hard skills</p>
            <p className="text-2xl font-semibold text-[hsl(var(--primary))]">
              {signalReport.hardSkills.length}
            </p>
            <p className="text-[10px] text-muted-foreground">Detected</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onExportMarkdown}
            className="rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-[hsl(var(--overlay)/0.5)] focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
          >
            Export Markdown
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onExportDocx}
            className="rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-[hsl(var(--overlay)/0.5)] focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
          >
            Export DOCX
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
