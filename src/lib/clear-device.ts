/**
 * Remove everything a visitor wrote, uploaded or recorded on this device.
 * For a shared or lab computer: one action that leaves nothing behind for
 * the next person.
 *
 * Display preferences (theme and typeface) are kept: they say nothing about
 * the person, and losing them would only make the next page flash.
 */
import { announceDeviceCleared } from './device-events';
import { closeLocalDb, deleteModels, LOCAL_DB_NAME } from './local-db';

const KEEP = new Set(['career-tools-theme', 'career-tools-font']);

export interface ClearResult {
  /** localStorage keys removed. */
  removedKeys: number;
  /** False when the browser refused to delete the database or a cache. */
  complete: boolean;
}

export async function clearDevice(): Promise<ClearResult> {
  let removedKeys = 0;
  let complete = true;

  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && !KEEP.has(key)) keys.push(key);
    }
    for (const key of keys) window.localStorage.removeItem(key);
    removedKeys = keys.length;
    window.sessionStorage.clear();
  } catch {
    complete = false;
  }
  // Other open tabs empty their editors, so none can save cleared work back.
  announceDeviceCleared();

  // Recordings, the resume file and its structured copy.
  try {
    await closeLocalDb();
    await new Promise<void>((resolve, reject) => {
      const request = window.indexedDB.deleteDatabase(LOCAL_DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      // Another tab holds the database open: it is deleted when that tab closes.
      request.onblocked = () => {
        complete = false;
        resolve();
      };
    });
  } catch {
    complete = false;
  }

  const models = await deleteModels().catch(() => null);
  if (!models?.ok) complete = false;

  return { removedKeys, complete };
}
