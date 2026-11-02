import { transcribeWithGeminiFlash, transcribeWithOpenAIWhisper } from './byokService';
import {
  ListenRequestOptions,
  LocalWhisperStatus,
  SpeechRecognitionResultPayload,
} from './types';

type WhisperListener = (status: LocalWhisperStatus) => void;

class SpeechManager {
  private worker: Worker | null = null;
  private whisperStatus: LocalWhisperStatus = {
    state: 'unloaded',
    progress: 0,
    statusText: 'Not downloaded yet (~40 MB offline model)',
  };
  private statusListeners = new Set<WhisperListener>();
  private pendingWorkerRequests = new Map<
    string,
    { resolve: (text: string) => void; reject: (err: Error) => void }
  >();
  private activeAbortController: (() => void) | null = null;
  private webSpeechNetworkBlocked = false;

  public subscribeWhisperStatus(listener: WhisperListener): () => void {
    this.statusListeners.add(listener);
    listener(this.whisperStatus);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private updateWhisperStatus(next: Partial<LocalWhisperStatus>) {
    this.whisperStatus = { ...this.whisperStatus, ...next };
    for (const l of this.statusListeners) {
      l(this.whisperStatus);
    }
  }

  private ensureWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('./whisper.worker.ts', import.meta.url), {
        type: 'module',
      });
      this.worker.addEventListener('message', (e: MessageEvent) => {
        const { type, id, progress, statusText, transcript, error } = e.data;
        if (type === 'progress') {
          this.updateWhisperStatus({
            state: 'loading',
            progress: progress ?? this.whisperStatus.progress,
            statusText: statusText || 'Loading Local Whisper...',
          });
        } else if (type === 'ready') {
          this.updateWhisperStatus({
            state: 'ready',
            progress: 100,
            statusText: statusText || 'Local Whisper ready (Offline WebGPU/WASM)',
          });
        } else if (type === 'error') {
          this.updateWhisperStatus({
            state: 'error',
            error: error || 'Failed to initialize Local Whisper',
            statusText: error || 'Error loading model',
          });
        } else if (type === 'result' && id) {
          const req = this.pendingWorkerRequests.get(id);
          if (req) {
            this.pendingWorkerRequests.delete(id);
            req.resolve(transcript || '');
          }
        } else if (type === 'transcribe_error' && id) {
          const req = this.pendingWorkerRequests.get(id);
          if (req) {
            this.pendingWorkerRequests.delete(id);
            req.reject(new Error(error || 'Whisper transcription error'));
          }
        }
      });
    }
    return this.worker;
  }

  public preloadLocalWhisper(): void {
    const worker = this.ensureWorker();
    this.updateWhisperStatus({
      state: 'loading',
      progress: 2,
      statusText: 'Downloading & caching Whisper-tiny (~40 MB)...',
    });
    worker.postMessage({ type: 'preload' });
  }

  /**
   * Ensures the local Whisper-tiny ONNX model is ready before recording begins,
   * streaming progress updates to the stage UI so the user knows when to speak.
   */
  private async ensureWhisperReady(
    onInterimTranscript?: (text: string) => void
  ): Promise<void> {
    if (this.whisperStatus.state === 'ready') return;

    if (this.whisperStatus.state !== 'loading') {
      this.preloadLocalWhisper();
    }

    await new Promise<void>((resolve, reject) => {
      const unsubscribe = this.subscribeWhisperStatus((status) => {
        if (status.state === 'loading') {
          onInterimTranscript?.(
            `Preparing offline Whisper model (${status.progress}%)...`
          );
        } else if (status.state === 'ready') {
          unsubscribe();
          resolve();
        } else if (status.state === 'error') {
          unsubscribe();
          reject(new Error(status.error || 'Failed to initialize offline Whisper model.'));
        }
      });
    });
  }

  public stopActiveListening(): void {
    if (this.activeAbortController) {
      const stop = this.activeAbortController;
      this.activeAbortController = null;
      stop();
    }
  }

  /**
   * Listens for a single conjugation utterance using the user's selected SpeechEngineType.
   * Automatically falls back to Local Whisper (or BYOK if configured) if Chrome's cloud
   * Web Speech API throws a `network` error.
   */
  public async listenOnce(
    options: ListenRequestOptions
  ): Promise<SpeechRecognitionResultPayload> {
    this.stopActiveListening();

    if (options.engine === 'web_speech' && !this.webSpeechNetworkBlocked) {
      try {
        return await this.listenWithWebSpeech(options);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.toLowerCase().includes('network')) {
          // Retry once after 250ms in case speechSynthesis was still releasing the audio channel
          try {
            if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
              window.speechSynthesis.cancel();
            }
            await new Promise((r) => setTimeout(r, 250));
            return await this.listenWithWebSpeech(options);
          } catch (retryErr) {
            const retryMsg =
              retryErr instanceof Error ? retryErr.message : String(retryErr);
            if (!retryMsg.toLowerCase().includes('network')) {
              throw retryErr;
            }
            // Browser's cloud Web Speech endpoint is blocked or unreachable -> switch to fallback
            this.webSpeechNetworkBlocked = true;
          }
        } else {
          throw err;
        }
      }
    }

    if (options.engine === 'web_speech' && this.webSpeechNetworkBlocked) {
      // Pause hesitation timer while switching to on-device Whisper or BYOK fallback
      options.onSpeechStarted?.();

      const hasByokKey =
        (options.byokConfig.provider === 'gemini' &&
          Boolean(options.byokConfig.geminiApiKey?.trim())) ||
        (options.byokConfig.provider === 'openai' &&
          Boolean(options.byokConfig.openaiApiKey?.trim()));

      const fallbackEngine = hasByokKey ? 'byok' : 'local_whisper';
      return this.listenWithMediaRecorder({
        ...options,
        engine: fallbackEngine,
      });
    }

    return this.listenWithMediaRecorder(options);
  }

  /**
   * Native Browser SpeechRecognition (optimized for Pixel 10 Android Chrome with continuous: false).
   */
  private listenWithWebSpeech(
    options: ListenRequestOptions
  ): Promise<SpeechRecognitionResultPayload> {
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRec) {
        reject(
          new Error(
            'Browser Web Speech API is not supported in this browser. Switch to Local Whisper or BYOK in Settings.'
          )
        );
        return;
      }

      const recognition = new SpeechRec();
      recognition.lang = options.locale;
      recognition.continuous = false; // Essential for Android Chrome on Pixel 10
      recognition.interimResults = true;
      recognition.maxAlternatives = 5;

      const maxDuration = options.maxDurationMs ?? 5000;
      const startedAt = Date.now();
      let finalTranscript = '';
      let latestInterim = '';
      let collectedAlternatives: string[] = [];
      let settled = false;
      let manuallyAborted = false;

      const finish = (text: string, alts?: string[]) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        this.activeAbortController = null;
        try {
          recognition.stop();
        } catch {
          // Ignore
        }
        resolve({
          transcript: text.trim(),
          alternatives: alts && alts.length > 0 ? alts : undefined,
          engineUsed: 'web_speech',
        });
      };

      const fail = (err: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        this.activeAbortController = null;
        try {
          recognition.abort();
        } catch {
          // Ignore
        }
        reject(err);
      };

      const timeoutId = setTimeout(() => {
        manuallyAborted = true;
        finish(finalTranscript || latestInterim, collectedAlternatives);
      }, maxDuration);

      this.activeAbortController = () => {
        manuallyAborted = true;
        finish(finalTranscript || latestInterim, collectedAlternatives);
      };

      // Immediately pause the beat countdown as soon as voice/sound is detected
      recognition.onspeechstart = () => {
        options.onSpeechStarted?.();
        options.onAudioLevel?.(0.5);
      };
      recognition.onsoundstart = () => {
        options.onSpeechStarted?.();
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        options.onSpeechStarted?.();
        let interim = '';
        const currentAlts: string[] = [];
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) {
            finalTranscript += res[0].transcript + ' ';
            for (let a = 0; a < res.length; a++) {
              if (res[a]?.transcript?.trim()) {
                currentAlts.push(res[a].transcript.trim());
              }
            }
          } else {
            interim += res[0].transcript;
            for (let a = 0; a < res.length; a++) {
              if (res[a]?.transcript?.trim()) {
                currentAlts.push(res[a].transcript.trim());
              }
            }
          }
        }
        if (currentAlts.length > 0) {
          collectedAlternatives = Array.from(
            new Set([...collectedAlternatives, ...currentAlts])
          );
        }
        latestInterim = interim;
        options.onInterimTranscript?.((finalTranscript + interim).trim());
        options.onAudioLevel?.(0.65);

        if (finalTranscript.trim()) {
          finish(finalTranscript, collectedAlternatives);
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech') {
          // Let onend handle restarting if time remains in maxDuration
          return;
        }
        if (event.error === 'aborted') {
          finish(finalTranscript || latestInterim, collectedAlternatives);
        } else {
          fail(new Error(`Speech recognition error: ${event.error}`));
        }
      };

      recognition.onend = () => {
        if (settled) return;
        const heardSoFar = (finalTranscript || latestInterim).trim();
        const elapsed = Date.now() - startedAt;

        // If Chrome ended early due to initial silence ('no-speech') before the user spoke
        // and there is still at least 1100ms left in our listening window, seamlessly restart!
        if (!heardSoFar && !manuallyAborted && elapsed + 1100 < maxDuration) {
          setTimeout(() => {
            if (settled || manuallyAborted) return;
            try {
              recognition.start();
            } catch {
              finish(finalTranscript || latestInterim, collectedAlternatives);
            }
          }, 70);
          return;
        }

        finish(heardSoFar, collectedAlternatives);
      };

      try {
        recognition.start();
      } catch (err) {
        fail(
          err instanceof Error ? err : new Error('Failed to start Web Speech API')
        );
      }
    });
  }

  /**
   * Records microphone audio with voice-activity silence detection (so Hands-Free mode works
   * automatically without needing to tap stop!) and sends the clip to either Local Whisper or BYOK.
   */
  private async listenWithMediaRecorder(
    options: ListenRequestOptions
  ): Promise<SpeechRecognitionResultPayload> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone access is not available in this browser context.');
    }

    if (options.engine === 'local_whisper' && this.whisperStatus.state !== 'ready') {
      options.onSpeechStarted?.();
      await this.ensureWhisperReady(options.onInterimTranscript);
      options.onInterimTranscript?.('Listening (Offline Whisper — speak now)...');
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const audioBlob = await new Promise<Blob>((resolve) => {
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      // Voice Activity Detection (VAD) via Web Audio AnalyserNode
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const timeData = new Float32Array(analyser.fftSize);

      let hasSpoken = false;
      let silenceStartMs: number | null = null;
      let stopped = false;

      const stopRecording = () => {
        if (stopped) return;
        stopped = true;
        clearInterval(vadInterval);
        clearTimeout(maxTimer);
        this.activeAbortController = null;
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
      };

      this.activeAbortController = stopRecording;

      const vadInterval = setInterval(() => {
        analyser.getFloatTimeDomainData(timeData);
        let sumSq = 0;
        for (let i = 0; i < timeData.length; i++) {
          sumSq += timeData[i] * timeData[i];
        }
        const rms = Math.sqrt(sumSq / timeData.length);
        const normalizedLevel = Math.min(1, rms * 6);
        options.onAudioLevel?.(normalizedLevel);

        if (rms > 0.028) {
          if (!hasSpoken) {
            options.onSpeechStarted?.();
          }
          hasSpoken = true;
          silenceStartMs = null;
        } else if (hasSpoken) {
          if (silenceStartMs === null) {
            silenceStartMs = Date.now();
          } else if (Date.now() - silenceStartMs > 620) {
            // User finished speaking their conjugation (~620ms trailing silence)
            stopRecording();
          }
        }
      }, 65);

      const maxTimer = setTimeout(stopRecording, options.maxDurationMs ?? 4500);

      recorder.onstop = () => {
        options.onAudioLevel?.(0);
        stream.getTracks().forEach((t) => t.stop());
        audioCtx.close().catch(() => {});
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        resolve(blob);
      };

      recorder.start();
    });

    if (audioBlob.size < 400) {
      return {
        transcript: '',
        engineUsed: options.engine,
      };
    }

    options.onSpeechStarted?.();
    options.onInterimTranscript?.('Transcribing...');

    if (options.engine === 'local_whisper') {
      const float32Audio = await this.decodeBlobTo16kHzPCM(audioBlob);
      const worker = this.ensureWorker();
      const reqId = `${Date.now()}-${Math.random()}`;
      const transcript = await new Promise<string>((resolve, reject) => {
        this.pendingWorkerRequests.set(reqId, { resolve, reject });
        worker.postMessage({
          type: 'transcribe',
          id: reqId,
          audio: float32Audio,
          language: options.language,
        });
      });

      return {
        transcript,
        engineUsed: 'local_whisper',
      };
    }

    // BYOK Mode (Gemini 2.5 Flash or OpenAI Whisper)
    if (options.byokConfig.provider === 'gemini') {
      return transcribeWithGeminiFlash(
        audioBlob,
        options.language,
        options.target,
        options.byokConfig
      );
    }
    return transcribeWithOpenAIWhisper(
      audioBlob,
      options.language,
      options.target,
      options.byokConfig
    );
  }

  /**
   * Decodes recorded audio Blob into 16kHz mono Float32Array required by Whisper ONNX models.
   */
  private async decodeBlobTo16kHzPCM(blob: Blob): Promise<Float32Array> {
    const arrayBuffer = await blob.arrayBuffer();
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const tempCtx = new AudioCtx({ sampleRate: 16000 });
    try {
      const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer);
      const offlineCtx = new OfflineAudioContext(
        1,
        Math.ceil(audioBuffer.duration * 16000),
        16000
      );
      const source = offlineCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineCtx.destination);
      source.start(0);
      const rendered = await offlineCtx.startRendering();
      return new Float32Array(rendered.getChannelData(0));
    } finally {
      tempCtx.close().catch(() => {});
    }
  }
}

export const speechManager = new SpeechManager();
