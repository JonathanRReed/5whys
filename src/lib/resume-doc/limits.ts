/** The most text any reader accepts from one resume, in characters. */
export const MAX_RESUME_TEXT = 200_000;

/**
 * A file rejected for its size or the amount it expands to. The rejection is
 * final: no other reader may take the same file, or the limit means nothing.
 */
export class ResumeLimitError extends Error {
  override name = 'ResumeLimitError';
}

export function isResumeLimitError(error: unknown): error is ResumeLimitError {
  return error instanceof ResumeLimitError;
}
