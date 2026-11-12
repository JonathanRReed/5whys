export type SpeechErrorReason =
  | 'unsupported'
  | 'no-local-voice'
  | 'voice-unavailable'
  | 'permission-denied'
  | 'no-device'
  | 'not-recording'
  | 'busy'
  | 'aborted'
  | 'recognition-unavailable'
  | 'playback-failed'
  | 'capture-failed'
  | 'inference-failed';
export class SpeechError extends Error {
  constructor(
    public readonly reason: SpeechErrorReason,
    message: string
  ) {
    super(message);
    this.name = 'SpeechError';
  }
}
export function checkSignal(signal?: AbortSignal): void {
  if (signal?.aborted) throw new SpeechError('aborted', 'Speech operation cancelled.');
}
