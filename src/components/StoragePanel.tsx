import * as React from 'react';
import type { StorageReport } from '../lib/local-db';
import ConfirmButton from './shared/ConfirmButton';

/** Bytes in the unit a person would say out loud. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

/**
 * What this site keeps on the device, measured, with a way to delete the
 * large things. It only measures when opened, and it never writes.
 */
export default function StoragePanel() {
  const [report, setReport] = React.useState<StorageReport | null>(null);
  const [open, setOpen] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  const measure = React.useCallback(async () => {
    const { storageReport } = await import('../lib/local-db');
    setReport(await storageReport());
  }, []);

  React.useEffect(() => {
    if (open) void measure();
  }, [open, measure]);

  const removeRecordings = async () => {
    const { deleteAllRecordings } = await import('../lib/local-db');
    const result = await deleteAllRecordings();
    setNotice(
      result.ok
        ? `Deleted ${result.value} ${result.value === 1 ? 'recording' : 'recordings'}.`
        : result.message
    );
    await measure();
  };

  const removeModels = async () => {
    const { deleteModels } = await import('../lib/local-db');
    const result = await deleteModels();
    setNotice(result.ok ? 'Deleted downloaded models.' : result.message);
    await measure();
  };

  const removeResumeFile = async () => {
    const { deleteResumeFile } = await import('../lib/local-db');
    const result = await deleteResumeFile();
    setNotice(result.ok ? 'Deleted the original resume file.' : result.message);
    await measure();
  };

  const stores = report?.indexedDb.stores;
  const rows = report
    ? [
        {
          label: 'Your writing and settings',
          detail: `${report.localStorage.entries.length} saved items`,
          bytes: report.localStorage.bytes,
        },
        {
          label: 'Structured resume',
          detail: stores?.resumeDocument.count ? 'Included in your backup' : 'None saved',
          bytes: stores?.resumeDocument.bytes ?? 0,
        },
        {
          label: 'Original resume file',
          detail: stores?.resumeFile.count ? 'Not in your backup' : 'None saved',
          bytes: stores?.resumeFile.bytes ?? 0,
          remove: stores?.resumeFile.count ? removeResumeFile : undefined,
          confirm: 'Delete the original file? Your structured resume stays.',
        },
        {
          label: 'Practice recordings',
          detail: `${stores?.recordings.count ?? 0} saved. Not in your backup`,
          bytes: stores?.recordings.bytes ?? 0,
          remove: stores?.recordings.count ? removeRecordings : undefined,
          confirm: 'Delete every recording? Transcripts go with them.',
        },
        {
          label: 'Downloaded models',
          detail: report.models.caches.length ? 'Not in your backup' : 'None downloaded',
          bytes: report.models.bytes,
          remove: report.models.caches.length ? removeModels : undefined,
          confirm: 'Delete downloaded models? You can download them again.',
        },
      ]
    : [];

  return (
    <section aria-labelledby="storage-title" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="storage-title" className="text-xl font-semibold">
          What is stored on this device
        </h2>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="rounded-lg border border-border/50 px-3 py-1.5 text-sm transition-colors hover:bg-overlay/40 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-foam"
        >
          {open ? 'Hide' : 'Measure it'}
        </button>
      </div>

      {open &&
        (report ? (
          <div className="space-y-3">
            <ul className="divide-y divide-border/30 rounded-xl border border-border/40">
              {rows.map((row) => (
                <li
                  key={row.label}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">{row.label}</p>
                    <p className="text-xs text-muted-foreground">{row.detail}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm tabular-nums text-muted-foreground">
                      {formatBytes(row.bytes)}
                    </span>
                    {row.remove && (
                      <ConfirmButton
                        confirmLabel={row.confirm ?? 'Delete it?'}
                        onConfirm={row.remove}
                        className="px-3 py-1.5 text-xs"
                      >
                        Delete
                      </ConfirmButton>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground" data-testid="storage-total">
              {formatBytes(report.totalBytes)} in all. None of it has left this device.
            </p>
            <p role="status" className="min-h-5 text-sm text-foreground">
              {notice}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Measuring.</p>
        ))}
    </section>
  );
}
