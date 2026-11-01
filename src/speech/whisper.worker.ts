import { pipeline } from '@huggingface/transformers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let transcriberPromise: Promise<any> | null = null;

async function getTranscriber() {
  if (!transcriberPromise) {
    const progressCallback = (info: {
      status?: string;
      progress?: number;
      file?: string;
    }) => {
      if (info.status === 'progress' && typeof info.progress === 'number') {
        self.postMessage({
          type: 'progress',
          progress: Math.round(info.progress),
          statusText: `Downloading ${info.file || 'Whisper model'} (${Math.round(info.progress)}%)...`,
        });
      } else if (info.status === 'initiate') {
        self.postMessage({
          type: 'progress',
          progress: 5,
          statusText: `Initializing ${info.file || 'onnx-community/whisper-tiny'}...`,
        });
      } else if (info.status === 'ready') {
        self.postMessage({
          type: 'ready',
          progress: 100,
          statusText: 'Local Whisper model ready on device.',
        });
      }
    };

    transcriberPromise = pipeline(
      'automatic-speech-recognition',
      'onnx-community/whisper-tiny',
      {
        device: 'wasm',
        dtype: 'q8',
        progress_callback: progressCallback,
      }
    );
    await transcriberPromise;
  }
  return transcriberPromise;
}

self.addEventListener('message', async (event: MessageEvent) => {
  const { type, id, audio, language } = event.data;

  if (type === 'preload') {
    try {
      self.postMessage({
        type: 'progress',
        progress: 1,
        statusText: 'Preparing Local Whisper (~40 MB)...',
      });
      await getTranscriber();
      self.postMessage({
        type: 'ready',
        progress: 100,
        statusText: 'Local Whisper ready (Offline WebGPU/WASM)',
      });
    } catch (err) {
      transcriberPromise = null;
      self.postMessage({
        type: 'error',
        error: err instanceof Error ? err.message : 'Failed to load Local Whisper model.',
      });
    }
    return;
  }

  if (type === 'transcribe') {
    try {
      const transcriber = await getTranscriber();
      const whisperLang = language === 'fr' ? 'french' : 'spanish';
      const output = await transcriber(audio, {
        language: whisperLang,
        task: 'transcribe',
        chunk_length_s: 15,
      });

      const text = Array.isArray(output)
        ? output.map((o) => o.text).join(' ')
        : output?.text || '';

      self.postMessage({
        type: 'result',
        id,
        transcript: text.trim(),
      });
    } catch (err) {
      self.postMessage({
        type: 'transcribe_error',
        id,
        error: err instanceof Error ? err.message : 'Local Whisper transcription failed.',
      });
    }
  }
});
