import { ConjugationResult, LanguageCode } from '../languages/types';

export type SpeechEngineType = 'web_speech' | 'local_whisper' | 'byok';

export type BYOKProvider = 'gemini' | 'openai';

export interface BYOKConfig {
  provider: BYOKProvider;
  geminiApiKey: string;
  openaiApiKey: string;
  geminiModel: string;
}

export interface LocalWhisperStatus {
  state: 'unloaded' | 'loading' | 'ready' | 'error';
  progress: number;
  statusText: string;
  error?: string;
}

export interface SpeechRecognitionResultPayload {
  transcript: string;
  alternatives?: string[];
  aiPronunciationNote?: string;
  engineUsed: SpeechEngineType;
}

export interface ListenRequestOptions {
  language: LanguageCode;
  locale: string;
  target: ConjugationResult;
  engine: SpeechEngineType;
  byokConfig: BYOKConfig;
  maxDurationMs?: number;
  onAudioLevel?: (rmsLevel: number) => void;
  onInterimTranscript?: (interim: string) => void;
  onSpeechStarted?: () => void;
}
