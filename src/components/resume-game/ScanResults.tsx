import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { SignalReport } from '../../lib/resume-game';

type Props = {
  highlightedResume: string;
  signalReport: SignalReport;
  resumeOutOfDate: boolean;
};

export default function ScanResults({ highlightedResume, signalReport, resumeOutOfDate }: Props) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr,0.85fr]">
      <Card className="backdrop-blur-lg">
        <CardHeader>
          <CardTitle className="text-xl">Analysis visualization</CardTitle>
          {resumeOutOfDate && (
            <p className="text-xs text-[hsl(var(--gold))]">Resume updated — rerun analysis to refresh metrics.</p>
          )}
        </CardHeader>
        <CardContent>
          <div
            className="min-h-[200px] rounded-2xl border border-[hsl(var(--border)/0.4)] bg-[hsl(var(--card)/0.65)] p-6 text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: highlightedResume.replace(/\n/g, '<br/>') }}
          />
        </CardContent>
      </Card>

      <Card className="backdrop-blur-lg">
        <CardHeader className="space-y-2">
          <CardTitle className="text-xl">Signal report</CardTitle>
          <p className="text-xs text-muted-foreground">How much signal your resume sends in an 8-second glance.</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="mb-2 flex justify-between text-xs text-muted-foreground">
              <span>Signal strength (verbs + numbers)</span>
              <span className={signalReport.visible >= 70 ? 'text-[hsl(var(--love))]' : 'text-[hsl(var(--gold))]'}>
                {signalReport.visible}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.25)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--foam))] via-[hsl(var(--iris))] to-[hsl(var(--love))]"
                style={{ width: `${signalReport.visible}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {signalReport.visible >= 70
                ? 'Strong signal — your resume stands out in a quick scan.'
                : 'Add more numbers or power verbs to increase signal strength.'}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 text-center text-sm sm:grid-cols-2">
            <div className="rounded-2xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.45)] p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Numbers surfaced</p>
              <p className="text-3xl font-semibold text-[hsl(var(--foam))]">{signalReport.numbers}</p>
            </div>
            <div className="rounded-2xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.45)] p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Power verbs</p>
              <p className="text-3xl font-semibold text-[hsl(var(--iris))]">{signalReport.verbs}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.3)] p-4 text-sm text-muted-foreground">
            <p>
              Visible value blends quantification ({signalReport.numbers}) and power verbs ({signalReport.verbs}). Aim for 70%+ to stand out in a quick review.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
