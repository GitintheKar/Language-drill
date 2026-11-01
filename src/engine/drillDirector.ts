import { getLanguagePack } from '../languages';
import {
  ChunkDrillMode,
  ConjugationResult,
  LanguageCode,
  LexicalChunk,
  NegationType,
  PersonIndex,
  PolarityMode,
  SubModuleConfig,
} from '../languages/types';
import {
  evaluateSpokenChunk,
  evaluateSpokenConjugation,
  EvaluationOptions,
  EvaluationResult,
} from './evaluator';
import {
  pickChunkForVerb,
  ResolvedSubModulePool,
  resolveSubModulePool,
} from './roadmapResolver';

export type RassiasDrillCadence =
  | 'substitution' // Single verb & tense, rapid-fire pronoun shifts (Je! *Snap* -> Nous! *Snap* -> Ils! *Snap*)
  | 'transformation' // Single verb & subject, shift across tenses using Rassias triggers ("Aujourd'hui..." -> "Hier..." -> "Demain...")
  | 'qa_flip' // Conversational Question <-> Answer flip (Tu? -> Je, Monsieur vous? -> Je, Vous tous? -> Nous, ¿Usted? -> Yo)
  | 'roulette'; // Full AT Roulette: random verb, tense, and person on every snap

export type DrillStageStatus =
  | 'idle'
  | 'at_speaking_cue'
  | 'snapping'
  | 'listening_initial'
  | 'evaluating'
  | 'feedback_success'
  | 'at_speaking_correction'
  | 'listening_repeat'
  | 'repeat_verified';

export interface QuestionAnswerMetadata {
  questionPromptDisplay: string;
  questionSpokenByAT: string;
  answerCueBadge: string; // e.g. "Oui !", "Non !", "Non, jamais !", "Si !", "¡Sí!", "¡No!"
  requiresFrenchSi?: boolean;
}

export interface DrillPromptCard {
  id: string;
  language: LanguageCode;
  /** Distinguishes a 5-snap Non-Verb Chunk warmup card from a standard verb conjugation card */
  promptKind?: 'verb_conjugation' | 'chunk_warmup';
  verbId: string;
  infinitive: string;
  translation: string;
  tenseId: string;
  tenseName: string;
  rassiasTrigger: string;
  rassiasTriggerEnglish: string;
  person: PersonIndex;
  negation: NegationType;
  pronounDisplay: string;
  pronounSpoken: string;
  target: ConjugationResult;
  /** Optional non-verb lexical chunk attached as a sentence tail or warmup target */
  lexicalChunk?: LexicalChunk;
  /** True when Option C 'full_sentence' mode requires speaking the lexicalChunk tail */
  requireTailInResponse?: boolean;
  /** Tracks whether this card came from the 70% Focus pool, 30% Review pool, Straggler queue, or Chunk warmup */
  poolSource?: 'focus' | 'review' | 'straggler' | 'chunk_warmup';
  /** Spoken cue delivered by the Virtual Assistant Teacher (AT) before the finger-snap */
  atSpokenCue: string;
  /** Spoken correction modeled by the AT during the "Répétez ! / ¡Repita!" loop */
  atSpokenCorrection: string;
  /** True when this card is returning from the Boomerang recall queue */
  isBoomerang: boolean;
  /** True when this card is Beat 2 of a 2-Beat Rassias Ping-Pong Negation flip */
  isPingPongSecondBeat?: boolean;
  /** Present when in Question <-> Answer Flip cadence */
  qaMetadata?: QuestionAnswerMetadata;
}

export interface BoomerangQueueItem {
  verbId: string;
  tenseId: string;
  person: PersonIndex;
  negation: NegationType;
  promptsRemaining: number;
}

export interface VerbMasteryStats {
  verbId: string;
  attempts: number;
  correctFirstTry: number;
  streak: number;
  lastPracticedAt: number;
}

export interface PairMasteryStats {
  /** Composite key "${verbId}:${tenseId}" */
  pairKey: string;
  verbId: string;
  tenseId: string;
  attempts: number;
  correctFirstTry: number;
  streak: number;
  lastPracticedAt: number;
}

export interface ChunkMasteryStats {
  chunkId: string;
  attempts: number;
  correctFirstTry: number;
  streak: number;
  lastPracticedAt: number;
}

export interface StragglerItem {
  verbId: string;
  tenseId: string;
  person: PersonIndex;
  negation: NegationType;
  consecutiveCorrect: number;
}

export interface MissedVerbFormItem {
  verbId: string;
  infinitive: string;
  tenseId: string;
  tenseName: string;
  person: PersonIndex;
  pronounDisplay: string;
  negation: NegationType;
  expectedFullForm: string;
}

export type SubModuleCheckOutcome =
  | 'in_progress'
  | 'encore_required'
  | 'pass_1_complete'
  | 'graduated_with_stragglers'
  | 'graduated_clean';

export interface SubModuleCheckReport {
  subModuleId: string;
  isComplete: boolean;
  targetVerbSnaps: number;
  completedVerbSnaps: number;
  verbCorrectFirstTry: number;
  firstTryAccuracyPct: number;
  chunkSnapsTotal: number;
  chunkSnapsCompleted: number;
  chunkCorrectFirstTry: number;
  chunkAccuracyPct: number;
  previousPasses: number;
  newPassesCompleted: number;
  requiredPasses: number;
  outcome: SubModuleCheckOutcome;
  missedForms: MissedVerbFormItem[];
  missedChunks: LexicalChunk[];
}

export interface DrillDirectorConfig {
  language: LanguageCode;
  activeVerbIds: string[];
  activeTenseIds: string[];
  cadence: RassiasDrillCadence;
  polarityMode?: PolarityMode;
  enableNegativeAdverbs?: boolean;
  includeVosotros: boolean;
  useNaturalTriggers: boolean;
  /** Optional Sub-Module ID enabling Course Roadmap Mode (70/30 Focus/Review split & Non-Verb Chunks) */
  activeSubModuleId?: string;
  /** Option C Toggle: 'two_part' (5-snap Chunk Warmup + Verb Snaps) vs 'full_sentence' (Spoken Sentence Tails) */
  chunkDrillMode?: ChunkDrillMode;
  /** Optional custom/reordered Sub-Module array override */
  customRoadmap?: SubModuleConfig[];
}

