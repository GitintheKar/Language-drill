import {
  MissedVerbFormItem,
  RassiasDrillCadence,
} from '../engine/drillDirector';
import {
  DialogueLine,
  LanguageCode,
  LexicalChunk,
  PersonIndex,
  PolarityMode,
} from '../languages/types';

export type CompanionLessonVariant =
  | 'baseline'
  | 'pass_2_consolidation'
  | 'encore_remedial';

export interface CompanionChunkCard {
  id: string;
  target: string;
  english: string;
  exampleTarget: string;
  exampleEnglish: string;
}

export interface CompanionWarmupPrompt {
  cueEnglish: string;
  expectedTarget: string;
  hint: string;
}

export interface CompanionDrillPrescription {
  subModuleId: string;
  displayCode: string;
  focusVerbsLabel: string;
  focusTensesLabel: string;
  recommendedCadence: RassiasDrillCadence;
  recommendedPolarity: PolarityMode;
  recommendedTimerSeconds: number;
  requiredPasses: number;
}

export interface ConjugationParadigmForm {
  person: PersonIndex;
  pronounDisplay: string;
  verbForm: string;
  fullForm: string;
  spokenAudio: string;
}

export interface VerbConjugationParadigm {
  verbId: string;
  infinitive: string;
  translation: string;
  tenseId: string;
  tenseName: string;
  forms: ConjugationParadigmForm[];
}

export interface CompanionLesson {
  id: string;
  language: LanguageCode;
  subModuleId: string;
  displayCode: string;
  phase: number;
  phaseTitle: string;
  title: string;
  subtitle: string;
  variant: CompanionLessonVariant;
  encoreIndex: number;
  recipeHash: string;
  generatedBy: 'starter_builtin' | 'offline_engine' | 'byok_ai';
  createdAt: number;
  /** Setting description for the narrative scene */
  sceneSetting: string;
  /** Parallel bilingual dialogue lines for 2-voice playback and paper reading */
  dialogue: DialogueLine[];
  /** Sound-first "How the Ear Hears It" bullet points */
  earNotes: string[];
  /** Complete 6-person conjugation paradigms for the Sub-Module's focus verbs */
  conjugationParadigms: VerbConjugationParadigm[];
  /** Present on 'encore_remedial' lessons: targeted coaching on the exact missed forms */
  diagnosticNotes: string[];
  /** Non-verb vocabulary chunks with contextualized example sentences */
  chunkCards: CompanionChunkCard[];
  /** 3 pen-and-paper / spoken warmup prompts before starting the 15-snap drill */
  warmupPrompts: CompanionWarmupPrompt[];
  /** Summary of the Sub-Module's drill recipe */
  drillPrescription: CompanionDrillPrescription;
  /** Snapshot of missed forms that triggered this lesson (if variant === 'encore_remedial') */
  spotlightMissedForms?: MissedVerbFormItem[];
  /** Snapshot of missed chunks that triggered this lesson */
  spotlightMissedChunks?: LexicalChunk[];
}
