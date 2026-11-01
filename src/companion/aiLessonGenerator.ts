import { MissedVerbFormItem } from '../engine/drillDirector';
import {
  ResolvedSubModulePool,
  resolveSubModulePool,
} from '../engine/roadmapResolver';
import { getLanguagePack } from '../languages';
import {
  DialogueLine,
  LanguageCode,
  LexicalChunk,
  SubModuleConfig,
} from '../languages/types';
import { BYOKConfig } from '../speech/types';
import {
  getCachedCompanionLesson,
  saveCachedCompanionLesson,
} from './lessonCache';
import { CompanionLesson, CompanionLessonVariant } from './lessonTypes';
import { buildOfflineCompanionLesson } from './offlineLessonBuilder';

export interface GenerateCompanionLessonParams {
  language: LanguageCode;
  subModuleId: string;
  variant?: CompanionLessonVariant;
  encoreIndex?: number;
  missedForms?: MissedVerbFormItem[];
  missedChunks?: LexicalChunk[];
  byokConfig?: BYOKConfig;
  customRoadmap?: SubModuleConfig[];
  bypassCache?: boolean;
}

function stripJsonCodeFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

export function buildCompanionPromptForLLM(
  pool: ResolvedSubModulePool,
  variant: CompanionLessonVariant,
  encoreIndex: number,
  missedForms: MissedVerbFormItem[],
  missedChunks: LexicalChunk[]
): string {
  const pack = getLanguagePack(pool.language);
  const langName = pool.language === 'fr' ? 'French' : 'Spanish';

  const focusVerbs = pool.focusVerbIds
    .map((id) => pack.verbs.find((v) => v.id === id)?.infinitive ?? id)
    .join(', ');
  const cumulativeVerbs = pool.cumulativeVerbIds
    .map((id) => pack.verbs.find((v) => v.id === id)?.infinitive ?? id)
    .join(', ');
  const allowedTenses = pool.cumulativeTenseIds
    .map((id) => pack.tenses.find((t) => t.id === id)?.name ?? id)
    .join(', ');
  const targetChunks = pool.focusChunks
    .map((c) => `"${c.target}" (${c.english})`)
    .join(', ');

  const missedFormsDesc =
    missedForms.length > 0
      ? missedForms
          .map(
            (m) =>
              `"${m.expectedFullForm}" (${m.infinitive} in ${m.tenseName}, ${m.pronounDisplay})`
          )
          .join('; ')
      : 'None';

  const missedChunksDesc =
    missedChunks.length > 0
      ? missedChunks.map((c) => `"${c.target}" (${c.english})`).join('; ')
      : 'None';

  return `You are designing a Dartmouth Rassias Method narrative companion lesson in ${langName} for Sub-Module ${pool.displayCode}: "${pool.subModule.title}".
Lesson Variant: "${variant}" (Encore index: ${encoreIndex}).

STRICT COMPREHENSIBLE INPUT & NATURAL DIALOGUE GUARDRAILS:
1. Allowed Tenses ONLY: [${allowedTenses}]. NEVER use any tense outside this list!
2. Focus Verbs to spotlight: [${focusVerbs}]. Allowed prior review verbs: [${cumulativeVerbs}].
3. Target Non-Verb Lexical Chunks to weave into the scene: [${targetChunks}].
4. NATURAL COLLOQUIAL CONVERSATION & PRO-DROP:
   ${
     pool.language === 'es'
       ? `- In Spanish, ALWAYS drop redundant subject pronouns (yo, tú, nosotros, vosotros). Never write "¿tú estás en casa?" or "Sí, yo hablo". Write "¿Estás en casa?" and "¡Sí, estoy en casa!". Only use él/ella/usted if needed to disambiguate third persons.\n   - Ensure authentic question-and-answer reciprocity: when Speaker A asks in 2nd person ("¿Estás...?"), Speaker B responds in 1st person ("Sí, estoy..."). Never have both speakers ask and answer using the same person pronoun!\n   - Use proper Spanish inverted punctuation marks (¿...? and ¡...!).`
       : `- In French, always include mandatory subject pronouns (je, tu, il/elle/on, nous, vous, ils/elles) with proper elision (j', l', n').\n   - Ensure authentic question-and-answer reciprocity (when Speaker A asks "Tu es...?", Speaker B responds "Oui, je suis...").`
   }
${
  variant === 'encore_remedial'
    ? `5. DIAGNOSTIC ENCORE REQUIREMENT: The student just missed these exact verb forms in the oral drill: [${missedFormsDesc}] and these chunks: [${missedChunksDesc}]. Your dialogue MUST naturally weave each missed form into the conversation (e.g. Speaker A prompts so Speaker B speaks the missed form, or vice versa). "diagnosticNotes" must give 1-3 crisp coaching tips explaining how the ear hears and remembers those exact missed forms!`
    : '5. Produce an authentic, lively 4-6 line dramatic or comedic scene between two friends that sounds like native speakers talking, NOT a robotic grammar textbook.'
}

Return ONLY a valid JSON object matching this exact structure:
{
  "sceneSetting": "1-sentence setting description in ${langName}",
  "dialogue": [
    {
      "speaker": "A",
      "speakerName": "${pool.language === 'fr' ? 'Luc' : 'Mateo'}",
      "target": "Natural line in ${langName}",
      "english": "Natural English translation",
      "audioTip": "Optional brief pronunciation or stress tip"
    }
  ],
  "earNotes": ["2-3 concise bullet points on how the ear hears the verb/tense pattern"],
  "diagnosticNotes": ["If variant is encore_remedial, 1-3 specific coaching tips on the missed forms"]
}`;
}

function sanitizeLLMDialogue(candidate: unknown): DialogueLine[] | null {
  if (!Array.isArray(candidate) || candidate.length < 2) return null;
  const lines: DialogueLine[] = [];
  for (const item of candidate) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const target = typeof obj.target === 'string' ? obj.target.trim() : '';
    const english = typeof obj.english === 'string' ? obj.english.trim() : '';
    if (!target || !english) continue;
    lines.push({
      speaker: obj.speaker === 'B' ? 'B' : 'A',
      speakerName:
        typeof obj.speakerName === 'string' && obj.speakerName.trim()
          ? obj.speakerName.trim()
          : obj.speaker === 'B'
          ? 'B'
          : 'A',
      target,
      english,
      audioTip:
        typeof obj.audioTip === 'string' && obj.audioTip.trim()
          ? obj.audioTip.trim()
          : undefined,
    });
  }
  return lines.length >= 2 ? lines : null;
}

/**
 * Generates or retrieves a CompanionLesson for a Sub-Module:
 * 1. Checks the recipe-hashed cache first (unless bypassCache is true).
 * 2. For baseline Scene A with a built-in starter dialogue (or when no BYOK API key is provided),
 *    uses the fast deterministic offline builder.
 * 3. When a BYOK Gemini key is configured, synthesizes a fresh scene constrained strictly to the
 *    unlocked grammar pool (and spotlighting any missedForms), falling back cleanly to the offline
 *    builder if the network request fails.
 */
export async function generateCompanionLesson(
  params: GenerateCompanionLessonParams
): Promise<CompanionLesson> {
  const {
    language,
    subModuleId,
    variant = 'baseline',
    encoreIndex = 0,
    missedForms = [],
    missedChunks = [],
    byokConfig,
    customRoadmap,
    bypassCache = false,
  } = params;

  const pool = resolveSubModulePool(language, subModuleId, customRoadmap);

  const geminiKey = byokConfig?.geminiApiKey?.trim() ?? '';

  // 1. Check cache if not bypassed and not a custom diagnostic Encore with new missedForms
  if (!bypassCache && variant !== 'encore_remedial') {
    const cached = getCachedCompanionLesson({
      language,
      subModuleId: pool.subModule.id,
      recipeHash: pool.recipeHash,
      variant,
      encoreIndex,
    });
    if (cached) {
      // If a Gemini API key is configured and this cached entry was only an offline fallback, bypass and upgrade!
      const isStaleOfflineFallback =
        Boolean(geminiKey) && cached.generatedBy === 'offline_engine';
      if (!isStaleOfflineFallback) {
        return cached;
      }
    }
  }

  // Build deterministic offline lesson as our guaranteed foundation / fallback
  const baseLesson = buildOfflineCompanionLesson({
    pool,
    variant,
    encoreIndex,
    missedForms,
    missedChunks,
  });

  // If this is a baseline lesson with a hand-crafted starterDialogue, or if no Gemini key is set, return & cache immediately
  if (
    baseLesson.generatedBy === 'starter_builtin' ||
    !geminiKey ||
    typeof fetch !== 'function'
  ) {
    saveCachedCompanionLesson(baseLesson);
    return baseLesson;
  }

  try {
    const model = byokConfig?.geminiModel || 'gemini-2.5-flash';
    const prompt = buildCompanionPromptForLLM(
      pool,
      variant,
      encoreIndex,
      missedForms,
      missedChunks
    );

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.4,
          },
        }),
      }
    );

    if (!response.ok) {
      saveCachedCompanionLesson(baseLesson);
      return baseLesson;
    }

    const data = await response.json();
    const rawText = stripJsonCodeFences(
      data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    );
    const parsed = JSON.parse(rawText);

    const validDialogue = sanitizeLLMDialogue(parsed?.dialogue);
    if (!validDialogue) {
      saveCachedCompanionLesson(baseLesson);
      return baseLesson;
    }

    const aiLesson: CompanionLesson = {
      ...baseLesson,
      generatedBy: 'byok_ai',
      sceneSetting:
        typeof parsed.sceneSetting === 'string' && parsed.sceneSetting.trim()
          ? parsed.sceneSetting.trim()
          : baseLesson.sceneSetting,
      dialogue: validDialogue,
      earNotes:
        Array.isArray(parsed.earNotes) && parsed.earNotes.length > 0
          ? parsed.earNotes.filter((n: unknown): n is string => typeof n === 'string')
          : baseLesson.earNotes,
      diagnosticNotes:
        Array.isArray(parsed.diagnosticNotes) &&
        parsed.diagnosticNotes.length > 0
          ? parsed.diagnosticNotes.filter(
              (n: unknown): n is string => typeof n === 'string'
            )
          : baseLesson.diagnosticNotes,
    };

    saveCachedCompanionLesson(aiLesson);
    return aiLesson;
  } catch {
    saveCachedCompanionLesson(baseLesson);
    return baseLesson;
  }
}
