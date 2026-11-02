import { LanguageCode } from '../languages/types';

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

/**
 * Synthesizes a crisp, realistic Dartmouth Rassias finger-snap (*Snap!*) using the Web Audio API
 * plus a short Android haptic pulse on supported devices (e.g. Pixel 10).
 */
export function playFingerSnap(options?: { quietMode?: boolean; isRepeatCue?: boolean }): void {
  if (options?.quietMode) return;

  // Trigger subtle haptic feedback on Android Chrome / Pixel 10
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(options?.isRepeatCue ? [30, 50, 35] : [22]);
    } catch {
      // Ignore if vibration is blocked by browser permissions
    }
  }

  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // 1. High-frequency skin-release pre-click (0ms)
  const clickOsc = ctx.createOscillator();
  const clickGain = ctx.createGain();
  clickOsc.type = 'triangle';
  clickOsc.frequency.setValueAtTime(2800, now);
  clickOsc.frequency.exponentialRampToValueAtTime(900, now + 0.012);

  clickGain.gain.setValueAtTime(0.35, now);
  clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.012);

  clickOsc.connect(clickGain);
  clickGain.connect(ctx.destination);
  clickOsc.start(now);
  clickOsc.stop(now + 0.013);

  // 2. Main broadband palm impact snap (10ms later)
  const snapOffset = now + 0.009;
  const bufferSize = Math.floor(ctx.sampleRate * 0.045);
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    // Exponentially decaying white noise burst
    const env = Math.pow(1 - i / bufferSize, 2.6);
    data[i] = (Math.random() * 2 - 1) * env;
  }

  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = noiseBuffer;

  // Bandpass filter around 2.2 kHz (classic finger-snap cavity resonance)
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(2250, snapOffset);
  filter.Q.setValueAtTime(3.2, snapOffset);

  const snapGain = ctx.createGain();
  snapGain.gain.setValueAtTime(0.85, snapOffset);
  snapGain.gain.exponentialRampToValueAtTime(0.001, snapOffset + 0.042);

  noiseSource.connect(filter);
  filter.connect(snapGain);
  snapGain.connect(ctx.destination);

  noiseSource.start(snapOffset);
  noiseSource.stop(snapOffset + 0.045);

  // 3. Warm woody palm thump (10ms)
  const bodyOsc = ctx.createOscillator();
  const bodyGain = ctx.createGain();
  bodyOsc.type = 'sine';
  bodyOsc.frequency.setValueAtTime(420, snapOffset);
  bodyOsc.frequency.exponentialRampToValueAtTime(140, snapOffset + 0.028);

  bodyGain.gain.setValueAtTime(0.45, snapOffset);
  bodyGain.gain.exponentialRampToValueAtTime(0.001, snapOffset + 0.03);

  bodyOsc.connect(bodyGain);
  bodyGain.connect(ctx.destination);
  bodyOsc.start(snapOffset);
  bodyOsc.stop(snapOffset + 0.032);
}

/**
 * Plays a short celebratory chime when a conjugation is answered on the beat.
 */
export function playSuccessMicroChime(quietMode?: boolean): void {
  if (quietMode) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(587.33, now); // D5
  osc.frequency.setValueAtTime(880, now + 0.055); // A5

  gain.gain.setValueAtTime(0.14, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.145);
}

/**
 * Selects the best neural French or Spanish voice available in the browser (prioritizing Google Android neural voices on Pixel).
 */
function pickBestVoice(locale: string, langCode: LanguageCode): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const normalizedLocale = locale.toLowerCase().replace('_', '-');
  const exactLocaleVoices = voices.filter(
    (v) => v.lang.toLowerCase().replace('_', '-') === normalizedLocale
  );
  const langPrefixVoices = voices.filter((v) =>
    v.lang.toLowerCase().startsWith(langCode)
  );

  // If Latin American Spanish (es-MX / es-US / es-419) is requested and exact match isn't found,
  // prioritize any Latin American / US Spanish voice over Castilian (es-ES).
  let pool = exactLocaleVoices;
  if (pool.length === 0 && langCode === 'es' && normalizedLocale !== 'es-es') {
    const latAmVoices = langPrefixVoices.filter((v) => {
      const tag = v.lang.toLowerCase().replace('_', '-');
      return (
        tag === 'es-mx' ||
        tag === 'es-us' ||
        tag === 'es-419' ||
        tag === 'es-co' ||
        tag === 'es-ar' ||
        tag === 'es-cl' ||
        /mexic|estados unidos|united states|latinoam|latin america/i.test(v.name)
      );
    });
    if (latAmVoices.length > 0) {
      pool = latAmVoices;
    }
  }

  if (pool.length === 0) {
    pool = langPrefixVoices;
  }
  if (pool.length === 0) return null;

  // Prefer Google / Neural / Natural voices
  const preferred = pool.find((v) => /google|natural|neural|premium/i.test(v.name));
  return preferred ?? pool[0];
}

let activeSpeechToken = 0;
// Keep a strong reference to the active utterance so Chromium never garbage-collects it mid-speech
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let activeUtteranceRef: SpeechSynthesisUtterance | null = null;

/**
 * Speaks a phrase out loud as the Dartmouth Assistant Teacher (AT) and resolves when finished.
 */
export function speakATUtterance(
  text: string,
  options: {
    language: LanguageCode;
    locale: string;
    rate?: number;
    pitch?: number;
    quietMode?: boolean;
  }
): Promise<void> {
  if (
    options.quietMode ||
    typeof window === 'undefined' ||
    !('speechSynthesis' in window)
  ) {
    return Promise.resolve();
  }

  activeSpeechToken += 1;
  const myToken = activeSpeechToken;

  return new Promise((resolve) => {
    try {
      const synth = window.speechSynthesis;
      const wasBusy = synth.speaking || synth.pending;
      if (wasBusy) {
        synth.cancel();
      }

      const startSpeaking = () => {
        if (activeSpeechToken !== myToken) {
          resolve();
          return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        activeUtteranceRef = utterance;
        utterance.lang = options.locale;
        utterance.rate = options.rate ?? 1.0; // Natural authentic Rassias cadence
        utterance.pitch = options.pitch ?? 1.0;

        const voice = pickBestVoice(options.locale, options.language);
        if (voice) {
          utterance.voice = voice;
        }

        let settled = false;
        const finish = () => {
          if (!settled) {
            settled = true;
            if (activeUtteranceRef === utterance) {
              activeUtteranceRef = null;
            }
            resolve();
          }
        };

        // Safety timeout in case mobile/desktop speechSynthesis onend doesn't fire
        const safetyTimer = setTimeout(
          finish,
          Math.max(6500, text.length * 200)
        );

        utterance.onend = () => {
          clearTimeout(safetyTimer);
          finish();
        };
        utterance.onerror = () => {
          clearTimeout(safetyTimer);
          finish();
        };

        synth.speak(utterance);
      };

      // In Chromium/Windows, calling synth.cancel() and synth.speak() in the same tick
      // can replay the previous utterance buffer or drop the new utterance. A 50ms flush prevents this.
      if (wasBusy) {
        setTimeout(startSpeaking, 50);
      } else {
        startSpeaking();
      }
    } catch {
      resolve();
    }
  });
}

export function cancelATSpeech(): void {
  activeSpeechToken += 1;
  activeUtteranceRef = null;
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore
    }
  }
}
