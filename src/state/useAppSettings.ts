import { useCallback, useEffect, useState } from 'react';
import { getLanguagePack } from '../languages';
import {
  ChunkDrillMode,
  CurriculumTier,
  LanguageCode,
  PolarityMode,
  VerbEntry,
} from '../languages/types';
import {
  PairMasteryStats,
  RassiasDrillCadence,
  StragglerItem,
  SubModuleCheckReport,
  VerbMasteryStats,
} from '../engine/drillDirector';
import {
  getRoadmapForLanguage,
  resolveSubModulePool,
} from '../engine/roadmapResolver';
import { BYOKConfig, SpeechEngineType } from '../speech/types';

export interface SubModuleProgressStats {
  subModuleId: string;
  passesCompleted: number;
  requiredPasses: number;
  graduated: boolean;
  bestAccuracyPct: number;
  encoreCount: number;
  lastAttemptedAt: number;
}

export interface AppSettings {
  language: LanguageCode;
  locales: Record<LanguageCode, string>;
  activeVerbIdsByLang: Record<LanguageCode, string[]>;
  activeTenseIdsByLang: Record<LanguageCode, string[]>;
  /** When true, follows the progressive Sub-Module Roadmap (70% Focus / 30% Review) */
  courseModeEnabled: boolean;
  /** Currently active Sub-Module ID per language */
  activeSubModuleIdByLang: Record<LanguageCode, string>;
  /** Option C Toggle: 'two_part' (5-snap Chunk Warmup + Verb Snaps) vs 'full_sentence' (Spoken Sentence Tails) */
  chunkDrillMode: ChunkDrillMode;
  cadence: RassiasDrillCadence;
  polarityMode: PolarityMode;
  enableNegativeAdverbs: boolean;
  handsFreeMode: boolean;
  quietVisualOnlyMode: boolean;
  useNaturalTriggers: boolean;
  hideWrittenPromptUntilSnap: boolean;
  beatTimerSeconds: number; // 0 = timer disabled
  includeVosotros: boolean;
  spanishPronounMode: 'pro_drop' | 'disambiguate';
  speechEngine: SpeechEngineType;
  byokConfig: BYOKConfig;
}

const SETTINGS_STORAGE_KEY = 'rassias_app_settings_v1';
const MASTERY_STORAGE_KEY = 'rassias_mastery_stats_v1';
const PAIR_MASTERY_STORAGE_KEY = 'rassias_pair_mastery_v1';
const SUBMODULE_PROGRESS_STORAGE_KEY = 'rassias_submodule_progress_v1';
const STRAGGLERS_STORAGE_KEY = 'rassias_stragglers_v1';

function getDefaultSettings(): AppSettings {
  const frDay1 = resolveSubModulePool('fr', 'fr-1.1');
  const esDay1 = resolveSubModulePool('es', 'es-1.1');

  return {
    language: 'fr',
    locales: {
      fr: 'fr-FR',
      es: 'es-ES',
    },
    activeVerbIdsByLang: {
      fr: frDay1.focusVerbIds,
      es: esDay1.focusVerbIds,
    },
    activeTenseIdsByLang: {
      fr: frDay1.focusTenseIds,
      es: esDay1.focusTenseIds,
    },
    courseModeEnabled: true,
    activeSubModuleIdByLang: {
      fr: 'fr-1.1',
      es: 'es-1.1',
    },
    chunkDrillMode: 'two_part',
    cadence: 'substitution',
    polarityMode: 'affirmative',
    enableNegativeAdverbs: true,
    handsFreeMode: true,
    quietVisualOnlyMode: false,
    useNaturalTriggers: true,
    hideWrittenPromptUntilSnap: false,
    beatTimerSeconds: 4,
    includeVosotros: false,
    spanishPronounMode: 'pro_drop',
    speechEngine: 'web_speech',
    byokConfig: {
      provider: 'gemini',
      geminiApiKey: '',
      openaiApiKey: '',
      geminiModel: 'gemini-2.5-flash',
    },
  };
}

