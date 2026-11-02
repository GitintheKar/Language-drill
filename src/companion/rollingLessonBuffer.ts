import {
  getRoadmapForLanguage,
  ResolvedSubModulePool,
  resolveSubModulePool,
} from '../engine/roadmapResolver';
import { getLanguagePack } from '../languages';
import {
  DialogueLine,
  LanguageCode,
  SubModuleConfig,
} from '../languages/types';
import { BYOKConfig } from '../speech/types';
import { CompanionLessonVariant } from './lessonTypes';

const ROLLING_BUFFER_STORAGE_KEY = 'rassias_rolling_buffer_v1';

/**
 * Sliding window size: Active Sub-Module + Next 2 Sub-Modules (3 total).
 */
export const ROLLING_BUFFER_WINDOW_SIZE = 3;

export interface BufferedDialogueScene {
  sceneSetting: string;
  dialogue: DialogueLine[];
  earNotes?: string[];
}

export interface BufferedPhraseItem {
  verbId: string;
  chunkId?: string;
  targetSentence: string;
  englishSentence: string;
}

export interface BufferedSubModulePack {
  language: LanguageCode;
  subModuleId: string;
  recipeHash: string;
  includeVosotros: boolean;
  createdAt: number;
  /** Distinct Scene B for Pass 2/2 Consolidation */
  consolidationScene: BufferedDialogueScene;
  /** Pre-generated library of 3 distinct Encore Remix scenes for offline/instant use */
  encoreScenes: BufferedDialogueScene[];
  /** Validated contextual phrase library for focus verbs + chunks */
  phraseLibrary: BufferedPhraseItem[];
}

type RollingBufferMap = Record<string, BufferedSubModulePack>;

function makeBufferKey(language: LanguageCode, subModuleId: string): string {
  return `${language}:${subModuleId}`;
}

function loadRollingBufferMap(): RollingBufferMap {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(ROLLING_BUFFER_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as RollingBufferMap;
  } catch {
    return {};
  }
}

function saveRollingBufferMap(map: RollingBufferMap): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      ROLLING_BUFFER_STORAGE_KEY,
      JSON.stringify(map)
    );
  } catch {
    // Ignore quota errors
  }
}

/**
 * Returns the Sub-Module IDs inside the rolling prefetch window:
 * [activeSubModule, nextSubModule1, nextSubModule2].
 */
export function getRollingBufferWindowIds(
  language: LanguageCode,
  activeSubModuleId: string,
  customRoadmap?: SubModuleConfig[],
  windowSize = ROLLING_BUFFER_WINDOW_SIZE
): string[] {
  const roadmap = getRoadmapForLanguage(language, customRoadmap);
  if (roadmap.length === 0) return [];
  const startIdx = Math.max(
    0,
    roadmap.findIndex((sm) => sm.id === activeSubModuleId)
  );
  return roadmap
    .slice(startIdx, startIdx + windowSize)
    .map((sm) => sm.id);
}

/**
 * Evicts a single Sub-Module (e.g. upon graduating Pass 2/2) from the rolling buffer.
 */
export function evictSubModuleFromRollingBuffer(
  language: LanguageCode,
  subModuleId: string
): void {
  const map = loadRollingBufferMap();
  const key = makeBufferKey(language, subModuleId);
  if (key in map) {
    delete map[key];
    saveRollingBufferMap(map);
  }
}

/**
 * Prunes any buffered Sub-Modules for `language` that fall outside the active
 * sliding window (e.g. already-graduated Sub-Modules), preventing storage bloat.
 */
export function pruneRollingBufferOutsideWindow(
  language: LanguageCode,
  allowedSubModuleIds: string[]
): void {
  const allowedSet = new Set(allowedSubModuleIds);
  const map = loadRollingBufferMap();
  let mutated = false;

  for (const key of Object.keys(map)) {
    const entry = map[key];
    if (entry.language === language && !allowedSet.has(entry.subModuleId)) {
      delete map[key];
      mutated = true;
    }
  }

  if (mutated) {
    saveRollingBufferMap(map);
  }
}

