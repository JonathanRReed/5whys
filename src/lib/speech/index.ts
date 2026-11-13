export {
  type RecognitionOptions,
  recognizeOnDevice,
  type SpeakOptions,
  speakBuiltIn,
} from './built-in';
export { type RecognitionState, type SpeechCapabilities, speechCapabilities } from './capabilities';
export { SpeechError, type SpeechErrorReason } from './errors';
export {
  DEFAULT_FILLERS,
  type DeliveryFacts,
  type DeliveryFactsInput,
  deliveryFacts,
  type FillerCount,
  type FillerDefinition,
  type FillerOccurrence,
  type Transcript,
  type TranscriptSegment,
} from './facts';
export {
  type PreparedQuestions,
  type PrepareQuestionsOptions,
  playAudio,
  prepareSpokenQuestions,
  type SpeechProgress,
  type TranscribeOptions,
  transcribe,
} from './hosted';
export {
  createRecorder,
  type RecordedAudio,
  type RecorderOptions,
  type SpeechRecorder,
} from './recorder';
export {
  bestVoice,
  isNoveltyVoice,
  loadVoiceChoice,
  rankVoices,
  saveVoiceChoice,
  scoreVoice,
  VOICE_STORAGE_KEY,
  type VoiceLike,
} from './voices';
