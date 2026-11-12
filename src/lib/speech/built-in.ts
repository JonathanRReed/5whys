import { localVoices, onDeviceRecognitionState, recognitionConstructor } from './capabilities';
import { checkSignal, SpeechError } from './errors';
export interface SpeakOptions {
  signal?: AbortSignal;
  voiceURI?: string;
}
let speaking = false;
/** Uses a local voice or rejects. No remote voice fallback. */
export async function speakBuiltIn(text: string, options: SpeakOptions = {}): Promise<void> {
  checkSignal(options.signal);
  const voices = await localVoices();
  checkSignal(options.signal);
  const voice = options.voiceURI
    ? voices.find((v) => v.voiceURI === options.voiceURI)
    : (voices.find((v) => v.lang.startsWith('en')) ?? voices[0]);
  if (!voice)
    throw new SpeechError(
      options.voiceURI && voices.length ? 'voice-unavailable' : 'no-local-voice',
      'No matching local voice is available.'
    );
  if (speaking) throw new SpeechError('busy', 'A question is already being spoken.');
  speaking = true;
  await new Promise<void>((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    const finish = (error?: SpeechError) => {
      speaking = false;
      options.signal?.removeEventListener('abort', cancel);
      utterance.onend = null;
      utterance.onerror = null;
      if (error) reject(error);
      else resolve();
    };
    const cancel = () => {
      finish(new SpeechError('aborted', 'Speech cancelled.'));
      speechSynthesis.cancel();
    };
    utterance.onend = () => finish();
    utterance.onerror = () =>
      finish(new SpeechError('playback-failed', 'The local voice could not speak.'));
    options.signal?.addEventListener('abort', cancel, { once: true });
    try {
      speechSynthesis.speak(utterance);
    } catch {
      finish(new SpeechError('playback-failed', 'The local voice could not speak.'));
    }
  });
}
export interface RecognitionOptions {
  signal?: AbortSignal;
  onPartial?: (text: string) => void;
}
/** Starts only after an available on-device English recognizer is confirmed. */
export async function recognizeOnDevice(options: RecognitionOptions = {}): Promise<string> {
  checkSignal(options.signal);
  if ((await onDeviceRecognitionState()) !== 'available')
    throw new SpeechError('recognition-unavailable', 'On-device recognition is unavailable.');
  checkSignal(options.signal);
  const Constructor = recognitionConstructor();
  if (!Constructor)
    throw new SpeechError('recognition-unavailable', 'On-device recognition is unavailable.');
  const recognition = new Constructor();
  if (!('processLocally' in recognition))
    throw new SpeechError('recognition-unavailable', 'On-device recognition is unavailable.');
  recognition.processLocally = true;
  if (recognition.processLocally !== true)
    throw new SpeechError('recognition-unavailable', 'On-device recognition is unavailable.');
  recognition.lang = 'en-US';
  recognition.interimResults = true;
  recognition.continuous = false;
  return new Promise((resolve, reject) => {
    let finalText = '';
    const cleanup = () => {
      options.signal?.removeEventListener('abort', cancel);
      recognition.removeEventListener('result', result);
      recognition.removeEventListener('error', error);
      recognition.removeEventListener('end', end);
    };
    const cancel = () => {
      cleanup();
      recognition.abort();
      reject(new SpeechError('aborted', 'Recognition cancelled.'));
    };
    const result = (event: Event) => {
      const e = event as Event & {
        results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
      };
      const results = Array.from(e.results);
      finalText = results
        .filter((r) => r.isFinal)
        .map((r) => r[0].transcript)
        .join(' ')
        .trim();
      options.onPartial?.(
        results
          .map((r) => r[0].transcript)
          .join(' ')
          .trim()
      );
    };
    const error = () => {
      cleanup();
      recognition.abort();
      reject(new SpeechError('recognition-unavailable', 'On-device recognition failed.'));
    };
    const end = () => {
      cleanup();
      resolve(finalText);
    };
    recognition.addEventListener('result', result);
    recognition.addEventListener('error', error);
    recognition.addEventListener('end', end);
    options.signal?.addEventListener('abort', cancel, { once: true });
    try {
      recognition.start();
    } catch {
      error();
    }
  });
}