interface PendingPingPongBeat {
  verbId: string;
  tenseId: string;
  person: PersonIndex;
  negation: Exclude<NegationType, 'none'>;
  poolSource?: 'focus' | 'review' | 'straggler';
}

interface ActiveSubModuleCheckState {
  subModuleId: string;
  requiredPasses: number;
  previousPasses: number;
  targetVerbSnaps: number;
  completedVerbSnaps: number;
  verbCorrectFirstTry: number;
  chunkSnapsTotal: number;
  chunkSnapsCompleted: number;
  chunkCorrectFirstTry: number;
  missedForms: MissedVerbFormItem[];
  missedChunks: LexicalChunk[];
  pendingFinalRepeatCompletion: boolean;
}

export function buildPairKey(verbId: string, tenseId: string): string {
  return `${verbId}:${tenseId}`;
}

/**
 * Stateful Dartmouth Rassias Method Drill Director.
 * Manages prompt sequencing across all 4 Rassias cadences, 2-Beat Ping-Pong Negation,
 * Question <-> Answer flips, the "Répétez !" immediate correction loop,
 * the Boomerang point-back queue, 70/30 Course Sub-Module Focus/Review weighting,
 * Option C Non-Verb Lexical Chunks, and the 2-Pass Sub-Module Graduation Gate.
 */
export class RassiasDrillDirector {
  private config: DrillDirectorConfig;
  private boomerangQueue: BoomerangQueueItem[] = [];
  private stragglerQueue: StragglerItem[] = [];
  private pendingPingPong: PendingPingPongBeat | null = null;
  private currentVerbIdx = 0;
  private currentTenseIdx = 0;
  private currentPersonStep = 0;
  private reviewStepIdx = 0;
  private courseWeightingStep = 0;
  private qaScenarioStep = 0;
  private negAdverbStep = 0;
  private mixedPolarityStep = 0;
  private currentPrompt: DrillPromptCard | null = null;
  private inRepeatLoop = false;
  private masteryMap: Record<string, VerbMasteryStats> = {};
  private pairMasteryMap: Record<string, PairMasteryStats> = {};
  private chunkMasteryMap: Record<string, ChunkMasteryStats> = {};
  private activeCheckState: ActiveSubModuleCheckState | null = null;

  constructor(
    config: DrillDirectorConfig,
    initialMastery?: Record<string, VerbMasteryStats>,
    initialPairMastery?: Record<string, PairMasteryStats>,
    initialStragglers?: StragglerItem[]
  ) {
    this.config = {
      polarityMode: 'affirmative',
      enableNegativeAdverbs: true,
      chunkDrillMode: 'two_part',
      ...config,
    };
    if (initialMastery) {
      this.masteryMap = { ...initialMastery };
    }
    if (initialPairMastery) {
      this.pairMasteryMap = { ...initialPairMastery };
    }
    if (initialStragglers) {
      this.stragglerQueue = initialStragglers.map((s) => ({ ...s }));
    }
  }

  public updateConfig(next: Partial<DrillDirectorConfig>): void {
    const languageChanged =
      next.language !== undefined && next.language !== this.config.language;
    const subModuleChanged =
      next.activeSubModuleId !== undefined &&
      next.activeSubModuleId !== this.config.activeSubModuleId;

    this.config = { ...this.config, ...next };

    if (languageChanged) {
      this.inRepeatLoop = false;
      this.pendingPingPong = null;
      this.boomerangQueue = [];
      this.activeCheckState = null;
      this.currentVerbIdx = 0;
      this.currentTenseIdx = 0;
      this.currentPersonStep = 0;
      this.courseWeightingStep = 0;
    } else if (subModuleChanged) {
      this.inRepeatLoop = false;
      this.pendingPingPong = null;
      this.currentVerbIdx = 0;
      this.currentTenseIdx = 0;
      this.currentPersonStep = 0;
      this.courseWeightingStep = 0;
    } else if (next.polarityMode && next.polarityMode !== 'ping_pong') {
      this.pendingPingPong = null;
    }
  }

  public getConfig(): DrillDirectorConfig {
    return this.config;
  }

  public getMasteryMap(): Record<string, VerbMasteryStats> {
    return this.masteryMap;
  }

  public getPairMasteryMap(): Record<string, PairMasteryStats> {
    return this.pairMasteryMap;
  }

  public getChunkMasteryMap(): Record<string, ChunkMasteryStats> {
    return this.chunkMasteryMap;
  }

  public getStragglerQueue(): StragglerItem[] {
    return this.stragglerQueue;
  }

  public setStragglerQueue(items: StragglerItem[]): void {
    this.stragglerQueue = items.map((s) => ({ ...s }));
  }

  public getBoomerangQueueLength(): number {
    return this.boomerangQueue.length;
  }

  public isInRepeatLoop(): boolean {
    return this.inRepeatLoop;
  }

  public getCurrentPrompt(): DrillPromptCard | null {
    return this.currentPrompt;
  }

  /**
   * Starts a graded Sub-Module Check (default: 15 verb snaps, plus 5-snap Chunk Warmup when in 'two_part' mode).
   */
  public startSubModuleCheck(
    subModuleId?: string,
    options?: {
      targetVerbSnaps?: number;
      currentPassesCompleted?: number;
      chunkWarmupCount?: number;
    }
  ): SubModuleCheckReport {
    const targetSubModuleId =
      subModuleId ??
      this.config.activeSubModuleId ??
      (this.config.language === 'fr' ? 'fr-1.1' : 'es-1.1');

    this.config.activeSubModuleId = targetSubModuleId;
    const pool = resolveSubModulePool(
      this.config.language,
      targetSubModuleId,
      this.config.customRoadmap
    );

    const isTwoPart = (this.config.chunkDrillMode ?? 'two_part') === 'two_part';
    const defaultWarmupCount = isTwoPart
      ? Math.min(5, pool.focusChunks.length)
      : 0;

    this.inRepeatLoop = false;
    this.pendingPingPong = null;
    this.courseWeightingStep = 0;

    this.activeCheckState = {
      subModuleId: pool.subModule.id,
      requiredPasses: pool.requiredPasses,
      previousPasses: options?.currentPassesCompleted ?? 0,
      targetVerbSnaps: options?.targetVerbSnaps ?? 15,
      completedVerbSnaps: 0,
      verbCorrectFirstTry: 0,
      chunkSnapsTotal: options?.chunkWarmupCount ?? defaultWarmupCount,
      chunkSnapsCompleted: 0,
      chunkCorrectFirstTry: 0,
      missedForms: [],
      missedChunks: [],
      pendingFinalRepeatCompletion: false,
    };

    return this.getSubModuleCheckReport()!;
  }

