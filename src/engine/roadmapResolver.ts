import { getLanguagePack } from '../languages';
import {
  LanguageCode,
  LexicalChunk,
  PersonIndex,
  SubModuleConfig,
} from '../languages/types';

export interface ResolvedSubModulePool {
  language: LanguageCode;
  subModule: SubModuleConfig;
  /** 0-based position in the active roadmap array */
  index: number;
  /** Dynamic display code computed from current array order (e.g. "1.1", "1.2", "2.1") */
  displayCode: string;
  /** Number of graded passes (>= 80%) required to graduate to the next Sub-Module (default: 2) */
  requiredPasses: number;
  /**
   * Focus Pool (70% of drill prompts):
   * Newly unlocked items or explicitly spotlighted subset of cumulative items.
   */
  focusVerbIds: string[];
  focusTenseIds: string[];
  focusChunks: LexicalChunk[];
  /**
   * Review Pool (30% of drill prompts):
   * Union of all verbs, tenses, and chunks unlocked in prior Sub-Modules (0 .. index - 1).
   */
  reviewVerbIds: string[];
  reviewTenseIds: string[];
  reviewChunks: LexicalChunk[];
  /**
   * Cumulative Allowed Pool (0 .. index inclusive):
   * Strictly defines all verbs, tenses, and chunks the Companion/Encore Lesson Generator may use.
   */
  cumulativeVerbIds: string[];
  cumulativeTenseIds: string[];
  cumulativeChunks: LexicalChunk[];
  /**
   * Deterministic fingerprint of this Sub-Module's recipe and cumulative context.
   * Automatically changes whenever the Sub-Module's contents or array order is edited.
   */
  recipeHash: string;
}

export interface RoadmapAuditReport {
  language: LanguageCode;
  isValid: boolean;
  totalCatalogVerbs: number;
  totalCatalogTenses: number;
  coveredVerbIds: string[];
  missingVerbIds: string[];
  duplicateVerbIds: string[];
  unknownVerbIds: string[];
  coveredTenseIds: string[];
  missingTenseIds: string[];
  duplicateTenseIds: string[];
  unknownTenseIds: string[];
}

/**
 * Deterministic 32-bit FNV-1a hash formatted as an 8-character hex string.
 */
export function hashStringFNV1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function getRoadmapForLanguage(
  language: LanguageCode,
  customRoadmap?: SubModuleConfig[]
): SubModuleConfig[] {
  if (customRoadmap && customRoadmap.length > 0) {
    return customRoadmap;
  }
  const pack = getLanguagePack(language);
  return pack.roadmap ?? [];
}

/**
 * Computes dynamic human-facing numbering (e.g. "1.1", "1.2", "2.1") based on
 * the current order of the roadmap array so reordering two items automatically renumbers them.
 */
function computeDynamicDisplayCodes(roadmap: SubModuleConfig[]): string[] {
  const stepCountersByPhase: Record<number, number> = {};
  return roadmap.map((sm) => {
    const nextStep = (stepCountersByPhase[sm.phase] ?? 0) + 1;
    stepCountersByPhase[sm.phase] = nextStep;
    return `${sm.phase}.${nextStep}`;
  });
}

export function computeRecipeHash(
  subModule: SubModuleConfig,
  cumulativeVerbIds: string[],
  cumulativeTenseIds: string[]
): string {
  const payload = JSON.stringify({
    id: subModule.id,
    newVerbs: subModule.newVerbIds,
    newTenses: subModule.newTenseIds,
    focusVerbs: subModule.focusVerbIdsOverride ?? [],
    focusTenses: subModule.focusTenseIdsOverride ?? [],
    chunks: subModule.newChunks.map((c) => ({
      id: c.id,
      target: c.target,
      english: c.english,
      verbs: c.attachToVerbIds ?? [],
      meanings: c.meaningByVerbId ?? {},
    })),
    starterLen: subModule.starterDialogue?.length ?? 0,
    starterFirst: subModule.starterDialogue?.[0]?.target ?? '',
    consolLen: subModule.consolidationDialogue?.length ?? 0,
    cadence: subModule.recommendedCadence,
    polarity: subModule.recommendedPolarity,
    cumVerbs: cumulativeVerbIds,
    cumTenses: cumulativeTenseIds,
  });
  return hashStringFNV1a(payload);
}

/**
 * Resolves the Focus Pool, Review Pool, and Cumulative Allowed Pool for any Sub-Module
 * purely from the Delta declarations of the roadmap up to that Sub-Module's position.
 */
