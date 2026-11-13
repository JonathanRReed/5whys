/**
 * Word between open tabs of this site that everything on the device was
 * cleared. A `storage` event already reaches other tabs for each removed
 * key; this says it was a clear and not an edit, so an open tool can empty
 * itself instead of offering to keep the text. Same origin only: a
 * BroadcastChannel never leaves this browser.
 */

const CHANNEL = 'career-studio-device';

type DeviceMessage = { type: 'cleared' };

/** Tell every other open tab of this site that the device was cleared. */
export function announceDeviceCleared(): void {
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage({ type: 'cleared' } satisfies DeviceMessage);
    channel.close();
  } catch {
    // No channel in this browser: the storage events still arrive.
  }
}

/** Call `listener` when another tab clears the device. Returns a function that stops listening. */
export function onDeviceCleared(listener: () => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  try {
    const channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (event: MessageEvent<DeviceMessage | undefined>) => {
      if (event.data?.type === 'cleared') listener();
    };
    return () => channel.close();
  } catch {
    return () => {};
  }
}