  public clearSubModuleCheck(): void {
    this.activeCheckState = null;
  }

  public getSubModuleCheckReport(): SubModuleCheckReport | null {
    if (!this.activeCheckState) return null;
    const st = this.activeCheckState;

    const isComplete =
      st.completedVerbSnaps >= st.targetVerbSnaps &&
      st.chunkSnapsCompleted >= st.chunkSnapsTotal &&
      !this.inRepeatLoop &&
      !st.pendingFinalRepeatCompletion;

    const firstTryAccuracyPct =
      st.completedVerbSnaps > 0
        ? Math.round((st.verbCorrectFirstTry / st.completedVerbSnaps) * 100)
        : 0;

    const chunkAccuracyPct =
      st.chunkSnapsCompleted > 0
        ? Math.round((st.chunkCorrectFirstTry / st.chunkSnapsCompleted) * 100)
        : 100;

    if (!isComplete) {
      return {
        subModuleId: st.subModuleId,
        isComplete: false,
        targetVerbSnaps: st.targetVerbSnaps,
        completedVerbSnaps: st.completedVerbSnaps,
        verbCorrectFirstTry: st.verbCorrectFirstTry,
        firstTryAccuracyPct,
        chunkSnapsTotal: st.chunkSnapsTotal,
        chunkSnapsCompleted: st.chunkSnapsCompleted,
        chunkCorrectFirstTry: st.chunkCorrectFirstTry,
        chunkAccuracyPct,
        previousPasses: st.previousPasses,
        newPassesCompleted: st.previousPasses,
        requiredPasses: st.requiredPasses,
        outcome: 'in_progress',
        missedForms: [...st.missedForms],
        missedChunks: [...st.missedChunks],
      };
    }

    const passedThisRun = firstTryAccuracyPct >= 80;
    const newPassesCompleted = passedThisRun
      ? st.previousPasses + 1
      : st.previousPasses;

    let outcome: SubModuleCheckOutcome;
    if (!passedThisRun) {
      outcome = 'encore_required';
    } else if (newPassesCompleted < st.requiredPasses) {
      outcome = 'pass_1_complete';
    } else if (firstTryAccuracyPct >= 90 && st.missedForms.length === 0) {
      outcome = 'graduated_clean';
    } else {
      outcome = 'graduated_with_stragglers';
    }

    return {
      subModuleId: st.subModuleId,
      isComplete: true,
      targetVerbSnaps: st.targetVerbSnaps,
      completedVerbSnaps: st.completedVerbSnaps,
      verbCorrectFirstTry: st.verbCorrectFirstTry,
      firstTryAccuracyPct,
      chunkSnapsTotal: st.chunkSnapsTotal,
      chunkSnapsCompleted: st.chunkSnapsCompleted,
      chunkCorrectFirstTry: st.chunkCorrectFirstTry,
      chunkAccuracyPct,
      previousPasses: st.previousPasses,
      newPassesCompleted,
      requiredPasses: st.requiredPasses,
      outcome,
      missedForms: [...st.missedForms],
      missedChunks: [...st.missedChunks],
    };
  }

  private pickNextNegationType(): Exclude<NegationType, 'none'> {
    if (!this.config.enableNegativeAdverbs) {
      return 'pas';
    }
    const sequence: Exclude<NegationType, 'none'>[] = ['pas', 'pas', 'jamais', 'plus'];
    const picked = sequence[this.negAdverbStep % sequence.length];
    this.negAdverbStep += 1;
    return picked;
  }

  private buildChunkWarmupCard(
    chunk: LexicalChunk,
    pool: ResolvedSubModulePool
  ): DrillPromptCard {
    const pack = getLanguagePack(this.config.language);
    const fallbackVerbId =
      chunk.attachToVerbIds?.[0] ?? pool.focusVerbIds[0] ?? pack.verbs[0].id;
    const fallbackTenseId = pool.focusTenseIds[0] ?? pack.tenses[0].id;
    const verb =
      pack.verbs.find((v) => v.id === fallbackVerbId) ?? pack.verbs[0];
    const tense =
      pack.tenses.find((t) => t.id === fallbackTenseId) ?? pack.tenses[0];
    const target = pack.conjugate(verb.id, tense.id, 0, 'none');

    const repeatWord = this.config.language === 'fr' ? 'Répétez' : '¡Repita!';
    const atSpokenCue =
      this.config.language === 'fr'
        ? `Expression : ${chunk.english}`
        : `Expresión: ${chunk.english}`;
    const atSpokenCorrection = `${chunk.target} ! ${repeatWord} !`;

    return {
      id: `chunk-${chunk.id}-${Date.now()}`,
      language: this.config.language,
      promptKind: 'chunk_warmup',
      verbId: verb.id,
      infinitive: chunk.target,
      translation: chunk.english,
      tenseId: tense.id,
      tenseName:
        this.config.language === 'fr'
          ? 'Vocabulaire & Expressions'
          : 'Vocabulario y Expresiones',
      rassiasTrigger: chunk.english,
      rassiasTriggerEnglish: chunk.english,
      person: 0,
      negation: 'none',
      pronounDisplay: chunk.english,
      pronounSpoken: '',
      target: {
        ...target,
        verbForm: chunk.target,
        fullForm: chunk.target,
        triggeredPhrase: chunk.target,
        acceptedForms: [chunk.target],
      },
      lexicalChunk: chunk,
      requireTailInResponse: false,
      poolSource: 'chunk_warmup',
      atSpokenCue,
      atSpokenCorrection,
      isBoomerang: false,
      isPingPongSecondBeat: false,
    };
  }