export function loadInitialSettings(): AppSettings {
  const defaults = getDefaultSettings();
  if (typeof window === 'undefined' || !window.localStorage) return defaults;
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return defaults;

    const language: LanguageCode =
      parsed.language === 'fr' || parsed.language === 'es'
        ? parsed.language
        : defaults.language;

    const sanitizeVerbList = (lang: LanguageCode, candidate: unknown): string[] => {
      if (!Array.isArray(candidate)) return defaults.activeVerbIdsByLang[lang];
      const validSet = new Set(getLanguagePack(lang).verbs.map((v) => v.id));
      const filtered = candidate.filter(
        (id): id is string => typeof id === 'string' && validSet.has(id)
      );
      return filtered.length > 0 ? filtered : defaults.activeVerbIdsByLang[lang];
    };

    const sanitizeTenseList = (lang: LanguageCode, candidate: unknown): string[] => {
      if (!Array.isArray(candidate)) return defaults.activeTenseIdsByLang[lang];
      const validSet = new Set(getLanguagePack(lang).tenses.map((t) => t.id));
      const filtered = candidate.filter(
        (id): id is string => typeof id === 'string' && validSet.has(id)
      );
      return filtered.length > 0 ? filtered : defaults.activeTenseIdsByLang[lang];
    };

    const sanitizeSubModuleId = (lang: LanguageCode, candidate: unknown): string => {
      if (typeof candidate !== 'string') return defaults.activeSubModuleIdByLang[lang];
      const roadmap = getRoadmapForLanguage(lang);
      return roadmap.some((sm) => sm.id === candidate)
        ? candidate
        : defaults.activeSubModuleIdByLang[lang];
    };

    const rawTimer = parsed.beatTimerSeconds;
    const beatTimerSeconds =
      typeof rawTimer === 'number' && Number.isFinite(rawTimer) && rawTimer >= 0
        ? rawTimer
        : defaults.beatTimerSeconds;

    const chunkDrillMode: ChunkDrillMode =
      parsed.chunkDrillMode === 'full_sentence' || parsed.chunkDrillMode === 'two_part'
        ? parsed.chunkDrillMode
        : defaults.chunkDrillMode;

    const courseModeEnabled =
      typeof parsed.courseModeEnabled === 'boolean'
        ? parsed.courseModeEnabled
        : defaults.courseModeEnabled;

    const rawLocales =
      parsed.locales && typeof parsed.locales === 'object' ? parsed.locales : {};
    const rawByok =
      parsed.byokConfig && typeof parsed.byokConfig === 'object'
        ? parsed.byokConfig
        : {};

    return {
      ...defaults,
      ...parsed,
      language,
      beatTimerSeconds,
      chunkDrillMode,
      courseModeEnabled,
      locales: {
        fr: typeof rawLocales.fr === 'string' ? rawLocales.fr : defaults.locales.fr,
        es: typeof rawLocales.es === 'string' ? rawLocales.es : defaults.locales.es,
      },
      activeVerbIdsByLang: {
        fr: sanitizeVerbList('fr', parsed.activeVerbIdsByLang?.fr),
        es: sanitizeVerbList('es', parsed.activeVerbIdsByLang?.es),
      },
      activeTenseIdsByLang: {
        fr: sanitizeTenseList('fr', parsed.activeTenseIdsByLang?.fr),
        es: sanitizeTenseList('es', parsed.activeTenseIdsByLang?.es),
      },
      activeSubModuleIdByLang: {
        fr: sanitizeSubModuleId('fr', parsed.activeSubModuleIdByLang?.fr),
        es: sanitizeSubModuleId('es', parsed.activeSubModuleIdByLang?.es),
      },
      byokConfig: {
        provider:
          rawByok.provider === 'openai' || rawByok.provider === 'gemini'
            ? rawByok.provider
            : defaults.byokConfig.provider,
        geminiApiKey:
          typeof rawByok.geminiApiKey === 'string' ? rawByok.geminiApiKey : '',
        openaiApiKey:
          typeof rawByok.openaiApiKey === 'string' ? rawByok.openaiApiKey : '',
        geminiModel:
          typeof rawByok.geminiModel === 'string' && rawByok.geminiModel
            ? rawByok.geminiModel
            : defaults.byokConfig.geminiModel,
      },
    };
  } catch {
    return defaults;
  }
}

export type MasteryByLanguage = Record<LanguageCode, Record<string, VerbMasteryStats>>;
export type PairMasteryByLanguage = Record<LanguageCode, Record<string, PairMasteryStats>>;
export type SubModuleProgressByLanguage = Record<
  LanguageCode,
  Record<string, SubModuleProgressStats>
>;
export type StragglersByLanguage = Record<LanguageCode, StragglerItem[]>;