export function clearRollingLessonBuffer(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(ROLLING_BUFFER_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

export function getRollingBufferStatus(
  language: LanguageCode,
  activeSubModuleId: string,
  customRoadmap?: SubModuleConfig[],
  includeVosotros = false
): {
  windowSubModuleIds: string[];
  bufferedSubModuleIds: string[];
  isCurrentBuffered: boolean;
} {
  const windowSubModuleIds = getRollingBufferWindowIds(
    language,
    activeSubModuleId,
    customRoadmap
  );
  const map = loadRollingBufferMap();
  const bufferedSubModuleIds = windowSubModuleIds.filter((smId) => {
    const pool = resolveSubModulePool(language, smId, customRoadmap);
    const entry = map[makeBufferKey(language, smId)];
    return (
      Boolean(entry) &&
      entry.recipeHash === pool.recipeHash &&
      Boolean(entry.includeVosotros) === Boolean(includeVosotros)
    );
  });

  return {
    windowSubModuleIds,
    bufferedSubModuleIds,
    isCurrentBuffered: bufferedSubModuleIds.includes(activeSubModuleId),
  };
}

export function getBufferedPackForSubModule(options: {
  language: LanguageCode;
  subModuleId: string;
  recipeHash: string;
  includeVosotros?: boolean;
}): BufferedSubModulePack | null {
  const {
    language,
    subModuleId,
    recipeHash,
    includeVosotros = false,
  } = options;
  const map = loadRollingBufferMap();
  const entry = map[makeBufferKey(language, subModuleId)];
  if (!entry) return null;
  if (entry.recipeHash !== recipeHash) return null;
  if (Boolean(entry.includeVosotros) !== Boolean(includeVosotros)) return null;
  return entry;
}

export function saveBufferedPackForSubModule(
  pack: BufferedSubModulePack
): void {
  const map = loadRollingBufferMap();
  map[makeBufferKey(pack.language, pack.subModuleId)] = pack;
  saveRollingBufferMap(map);
}

/**
 * Retrieves a pre-generated Scene B (`pass_2_consolidation`) or Encore Remix scene
 * from the local rolling buffer when available.
 */
export function getBufferedSceneForLesson(options: {
  language: LanguageCode;
  subModuleId: string;
  recipeHash: string;
  variant: CompanionLessonVariant;
  encoreIndex: number;
  includeVosotros?: boolean;
}): {
  scene: BufferedDialogueScene;
  phraseLibrary: BufferedPhraseItem[];
} | null {
  const {
    language,
    subModuleId,
    recipeHash,
    variant,
    encoreIndex,
    includeVosotros = false,
  } = options;

  const pack = getBufferedPackForSubModule({
    language,
    subModuleId,
    recipeHash,
    includeVosotros,
  });
  if (!pack) return null;

  if (variant === 'pass_2_consolidation' && encoreIndex === 0) {
    return {
      scene: pack.consolidationScene,
      phraseLibrary: pack.phraseLibrary,
    };
  }

  if (
    (encoreIndex > 0 || variant === 'encore_remedial') &&
    pack.encoreScenes.length > 0
  ) {
    const idx = Math.max(0, encoreIndex - 1) % pack.encoreScenes.length;
    return {
      scene: pack.encoreScenes[idx],
      phraseLibrary: pack.phraseLibrary,
    };
  }

  return null;
}

function stripJsonCodeFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function sanitizeDialogueLines(candidate: unknown): DialogueLine[] | null {
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

function sanitizeScene(candidate: unknown): BufferedDialogueScene | null {
  if (!candidate || typeof candidate !== 'object') return null;
  const obj = candidate as Record<string, unknown>;
  const dialogue = sanitizeDialogueLines(obj.dialogue);
  if (!dialogue) return null;
  const sceneSetting =
    typeof obj.sceneSetting === 'string' && obj.sceneSetting.trim()
      ? obj.sceneSetting.trim()
      : '';
  const earNotes = Array.isArray(obj.earNotes)
    ? obj.earNotes.filter((n): n is string => typeof n === 'string')
    : undefined;
  return {
    sceneSetting,
    dialogue,
    earNotes,
  };
}

export function buildRollingBufferPromptForLLM(
  pool: ResolvedSubModulePool,
  includeVosotros = false
): string {
  const pack = getLanguagePack(pool.language);
  const langName =
    pool.language === 'fr' ? 'French' : 'Spanish (Latin America)';
  const speakerA = pool.language === 'fr' ? 'Luc' : 'Mateo';
  const speakerB = pool.language === 'fr' ? 'Camille' : 'Sofía';

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

  return `You are building an offline-ready Dartmouth Rassias Method Lesson Pack in ${langName} for Sub-Module ${pool.displayCode}: "${pool.subModule.title}".

STRICT LINGUISTIC & PEDAGOGICAL GUARDRAILS:
1. Allowed Tenses ONLY: [${allowedTenses}]. NEVER use any tense outside this list.
2. Focus Verbs: [${focusVerbs}]. Allowed cumulative review verbs: [${cumulativeVerbs}].
3. Target Lexical Chunks: [${targetChunks}].
4. COPULA & ADJECTIVE ACCURACY:
   - Respect ser vs. estar contrasts (e.g. estar listo = "to be ready" vs. ser listo = "to be clever/smart"; estar loco = "acting crazy" vs. ser loco = "crazy").
   - Ensure full gender and plural agreement on adjectives (${speakerB} is female singular -> cansada, lista; ${speakerA} is male singular -> cansado, listo; plural -> cansados, listos).
   ${
     pool.language === 'es'
       ? `- Use Latin American Spanish${includeVosotros ? ' (with vosotros)' : ' (use "ustedes" for plural "you all"; NEVER use "vosotros" or "-áis/-éis/-ís" endings)'}. Drop redundant subject pronouns (yo, tú, nosotros).`
       : `- Use natural spoken French with mandatory pronouns and proper elision (j', n', l').`
   }
5. SCENE VARIETY:
   - "consolidationScene" (Scene B) and the 3 "encoreScenes" MUST each take place in a DIFFERENT setting and have completely different conversational lines from one another.

Return ONLY a valid JSON object matching this exact structure:
{
  "consolidationScene": {
    "sceneSetting": "Distinct setting for Pass 2 Scene B",
    "dialogue": [
      { "speaker": "A", "speakerName": "${speakerA}", "target": "...", "english": "...", "audioTip": "..." },
      { "speaker": "B", "speakerName": "${speakerB}", "target": "...", "english": "..." }
    ],
    "earNotes": ["1-2 concise sound/stress tips"]
  },
  "encoreScenes": [
    {
      "sceneSetting": "Distinct Encore Remix Scene #1 setting",
      "dialogue": [
        { "speaker": "A", "speakerName": "${speakerA}", "target": "...", "english": "..." },
        { "speaker": "B", "speakerName": "${speakerB}", "target": "...", "english": "..." }
      ],
      "earNotes": ["1 concise sound tip"]
    },
    {
      "sceneSetting": "Distinct Encore Remix Scene #2 setting",
      "dialogue": [
        { "speaker": "A", "speakerName": "${speakerA}", "target": "...", "english": "..." },
        { "speaker": "B", "speakerName": "${speakerB}", "target": "...", "english": "..." }
      ],
      "earNotes": ["1 concise sound tip"]
    },
    {
      "sceneSetting": "Distinct Encore Remix Scene #3 setting",
      "dialogue": [
        { "speaker": "A", "speakerName": "${speakerA}", "target": "...", "english": "..." },
        { "speaker": "B", "speakerName": "${speakerB}", "target": "...", "english": "..." }
      ],
      "earNotes": ["1 concise sound tip"]
    }
  ],
  "phraseLibrary": [
    {
      "verbId": "${pool.focusVerbIds[0] ?? ''}",
      "chunkId": "${pool.focusChunks[0]?.id ?? ''}",
      "targetSentence": "Natural example sentence in ${langName}",
      "englishSentence": "Natural English translation"
    }
  ]
}`;
}

export async function prefetchSubModulePackWithGemini(options: {
  pool: ResolvedSubModulePool;
  byokConfig: BYOKConfig;
  includeVosotros?: boolean;
}): Promise<BufferedSubModulePack | null> {
  const { pool, byokConfig, includeVosotros = false } = options;
  const geminiKey = byokConfig.geminiApiKey?.trim() ?? '';
  if (!geminiKey || typeof fetch !== 'function') return null;

  try {
    const model = byokConfig.geminiModel || 'gemini-2.5-flash';
    const prompt = buildRollingBufferPromptForLLM(pool, includeVosotros);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.45,
          },
        }),
      }
    );

    if (!response.ok) return null;
    const data = await response.json();
    const rawText = stripJsonCodeFences(
      data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    );
    const parsed = JSON.parse(rawText);

    const consolidationScene = sanitizeScene(parsed?.consolidationScene);
    const rawEncores = Array.isArray(parsed?.encoreScenes)
      ? parsed.encoreScenes
      : [];
    const encoreScenes = rawEncores
      .map((s: unknown) => sanitizeScene(s))
      .filter((s: BufferedDialogueScene | null): s is BufferedDialogueScene =>
        Boolean(s)
      );

    if (!consolidationScene || encoreScenes.length === 0) {
      return null;
    }

    const phraseLibrary: BufferedPhraseItem[] = Array.isArray(
      parsed?.phraseLibrary
    )
      ? parsed.phraseLibrary
          .filter(
            (p: unknown): p is Record<string, unknown> =>
              Boolean(p) && typeof p === 'object'
          )
          .map((p: Record<string, unknown>) => ({
            verbId: typeof p.verbId === 'string' ? p.verbId : '',
            chunkId: typeof p.chunkId === 'string' ? p.chunkId : undefined,
            targetSentence:
              typeof p.targetSentence === 'string'
                ? p.targetSentence.trim()
                : '',
            englishSentence:
              typeof p.englishSentence === 'string'
                ? p.englishSentence.trim()
                : '',
          }))
          .filter(
            (p: BufferedPhraseItem) =>
              Boolean(p.targetSentence) && Boolean(p.englishSentence)
          )
      : [];

    const pack: BufferedSubModulePack = {
      language: pool.language,
      subModuleId: pool.subModule.id,
      recipeHash: pool.recipeHash,
      includeVosotros,
      createdAt: Date.now(),
      consolidationScene,
      encoreScenes,
      phraseLibrary,
    };

    saveBufferedPackForSubModule(pack);
    return pack;
  } catch {
    return null;
  }
}

/**
 * Synchronizes the 3-Sub-Module Rolling Buffer (`Current + Next 2`):
 * 1. Evicts any Sub-Modules outside the `[current, next1, next2]` window so storage never bloats.
 * 2. When online with a BYOK Gemini API key, prefetches any unbuffered Sub-Module in the window.
 */
export async function syncRollingLessonBuffer(options: {
  language: LanguageCode;
  activeSubModuleId: string;
  byokConfig?: BYOKConfig;
  customRoadmap?: SubModuleConfig[];
  includeVosotros?: boolean;
}): Promise<{
  windowIds: string[];
  prefetchedIds: string[];
}> {
  const {
    language,
    activeSubModuleId,
    byokConfig,
    customRoadmap,
    includeVosotros = false,
  } = options;

  const windowIds = getRollingBufferWindowIds(
    language,
    activeSubModuleId,
    customRoadmap,
    ROLLING_BUFFER_WINDOW_SIZE
  );

  // 1. Always prune out-of-window (graduated) Sub-Modules first
  pruneRollingBufferOutsideWindow(language, windowIds);

  const geminiKey = byokConfig?.geminiApiKey?.trim() ?? '';
  if (!geminiKey || !byokConfig) {
    return { windowIds, prefetchedIds: [] };
  }

  const prefetchedIds: string[] = [];
  for (const smId of windowIds) {
    const pool = resolveSubModulePool(language, smId, customRoadmap);
    const existing = getBufferedPackForSubModule({
      language,
      subModuleId: smId,
      recipeHash: pool.recipeHash,
      includeVosotros,
    });
    if (existing) continue;

    const fetched = await prefetchSubModulePackWithGemini({
      pool,
      byokConfig,
      includeVosotros,
    });
    if (fetched) {
      prefetchedIds.push(smId);
    }
  }

  return { windowIds, prefetchedIds };
}