  /**
   * Generates the next Rassias drill prompt card, prioritizing:
   * 0. Non-Verb Chunk Warmup cards (when in a 'two_part' Sub-Module Check warmup phase)
   * 1. Beat 2 of a Ping-Pong Negation Flip (if Beat 1 just succeeded)
   * 2. Any due Boomerang return card
   * 3. Course Mode 70% Focus / 30% Review + Stragglers (when activeSubModuleId is set)
   * 4. Standard Rassias Drill Cadence
   */
  public nextPrompt(): DrillPromptCard {
    this.inRepeatLoop = false;
    const pack = getLanguagePack(this.config.language);

    const activePool = this.config.activeSubModuleId
      ? resolveSubModulePool(
          this.config.language,
          this.config.activeSubModuleId,
          this.config.customRoadmap
        )
      : null;

    // 0. If in a 'two_part' Sub-Module Check and chunk warmup snaps remain, serve the next chunk card!
    if (
      this.activeCheckState &&
      activePool &&
      this.activeCheckState.chunkSnapsCompleted <
        this.activeCheckState.chunkSnapsTotal &&
      activePool.focusChunks.length > 0
    ) {
      const chunkIdx =
        this.activeCheckState.chunkSnapsCompleted % activePool.focusChunks.length;
      const chunk = activePool.focusChunks[chunkIdx];
      const chunkCard = this.buildChunkWarmupCard(chunk, activePool);
      this.currentPrompt = chunkCard;
      return chunkCard;
    }

    // 1. Check if Beat 2 of a 2-Beat Ping-Pong Negation Flip is pending!
    if (this.pendingPingPong && this.config.polarityMode === 'ping_pong') {
      const pp = this.pendingPingPong;
      this.pendingPingPong = null;
      const card = this.buildPromptCard(
        pp.verbId,
        pp.tenseId,
        pp.person,
        pp.negation,
        false,
        true,
        activePool,
        pp.poolSource ?? 'focus'
      );
      this.currentPrompt = card;
      return card;
    }

    // 2. Decrement boomerang counters and check if a missed item is ready to boomerang back!
    for (const item of this.boomerangQueue) {
      item.promptsRemaining -= 1;
    }

    const dueIdx = this.boomerangQueue.findIndex((b) => b.promptsRemaining <= 0);
    if (dueIdx !== -1) {
      const [dueItem] = this.boomerangQueue.splice(dueIdx, 1);
      const verbExists = pack.verbs.some((v) => v.id === dueItem.verbId);
      const tenseExists = pack.tenses.some((t) => t.id === dueItem.tenseId);
      if (verbExists && tenseExists) {
        const card = this.buildPromptCard(
          dueItem.verbId,
          dueItem.tenseId,
          dueItem.person,
          dueItem.negation,
          true,
          false,
          activePool,
          'straggler'
        );
        this.currentPrompt = card;
        return card;
      }
    }

    // Determine negation for this prompt
    const polarity = this.config.polarityMode ?? 'affirmative';
    let negation: NegationType = 'none';
    if (polarity === 'negative') {
      negation = this.pickNextNegationType();
    } else if (polarity === 'mixed') {
      this.mixedPolarityStep += 1;
      negation =
        this.mixedPolarityStep % 2 === 0 ? this.pickNextNegationType() : 'none';
    } else {
      negation = 'none';
    }

    // 3. Course Mode: 70% Focus Pool / 30% Review + Stragglers Pool
    if (activePool) {
      const stepSlot = this.courseWeightingStep % 10;
      this.courseWeightingStep += 1;

      // Slots 3, 6, 9 (3 out of 10 = 30%) attempt to draw from Stragglers or Cumulative Review Pool
      const isReviewSlot = stepSlot === 3 || stepSlot === 6 || stepSlot === 9;

      if (isReviewSlot) {
        // 3a. First check if there is an active Straggler valid in the cumulative pool
        const validStragglers = this.stragglerQueue.filter(
          (s) =>
            activePool.cumulativeVerbIds.includes(s.verbId) &&
            activePool.cumulativeTenseIds.includes(s.tenseId)
        );
        if (validStragglers.length > 0) {
          const pickedStraggler =
            validStragglers[this.reviewStepIdx % validStragglers.length];
          this.reviewStepIdx += 1;
          const card = this.buildPromptCard(
            pickedStraggler.verbId,
            pickedStraggler.tenseId,
            pickedStraggler.person,
            pickedStraggler.negation,
            false,
            false,
            activePool,
            'straggler'
          );
          this.currentPrompt = card;
          return card;
        }

        // 3b. Next check if the Cumulative Review Pool has prior (verb, tense) pairs
        const focusPairSet = new Set<string>();
        for (const fv of activePool.focusVerbIds) {
          for (const ft of activePool.focusTenseIds) {
            focusPairSet.add(buildPairKey(fv, ft));
          }
        }

        const reviewPairs: { verbId: string; tenseId: string }[] = [];
        for (const rv of activePool.cumulativeVerbIds) {
          for (const rt of activePool.cumulativeTenseIds) {
            if (!focusPairSet.has(buildPairKey(rv, rt))) {
              reviewPairs.push({ verbId: rv, tenseId: rt });
            }
          }
        }

        // If all cumulative pairs are in focusPairSet (e.g. when a new tense is practiced across all cumulative verbs),
        // use prior reviewVerbIds x reviewTenseIds if non-empty
        if (
          reviewPairs.length === 0 &&
          activePool.reviewVerbIds.length > 0 &&
          activePool.reviewTenseIds.length > 0
        ) {
          for (const rv of activePool.reviewVerbIds) {
            for (const rt of activePool.reviewTenseIds) {
              reviewPairs.push({ verbId: rv, tenseId: rt });
            }
          }
        }

        if (reviewPairs.length > 0) {
          // Sort review pairs so weakest or least-recently practiced pairs surface first
          const sortedReview = [...reviewPairs].sort((a, b) => {
            const statA = this.pairMasteryMap[buildPairKey(a.verbId, a.tenseId)];
            const statB = this.pairMasteryMap[buildPairKey(b.verbId, b.tenseId)];
            const accA =
              statA && statA.attempts > 0
                ? statA.correctFirstTry / statA.attempts
                : 0;
            const accB =
              statB && statB.attempts > 0
                ? statB.correctFirstTry / statB.attempts
                : 0;
            if (accA !== accB) return accA - accB;
            return (statA?.lastPracticedAt ?? 0) - (statB?.lastPracticedAt ?? 0);
          });

          const pickedPair =
            sortedReview[this.reviewStepIdx % sortedReview.length];
          this.reviewStepIdx += 1;
          const validPersons = this.getValidPersonsForTense(pickedPair.tenseId);
          const person =
            validPersons[this.reviewStepIdx % validPersons.length];

          const card = this.buildPromptCard(
            pickedPair.verbId,
            pickedPair.tenseId,
            person,
            negation,
            false,
            false,
            activePool,
            'review'
          );
          this.currentPrompt = card;
          return card;
        }
      }
    }

    // 4. Determine active verb and tense pools (using Focus Pool when in Course Mode)
    const verbPool = activePool
      ? activePool.focusVerbIds
      : this.config.activeVerbIds.length > 0
      ? this.config.activeVerbIds
      : pack.verbs.filter((v) => v.tier === 1).map((v) => v.id);

    const tensePool = activePool
      ? activePool.focusTenseIds
      : this.config.activeTenseIds.length > 0
      ? this.config.activeTenseIds
      : [pack.tenses[0].id];

    let verbId: string;
    let tenseId: string;
    let person: PersonIndex;

    if (
      this.config.cadence === 'substitution' ||
      this.config.cadence === 'qa_flip'
    ) {
      verbId = verbPool[this.currentVerbIdx % verbPool.length];
      tenseId = tensePool[this.currentTenseIdx % tensePool.length];
      const validPersons = this.getValidPersonsForTense(tenseId);
      person = validPersons[this.currentPersonStep % validPersons.length];

      this.currentPersonStep += 1;
      if (this.currentPersonStep >= validPersons.length) {
        this.currentPersonStep = 0;
        this.currentVerbIdx = (this.currentVerbIdx + 1) % verbPool.length;
        if (this.currentVerbIdx === 0) {
          this.currentTenseIdx = (this.currentTenseIdx + 1) % tensePool.length;
        }
      }
    } else if (this.config.cadence === 'transformation') {
      verbId = verbPool[this.currentVerbIdx % verbPool.length];
      tenseId = tensePool[this.currentTenseIdx % tensePool.length];
      const validPersons = this.getValidPersonsForTense(tenseId);
      person = validPersons[this.currentPersonStep % validPersons.length];

      this.currentTenseIdx += 1;
      if (this.currentTenseIdx >= tensePool.length) {
        this.currentTenseIdx = 0;
        this.currentPersonStep =
          (this.currentPersonStep + 1) % validPersons.length;
        this.currentVerbIdx = (this.currentVerbIdx + 1) % verbPool.length;
      }
    } else {
      verbId = verbPool[Math.floor(Math.random() * verbPool.length)];
      tenseId = tensePool[Math.floor(Math.random() * tensePool.length)];
      const validPersons = this.getValidPersonsForTense(tenseId);
      person = validPersons[Math.floor(Math.random() * validPersons.length)];
    }

    const card = this.buildPromptCard(
      verbId,
      tenseId,
      person,
      negation,
      false,
      false,
      activePool,
      'focus'
    );
    this.currentPrompt = card;
    return card;
  }

