import * as React from 'react';
import { toPng } from 'html-to-image';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import type { BulletRecord, SignalReport } from '../../lib/resume-game';

type Props = {
  bullets: BulletRecord[];
  averageScore: number;
  signalReport: SignalReport;
  verbCoverage: number;
};

export default function ShareScoreCard({ bullets, averageScore, signalReport, verbCoverage }: Props) {
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [copied, setCopied] = React.useState(false);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `resume-score-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Failed to generate image:', error);
    }
  };

  const handleCopyText = () => {
    const text = `Resume Score Card\nAverage: ${averageScore}/100\nVisible Value: ${signalReport.visible}%\nQuantified: ${signalReport.numbers} bullets\nPower Verbs: ${signalReport.verbs}\nVerb Coverage: ${verbCoverage}%\nTotal Bullets: ${bullets.length}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Card className="backdrop-blur-lg">
      <CardHeader>
        <CardTitle className="text-xl">Share your score</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          ref={cardRef}
          className="rounded-2xl border border-[hsl(var(--border)/0.35)] bg-gradient-to-br from-[hsl(var(--card)/0.9)] to-[hsl(var(--overlay)/0.6)] p-6 text-center"
        >
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Resume Game Score</p>
          <p className="mt-2 text-5xl font-bold text-[hsl(var(--foam))]">{averageScore}</p>
          <p className="text-sm text-muted-foreground">out of 100</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-[hsl(var(--overlay)/0.4)] p-3">
              <p className="text-xs text-muted-foreground">Visible Value</p>
              <p className="font-semibold text-[hsl(var(--iris))]">{signalReport.visible}%</p>
            </div>
            <div className="rounded-xl bg-[hsl(var(--overlay)/0.4)] p-3">
              <p className="text-xs text-muted-foreground">Verb Coverage</p>
              <p className="font-semibold text-[hsl(var(--love))]">{verbCoverage}%</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">5whys.jonathanrreed.com</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={handleDownload}>
            Download image
          </Button>
          <Button type="button" variant="outline" onClick={handleCopyText}>
            {copied ? 'Copied!' : 'Copy text'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
