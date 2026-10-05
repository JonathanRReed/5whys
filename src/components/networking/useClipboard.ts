import * as React from 'react';

const COPY_RESET_MS = 2000;

type CopyStatus = {
  key: string;
  succeeded: boolean;
  attempt: number;
};

export function useClipboard() {
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const [copyStatus, setCopyStatus] = React.useState<CopyStatus | null>(null);
  const copyResetRef = React.useRef<number | null>(null);
  const operationRef = React.useRef(0);

  React.useEffect(
    () => () => {
      operationRef.current += 1;
      if (copyResetRef.current !== null) window.clearTimeout(copyResetRef.current);
    },
    []
  );

  const handleCopy = React.useCallback(async (value: string, key: string) => {
    if (!value?.trim()) return false;
    const attempt = ++operationRef.current;
    if (copyResetRef.current !== null) window.clearTimeout(copyResetRef.current);
    copyResetRef.current = null;
    setCopiedKey(null);
    setCopyStatus(null);

    let succeeded = false;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        succeeded = true;
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch {
      // An older request must not copy again or steal focus after a newer action.
      if (attempt !== operationRef.current) return false;
      const previousFocus = document.activeElement;
      const textarea = document.createElement('textarea');
      try {
        textarea.value = value;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        succeeded = document.execCommand('copy');
      } catch {
        // Report a failed fallback without leaving temporary elements behind.
      } finally {
        textarea.remove();
        if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
          previousFocus.focus();
        }
      }
    }

    if (attempt !== operationRef.current) return false;
    setCopiedKey(succeeded ? key : null);
    setCopyStatus({ key, succeeded, attempt });
    copyResetRef.current = window.setTimeout(() => {
      if (attempt !== operationRef.current) return;
      setCopiedKey(null);
      setCopyStatus(null);
      copyResetRef.current = null;
    }, COPY_RESET_MS);
    return succeeded;
  }, []);

  return { copiedKey, copyStatus, handleCopy };
}