  public submitResponse(
    transcript: string,
    options?: EvaluationOptions
  ): {
    evaluation: EvaluationResult;
    enteredRepeatLoop: boolean;
    completedRepeatLoop: boolean;
    queuedBoomerang: boolean;
    checkReport?: SubModuleCheckReport | null;
  } {
    if (!this.currentPrompt) {
      throw new Error('No active prompt in RassiasDrillDirector');
    }

    // Handle Non-Verb Lexical Chunk Warmup card ('chunk_warmup')
    if (
      this.currentPrompt.promptKind === 'chunk_warmup' &&
      this.currentPrompt.lexicalChunk
    ) {
      const chunk = this.currentPrompt.lexicalChunk;
      const evaluation = evaluateSpokenChunk(
        transcript,
        chunk,
        this.config.language,
        options?.alternatives
      );

      if (this.inRepeatLoop) {
        if (evaluation.isCorrect) {
          this.inRepeatLoop = false;
          if (this.activeCheckState) {
            this.activeCheckState.chunkSnapsCompleted += 1;
          }
          return {
            evaluation,
            enteredRepeatLoop: false,
            completedRepeatLoop: true,
            queuedBoomerang: false,
            checkReport: this.getSubModuleCheckReport(),
          };
        }
        return {
          evaluation,
          enteredRepeatLoop: true,
          completedRepeatLoop: false,
          queuedBoomerang: false,
          checkReport: this.getSubModuleCheckReport(),
        };
      }

      this.recordChunkAttempt(chunk.id, evaluation.isCorrect);

      if (evaluation.isCorrect) {
        if (this.activeCheckState) {
          this.activeCheckState.chunkCorrectFirstTry += 1;
          this.activeCheckState.chunkSnapsCompleted += 1;
        }
        return {
          evaluation,
          enteredRepeatLoop: false,
          completedRepeatLoop: false,
          queuedBoomerang: false,
          checkReport: this.getSubModuleCheckReport(),
        };
      }

      // Missed chunk on first try -> enter repeat loop & record in missedChunks
      this.inRepeatLoop = true;
      if (
        this.activeCheckState &&
        !this.activeCheckState.missedChunks.some((c) => c.id === chunk.id)
      ) {
        this.activeCheckState.missedChunks.push(chunk);
      }
      return {
        evaluation,
        enteredRepeatLoop: true,
        completedRepeatLoop: false,
        queuedBoomerang: false,
        checkReport: this.getSubModuleCheckReport(),
      };
    }

    // Standard Verb Conjugation evaluation (with optional Non-Verb Sentence Tail support)
    const mergedOptions: EvaluationOptions = {
      ...options,
      expectedTailChunk:
        options?.expectedTailChunk ?? this.currentPrompt.lexicalChunk,
      requireTailInResponse:
        options?.requireTailInResponse ??
        this.currentPrompt.requireTailInResponse,
    };

    const evaluation = evaluateSpokenConjugation(
      transcript,
      this.currentPrompt.target,
      mergedOptions
    );

    if (this.inRepeatLoop) {
      if (evaluation.isCorrect) {
        this.inRepeatLoop = false;
        if (this.activeCheckState?.pendingFinalRepeatCompletion) {
          this.activeCheckState.pendingFinalRepeatCompletion = false;
        }
        if (
          this.config.polarityMode === 'ping_pong' &&
          this.currentPrompt.negation === 'none' &&
          !this.currentPrompt.isPingPongSecondBeat
        ) {
          this.pendingPingPong = {
            verbId: this.currentPrompt.verbId,
            tenseId: this.currentPrompt.tenseId,
            person: this.currentPrompt.person,
            negation: this.pickNextNegationType(),
            poolSource:
              this.currentPrompt.poolSource === 'chunk_warmup'
                ? 'focus'
                : this.currentPrompt.poolSource,
          };
        }
        return {
          evaluation,
          enteredRepeatLoop: false,
          completedRepeatLoop: true,
          queuedBoomerang: false,
          checkReport: this.getSubModuleCheckReport(),
        };
      }
      return {
        evaluation,
        enteredRepeatLoop: true,
        completedRepeatLoop: false,
        queuedBoomerang: false,
        checkReport: this.getSubModuleCheckReport(),
      };
    }

    this.recordAttempt(
      this.currentPrompt.verbId,
      this.currentPrompt.tenseId,
      evaluation.isCorrect
    );
    this.updateStragglerOnAttempt(
      this.currentPrompt.verbId,
      this.currentPrompt.tenseId,
      this.currentPrompt.person,
      this.currentPrompt.negation,
      evaluation.isCorrect
    );

    if (evaluation.isCorrect) {
      if (
        this.activeCheckState &&
        this.activeCheckState.completedVerbSnaps <
          this.activeCheckState.targetVerbSnaps
      ) {
        this.activeCheckState.verbCorrectFirstTry += 1;
        this.activeCheckState.completedVerbSnaps += 1;
      }

      if (
        this.config.polarityMode === 'ping_pong' &&
        this.currentPrompt.negation === 'none' &&
        !this.currentPrompt.isPingPongSecondBeat
      ) {
        this.pendingPingPong = {
          verbId: this.currentPrompt.verbId,
          tenseId: this.currentPrompt.tenseId,
          person: this.currentPrompt.person,
          negation: this.pickNextNegationType(),
          poolSource:
            this.currentPrompt.poolSource === 'chunk_warmup'
              ? 'focus'
              : this.currentPrompt.poolSource,
        };
      }
      return {
        evaluation,
        enteredRepeatLoop: false,
        completedRepeatLoop: false,
        queuedBoomerang: false,
        checkReport: this.getSubModuleCheckReport(),
      };
    }

    // Missed on first try -> Enter "Répétez !" loop, record diagnostic miss, and queue for Boomerang!
    this.inRepeatLoop = true;
    this.recordSubModuleCheckMiss(this.currentPrompt);

    const queuedBoomerang = this.enqueueBoomerang(
      this.currentPrompt.verbId,
      this.currentPrompt.tenseId,
      this.currentPrompt.person,
      this.currentPrompt.negation
    );

    return {
      evaluation,
      enteredRepeatLoop: true,
      completedRepeatLoop: false,
      queuedBoomerang,
      checkReport: this.getSubModuleCheckReport(),
    };
  }

