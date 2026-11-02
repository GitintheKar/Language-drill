export type LanguageCode = 'fr' | 'es';

/**
 * Canonical 6 grammatical persons used across Romance languages:
 * 0: 1st person singular (je / yo)
 * 1: 2nd person singular informal (tu / tú)
 * 2: 3rd person singular (il, elle, on / él, ella, usted)
 * 3: 1st person plural (nous / nosotros)
 * 4: 2nd person plural (vous / vosotros)
 * 5: 3rd person plural (ils, elles / ellos, ellas, ustedes)
 */
export type PersonIndex = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Rassias Negation Types:
 * - 'none': Affirmative
 * - 'pas': Standard negation (FR: ne ... pas / ES: no ...)
 * - 'jamais': Never (FR: ne ... jamais / ES: nunca ... / no ... nunca)
 * - 'plus': No longer / anymore (FR: ne ... plus / ES: ya no ...)
 */
export type NegationType = 'none' | 'pas' | 'jamais' | 'plus';

export type PolarityMode = 'affirmative' | 'negative' | 'ping_pong' | 'mixed';

export interface PronounDefinition {
  index: PersonIndex;
  /** Primary display label on drill cards, e.g. "je", "il / elle", "yo", "él / ella / usted" */
  display: string;
  /** Primary spoken pronoun used by the Virtual AT & expected in full-phrase speech */
  spokenPrimary: string;
  /** Alternative valid subject pronouns accepted by the evaluator */
  acceptedVariants: string[];
  /** Whether this pronoun is optional in Peninsular/LatAm dialect toggles (e.g. vosotros) */
  isVosotros?: boolean;
}

export type TenseCategory = 'core' | 'advanced';

export interface TenseConfig {
  id: string;
  name: string;
  englishName: string;
  category: TenseCategory;
  description: string;
  /**
   * Spoken Rassias Method trigger phrase (e.g., "Hier...", "Il faut que...", "Ayer...", "Es necesario que...")
   * that naturally cues the mouth into the target tense without dry grammar terminology.
   */
  rassiasTrigger: string;
  /** English hint for the Rassias trigger */
  rassiasTriggerEnglish: string;
  /** Whether this tense requires a subjunctive connector ("que" / "qu'") before the pronoun */
  usesSubjunctiveCue?: boolean;
  /** Whether this tense is an imperative command (no subject pronoun spoken) */
  isImperative?: boolean;
  /** Person indices valid for this tense (defaults to [0, 1, 2, 3, 4, 5], or [1, 3, 4] for French Imperative) */
  validPersons?: PersonIndex[];
}

export type CurriculumTier = 1 | 2 | 3 | 4 | 5;

export interface VerbEntry {
  id: string;
  infinitive: string;
  translation: string;
  tier: CurriculumTier;
  groupTag: string;
  isIrregular: boolean;
  notes?: string;
}

export interface ConjugationResult {
  language: LanguageCode;
  verbId: string;
  infinitive: string;
  tenseId: string;
  person: PersonIndex;
  negation: NegationType;
  /** The bare conjugated verb form (e.g. "parle", "n'ai pas parlé", "hablo", "no he hablado") */
  verbForm: string;
  /** The full natural phrase with pronoun & elision (e.g. "j'aime", "je n'aime pas", "yo no hablo") */
  fullForm: string;
  /** The full phrase including the Rassias trigger (e.g. "Il faut que j'aille", "Hier, tu n'as pas parlé") */
  triggeredPhrase: string;
  /** Accepted full/bare spoken forms for evaluation */
  acceptedForms: string[];
  /** Whether this prompt is an affirmative response to a negative French question requiring "Si !" */
  requiresFrenchSi?: boolean;
}

/**
 * Option C Toggle for Non-Verb Lexical Chunks in the spoken drill:
 * - 'two_part': 5-snap Non-Verb Chunk warmup first, followed by rapid bare/pronoun verb snaps
 * - 'full_sentence': Spoken responses during the verb drill include the attached sentence tail
 */
