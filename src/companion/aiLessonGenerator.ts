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
import {
  CompanionChunkCard,
  CompanionLesson,
  CompanionLessonVariant,
} from './lessonTypes';
import { buildOfflineCompanionLesson } from './offlineLessonBuilder';
import {
  BufferedPhraseItem,
  getBufferedSceneForLesson,
} from './rollingLessonBuffer';

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
  includeVosotros?: boolean;
}

function stripJsonCodeFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

const REMIX_THEMES = [
  'a funny misunderstanding about running late or forgetting something',
  'making spontaneous plans after work or class',
  'running into each other unexpectedly on the street or transit',
  'preparing for a weekend trip or dinner together',
];

export function buildCompanionPromptForLLM(
  pool: ResolvedSubModulePool,
  variant: CompanionLessonVariant,
  encoreIndex: number,
  missedForms: MissedVerbFormItem[],
  missedChunks: LexicalChunk[],
  includeVosotros = false
): string {
  const pack = getLanguagePack(pool.language);
  const langName =
    pool.language === 'fr' ? 'French' : 'Spanish (Latin America)';

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
    .map((c) => {
      const contrast = c.meaningByVerbId
        ? ` [verb-specific meanings: ${Object.entries(c.meaningByVerbId)
            .map(([v, m]) => `${v}="${m}"`)
            .join(', ')}]`
        : '';
      return `"${c.target}" (${c.english})${contrast}`;
    })
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

  const starterPreview =
    pool.subModule.starterDialogue && pool.subModule.starterDialogue.length > 0
      ? pool.subModule.starterDialogue
          .slice(0, 2)
          .map((d) => d.target)
          .join(' / ')
      : '';

  const themeHint =
    REMIX_THEMES[
      (encoreIndex + (variant === 'pass_2_consolidation' ? 1 : 0)) %
        REMIX_THEMES.length
    ];

  return `You are designing a Dartmouth Rassias Method narrative companion lesson in ${langName} for Sub-Module ${pool.displayCode}: "${pool.subModule.title}".
Lesson Variant: "${variant}" (Encore index: ${encoreIndex}).

STRICT COMPREHENSIBLE INPUT & NATURAL DIALOGUE GUARDRAILS:
1. Allowed Tenses ONLY: [${allowedTenses}]. NEVER use any tense outside this list!
2. Focus Verbs to spotlight: [${focusVerbs}]. Allowed prior review verbs: [${cumulativeVerbs}].
3. Target Non-Verb Lexical Chunks to weave into the scene: [${targetChunks}].
4. COPULA, GENDER & DIALECT ACCURACY:
   - Respect verb-specific adjective meanings (e.g. estar listo = "ready" vs. ser listo = "clever/smart"; estar loco = "acting crazy" vs. ser loco = "crazy").
   - Ensure full gender and plural agreement on all adjectives.
   ${
     pool.language === 'es'
       ? `- Default to Latin American Spanish${includeVosotros ? ' (with Peninsular vosotros enabled)' : ' (use "ustedes" for plural "you all"; NEVER use "vosotros" or "-áis/-éis/-ís" vosotros endings)'}.\n   - ALWAYS drop redundant subject pronouns (yo, tú, nosotros). Never write "¿tú estás en casa?" or "Sí, yo hablo". Write "¿Estás en casa?" and "¡Sí, estoy en casa!". Only use él/ella/usted/ustedes if needed to disambiguate.\n   - Ensure authentic question-and-answer reciprocity: when Speaker A asks in 2nd person ("¿Estás...?"), Speaker B responds in 1st person ("Sí, estoy..."). Never have both speakers ask and answer using the same person pronoun!\n   - Use proper Spanish inverted punctuation marks (¿...? and ¡...!).`
       : `- In French, always include mandatory subject pronouns (je, tu, il/elle/on, nous, vous, ils/elles) with proper elision (j', l', n').\n   - Ensure authentic question-and-answer reciprocity (when Speaker A asks "Tu es...?", Speaker B responds "Oui, je suis...").`
   }
${
  starterPreview
    ? `5. ANTI-DUPLICATION REQUIREMENT: Scene A opened with "${starterPreview}". Your new scene MUST take place in a completely different setting and follow a fresh plot (${themeHint})!`
    : `5. Plot direction: ${themeHint}.`
}
${
  variant === 'encore_remedial' && missedForms.length > 0
    ? `6. DIAGNOSTIC ENCORE REQUIREMENT: The student just missed these exact verb forms in the oral drill: [${missedFormsDesc}] and these chunks: [${missedChunksDesc}]. Your dialogue MUST naturally weave each missed form into the conversation (e.g. Speaker A prompts so Speaker B speaks the missed form, or vice versa). "diagnosticNotes" must give 1-3 crisp coaching tips explaining how the ear hears and remembers those exact missed forms!`
    : '6. Produce an authentic, lively 4-6 line dramatic or comedic scene between two friends that sounds like native speakers talking, NOT a robotic grammar textbook.'
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

function enrichChunkCardsFromPhraseLibrary(
  cards: CompanionChunkCard[],
  phraseLibrary: BufferedPhraseItem[]
): CompanionChunkCard[] {
  if (!phraseLibrary || phraseLibrary.length === 0) return cards;
  return cards.map((card) => {
    const matched = phraseLibrary.find((p) => p.chunkId === card.id);
    if (!matched) return card;
    return {
      ...card,
      exampleTarget: matched.targetSentence,
      exampleEnglish: matched.englishSentence,
    };
  });
}

/**
 * Generates or retrieves a CompanionLesson for a Sub-Module:
 * 1. Checks the recipe-hashed cache first (unless bypassCache is true).
 * 2. Checks the 3-Sub-Module Rolling Buffer (`rollingLessonBuffer.ts`) for pre-generated
 *    Scene B (`pass_2_consolidation`) or Encore Remix scenes so offline & remix clicks are instant and high quality.
 * 3. For baseline Scene A with a built-in starter dialogue (or when no BYOK API key is provided),
 *    uses the deterministic offline builder.
 * 4. When a BYOK Gemini key is configured, synthesizes a fresh scene constrained strictly to the
 *    unlocked grammar pool (and spotlighting any missedForms), falling back cleanly to the rolling buffer
 *    or offline builder if the network request fails.
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
    includeVosotros = false,
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
      const isStaleOfflineFallback =
        Boolean(geminiKey) && cached.generatedBy === 'offline_engine';
      const hasVosotrosInCache = cached.conjugationParadigms?.[0]?.forms?.some(
        (f) => f.person === 4
      );
      const vosotrosMismatch =
        language === 'es' &&
        Boolean(hasVosotrosInCache) !== Boolean(includeVosotros);

      if (!isStaleOfflineFallback && !vosotrosMismatch) {
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
    includeVosotros,
  });

  // 2. Check the Rolling 3-Sub-Module Prefetch Buffer (when no specific diagnostic missedForms require custom synthesis, or when offline)
  const bufferedMatch =
    missedForms.length === 0
      ? getBufferedSceneForLesson({
          language,
          subModuleId: pool.subModule.id,
          recipeHash: pool.recipeHash,
          variant,
          encoreIndex,
          includeVosotros,
        })
      : null;

  if (bufferedMatch) {
    const bufferedLesson: CompanionLesson = {
      ...baseLesson,
      generatedBy: 'rolling_buffer',
      sceneSetting: bufferedMatch.scene.sceneSetting || baseLesson.sceneSetting,
      dialogue: bufferedMatch.scene.dialogue,
      earNotes:
        bufferedMatch.scene.earNotes && bufferedMatch.scene.earNotes.length > 0
          ? bufferedMatch.scene.earNotes
          : baseLesson.earNotes,
      chunkCards: enrichChunkCardsFromPhraseLibrary(
        baseLesson.chunkCards,
        bufferedMatch.phraseLibrary
      ),
    };
    saveCachedCompanionLesson(bufferedLesson);
    return bufferedLesson;
  }

  // 3. If this is a baseline Scene A lesson with a hand-crafted starterDialogue, or if no Gemini key is set, return & cache immediately
  if (
    (variant === 'baseline' &&
      encoreIndex === 0 &&
      baseLesson.generatedBy === 'starter_builtin') ||
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
      missedChunks,
      includeVosotros
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
            temperature: 0.5,
          },
        }),
      }
    );

    if (!response.ok) {
      const fallbackWithReason: CompanionLesson = {
        ...baseLesson,
        aiFallbackReason: `Gemini HTTP ${response.status} — showing curated/offline lesson`,
      };
      saveCachedCompanionLesson(fallbackWithReason);
      return fallbackWithReason;
    }

    const data = await response.json();
    const rawText = stripJsonCodeFences(
      data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    );
    const parsed = JSON.parse(rawText);

    const validDialogue = sanitizeLLMDialogue(parsed?.dialogue);
    if (!validDialogue) {
      const fallbackWithReason: CompanionLesson = {
        ...baseLesson,
        aiFallbackReason: 'Invalid AI JSON structure — showing curated/offline lesson',
      };
      saveCachedCompanionLesson(fallbackWithReason);
      return fallbackWithReason;
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
          ? parsed.earNotes.filter(
              (n: unknown): n is string => typeof n === 'string'
            )
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
  } catch (err) {
    const fallbackWithReason: CompanionLesson = {
      ...baseLesson,
      aiFallbackReason:
        err instanceof Error
          ? `${err.message} — showing curated/offline lesson`
          : 'Network offline — showing curated/offline lesson',
    };
    saveCachedCompanionLesson(fallbackWithReason);
    return fallbackWithReason;
  }
}