  public triggerBeatTimeout(): {
    enteredRepeatLoop: boolean;
    queuedBoomerang: boolean;
    atCorrectionText: string;
    checkReport?: SubModuleCheckReport | null;
  } {
    if (!this.currentPrompt) {
      throw new Error('No active prompt in RassiasDrillDirector');
    }

    if (
      this.currentPrompt.promptKind === 'chunk_warmup' &&
      this.currentPrompt.lexicalChunk
    ) {
      const chunk = this.currentPrompt.lexicalChunk;
      if (!this.inRepeatLoop) {
        this.recordChunkAttempt(chunk.id, false);
        if (
          this.activeCheckState &&
          !this.activeCheckState.missedChunks.some((c) => c.id === chunk.id)
        ) {
          this.activeCheckState.missedChunks.push(chunk);
        }
      }
      this.inRepeatLoop = true;
      return {
        enteredRepeatLoop: true,
        queuedBoomerang: false,
        atCorrectionText: this.currentPrompt.atSpokenCorrection,
        checkReport: this.getSubModuleCheckReport(),
      };
    }

    if (!this.inRepeatLoop) {
      this.recordAttempt(
        this.currentPrompt.verbId,
        this.currentPrompt.tenseId,
        false
      );
      this.updateStragglerOnAttempt(
        this.currentPrompt.verbId,
        this.currentPrompt.tenseId,
        this.currentPrompt.person,
        this.currentPrompt.negation,
        false
      );
      this.recordSubModuleCheckMiss(this.currentPrompt);
    }

    this.inRepeatLoop = true;
    const queuedBoomerang = this.enqueueBoomerang(
      this.currentPrompt.verbId,
      this.currentPrompt.tenseId,
      this.currentPrompt.person,
      this.currentPrompt.negation
    );

    return {
      enteredRepeatLoop: true,
      queuedBoomerang,
      atCorrectionText: this.currentPrompt.atSpokenCorrection,
      checkReport: this.getSubModuleCheckReport(),
    };
  }

  private recordSubModuleCheckMiss(card: DrillPromptCard): void {
    if (!this.activeCheckState) return;
    const st = this.activeCheckState;

    if (st.completedVerbSnaps < st.targetVerbSnaps) {
      st.completedVerbSnaps += 1;
      if (st.completedVerbSnaps >= st.targetVerbSnaps) {
        st.pendingFinalRepeatCompletion = true;
      }
    }

    const alreadyRecorded = st.missedForms.some(
      (m) =>
        m.verbId === card.verbId &&
        m.tenseId === card.tenseId &&
        m.person === card.person &&
        m.negation === card.negation
    );
    if (!alreadyRecorded) {
      st.missedForms.push({
        verbId: card.verbId,
        infinitive: card.infinitive,
        tenseId: card.tenseId,
        tenseName: card.tenseName,
        person: card.person,
        pronounDisplay: card.pronounDisplay,
        negation: card.negation,
        expectedFullForm: card.target.fullForm,
      });
    }

    if (
      card.requireTailInResponse &&
      card.lexicalChunk &&
      !st.missedChunks.some((c) => c.id === card.lexicalChunk!.id)
    ) {
      st.missedChunks.push(card.lexicalChunk);
    }
  }

