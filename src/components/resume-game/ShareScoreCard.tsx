import { toPng } from 'html-to-image';
import * as React from 'react';
import { localDate } from '../../lib/local-date';
import type { BulletRecord } from '../../lib/resume-game';
import { STRONG_SCORE } from '../../lib/resume-game';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

type Props = {
  bullets: BulletRecord[];
};

/**
 * A card to share once every scored line is strong. Below that it renders
 * nothing: a low score is a list of things to fix, not something to post.
 */
export default function ShareScoreCard({ bullets }: Props) {
  const total = bullets.length;
  const strongCount = bullets.filter((bullet) => bullet.improvedScore >= STRONG_SCORE).length;
  const allStrong = total > 0 && strongCount === total;
  const summary = 'Each line says what was done and what happened because of it.';
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [copied, setCopied] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<{ text: string; id: number } | null>(
    null
  );
  const operation = React.useRef(0);
  const announcement = React.useRef(0);
  const statusTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const downloadPending = React.useRef(false);
  React.useEffect(
    () => () => {
      operation.current += 1;
      if (statusTimer.current) clearTimeout(statusTimer.current);
    },
    []
  );

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
    statusTimer.current = setTimeout(
      () => {
        if (id !== operation.current) return;
        setCopied(false);
        setStatusMessage(null);
        statusTimer.current = null;
      },
      copiedText ? 2000 : 3000
    );
  };

  const handleDownload = async () => {
    if (!cardRef.current || downloadPending.current) return;
    downloadPending.current = true;
    setDownloading(true);
    const id = startOperation('Making the image...');
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2 });
      if (!cardRef.current) return;
      const link = document.createElement('a');
      link.download = `resume-game-lines-${localDate()}.png`;
      link.href = dataUrl;
      link.click();
      finishOperation(id, 'Image download started.');
    } catch (error) {
      console.error('Failed to generate image:', error);
      finishOperation(id, 'Could not make the image.');
    } finally {
      downloadPending.current = false;
      if (cardRef.current) setDownloading(false);
    }
  };

  const handleCopyText = async () => {
    const id = startOperation('Copying...');
    const text = `Resume Game: ${strongCount} of ${total} lines strong. ${summary}`;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(text);
      finishOperation(id, 'Copied to the clipboard.', true);
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
        if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
          previousFocus.focus();
      }
      finishOperation(id, successful ? 'Copied to the clipboard.' : 'Could not copy.', successful);
    }
  };

  if (!allStrong) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Share this</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          ref={cardRef}
          className="rounded-2xl border border-border/35 bg-card/80 p-6 text-center"
        >
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Resume Game</p>
          <p className="mt-2 text-5xl font-bold text-foam">
            {strongCount} of {total}
          </p>
          <p className="text-sm text-muted-foreground">lines strong</p>
          <p className="mt-4 text-sm text-muted-foreground">{summary}</p>
          <p className="mt-4 text-xs text-muted-foreground">5whys.jonathanrreed.com</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={handleDownload} disabled={downloading}>
            {downloading ? 'Downloading...' : 'Download image'}
          </Button>
          <Button type="button" variant="outline" onClick={handleCopyText}>
            {copied ? 'Copied' : 'Copy text'}
          </Button>
        </div>
        <div aria-live="polite" className="sr-only" role="status">
          {statusMessage ? <span key={statusMessage.id}>{statusMessage.text}</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}