export type ChunkDrillMode = 'two_part' | 'full_sentence';

export type SubModuleCadencePreset =
  | 'substitution'
  | 'transformation'
  | 'qa_flip'
  | 'roulette';

export interface LexicalChunk {
  /** Stable identifier (e.g. 'es-en-casa', 'fr-en-retard') */
  id: string;
  /** Target-language spoken/written chunk (e.g. "en casa", "à la maison") */
  target: string;
  /** English meaning prompt (e.g. "at home") */
  english: string;
  /** Optional verb IDs this chunk naturally attaches to as a sentence tail */
  attachToVerbIds?: string[];
  /**
   * Optional verb-specific English meaning overrides when a chunk changes meaning
   * depending on the verb (e.g. Spanish "listo": { estar: "ready", ser: "clever" },
   * "loco": { estar: "acting crazy", ser: "crazy" }).
   */
  meaningByVerbId?: Record<string, string>;
  /** Optional flag indicating this chunk requires a plural subject (e.g. "juntos", "ensemble") */
  requiresPlural?: boolean;
}

export interface DialogueLine {
  speaker: 'A' | 'B';
  speakerName: string;
  target: string;
  english: string;
  audioTip?: string;
}

export interface SubModuleConfig {
  /** Stable semantic ID (survives array reordering) */
  id: string;
  /** Macro-phase number */
  phase: number;
  /** Macro-phase title */
  phaseTitle: string;
  /** Sub-module title */
  title: string;
  /** Delta: newly unlocked verb IDs at this step (empty when introducing a new tense on known verbs) */
  newVerbIds: string[];
  /** Delta: newly unlocked tense IDs at this step (empty when adding new verbs to known tenses) */
  newTenseIds: string[];
  /**
   * Optional subset of cumulative unlocked verbs to spotlight in this sub-module
   * (e.g. regular verbs first when introducing Preterite/Passé Composé, then irregulars next).
   */
  focusVerbIdsOverride?: string[];
  /**
   * Optional subset of cumulative unlocked tenses to spotlight in this sub-module
   * (e.g. contrasting Presente and Futuro Próximo in Transformation cadence).
   */
  focusTenseIdsOverride?: string[];
  /** Delta: newly introduced non-verb vocabulary chunks / sentence tails */
  newChunks: LexicalChunk[];
  /** Recommended Rassias drill cadence */
  recommendedCadence: SubModuleCadencePreset;
  /** Recommended polarity mode */
  recommendedPolarity: PolarityMode;
  /** Recommended reflex beat timer in seconds */
  recommendedTimerSeconds: number;
  /** Graded passes required at >= 80% before graduating (defaults to 2) */
  requiredPasses?: number;
  /** "How the Ear Hears It" sound/stress rule */
  earRule: string;
  /** Optional built-in baseline dialogue (Scene A) for immediate offline use */
  starterDialogue?: DialogueLine[];
  /** Optional built-in Pass 2 consolidation dialogue (Scene B) so offline Scene B is rich and distinct */
  consolidationDialogue?: DialogueLine[];
}

export interface LanguagePack {
  code: LanguageCode;
  name: string;
  nativeName: string;
  defaultLocale: string;
  availableLocales: { code: string; label: string }[];
  pronouns: PronounDefinition[];
  tenses: TenseConfig[];
  verbs: VerbEntry[];
  roadmap?: SubModuleConfig[];
  /** Whether the language naturally drops subject pronouns in everyday speech */
  isProDrop: boolean;
  conjugate: (
    verbId: string,
    tenseId: string,
    person: PersonIndex,
    negation?: NegationType
  ) => ConjugationResult;
  conjugateAllPersons: (
    verbId: string,
    tenseId: string,
    negation?: NegationType
  ) => ConjugationResult[];
}
