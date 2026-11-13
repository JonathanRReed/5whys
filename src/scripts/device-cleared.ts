/**
 * When another tab clears this device, a tool still open here must not keep
 * the cleared writing on screen, or save it back on the next keystroke. The
 * Application Desk, Pay and the dashboard empty themselves and say why. The
 * other tools load again from the now-empty device, which is the same thing
 * a visitor would see on opening them fresh.
 */
import { onDeviceCleared } from '../lib/device-events';

const RELOAD = ['/career/', '/resume-game/', '/networking-practice/', '/interview-glow-up/'];

onDeviceCleared(() => {
  if (!RELOAD.some((path) => window.location.pathname.startsWith(path))) return;
  // This page still holds the cleared writing in memory, and its tools save
  // when a page is hidden or closed. It is about to be thrown away: from here
  // until it reloads, nothing it holds may reach storage.
  try {
    Storage.prototype.setItem = () => {};
  } catch {
    // The reload alone still empties the screen.
  }
  window.location.reload();
});
