import { ConjugationResult, LanguageCode } from '../languages/types';
import { BYOKConfig, SpeechRecognitionResultPayload } from './types';

async function blobToBase64(blob: Blob): Promise<string> {
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Failed to encode audio blob'));
      reader.readAsDataURL(blob);
    });
  }
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return typeof btoa === 'function' ? btoa(binary) : '';
}

function stripMarkdownCodeFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

/**
 * Evaluates spoken audio directly using Gemini 2.5 Flash multimodal audio input.
 * Returns both the exact transcription in French/Spanish (preserving spoken stress accents like hablo vs. habló)
 * and a concise 1-sentence pronunciation/stress coaching tip.
 */
export async function transcribeWithGeminiFlash(
  audioBlob: Blob,
  language: LanguageCode,
  target: ConjugationResult,
  config: BYOKConfig
): Promise<SpeechRecognitionResultPayload> {
  const apiKey = config.geminiApiKey.trim();
  if (!apiKey) {
    throw new Error('Missing Gemini API Key. Add your key in Settings -> Speech Engine.');
  }

  const model = config.geminiModel || 'gemini-2.5-flash';
  const base64Audio = await blobToBase64(audioBlob);
  const mimeType = audioBlob.type ? audioBlob.type.split(';')[0] : 'audio/webm';
  const langName = language === 'fr' ? 'French' : 'Spanish';

  const systemPrompt = `You are a native ${langName} Dartmouth Rassias Method pronunciation & conjugation judge.
The student was prompted to conjugate the verb "${target.infinitive}" in the tense "${target.tenseId}" (expected target: "${target.fullForm}" or "${target.verbForm}").
Listen carefully to the audio clip and return ONLY a JSON object with two keys:
1. "transcript": The exact ${langName} words the student actually spoke. Do NOT auto-correct a wrong conjugation or wrong syllable stress! For Spanish, pay strict attention to spoken syllable stress (e.g., if they stressed the first syllable "HA-blo", write "hablo"; if they stressed the final syllable "ha-BLÓ", write "habló").
2. "pronunciationNote": A brief (max 12 words) encouraging note on their pronunciation, rhythm, nasal vowels, or syllable stress.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: systemPrompt },
              {
                inlineData: {
                  mimeType,
                  data: base64Audio,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Gemini API Error (${response.status}): ${errText.slice(0, 120)}`);
  }

  const data = await response.json();
  const rawText = stripMarkdownCodeFences(
    data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
  );

  try {
    const parsed = JSON.parse(rawText);
    return {
      transcript: String(parsed.transcript || '').trim(),
      aiPronunciationNote: parsed.pronunciationNote
        ? String(parsed.pronunciationNote).trim()
        : undefined,
      engineUsed: 'byok',
    };
  } catch {
    return {
      transcript: rawText.trim(),
      engineUsed: 'byok',
    };
  }
}

/**
 * Transcribes spoken audio using OpenAI Whisper (`whisper-1`).
 */
export async function transcribeWithOpenAIWhisper(
  audioBlob: Blob,
  language: LanguageCode,
  target: ConjugationResult,
  config: BYOKConfig
): Promise<SpeechRecognitionResultPayload> {
  const apiKey = config.openaiApiKey.trim();
  if (!apiKey) {
    throw new Error('Missing OpenAI API Key. Add your key in Settings -> Speech Engine.');
  }

  const ext = audioBlob.type.includes('mp4') ? 'mp4' : 'webm';
  const formData = new FormData();
  formData.append('file', audioBlob, `drill.${ext}`);
  formData.append('model', 'whisper-1');
  formData.append('language', language);
  formData.append(
    'prompt',
    language === 'fr'
      ? `Conjugaison du verbe ${target.infinitive} : je, tu, il, elle, nous, vous, ils, elles.`
      : `Conjugación del verbo ${target.infinitive}: yo, tú, él, ella, usted, nosotros, vosotros, ellos.`
  );

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`OpenAI Whisper Error (${response.status}): ${errText.slice(0, 120)}`);
  }

  const data = await response.json();
  return {
    transcript: String(data?.text || '').trim(),
    engineUsed: 'byok',
  };
}
