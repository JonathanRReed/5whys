import { toPng } from 'html-to-image';
import * as React from 'react';
import type { BulletRecord, SignalReport } from '../../lib/resume-game';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

type Props = {
  bullets: BulletRecord[];
  averageScore: number;
  signalReport: SignalReport;
  verbCoverage: number;
};

export default function ShareScoreCard({
  bullets,
  averageScore,
  signalReport,
  verbCoverage,
}: Props) {
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [copied, setCopied] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<{ text: string; id: number } | null>(null);
  const operation = React.useRef(0);
  const announcement = React.useRef(0);
  const statusTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const downloadPending = React.useRef(false);
  React.useEffect(() => () => {
    operation.current += 1;
    if (statusTimer.current) clearTimeout(statusTimer.current);
  }, []);

  const announce = (text: string) => {
    announcement.current += 1;
    setStatusMessage({ text, id: announcement.current });
  };
  const startOperation = (text: string) => {
    operation.current += 1;
    if (statusTimer.current) clearTimeout(statusTimer.current);
    statusTimer.current = null;
    setCopied(false);
    announce(text);
    return operation.current;
  };
  const finishOperation = (id: number, text: string, copiedText = false) => {
    if (id !== operation.current) return;
    setCopied(copiedText);
    announce(text);
    statusTimer.current = setTimeout(() => {
      if (id !== operation.current) return;
      setCopied(false);
      setStatusMessage(null);
      statusTimer.current = null;
    }, copiedText ? 2000 : 3000);
  };

  const handleDownload = async () => {
    if (!cardRef.current || downloadPending.current) return;
    downloadPending.current = true;
    setDownloading(true);
    const id = startOperation('Generating score card image...');
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `resume-score-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
      finishOperation(id, 'Score card image download started.');
    } catch (error) {
      console.error('Failed to generate image:', error);
      finishOperation(id, 'Could not generate score card image.');
    } finally {
      downloadPending.current = false;
      setDownloading(false);
    }
  };

  const handleCopyText = async () => {
    const id = startOperation('Copying score card summary...');
    const text = `Resume Score Card\nAverage: ${averageScore}/100\nVisible Value: ${signalReport.visible}%\nQuantified: ${signalReport.numbers} bullets\nPower Verbs: ${signalReport.verbs}\nVerb Coverage: ${verbCoverage}%\nTotal Bullets: ${bullets.length}`;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(text);
      finishOperation(id, 'Copied score card summary to clipboard.', true);
    } catch {
      // Do not let an older rejected request steal focus from a newer action.
      if (id !== operation.current) return;
      const previousFocus = document.activeElement;
      const textarea = document.createElement('textarea');
      let successful = false;
      try {
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        successful = document.execCommand('copy');
      } catch {
        // Report the failed fallback below.
      } finally {
        textarea.remove();
        if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
      }
      finishOperation(id, successful ? 'Copied score card summary to clipboard.' : 'Failed to copy score card summary.', successful);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Share your score</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          ref={cardRef}
          className="rounded-2xl border border-border/35 bg-card/80 p-6 text-center"
        >
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Resume Game Score
          </p>
          <p className="mt-2 text-5xl font-bold text-foam">{averageScore}</p>
          <p className="text-sm text-muted-foreground">out of 100</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-overlay/40 p-3">
              <p className="text-xs text-muted-foreground">Visible Value</p>
              <p className="font-semibold text-iris">{signalReport.visible}%</p>
            </div>
            <div className="rounded-xl bg-overlay/40 p-3">
              <p className="text-xs text-muted-foreground">Verb Coverage</p>
              <p className="font-semibold text-love">{verbCoverage}%</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">5whys.jonathanrreed.com</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={handleDownload} disabled={downloading}>
            {downloading ? 'Downloading...' : 'Download image'}
          </Button>
          <Button type="button" variant="outline" onClick={handleCopyText}>
            {copied ? 'Copied!' : 'Copy text'}
          </Button>
        </div>
        <div aria-live="polite" className="sr-only" role="status">
          {statusMessage ? <span key={statusMessage.id}>{statusMessage.text}</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}
