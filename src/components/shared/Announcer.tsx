import * as React from 'react';

/**
 * A polite status message for screen readers. The region is always in the
 * page and starts empty, so a reader notices when text arrives; a region
 * inserted with its text already inside is often skipped.
 */
export default function Announcer({ message }: { message: string }) {
  return (
    <p className="sr-only" role="status">
      {message}
    </p>
  );
}

/**
 * Returns the current message and a function that sets it. The same sentence
 * twice in a row is cleared first, so a reader hears it again.
 */
export function useAnnouncer() {
  const [message, setMessage] = React.useState('');
  const timer = React.useRef<number | undefined>(undefined);
  React.useEffect(() => () => window.clearTimeout(timer.current), []);
  const announce = React.useCallback((text: string) => {
    window.clearTimeout(timer.current);
    setMessage('');
    timer.current = window.setTimeout(() => setMessage(text), 150);
  }, []);
  return [message, announce] as const;
}

/**
 * For results computed while the visitor types: announce `text` once it has
 * stopped changing for `delay` ms, and only after `active` has been true (the
 * visitor changed something), so loading saved work stays quiet.
 */
export function useSettledAnnouncement(text: string, active: boolean, delay = 1200) {
  const [message, setMessage] = React.useState('');
  React.useEffect(() => {
    if (!active) return undefined;
    const handle = window.setTimeout(() => setMessage(text), delay);
    return () => window.clearTimeout(handle);
  }, [text, active, delay]);
  return message;
}
