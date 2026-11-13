import type * as React from 'react';
import { MAX_RESUME_FILE_MB } from '../../lib/resume-game';
import ConfirmButton from '../shared/ConfirmButton';
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
  fileError?: string | null;
  storageNotice: string | null;
  needsRescan: boolean;
  onTextChange: (value: string) => void;
  onFileUpload: (file: File) => Promise<void>;
  onScan: () => void;
  onLoadSample: (id?: string) => void;
  onClear: () => void;
  placeholder: string;
  /** Open the "start from nothing" form. */
  onStartBlank?: () => void;
  /** Hidden while the start-from-nothing form takes its place. */
  hidden?: boolean;
  /** When there is more than one sample, the choice between them. */
  samples?: readonly { id: string; label: string }[];
  /** The box holds the visitor's own resume, so a sample asks before replacing it. */
  replacesOwn?: boolean;
  /** Put back the resume a sample replaced. Offered while the sample is untouched. */
  undoSample?: () => void;
};

const SAMPLE_BUTTON =
  'min-h-11 rounded-lg border border-border/50 bg-overlay/30 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-overlay/50 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2';

/** One sample button. Over the visitor's own resume it arms first and names the loss. */
function SampleButton({
  label,
  replacesOwn,
  onLoad,
  className,
  guide,
}: {
  label: string;
  replacesOwn: boolean;
  onLoad: () => void;
  className?: string;
  guide?: string;
}) {
  if (replacesOwn) {
    return (
      <span data-guide={guide} className={className}>
        <ConfirmButton
          tone="neutral"
          confirmLabel={`Replace your resume with the ${label.toLowerCase()} sample?`}
          onConfirm={onLoad}
          className={`${SAMPLE_BUTTON} w-full`}
        >
          {label}
        </ConfirmButton>
      </span>
    );
  }
  return (
    <Button
      type="button"
      variant="outline"
      className={`${SAMPLE_BUTTON} ${className ?? ''}`}
      data-guide={guide}
      onClick={onLoad}
    >
      {label}
    </Button>
  );
}

export default function ResumeInput({
  resumeText,
  isScanning,
  scanComplete,
  isLoadingFile,
  status,
  fileError,
  storageNotice,
  needsRescan,
  onTextChange,
  onFileUpload,
  onScan,
  onLoadSample,
  onClear,
  placeholder,
  onStartBlank,
  samples,
  hidden,
  replacesOwn = false,
  undoSample,
}: Props) {
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (file) await onFileUpload(file);
  };

  return (
    <Card hidden={hidden}>
      <CardHeader className="space-y-4">
        <CardTitle className="text-2xl">Upload or paste resume</CardTitle>
        <p className="text-sm text-muted-foreground">
          Paste your resume or upload a PDF, Word file, or text file. Check the text below before
          you analyze it. A scanned PDF is a picture of text, so there is nothing to read; export it
          from the program you wrote it in. Files up to {MAX_RESUME_FILE_MB} MB. Everything stays in
          your browser.
        </p>
        {onStartBlank && (
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full sm:w-auto"
              data-guide="resume-blank"
              onClick={onStartBlank}
            >
              I do not have a resume yet
            </Button>
            <p className="text-sm text-muted-foreground">Build one from a few short questions.</p>
          </div>
        )}
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
              className="h-auto w-full cursor-pointer border-border/50 bg-transparent p-1.5 text-sm text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-solid file:border-border/60 file:bg-overlay/40 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-overlay/60 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2 md:w-auto"
            />
          </div>
          <div className="flex flex-col gap-2 w-full md:w-auto md:flex-row">
            <ConfirmButton
              tone="neutral"
              confirmLabel="Clear resume and scores?"
              onConfirm={onClear}
              className="w-full md:w-auto px-4"
            >
              Clear
            </ConfirmButton>
            {samples && samples.length > 1 ? (
              <fieldset className="flex flex-wrap items-center gap-2">
                <legend className="sr-only">Try a sample</legend>
                <span aria-hidden="true" className="text-sm text-muted-foreground">
                  Try a sample:
                </span>
                {samples.map((sample, index) => (
                  <SampleButton
                    key={sample.id}
                    label={sample.label}
                    replacesOwn={replacesOwn}
                    className="flex-1 md:flex-none"
                    guide={index === samples.length - 1 ? 'resume-sample' : undefined}
                    onLoad={() => onLoadSample(sample.id)}
                  />
                ))}
              </fieldset>
            ) : (
              <SampleButton
                label="Try sample"
                replacesOwn={replacesOwn}
                className="w-full md:w-auto"
                guide="resume-sample"
                onLoad={() => onLoadSample()}
              />
            )}
          </div>
        </div>
        <Textarea
          aria-label="Paste resume text"
          value={resumeText}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder={placeholder}
          className="min-h-[220px] border-border/50 bg-overlay/30 text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
        />
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <Button
            type="button"
            data-guide="resume-analyze"
            onClick={onScan}
            className="h-12 rounded-lg bg-foam px-6 text-sm font-semibold text-background transition-colors hover:bg-foam/90 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
            // Busy, not disabled, while it runs: a disabled button drops the
            // keyboard focus to the top of the page.
            disabled={!resumeText.trim() || isLoadingFile}
            aria-disabled={isScanning || undefined}
            aria-describedby="resume-analyze-state"
          >
            {isScanning ? 'Analyzing...' : 'Analyze resume'}
          </Button>
          <p id="resume-analyze-state" className="text-sm text-muted-foreground md:ml-4">
            {isScanning
              ? 'Analyzing...'
              : scanComplete
                ? 'Analysis complete'
                : resumeText.trim()
                  ? 'Ready when you are'
                  : onStartBlank
                    ? 'Paste a resume, upload one, build one, or try a sample to analyze it.'
                    : 'Paste a resume, upload one, or try the sample to analyze it.'}
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
        {fileError && (
          <p className="text-sm text-love" role="alert">
            {fileError}
          </p>
        )}
        {undoSample && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/40 p-3">
            <p className="text-sm text-muted-foreground">
              The sample took the place of your resume.
            </p>
            <Button type="button" variant="outline" className="min-h-11" onClick={undoSample}>
              Put my resume back
            </Button>
          </div>
        )}
        {/* Always in the page, so a reader hears each new message arrive. */}
        <p className={status ? 'text-sm text-foam' : 'sr-only'} role="status">
          {status}
        </p>
        {storageNotice && !status ? <p className="text-sm text-gold">{storageNotice}</p> : null}
      </CardContent>
    </Card>
  );
}
