import type * as React from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';

type Props = {
  resumeText: string;
  isScanning: boolean;
  scanComplete: boolean;
  isLoadingFile?: boolean;
  status: string | null;
  storageNotice: string | null;
  needsRescan: boolean;
  onTextChange: (value: string) => void;
  onFileUpload: (file: File) => void;
  onScan: () => void;
  onLoadSample: () => void;
  onClear: () => void;
};

const SAMPLE_RESUME_TEXT = `• Led a 6-person product pod launching a pricing diagnostics dashboard adopted by 4 global regions within the first quarter.
• Automated weekly revenue reporting with Python + Airflow, trimming manual analysis time by 9 hours per analyst.
• Mentored three new hires, coaching them on stakeholder narrative reviews that helped lift NPS by 14 points.`;

export default function ResumeInput({
  resumeText,
  isScanning,
  scanComplete,
  isLoadingFile,
  status,
  storageNotice,
  needsRescan,
  onTextChange,
  onFileUpload,
  onScan,
  onLoadSample,
  onClear,
}: Props) {
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) await onFileUpload(file);
  };

  return (
    <Card>
      <CardHeader className="space-y-4">
        <CardTitle className="text-2xl">Upload or paste resume</CardTitle>
        <p className="text-sm text-muted-foreground">
          Supports .txt, .md, .docx, and .pdf. Bullets starting with •, -, or * are auto-detected.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col items-start gap-2">
            <Label
              htmlFor="resume-upload"
              className="text-xs uppercase tracking-[0.3em] text-muted-foreground"
            >
              Upload
            </Label>
            <Input
              id="resume-upload"
              type="file"
              accept=".txt,.md,.markdown,.text,.docx,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf,text/plain,text/markdown"
              onChange={handleFileChange}
              aria-label="Upload resume file (PDF, DOCX, TXT, or Markdown)"
              className="w-full md:w-auto border-border/50 bg-overlay/30 text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
            />
          </div>
          <div className="flex flex-col gap-2 w-full md:w-auto md:flex-row">
            <Button
              type="button"
              variant="ghost"
              className="w-full md:w-auto rounded-lg border border-border/50 bg-overlay/30 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-overlay/50 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
              onClick={onClear}
            >
              Clear
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full md:w-auto rounded-lg border border-border/50 bg-overlay/30 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-overlay/50 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
              onClick={onLoadSample}
            >
              Try sample
            </Button>
          </div>
        </div>
        <Textarea
          aria-label="Paste resume text"
          value={resumeText}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder={SAMPLE_RESUME_TEXT}
          className="min-h-[220px] border-border/50 bg-overlay/30 text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
        />
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <Button
            type="button"
            onClick={onScan}
            className="h-12 rounded-lg bg-foam px-6 text-sm font-semibold text-background transition-colors hover:bg-foam/90 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
            disabled={!resumeText.trim() || isScanning || isLoadingFile}
          >
            {isScanning ? 'Analyzing...' : 'Analyze resume'}
          </Button>
          <p className="text-sm text-muted-foreground md:ml-4">
            {isScanning
              ? 'Analyzing...'
              : scanComplete
                ? 'Analysis complete'
                : 'Ready when you are'}
            {needsRescan && scanComplete && (
              <span className="ml-2 text-xs text-gold">
                Resume changed. Tap &quot;Analyze resume&quot; to update scores.
              </span>
            )}
          </p>
        </div>
        {isLoadingFile && (
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-foam animate-pulse" />
            <p className="text-xs text-muted-foreground">Reading file...</p>
          </div>
        )}
        {status ? (
          <p className="text-sm text-foam" role="status">
            {status}
          </p>
        ) : null}
        {storageNotice && !status ? <p className="text-sm text-gold">{storageNotice}</p> : null}
      </CardContent>
    </Card>
  );
}
