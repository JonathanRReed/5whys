import * as React from 'react';

const COPY_RESET_MS = 2000;

export function useClipboard() {
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const copyResetRef = React.useRef<number | null>(null);

  React.useEffect(
    () => () => {
      if (copyResetRef.current) window.clearTimeout(copyResetRef.current);
    },
    []
  );

  const handleCopy = React.useCallback(async (value: string, key: string) => {
    if (!value?.trim()) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopiedKey(key);
    if (copyResetRef.current) window.clearTimeout(copyResetRef.current);
    copyResetRef.current = window.setTimeout(() => setCopiedKey(null), COPY_RESET_MS);
  }, []);

  return { copiedKey, handleCopy };
}
