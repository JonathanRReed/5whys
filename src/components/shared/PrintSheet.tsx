import * as React from 'react';
import { createPortal } from 'react-dom';

type Props = {
  children: React.ReactNode;
  /** Called once the print dialog has closed. */
  onDone: () => void;
};

/**
 * Prints its children as a plain black-on-white sheet and nothing else on the
 * page. Mount it to print; it opens the browser's print dialog and reports
 * back when the dialog closes. Styled by `.resume-print` in globals.css.
 */
export default function PrintSheet({ children, onDone }: Props) {
  React.useEffect(() => {
    const root = document.documentElement;
    root.dataset.print = 'resume';
    const done = () => {
      delete root.dataset.print;
      onDone();
    };
    window.addEventListener('afterprint', done, { once: true });
    const frame = window.requestAnimationFrame(() => window.print());
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('afterprint', done);
      delete root.dataset.print;
    };
  }, [onDone]);

  return createPortal(
    <div className="resume-print" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
      {children}
    </div>,
    document.body
  );
}
