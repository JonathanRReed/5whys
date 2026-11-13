/**
 * Things typed on the Application Desk but not yet committed: a posting being
 * edited before it is decoded again, a step and its date before "Add step".
 * They are kept for the visit, per application, so switching to another
 * application and back does not lose them. They live in memory only: never
 * in storage, gone on reload, and dropped when the device is cleared.
 */
const drafts = new Map<string, string>();

const key = (applicationId: string, field: string) => `${applicationId}\u0000${field}`;

export function readDeskDraft(applicationId: string, field: string): string | null {
  return drafts.get(key(applicationId, field)) ?? null;
}

export function keepDeskDraft(applicationId: string, field: string, value: string | null): void {
  if (value === null) drafts.delete(key(applicationId, field));
  else drafts.set(key(applicationId, field), value);
}

export function forgetDeskDrafts(): void {
  drafts.clear();
}
