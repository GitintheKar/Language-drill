import { useCallback, useEffect, useState } from 'react';
import { getLanguagePack } from '../languages';
import {
  CurriculumTier,
  LanguageCode,
  PolarityMode,
  VerbEntry,
} from '../languages/types';
import { RassiasDrillCadence, VerbMasteryStats } from '../engine/drillDirector';
import { BYOKConfig, SpeechEngineType } from '../speech/types';

export interface AppSettings {
  language: LanguageCode;
  locales: Record<LanguageCode, string>;
  activeVerbIdsByLang: Record<LanguageCode, string[]>;
  activeTenseIdsByLang: Record<LanguageCode, string[]>;
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

function getDefaultSettings(): AppSettings {
  const frTier1 = getLanguagePack('fr')
    .verbs.filter((v) => v.tier === 1)
    .map((v) => v.id);
  const esTier1 = getLanguagePack('es')
    .verbs.filter((v) => v.tier === 1)
    .map((v) => v.id);

  return {
    language: 'fr',
    locales: {
      fr: 'fr-FR',
      es: 'es-ES',
    },
    activeVerbIdsByLang: {
      fr: frTier1,
      es: esTier1,
    },
    activeTenseIdsByLang: {
      fr: ['present', 'passe_compose', 'imparfait', 'futur_simple'],
      es: ['presente', 'preterito_indefinido', 'preterito_imperfecto', 'futuro_simple'],
    },
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

    const rawTimer = parsed.beatTimerSeconds;
    const beatTimerSeconds =
      typeof rawTimer === 'number' && Number.isFinite(rawTimer) && rawTimer >= 0
        ? rawTimer
        : defaults.beatTimerSeconds;

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

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(loadInitialSettings);
  const [masteryByLang, setMasteryByLang] = useState<MasteryByLanguage>(loadInitialMastery);

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
   * Manual Unlock Progression: Adds the next `count` (default 3) locked verbs in curriculum order
   * (Tier 1 -> Tier 2 -> Tier 3 -> Tier 4 -> Tier 5) for the active language.
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
      // Never allow 0 active verbs
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
      // Ensure at least the first Tier 1 verb stays active
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
    (lang: LanguageCode, updatedMap: Record<string, VerbMasteryStats>) => {
      setMasteryByLang((prev) => ({
        ...prev,
        [lang]: { ...updatedMap },
      }));
    },
    []
  );

  const currentLanguagePack = getLanguagePack(settings.language);
  const activeVerbIds = settings.activeVerbIdsByLang[settings.language];
  const activeTenseIds = settings.activeTenseIdsByLang[settings.language];
  const currentMastery = masteryByLang[settings.language];

  return {
    settings,
    currentLanguagePack,
    activeVerbIds,
    activeTenseIds,
    currentMastery,
    updateSettings,
    updateBYOKConfig,
    setLanguage,
    unlockNextVerbs,
    toggleVerb,
    toggleVerbTier,
    resetToTier1Verbs,
    toggleTense,
    selectTensePreset,
    syncLanguageMastery,
  };
}