export function loadInitialMastery(): MasteryByLanguage {
  if (typeof window === 'undefined' || !window.localStorage) return { fr: {}, es: {} };
  try {
    const raw = window.localStorage.getItem(MASTERY_STORAGE_KEY);
    if (!raw) return { fr: {}, es: {} };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { fr: {}, es: {} };
    return {
      fr: parsed.fr && typeof parsed.fr === 'object' ? parsed.fr : {},
      es: parsed.es && typeof parsed.es === 'object' ? parsed.es : {},
    };
  } catch {
    return { fr: {}, es: {} };
  }
}

export function loadInitialPairMastery(): PairMasteryByLanguage {
  if (typeof window === 'undefined' || !window.localStorage) return { fr: {}, es: {} };
  try {
    const raw = window.localStorage.getItem(PAIR_MASTERY_STORAGE_KEY);
    if (!raw) return { fr: {}, es: {} };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { fr: {}, es: {} };
    return {
      fr: parsed.fr && typeof parsed.fr === 'object' ? parsed.fr : {},
      es: parsed.es && typeof parsed.es === 'object' ? parsed.es : {},
    };
  } catch {
    return { fr: {}, es: {} };
  }
}

export function loadInitialSubModuleProgress(): SubModuleProgressByLanguage {
  if (typeof window === 'undefined' || !window.localStorage) return { fr: {}, es: {} };
  try {
    const raw = window.localStorage.getItem(SUBMODULE_PROGRESS_STORAGE_KEY);
    if (!raw) return { fr: {}, es: {} };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { fr: {}, es: {} };
    return {
      fr: parsed.fr && typeof parsed.fr === 'object' ? parsed.fr : {},
      es: parsed.es && typeof parsed.es === 'object' ? parsed.es : {},
    };
  } catch {
    return { fr: {}, es: {} };
  }
}

