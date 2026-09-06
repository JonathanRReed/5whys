import * as React from 'react';
import { cn } from '../../lib/utils';

type Props = {
  /** Resting label, e.g. "Clear history". */
  children: React.ReactNode;
  /** What the second press does, e.g. "Delete 12 snapshots". Names the stakes. */
  confirmLabel: string;
  onConfirm: () => void;
  className?: string;
  /** Styling for the armed state. Defaults to the destructive palette. */
  tone?: 'destructive' | 'neutral';
  'aria-label'?: string;
};

const ARM_TIMEOUT_MS = 4000;

/**
 * A destructive action that asks in place instead of opening a browser
 * dialog. The first press arms the button and states exactly what will be
 * lost; the second press does it. Arming disarms itself after a few seconds
 * and on blur, so a stray click never leaves a loaded gun on the page.
 *
 * DESIGN.md bans reaching for a modal first, and a native confirm() cannot be
 * themed, cannot name the stakes in the product's voice, and reads as a bug
 * on a site that otherwise never interrupts.
 */
export default function ConfirmButton({
  children,
  confirmLabel,
  onConfirm,
  className,
  tone = 'destructive',
  'aria-label': ariaLabel,
}: Props) {
  const [armed, setArmed] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const disarm = React.useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    setArmed(false);
  }, []);

  React.useEffect(() => disarm, [disarm]);

  const handleClick = () => {
    if (!armed) {
      setArmed(true);
      timeoutRef.current = setTimeout(() => setArmed(false), ARM_TIMEOUT_MS);
      return;
    }
    disarm();
    onConfirm();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onBlur={disarm}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && armed) {
          event.preventDefault();
          disarm();
        }
      }}
      aria-label={ariaLabel}
      // The label changes, so announce it rather than leaving the old one read out.
      aria-live="polite"
      className={cn(
        'rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2',
        tone === 'destructive'
          ? armed
            ? 'border-destructive bg-destructive text-destructive-foreground focus-visible:ring-destructive'
            : 'border-destructive/30 bg-destructive/8 text-destructive hover:bg-destructive/15 focus-visible:ring-destructive'
          : armed
            ? 'border-gold bg-gold text-background focus-visible:ring-gold'
            : 'border-border/50 bg-overlay/30 text-foreground hover:bg-overlay/50 focus-visible:ring-foam',
        className
      )}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}
