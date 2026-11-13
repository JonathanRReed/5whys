/**
 * The site's IndexedDB layer: recordings, the original resume file, the
 * structured resume document, and the storage report. See db.ts for how it
 * fails soft when IndexedDB is unavailable.
 */

export {
  closeLocalDb,
  isLocalDbAvailable,
  LOCAL_DB_NAME,
  type LocalDbFailure,
  type LocalDbFailureReason,
  type LocalDbResult,
} from './db';
export {
  deleteModels,
  hasDownloadedModels,
  MODEL_CACHE_PREFIX,
  type ModelCacheSize,
  type ModelCachesReport,
} from './models';
export {
  countRecordings,
  deleteAllRecordings,
  deleteRecording,
  deleteResumeDoc,
  deleteResumeFile,
  getRecording,
  getResumeDoc,
  getResumeFile,
  listRecordings,
  type NewRecording,
  type Recording,
  type RecordingFilter,
  type RecordingMeta,
  type RecordingTool,
  type ResumeDocRecord,
  type ResumeFileInput,
  type ResumeFileRecord,
  saveRecording,
  saveResumeDoc,
  saveResumeFile,
  updateRecording,
} from './records';
export {
  type LocalStorageEntry,
  type StorageReport,
  type StoreSize,
  storageReport,
} from './report';
