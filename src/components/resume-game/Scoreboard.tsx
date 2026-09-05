import type { SignalReport } from '../../lib/resume-game';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

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
        <div className="rounded-2xl border border-foam/60 bg-linear-to-br from-foam/15 to-overlay/30 p-6 text-center ring-1 ring-foam/30">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Average bullet score
          </p>
          <p className="mt-1 text-5xl font-bold text-foam">
            <span className="sr-only">Average score: </span>
            {averageScore}
            <span className="sr-only"> out of 100</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">out of 100</p>
        </div>

        {/* Secondary metrics */}
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-border/35 bg-overlay/35 p-3 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Quantified</p>
            <p className="text-2xl font-semibold text-foam">{quantifiedPercent}%</p>
            <p className="text-[10px] text-muted-foreground">
              {quantifiedBullets}/{totalBullets} bullets
            </p>
          </div>
          <div className="rounded-xl border border-border/35 bg-overlay/35 p-3 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Verb coverage
            </p>
            <p className="text-2xl font-semibold text-iris">{verbCoverage}%</p>
            <p className="text-[10px] text-muted-foreground">With action verbs</p>
          </div>
          <div className="rounded-xl border border-border/35 bg-overlay/35 p-3 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Signal</p>
            <p className="text-2xl font-semibold text-love">{signalReport.visible}%</p>
            <p className="text-[10px] text-muted-foreground">Strength</p>
          </div>
          <div className="rounded-xl border border-border/35 bg-overlay/35 p-3 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Hard skills</p>
            <p className="text-2xl font-semibold text-primary">{signalReport.hardSkills.length}</p>
            <p className="text-[10px] text-muted-foreground">Detected</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onExportMarkdown}
            className="rounded-lg border border-border/50 bg-overlay/30 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-overlay/50 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
          >
            Export Markdown
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onExportDocx}
            className="rounded-lg border border-border/50 bg-overlay/30 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-overlay/50 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
          >
            Export DOCX
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