  private updateStragglerOnAttempt(
    verbId: string,
    tenseId: string,
    person: PersonIndex,
    negation: NegationType,
    isCorrect: boolean
  ): void {
    const idx = this.stragglerQueue.findIndex(
      (s) =>
        s.verbId === verbId &&
        s.tenseId === tenseId &&
        s.person === person &&
        s.negation === negation
    );

    // If this form was already missed during the current active Sub-Module Check,
    // keep it pinned in stragglerQueue so it carries over into the next Sub-Module!
    const missedInCurrentCheck = Boolean(
      this.activeCheckState?.missedForms.some(
        (m) =>
          m.verbId === verbId &&
          m.tenseId === tenseId &&
          m.person === person &&
          m.negation === negation
      )
    );

    if (isCorrect) {
      if (idx !== -1 && !missedInCurrentCheck) {
        this.stragglerQueue[idx].consecutiveCorrect += 1;
        // Graduate out of stragglers after 2 consecutive first-try hits
        if (this.stragglerQueue[idx].consecutiveCorrect >= 2) {
          this.stragglerQueue.splice(idx, 1);
        }
      }
    } else {
      if (idx !== -1) {
        this.stragglerQueue[idx].consecutiveCorrect = 0;
      } else {
        this.stragglerQueue.push({
          verbId,
          tenseId,
          person,
          negation,
          consecutiveCorrect: 0,
        });
      }
    }
  }

  private enqueueBoomerang(
    verbId: string,
    tenseId: string,
    person: PersonIndex,
    negation: NegationType,
    delayPrompts = 3
  ): boolean {
    const alreadyQueued = this.boomerangQueue.some(
      (b) =>
        b.verbId === verbId &&
        b.tenseId === tenseId &&
        b.person === person &&
        b.negation === negation
    );
    if (alreadyQueued) return false;

    this.boomerangQueue.push({
      verbId,
      tenseId,
      person,
      negation,
      promptsRemaining: delayPrompts,
    });
    return true;
  }

  private recordAttempt(
    verbId: string,
    tenseId: string,
    isCorrect: boolean
  ): void {
    const now = Date.now();
    const existingVerb = this.masteryMap[verbId] ?? {
      verbId,
      attempts: 0,
      correctFirstTry: 0,
      streak: 0,
      lastPracticedAt: 0,
    };

    this.masteryMap[verbId] = {
      verbId,
      attempts: existingVerb.attempts + 1,
      correctFirstTry: existingVerb.correctFirstTry + (isCorrect ? 1 : 0),
      streak: isCorrect ? existingVerb.streak + 1 : 0,
      lastPracticedAt: now,
    };

    const pairKey = buildPairKey(verbId, tenseId);
    const existingPair = this.pairMasteryMap[pairKey] ?? {
      pairKey,
      verbId,
      tenseId,
      attempts: 0,
      correctFirstTry: 0,
      streak: 0,
      lastPracticedAt: 0,
    };

    this.pairMasteryMap[pairKey] = {
      pairKey,
      verbId,
      tenseId,
      attempts: existingPair.attempts + 1,
      correctFirstTry: existingPair.correctFirstTry + (isCorrect ? 1 : 0),
      streak: isCorrect ? existingPair.streak + 1 : 0,
      lastPracticedAt: now,
    };
  }

  private recordChunkAttempt(chunkId: string, isCorrect: boolean): void {
    const existing = this.chunkMasteryMap[chunkId] ?? {
      chunkId,
      attempts: 0,
      correctFirstTry: 0,
      streak: 0,
      lastPracticedAt: 0,
    };

    this.chunkMasteryMap[chunkId] = {
      chunkId,
      attempts: existing.attempts + 1,
      correctFirstTry: existing.correctFirstTry + (isCorrect ? 1 : 0),
      streak: isCorrect ? existing.streak + 1 : 0,
      lastPracticedAt: Date.now(),
    };
  }

  private getValidPersonsForTense(tenseId: string): PersonIndex[] {
    const pack = getLanguagePack(this.config.language);
    const tense = pack.tenses.find((t) => t.id === tenseId);
    const basePersons: PersonIndex[] =
      tense?.validPersons ?? [0, 1, 2, 3, 4, 5];

    if (this.config.language === 'es' && !this.config.includeVosotros) {
      return basePersons.filter((p) => p !== 4);
    }
    return basePersons;
  }

  /**
   * Builds authentic Dartmouth Rassias Question <-> Answer metadata for a target answer person.
   */
  private buildQuestionAnswerMetadata(
    verbId: string,
    tenseId: string,
    answerPerson: PersonIndex,
    answerNegation: NegationType,
    lexicalChunk?: LexicalChunk
  ): { qa: QuestionAnswerMetadata; requiresFrenchSi: boolean } {
    const pack = getLanguagePack(this.config.language);
    const tense = pack.tenses.find((t) => t.id === tenseId) ?? pack.tenses[0];
    this.qaScenarioStep += 1;

    const tailSuffix = lexicalChunk ? ` ${lexicalChunk.target}` : '';

    if (this.config.language === 'fr') {
      let questionPerson: PersonIndex = answerPerson;
      let questionPrefix = '';

      if (answerPerson === 0) {
        if (this.qaScenarioStep % 2 === 1) {
          questionPerson = 1; // tu
        } else {
          questionPerson = 4; // vous (polite singular)
          questionPrefix = 'Monsieur, ';
        }
      } else if (answerPerson === 1) {
        questionPerson = 0;
      } else if (answerPerson === 3) {
        questionPerson = 4;
        questionPrefix = 'Vous tous, ';
      } else if (answerPerson === 4) {
        questionPerson = 3;
      }

      const askNegativeQuestionForSiTrap =
        answerNegation === 'none' &&
        !tense.isImperative &&
        this.qaScenarioStep % 3 === 0;

      const questionConj = pack.conjugate(
        verbId,
        tenseId,
        questionPerson,
        askNegativeQuestionForSiTrap ? 'pas' : 'none'
      );

      let answerCueBadge: string;
      if (askNegativeQuestionForSiTrap) {
        answerCueBadge = 'Affirmative (Si !)';
      } else if (answerNegation === 'none') {
        answerCueBadge = 'Oui !';
      } else if (answerNegation === 'jamais') {
        answerCueBadge = 'Non, jamais !';
      } else if (answerNegation === 'plus') {
        answerCueBadge = 'Non, plus !';
      } else {
        answerCueBadge = 'Non !';
      }

      const triggerPrefix = `${tense.rassiasTrigger} `;
      const questionDisplay = `${questionPrefix}${triggerPrefix}${questionConj.fullForm}${tailSuffix} ?`;
      const spokenCueWord = askNegativeQuestionForSiTrap
        ? 'Affirmatif !'
        : answerCueBadge;

      return {
        qa: {
          questionPromptDisplay: questionDisplay,
          questionSpokenByAT: `${questionDisplay} — ${spokenCueWord}`,
          answerCueBadge,
          requiresFrenchSi: askNegativeQuestionForSiTrap,
        },
        requiresFrenchSi: askNegativeQuestionForSiTrap,
      };
    }

    // Spanish Question <-> Answer Flip
    let questionPerson: PersonIndex = answerPerson;
    let questionSubjectLabel = '';

    if (answerPerson === 0) {
      if (this.qaScenarioStep % 2 === 1) {
        questionPerson = 1;
        questionSubjectLabel = 'tú';
      } else {
        questionPerson = 2;
        questionSubjectLabel = 'Señor, usted';
      }
    } else if (answerPerson === 1) {
      questionPerson = 0;
      questionSubjectLabel = 'yo';
    } else if (answerPerson === 3) {
      if (this.config.includeVosotros) {
        questionPerson = 4;
        questionSubjectLabel = 'vosotros';
      } else {
        questionPerson = 5;
        questionSubjectLabel = 'ustedes todos';
      }
    } else if (answerPerson === 4) {
      questionPerson = 3;
      questionSubjectLabel = 'nosotros';
    } else if (answerPerson === 2) {
      questionPerson = 2;
      questionSubjectLabel = 'él';
    } else {
      questionPerson = 5;
      questionSubjectLabel = 'ellos';
    }

    const questionConj = pack.conjugate(verbId, tenseId, questionPerson, 'none');
    let answerCueBadge: string;
    if (answerNegation === 'none') {
      answerCueBadge = '¡Sí!';
    } else if (answerNegation === 'jamais') {
      answerCueBadge = '¡No, nunca!';
    } else if (answerNegation === 'plus') {
      answerCueBadge = '¡Ya no!';
    } else {
      answerCueBadge = '¡No!';
    }

    const questionDisplay = `¿${tense.rassiasTrigger} ${questionSubjectLabel} ${questionConj.verbForm}${tailSuffix}?`;
    return {
      qa: {
        questionPromptDisplay: questionDisplay,
        questionSpokenByAT: `${questionDisplay} — ${answerCueBadge}`,
        answerCueBadge,
      },
      requiresFrenchSi: false,
    };
  }

