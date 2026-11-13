import * as React from 'react';
import { createPortal } from 'react-dom';

type Props = {
  children: React.ReactNode;
  /** Called once the print dialog has closed. */
  onDone: () => void;
  /**
   * Open the print dialog on mount. False when the browser's dialog is
   * already opening (the sheet was mounted from a beforeprint event).
   */
  autoPrint?: boolean;
};

/**
 * Prints its children as a plain black-on-white sheet and nothing else on the
 * page. Mount it to print; it opens the browser's print dialog and reports
 * back when the dialog closes. Styled by `.resume-print` in globals.css.
 */
export default function PrintSheet({ children, onDone, autoPrint = true }: Props) {
  React.useEffect(() => {
    const root = document.documentElement;
    root.dataset.print = 'resume';
    const done = () => {
      delete root.dataset.print;
      onDone();
    };
    window.addEventListener('afterprint', done, { once: true });
    const frame = autoPrint ? window.requestAnimationFrame(() => window.print()) : 0;
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('afterprint', done);
      delete root.dataset.print;
    };
  }, [onDone, autoPrint]);

  return createPortal(
    <div className="resume-print" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
      {children}
    </div>,
    document.body
  );
}