export function resolveSubModulePool(
  language: LanguageCode,
  subModuleIdOrIndex: string | number,
  customRoadmap?: SubModuleConfig[]
): ResolvedSubModulePool {
  const pack = getLanguagePack(language);
  const roadmap = getRoadmapForLanguage(language, customRoadmap);
  if (roadmap.length === 0) {
    throw new Error(`No roadmap configured for language: ${language}`);
  }

  const validVerbSet = new Set(pack.verbs.map((v) => v.id));
  const validTenseSet = new Set(pack.tenses.map((t) => t.id));

  let targetIndex = 0;
  if (typeof subModuleIdOrIndex === 'number') {
    targetIndex = Math.max(0, Math.min(roadmap.length - 1, subModuleIdOrIndex));
  } else {
    const foundIdx = roadmap.findIndex((sm) => sm.id === subModuleIdOrIndex);
    targetIndex = foundIdx >= 0 ? foundIdx : 0;
  }

  const displayCodes = computeDynamicDisplayCodes(roadmap);
  const targetSubModule = roadmap[targetIndex];

  const reviewVerbSet = new Set<string>();
  const reviewTenseSet = new Set<string>();
  const reviewChunkMap = new Map<string, LexicalChunk>();

  for (let i = 0; i < targetIndex; i++) {
    const prior = roadmap[i];
    for (const vId of prior.newVerbIds) {
      if (validVerbSet.has(vId)) reviewVerbSet.add(vId);
    }
    for (const tId of prior.newTenseIds) {
      if (validTenseSet.has(tId)) reviewTenseSet.add(tId);
    }
    for (const chunk of prior.newChunks) {
      reviewChunkMap.set(chunk.id, chunk);
    }
  }

  const reviewVerbIds = Array.from(reviewVerbSet);
  const reviewTenseIds = Array.from(reviewTenseSet);
  const reviewChunks = Array.from(reviewChunkMap.values());

  // Cumulative = Review (0 .. index-1) U Current Delta (index)
  const cumulativeVerbSet = new Set<string>(reviewVerbIds);
  for (const vId of targetSubModule.newVerbIds) {
    if (validVerbSet.has(vId)) cumulativeVerbSet.add(vId);
  }
  // Ensure at least the first Tier 1 verb is present even if Sub-Module 0 was edited to have empty newVerbIds
  if (cumulativeVerbSet.size === 0 && pack.verbs.length > 0) {
    cumulativeVerbSet.add(pack.verbs[0].id);
  }

  const cumulativeTenseSet = new Set<string>(reviewTenseIds);
  for (const tId of targetSubModule.newTenseIds) {
    if (validTenseSet.has(tId)) cumulativeTenseSet.add(tId);
  }
  // Ensure at least the primary Present tense is present even if Sub-Module 0 was edited to have empty newTenseIds
  if (cumulativeTenseSet.size === 0 && pack.tenses.length > 0) {
    cumulativeTenseSet.add(pack.tenses[0].id);
  }

  const cumulativeChunkMap = new Map<string, LexicalChunk>(reviewChunkMap);
  for (const chunk of targetSubModule.newChunks) {
    cumulativeChunkMap.set(chunk.id, chunk);
  }

  const cumulativeVerbIds = Array.from(cumulativeVerbSet);
  const cumulativeTenseIds = Array.from(cumulativeTenseSet);
  const cumulativeChunks = Array.from(cumulativeChunkMap.values());

  // Compute Focus Verbs (intersecting any override with cumulativeVerbSet so reordering never leaks locked future verbs!)
  const newValidVerbs = targetSubModule.newVerbIds.filter((id) =>
    cumulativeVerbSet.has(id)
  );
  let focusVerbIds: string[];
  if (
    targetSubModule.focusVerbIdsOverride &&
    targetSubModule.focusVerbIdsOverride.length > 0
  ) {
    const intersected = targetSubModule.focusVerbIdsOverride.filter((id) =>
      cumulativeVerbSet.has(id)
    );
    focusVerbIds =
      intersected.length > 0
        ? intersected
        : newValidVerbs.length > 0
        ? newValidVerbs
        : cumulativeVerbIds;
  } else if (newValidVerbs.length > 0) {
    focusVerbIds = newValidVerbs;
  } else {
    focusVerbIds = cumulativeVerbIds;
  }

  // Compute Focus Tenses (intersecting any override with cumulativeTenseSet so reordering never leaks locked future tenses!)
  const newValidTenses = targetSubModule.newTenseIds.filter((id) =>
    cumulativeTenseSet.has(id)
  );
  let focusTenseIds: string[];
  if (
    targetSubModule.focusTenseIdsOverride &&
    targetSubModule.focusTenseIdsOverride.length > 0
  ) {
    const intersected = targetSubModule.focusTenseIdsOverride.filter((id) =>
      cumulativeTenseSet.has(id)
    );
    focusTenseIds =
      intersected.length > 0
        ? intersected
        : newValidTenses.length > 0
        ? newValidTenses
        : cumulativeTenseIds;
  } else if (newValidTenses.length > 0) {
    focusTenseIds = newValidTenses;
  } else {
    focusTenseIds = cumulativeTenseIds;
  }

  const focusChunks =
    targetSubModule.newChunks.length > 0
      ? targetSubModule.newChunks
      : cumulativeChunks.slice(-4);

  const recipeHash = computeRecipeHash(
    targetSubModule,
    cumulativeVerbIds,
    cumulativeTenseIds
  );

  return {
    language,
    subModule: targetSubModule,
    index: targetIndex,
    displayCode: displayCodes[targetIndex],
    requiredPasses: targetSubModule.requiredPasses ?? 2,
    focusVerbIds,
    focusTenseIds,
    focusChunks,
    reviewVerbIds,
    reviewTenseIds,
    reviewChunks,
    cumulativeVerbIds,
    cumulativeTenseIds,
    cumulativeChunks,
    recipeHash,
  };
}

