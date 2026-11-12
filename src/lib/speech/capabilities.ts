export type RecognitionState = 'available' | 'downloadable' | 'unsupported';
export interface LocalRecognition extends EventTarget {
  processLocally: boolean;
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
}
export interface RecognitionConstructor {
  new (): LocalRecognition;
  available?: (options: { langs: string[]; processLocally: true }) => Promise<string>;
}
export function recognitionConstructor(): RecognitionConstructor | undefined {
  const scope = globalThis as typeof globalThis & {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
}
/** Checks availability only. Never starts recognition or installs a language pack. */
export async function onDeviceRecognitionState(): Promise<RecognitionState> {
  try {
    const Constructor = recognitionConstructor();
    if (!Constructor?.available) return 'unsupported';
    const recognition = new Constructor();
    if (!('processLocally' in recognition)) return 'unsupported';
    recognition.processLocally = true;
    const state = await Constructor.available({ langs: ['en-US'], processLocally: true });
    return state === 'available'
      ? 'available'
      : state === 'downloadable' || state === 'downloading'
        ? 'downloadable'
        : 'unsupported';
  } catch {
    return 'unsupported';
  }
}
/** Some browsers populate voices asynchronously. The timeout keeps text usable when they never do. */
export async function localVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof speechSynthesis === 'undefined') return [];
  const read = () => speechSynthesis.getVoices().filter((voice) => voice.localService === true);
  if (speechSynthesis.getVoices().length) return read();
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      speechSynthesis.removeEventListener('voiceschanged', changed);
      resolve(read());
    };
    const changed = () => {
      if (speechSynthesis.getVoices().length) finish();
    };
    const timer = setTimeout(finish, 1000);
    speechSynthesis.addEventListener('voiceschanged', changed);
    changed();
  });
}
export function recorderMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined' || !globalThis.navigator?.mediaDevices?.getUserMedia)
    return null;
  return (
    ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'].find((type) =>
      MediaRecorder.isTypeSupported(type)
    ) ?? null
  );
}
export interface SpeechCapabilities {
  localVoices: SpeechSynthesisVoice[];
  recognition: RecognitionState;
  mediaRecorder: { supported: boolean; mimeType: string | null };
  webGPU: boolean;
}
export async function speechCapabilities(): Promise<SpeechCapabilities> {
  const [voices, recognition] = await Promise.all([localVoices(), onDeviceRecognitionState()]);
  const mimeType = recorderMimeType();
  return {
    localVoices: voices,
    recognition,
    mediaRecorder: { supported: mimeType !== null, mimeType },
    webGPU: typeof navigator !== 'undefined' && 'gpu' in navigator,
  };
}
