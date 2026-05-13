import * as React from 'react';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

type Props = {
  resumeText: string;
  isScanning: boolean;
  scanProgress: number;
  scanComplete: boolean;
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
  scanProgress,
  scanComplete,
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
    <Card className="backdrop-blur-xl">
      <CardHeader className="space-y-4">
        <CardTitle className="text-2xl">Upload or paste resume</CardTitle>
        <p className="text-sm text-muted-foreground">
          Supports .txt, .md, .docx, and .pdf. Bullets starting with •, -, or * are auto-detected.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col items-start gap-2">
            <Label htmlFor="resume-upload" className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Upload
            </Label>
            <Input
              id="resume-upload"
              type="file"
              accept=".txt,.md,.markdown,.text,.docx,.pdf"
              onChange={handleFileChange}
              className="w-full md:w-auto"
            />
          </div>
          <Button type="button" variant="ghost" className="md:ml-auto" onClick={onClear}>
            Clear workspace
          </Button>
          <Button type="button" variant="outline" className="w-full md:w-auto" onClick={onLoadSample}>
            Try sample resume
          </Button>
        </div>
        <Textarea
          aria-label="Paste resume text"
          value={resumeText}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder="• Led a cross-functional pod launching...\n• Built an internal dashboard that..."
          className="min-h-[220px]"
        />
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <Button
            type="button"
            onClick={onScan}
            className="h-12 rounded-xl px-6"
            disabled={!resumeText.trim() || isScanning}
          >
            Simulate recruiter scan
          </Button>
          <p className="text-sm text-muted-foreground md:ml-4">
            {isScanning ? 'Scanning in progress...' : scanComplete ? 'Scan complete' : 'Ready when you are'}
            {needsRescan && scanComplete && (
              <span className="ml-2 text-xs text-[hsl(var(--gold))]">(resume updated — rescan to refresh)</span>
            )}
          </p>
        </div>
        {(isScanning || scanProgress > 0) && (
          <div className="space-y-2">
            <div className="h-2 w-full overflow-hidden rounded-full border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.25)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--foam))] via-[hsl(var(--iris))] to-[hsl(var(--love))] transition-all"
                style={{ width: `${scanProgress}%` }}
              />
            </div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
              {isScanning ? `Scanning • ${scanProgress}%` : 'Scan ready'}
            </p>
          </div>
        )}
        {status ? (
          <p className="text-sm text-[hsl(var(--foam))]" role="status">
            {status}
          </p>
        ) : null}
        {storageNotice && !status ? (
          <p className="text-sm text-[hsl(var(--gold))]">{storageNotice}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