export function resolveAllSubModulePools(
  language: LanguageCode,
  customRoadmap?: SubModuleConfig[]
): ResolvedSubModulePool[] {
  const roadmap = getRoadmapForLanguage(language, customRoadmap);
  return roadmap.map((_, idx) =>
    resolveSubModulePool(language, idx, customRoadmap)
  );
}

/**
 * Finds the best matching Non-Verb LexicalChunk to attach as a sentence tail for a given verbId
 * within the resolved Sub-Module pool.
 */
export function pickChunkForVerb(
  verbId: string,
  pool: ResolvedSubModulePool,
  stepIndex = 0,
  person?: PersonIndex
): LexicalChunk | undefined {
  const isSingular =
    person !== undefined && (person === 0 || person === 1 || person === 2);
  const fitsNumber = (c: LexicalChunk) => !(isSingular && c.requiresPlural);

  // 1. Prefer a focus chunk explicitly tagged for this verbId
  const matchingFocus = pool.focusChunks.filter(
    (c) => c.attachToVerbIds?.includes(verbId) && fitsNumber(c)
  );
  if (matchingFocus.length > 0) {
    return matchingFocus[stepIndex % matchingFocus.length];
  }

  // 2. Otherwise check cumulative chunks explicitly tagged for this verbId
  const matchingCumulative = pool.cumulativeChunks.filter(
    (c) => c.attachToVerbIds?.includes(verbId) && fitsNumber(c)
  );
  if (matchingCumulative.length > 0) {
    return matchingCumulative[stepIndex % matchingCumulative.length];
  }

  // 3. Fallback to any focus chunk without strict verb restrictions
  const generalFocus = pool.focusChunks.filter(
    (c) =>
      (!c.attachToVerbIds || c.attachToVerbIds.length === 0) && fitsNumber(c)
  );
  if (generalFocus.length > 0) {
    return generalFocus[stepIndex % generalFocus.length];
  }

  return undefined;
}

/**
 * Audits a language's roadmap to verify that 100% of catalog verbs and tenses
 * are introduced across the Sub-Module deltas without orphans or duplicates.
 */
export function auditRoadmapCompleteness(
  language: LanguageCode,
  customRoadmap?: SubModuleConfig[]
): RoadmapAuditReport {
  const pack = getLanguagePack(language);
  const roadmap = getRoadmapForLanguage(language, customRoadmap);

  const catalogVerbIds = pack.verbs.map((v) => v.id);
  const catalogTenseIds = pack.tenses.map((t) => t.id);
  const catalogVerbSet = new Set(catalogVerbIds);
  const catalogTenseSet = new Set(catalogTenseIds);

  const seenVerbs = new Set<string>();
  const duplicateVerbs = new Set<string>();
  const unknownVerbs = new Set<string>();

  const seenTenses = new Set<string>();
  const duplicateTenses = new Set<string>();
  const unknownTenses = new Set<string>();

  for (const sm of roadmap) {
    for (const vId of sm.newVerbIds) {
      if (!catalogVerbSet.has(vId)) {
        unknownVerbs.add(vId);
      } else if (seenVerbs.has(vId)) {
        duplicateVerbs.add(vId);
      } else {
        seenVerbs.add(vId);
      }
    }

    for (const tId of sm.newTenseIds) {
      if (!catalogTenseSet.has(tId)) {
        unknownTenses.add(tId);
      } else if (seenTenses.has(tId)) {
        duplicateTenses.add(tId);
      } else {
        seenTenses.add(tId);
      }
    }
  }

  const missingVerbIds = catalogVerbIds.filter((id) => !seenVerbs.has(id));
  const missingTenseIds = catalogTenseIds.filter((id) => !seenTenses.has(id));

  const isValid =
    missingVerbIds.length === 0 &&
    duplicateVerbs.size === 0 &&
    unknownVerbs.size === 0 &&
    missingTenseIds.length === 0 &&
    duplicateTenses.size === 0 &&
    unknownTenses.size === 0;

  return {
    language,
    isValid,
    totalCatalogVerbs: catalogVerbIds.length,
    totalCatalogTenses: catalogTenseIds.length,
    coveredVerbIds: Array.from(seenVerbs),
    missingVerbIds,
    duplicateVerbIds: Array.from(duplicateVerbs),
    unknownVerbIds: Array.from(unknownVerbs),
    coveredTenseIds: Array.from(seenTenses),
    missingTenseIds,
    duplicateTenseIds: Array.from(duplicateTenses),
    unknownTenseIds: Array.from(unknownTenses),
  };
}