  private buildNegationCueLabel(negation: NegationType): string {
    if (negation === 'none') return '';
    if (this.config.language === 'fr') {
      if (negation === 'jamais') return 'Non, jamais !';
      if (negation === 'plus') return 'Non, plus !';
      return 'Non ! (Négatif)';
    }
    if (negation === 'jamais') return '¡Nunca!';
    if (negation === 'plus') return '¡Ya no!';
    return '¡No! (Negativo)';
  }

  private buildPromptCard(
    verbId: string,
    tenseId: string,
    person: PersonIndex,
    negation: NegationType,
    isBoomerang: boolean,
    isPingPongSecondBeat: boolean,
    activePool?: ResolvedSubModulePool | null,
    poolSource: 'focus' | 'review' | 'straggler' = 'focus'
  ): DrillPromptCard {
    const pack = getLanguagePack(this.config.language);
    const verb = pack.verbs.find((v) => v.id === verbId) ?? pack.verbs[0];
    const tense = pack.tenses.find((t) => t.id === tenseId) ?? pack.tenses[0];
    const pronoun = pack.pronouns[person];
    const target = pack.conjugate(verb.id, tense.id, person, negation);

    const lexicalChunk = activePool
      ? pickChunkForVerb(verb.id, activePool, this.courseWeightingStep)
      : undefined;
    const requireTailInResponse = Boolean(
      activePool &&
        lexicalChunk &&
        this.config.chunkDrillMode === 'full_sentence'
    );

    let qaMetadata: QuestionAnswerMetadata | undefined;
    if (this.config.cadence === 'qa_flip' && !tense.isImperative) {
      const qaBuilt = this.buildQuestionAnswerMetadata(
        verb.id,
        tense.id,
        person,
        negation,
        lexicalChunk
      );
      qaMetadata = qaBuilt.qa;
      if (qaBuilt.requiresFrenchSi) {
        target.requiresFrenchSi = true;
      }
    }

    const negCue = this.buildNegationCueLabel(negation);
    const verbWithTailCue =
      requireTailInResponse && lexicalChunk
        ? `${verb.infinitive} ${lexicalChunk.target}`
        : verb.infinitive;

    let atSpokenCue: string;
    if (isPingPongSecondBeat) {
      atSpokenCue = negCue;
    } else if (qaMetadata) {
      atSpokenCue = qaMetadata.questionSpokenByAT;
    } else if (tense.isImperative) {
      atSpokenCue = `${verbWithTailCue} — ${pronoun.spokenPrimary} ${negCue}`.trim();
    } else if (this.config.useNaturalTriggers) {
      atSpokenCue = `${verbWithTailCue} — ${tense.rassiasTrigger} ${pronoun.spokenPrimary}${negCue ? ` — ${negCue}` : ''}`;
    } else {
      atSpokenCue = `${verbWithTailCue}, ${tense.name} — ${pronoun.spokenPrimary}${negCue ? ` — ${negCue}` : ''}`;
    }

    const repeatWord = this.config.language === 'fr' ? 'Répétez' : '¡Repita!';
    const baseExpectedSpoken = target.requiresFrenchSi
      ? `Si, ${target.fullForm}`
      : target.fullForm;
    const expectedSpokenForm =
      requireTailInResponse && lexicalChunk
        ? `${baseExpectedSpoken} ${lexicalChunk.target}`
        : baseExpectedSpoken;
    const atSpokenCorrection = `${expectedSpokenForm} ! ${repeatWord} !`;

    return {
      id: `${verb.id}-${tense.id}-${person}-${negation}-${Date.now()}`,
      language: this.config.language,
      promptKind: 'verb_conjugation',
      verbId: verb.id,
      infinitive: verb.infinitive,
      translation: verb.translation,
      tenseId: tense.id,
      tenseName: tense.name,
      rassiasTrigger: tense.rassiasTrigger,
      rassiasTriggerEnglish: tense.rassiasTriggerEnglish,
      person,
      negation,
      pronounDisplay: pronoun.display,
      pronounSpoken: pronoun.spokenPrimary,
      target,
      lexicalChunk,
      requireTailInResponse,
      poolSource,
      atSpokenCue,
      atSpokenCorrection,
      isBoomerang,
      isPingPongSecondBeat,
      qaMetadata,
    };
  }
}
