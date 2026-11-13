import { localDate, shortDate } from '../../lib/applications';
import { cn } from '../../lib/utils';

/**
 * Whether an application has gone out, as the visitor says. "Mark as sent"
 * records today; the date can be changed, and "Not sent yet" undoes it. A
 * sent application is never called late anywhere.
 */
export default function SentControl({
  sentOn,
  title,
  onChange,
  className,
  showDate = true,
}: {
  sentOn: string | null | undefined;
  /** The role, for the controls' accessible names. */
  title: string;
  onChange: (sentOn: string | null) => void;
  className?: string;
  /** False where the date is already shown beside it. */
  showDate?: boolean;
}) {
  const button =
    'inline-flex min-h-10 items-center rounded-lg border border-border/50 px-3 text-sm text-foreground transition-colors hover:bg-overlay/40 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-foam';
  if (!sentOn) {
    return (
      <div className={cn('flex flex-wrap items-center gap-2', className)}>
        <button type="button" className={button} onClick={() => onChange(localDate())}>
          Mark as sent<span className="sr-only">: {title}</span>
        </button>
      </div>
    );
  }
  return (
    <div className={cn('flex flex-wrap items-center gap-2 text-sm', className)}>
      {showDate && (
        <span className="text-foreground" data-testid="sent-on">
          Sent {shortDate(sentOn)}
        </span>
      )}
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="sr-only">Date {title} was sent</span>
        <input
          type="date"
          value={sentOn}
          max={localDate()}
          onChange={(event) => event.target.value && onChange(event.target.value)}
          className="h-10 rounded-lg border border-border/50 bg-transparent px-2 text-sm text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-foam"
        />
      </label>
      <button type="button" className={button} onClick={() => onChange(null)}>
        Not sent yet<span className="sr-only">: {title}</span>
      </button>
    </div>
  );
}