export function loadInitialStragglers(): StragglersByLanguage {
  if (typeof window === 'undefined' || !window.localStorage) return { fr: [], es: [] };
  try {
    const raw = window.localStorage.getItem(STRAGGLERS_STORAGE_KEY);
    if (!raw) return { fr: [], es: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { fr: [], es: [] };
    return {
      fr: Array.isArray(parsed.fr) ? parsed.fr : [],
      es: Array.isArray(parsed.es) ? parsed.es : [],
    };
  } catch {
    return { fr: [], es: [] };
  }
}

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(loadInitialSettings);
  const [masteryByLang, setMasteryByLang] = useState<MasteryByLanguage>(loadInitialMastery);
  const [pairMasteryByLang, setPairMasteryByLang] =
    useState<PairMasteryByLanguage>(loadInitialPairMastery);
  const [subModuleProgressByLang, setSubModuleProgressByLang] =
    useState<SubModuleProgressByLanguage>(loadInitialSubModuleProgress);
  const [stragglersByLang, setStragglersByLang] =
    useState<StragglersByLanguage>(loadInitialStragglers);

  useEffect(() => {
    try {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore quota errors
    }
  }, [settings]);

  useEffect(() => {
    try {
      window.localStorage.setItem(MASTERY_STORAGE_KEY, JSON.stringify(masteryByLang));
    } catch {
      // Ignore quota errors
    }
  }, [masteryByLang]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        PAIR_MASTERY_STORAGE_KEY,
        JSON.stringify(pairMasteryByLang)
      );
    } catch {
      // Ignore quota errors
    }
  }, [pairMasteryByLang]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SUBMODULE_PROGRESS_STORAGE_KEY,
        JSON.stringify(subModuleProgressByLang)
      );
    } catch {
      // Ignore quota errors
    }
  }, [subModuleProgressByLang]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STRAGGLERS_STORAGE_KEY,
        JSON.stringify(stragglersByLang)
      );
    } catch {
      // Ignore quota errors
    }
  }, [stragglersByLang]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateBYOKConfig = useCallback((patch: Partial<BYOKConfig>) => {
    setSettings((prev) => ({
      ...prev,
      byokConfig: { ...prev.byokConfig, ...patch },
    }));
  }, []);

  const setLanguage = useCallback((language: LanguageCode) => {
    setSettings((prev) => ({ ...prev, language }));
  }, []);

  /**
   * Selects a Course Sub-Module and configures active verbs, tenses, cadence, polarity, and timer.
   */
  const selectSubModule = useCallback(
    (subModuleId: string, langOverride?: LanguageCode) => {
      setSettings((prev) => {
        const lang = langOverride ?? prev.language;
        const pool = resolveSubModulePool(lang, subModuleId);
        return {
          ...prev,
          language: lang,
          courseModeEnabled: true,
          activeSubModuleIdByLang: {
            ...prev.activeSubModuleIdByLang,
            [lang]: pool.subModule.id,
          },
          activeVerbIdsByLang: {
            ...prev.activeVerbIdsByLang,
            [lang]: pool.cumulativeVerbIds,
          },
          activeTenseIdsByLang: {
            ...prev.activeTenseIdsByLang,
            [lang]: pool.cumulativeTenseIds,
          },
          cadence: pool.subModule.recommendedCadence,
          polarityMode: pool.subModule.recommendedPolarity,
          beatTimerSeconds: pool.subModule.recommendedTimerSeconds,
        };
      });
    },
    []
  );

  /**
   * Records a completed 15-snap Sub-Module Check and updates 2-Pass graduation state.
   */
  const recordSubModuleCheckResult = useCallback(
    (
      lang: LanguageCode,
      report: SubModuleCheckReport,
      updatedPairMastery?: Record<string, PairMasteryStats>,
      updatedStragglers?: StragglerItem[]
    ) => {
      if (updatedPairMastery) {
        setPairMasteryByLang((prev) => ({
          ...prev,
          [lang]: { ...updatedPairMastery },
        }));
      }
      if (updatedStragglers) {
        setStragglersByLang((prev) => ({
          ...prev,
          [lang]: [...updatedStragglers],
        }));
      }

      setSubModuleProgressByLang((prev) => {
        const langMap = prev[lang] ?? {};
        const existing = langMap[report.subModuleId] ?? {
          subModuleId: report.subModuleId,
          passesCompleted: 0,
          requiredPasses: report.requiredPasses,
          graduated: false,
          bestAccuracyPct: 0,
          encoreCount: 0,
          lastAttemptedAt: 0,
        };

        const graduated =
          existing.graduated ||
          report.outcome === 'graduated_clean' ||
          report.outcome === 'graduated_with_stragglers';

        const nextEntry: SubModuleProgressStats = {
          subModuleId: report.subModuleId,
          passesCompleted: Math.max(
            existing.passesCompleted,
            report.newPassesCompleted
          ),
          requiredPasses: report.requiredPasses,
          graduated,
          bestAccuracyPct: Math.max(
            existing.bestAccuracyPct,
            report.firstTryAccuracyPct
          ),
          encoreCount:
            report.outcome === 'encore_required'
              ? existing.encoreCount + 1
              : existing.encoreCount,
          lastAttemptedAt: Date.now(),
        };

        return {
          ...prev,
          [lang]: {
            ...langMap,
            [report.subModuleId]: nextEntry,
          },
        };
      });
    },
    []
  );

  /**
   * Manual Unlock Progression: Adds the next `count` (default 3) locked verbs in curriculum order.
   */
  const unlockNextVerbs = useCallback(
    (count = 3): VerbEntry[] => {
      const pack = getLanguagePack(settings.language);
      const currentActive = new Set(settings.activeVerbIdsByLang[settings.language]);
      const lockedVerbs = pack.verbs.filter((v) => !currentActive.has(v.id));
      const toAdd = lockedVerbs.slice(0, count);

      if (toAdd.length === 0) return [];

      setSettings((prev) => {
        const lang = prev.language;
        const nextIds = Array.from(
          new Set([...prev.activeVerbIdsByLang[lang], ...toAdd.map((v) => v.id)])
        );
        return {
          ...prev,
          activeVerbIdsByLang: {
            ...prev.activeVerbIdsByLang,
            [lang]: nextIds,
          },
        };
      });

      return toAdd;
    },
    [settings.language, settings.activeVerbIdsByLang]
  );

  const toggleVerb = useCallback((verbId: string) => {
    setSettings((prev) => {
      const lang = prev.language;
      const current = prev.activeVerbIdsByLang[lang];
      const exists = current.includes(verbId);
      if (exists && current.length <= 1) return prev;
      const next = exists ? current.filter((id) => id !== verbId) : [...current, verbId];
      return {
        ...prev,
        activeVerbIdsByLang: {
          ...prev.activeVerbIdsByLang,
          [lang]: next,
        },
      };
    });
  }, []);

  const toggleVerbTier = useCallback((tier: CurriculumTier, enable: boolean) => {
    setSettings((prev) => {
      const lang = prev.language;
      const pack = getLanguagePack(lang);
      const tierVerbIds = pack.verbs.filter((v) => v.tier === tier).map((v) => v.id);
      const current = new Set(prev.activeVerbIdsByLang[lang]);

      if (enable) {
        tierVerbIds.forEach((id) => current.add(id));
      } else {
        tierVerbIds.forEach((id) => current.delete(id));
      }

      const next = Array.from(current);
      const safeNext = next.length > 0 ? next : [pack.verbs[0].id];

      return {
        ...prev,
        activeVerbIdsByLang: {
          ...prev.activeVerbIdsByLang,
          [lang]: safeNext,
        },
      };
    });
  }, []);

  const resetToTier1Verbs = useCallback(() => {
    setSettings((prev) => {
      const lang = prev.language;
      const tier1Ids = getLanguagePack(lang)
        .verbs.filter((v) => v.tier === 1)
        .map((v) => v.id);
      return {
        ...prev,
        activeVerbIdsByLang: {
          ...prev.activeVerbIdsByLang,
          [lang]: tier1Ids,
        },
      };
    });
  }, []);

  const toggleTense = useCallback((tenseId: string) => {
    setSettings((prev) => {
      const lang = prev.language;
      const current = prev.activeTenseIdsByLang[lang];
      const exists = current.includes(tenseId);
      if (exists && current.length <= 1) return prev;
      const next = exists ? current.filter((id) => id !== tenseId) : [...current, tenseId];
      return {
        ...prev,
        activeTenseIdsByLang: {
          ...prev.activeTenseIdsByLang,
          [lang]: next,
        },
      };
    });
  }, []);

  const selectTensePreset = useCallback((preset: 'starter' | 'core' | 'comprehensive') => {
    setSettings((prev) => {
      const lang = prev.language;
      const pack = getLanguagePack(lang);
      let nextIds: string[];
      if (preset === 'starter') {
        nextIds = pack.tenses.slice(0, 2).map((t) => t.id);
      } else if (preset === 'core') {
        nextIds = pack.tenses.filter((t) => t.category === 'core').map((t) => t.id);
      } else {
        nextIds = pack.tenses.map((t) => t.id);
      }
      return {
        ...prev,
        activeTenseIdsByLang: {
          ...prev.activeTenseIdsByLang,
          [lang]: nextIds,
        },
      };
    });
  }, []);

  const syncLanguageMastery = useCallback(
    (
      lang: LanguageCode,
      updatedMap: Record<string, VerbMasteryStats>,
      updatedPairMap?: Record<string, PairMasteryStats>,
      updatedStragglers?: StragglerItem[]
    ) => {
      setMasteryByLang((prev) => ({
        ...prev,
        [lang]: { ...updatedMap },
      }));
      if (updatedPairMap) {
        setPairMasteryByLang((prev) => ({
          ...prev,
          [lang]: { ...updatedPairMap },
        }));
      }
      if (updatedStragglers) {
        setStragglersByLang((prev) => ({
          ...prev,
          [lang]: [...updatedStragglers],
        }));
      }
    },
    []
  );

  const currentLanguagePack = getLanguagePack(settings.language);
  const activeVerbIds = settings.activeVerbIdsByLang[settings.language];
  const activeTenseIds = settings.activeTenseIdsByLang[settings.language];
  const activeSubModuleId = settings.activeSubModuleIdByLang[settings.language];
  const currentMastery = masteryByLang[settings.language];
  const currentPairMastery = pairMasteryByLang[settings.language];
  const currentSubModuleProgress = subModuleProgressByLang[settings.language];
  const currentStragglers = stragglersByLang[settings.language];

  return {
    settings,
    currentLanguagePack,
    activeVerbIds,
    activeTenseIds,
    activeSubModuleId,
    currentMastery,
    currentPairMastery,
    currentSubModuleProgress,
    currentStragglers,
    updateSettings,
    updateBYOKConfig,
    setLanguage,
    selectSubModule,
    recordSubModuleCheckResult,
    unlockNextVerbs,
    toggleVerb,
    toggleVerbTier,
    resetToTier1Verbs,
    toggleTense,
    selectTensePreset,
    syncLanguageMastery,
  };
}
