import { getLanguagePack } from '../languages';
import {
  ConjugationResult,
  LanguageCode,
  NegationType,
  PersonIndex,
  PolarityMode,
} from '../languages/types';
import {
  evaluateSpokenConjugation,
  EvaluationOptions,
  EvaluationResult,
} from './evaluator';

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

export interface DrillDirectorConfig {
  language: LanguageCode;
  activeVerbIds: string[];
  activeTenseIds: string[];
  cadence: RassiasDrillCadence;
  polarityMode?: PolarityMode;
  enableNegativeAdverbs?: boolean;
  includeVosotros: boolean;
  useNaturalTriggers: boolean;
}

interface PendingPingPongBeat {
  verbId: string;
  tenseId: string;
  person: PersonIndex;
  negation: Exclude<NegationType, 'none'>;
}

/**
 * Stateful Dartmouth Rassias Method Drill Director.
 * Manages prompt sequencing across all 4 Rassias cadences, 2-Beat Ping-Pong Negation,
 * Question <-> Answer flips, the "Répétez !" immediate correction loop,
 * and the Boomerang point-back queue.
 */
export class RassiasDrillDirector {
  private config: DrillDirectorConfig;
  private boomerangQueue: BoomerangQueueItem[] = [];
  private pendingPingPong: PendingPingPongBeat | null = null;
  private currentVerbIdx = 0;
  private currentTenseIdx = 0;
  private currentPersonStep = 0;
  private qaScenarioStep = 0;
  private negAdverbStep = 0;
  private mixedPolarityStep = 0;
  private currentPrompt: DrillPromptCard | null = null;
  private inRepeatLoop = false;
  private masteryMap: Record<string, VerbMasteryStats> = {};

  constructor(
    config: DrillDirectorConfig,
    initialMastery?: Record<string, VerbMasteryStats>
  ) {
    this.config = {
      polarityMode: 'affirmative',
      enableNegativeAdverbs: true,
      ...config,
    };
    if (initialMastery) {
      this.masteryMap = { ...initialMastery };
    }
  }

  public updateConfig(next: Partial<DrillDirectorConfig>): void {
    const languageChanged =
      next.language !== undefined && next.language !== this.config.language;
    this.config = { ...this.config, ...next };

    if (languageChanged) {
      this.inRepeatLoop = false;
      this.pendingPingPong = null;
      this.boomerangQueue = [];
      this.currentVerbIdx = 0;
      this.currentTenseIdx = 0;
      this.currentPersonStep = 0;
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

  public getBoomerangQueueLength(): number {
    return this.boomerangQueue.length;
  }

  public isInRepeatLoop(): boolean {
    return this.inRepeatLoop;
  }

  public getCurrentPrompt(): DrillPromptCard | null {
    return this.currentPrompt;
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

  /**
   * Generates the next Rassias drill prompt card, prioritizing:
   * 1. Beat 2 of a Ping-Pong Negation Flip (if Beat 1 just succeeded)
   * 2. Any due Boomerang return card
   * 3. The selected Rassias Drill Cadence
   */
  public nextPrompt(): DrillPromptCard {
    this.inRepeatLoop = false;
    const pack = getLanguagePack(this.config.language);

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
        true
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
          false
        );
        this.currentPrompt = card;
        return card;
      }
    }

    // 3. Determine active verb and tense pools
    const verbPool =
      this.config.activeVerbIds.length > 0
        ? this.config.activeVerbIds
        : pack.verbs.filter((v) => v.tier === 1).map((v) => v.id);

    const tensePool =
      this.config.activeTenseIds.length > 0
        ? this.config.activeTenseIds
        : [pack.tenses[0].id];

    // Determine negation for this prompt
    const polarity = this.config.polarityMode ?? 'affirmative';
    let negation: NegationType = 'none';
    if (polarity === 'negative') {
      negation = this.pickNextNegationType();
    } else if (polarity === 'mixed') {
      this.mixedPolarityStep += 1;
      negation = this.mixedPolarityStep % 2 === 0 ? this.pickNextNegationType() : 'none';
    } else {
      // 'affirmative' or Beat 1 of 'ping_pong' starts affirmative
      negation = 'none';
    }

    let verbId: string;
    let tenseId: string;
    let person: PersonIndex;

    if (this.config.cadence === 'substitution' || this.config.cadence === 'qa_flip') {
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
        this.currentPersonStep = (this.currentPersonStep + 1) % validPersons.length;
        this.currentVerbIdx = (this.currentVerbIdx + 1) % verbPool.length;
      }
    } else {
      verbId = verbPool[Math.floor(Math.random() * verbPool.length)];
      tenseId = tensePool[Math.floor(Math.random() * tensePool.length)];
      const validPersons = this.getValidPersonsForTense(tenseId);
      person = validPersons[Math.floor(Math.random() * validPersons.length)];
    }

    const card = this.buildPromptCard(verbId, tenseId, person, negation, false, false);
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
  } {
    if (!this.currentPrompt) {
      throw new Error('No active prompt in RassiasDrillDirector');
    }

    const evaluation = evaluateSpokenConjugation(
      transcript,
      this.currentPrompt.target,
      options
    );

    if (this.inRepeatLoop) {
      if (evaluation.isCorrect) {
        this.inRepeatLoop = false;
        // If Beat 1 of Ping-Pong finished via repeat loop, still queue Beat 2 so they flip it!
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
          };
        }
        return {
          evaluation,
          enteredRepeatLoop: false,
          completedRepeatLoop: true,
          queuedBoomerang: false,
        };
      }
      return {
        evaluation,
        enteredRepeatLoop: true,
        completedRepeatLoop: false,
        queuedBoomerang: false,
      };
    }

    this.recordAttempt(this.currentPrompt.verbId, evaluation.isCorrect);

    if (evaluation.isCorrect) {
      // If we are in Ping-Pong mode and just nailed Beat 1 (Affirmative), schedule Beat 2 (Negative Flip)!
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
        };
      }
      return {
        evaluation,
        enteredRepeatLoop: false,
        completedRepeatLoop: false,
        queuedBoomerang: false,
      };
    }

    // Missed on first try -> Enter "Répétez !" loop and queue for Boomerang return in 3 prompts!
    this.inRepeatLoop = true;
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
    };
  }

  public triggerBeatTimeout(): {
    enteredRepeatLoop: boolean;
    queuedBoomerang: boolean;
    atCorrectionText: string;
  } {
    if (!this.currentPrompt) {
      throw new Error('No active prompt in RassiasDrillDirector');
    }

    if (!this.inRepeatLoop) {
      this.recordAttempt(this.currentPrompt.verbId, false);
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
    };
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

  private recordAttempt(verbId: string, isCorrect: boolean): void {
    const existing = this.masteryMap[verbId] ?? {
      verbId,
      attempts: 0,
      correctFirstTry: 0,
      streak: 0,
      lastPracticedAt: 0,
    };

    this.masteryMap[verbId] = {
      verbId,
      attempts: existing.attempts + 1,
      correctFirstTry: existing.correctFirstTry + (isCorrect ? 1 : 0),
      streak: isCorrect ? existing.streak + 1 : 0,
      lastPracticedAt: Date.now(),
    };
  }

  private getValidPersonsForTense(tenseId: string): PersonIndex[] {
    const pack = getLanguagePack(this.config.language);
    const tense = pack.tenses.find((t) => t.id === tenseId);
    const basePersons: PersonIndex[] = tense?.validPersons ?? [0, 1, 2, 3, 4, 5];

    if (this.config.language === 'es' && !this.config.includeVosotros) {
      return basePersons.filter((p) => p !== 4);
    }
    return basePersons;
  }

  /**
   * Builds authentic Dartmouth Rassias Question <-> Answer metadata for a target answer person:
   * - Target Answer = je / yo (0):
   *   Alternates between informal `tu / tú` question ("Tu as fini ?")
   *   and polite singular `Monsieur/Madame, vous` / `Señor(a), ¿usted...?` question!
   * - Target Answer = tu / tú (1) or vous / vosotros (4):
   *   Flips so the AT asks with `je/nous` ("Est-ce que je...?" / "Vous me voyez ?") OR maps the Q&A pairs cleanly.
   * - Target Answer = nous / nosotros (3):
   *   AT asks with group plural `Vous tous, vous... ?` / `¿Vosotros...?` / `¿Ustedes todos...?`
   * - Target Answer = il/elle (2) or ils/elles (5):
   *   AT asks in the 3rd person (`Il vient ?` / `¿Ellos vienen?`)
   */
  private buildQuestionAnswerMetadata(
    verbId: string,
    tenseId: string,
    answerPerson: PersonIndex,
    answerNegation: NegationType
  ): { qa: QuestionAnswerMetadata; requiresFrenchSi: boolean } {
    const pack = getLanguagePack(this.config.language);
    const tense = pack.tenses.find((t) => t.id === tenseId) ?? pack.tenses[0];
    this.qaScenarioStep += 1;

    if (this.config.language === 'fr') {
      let questionPerson: PersonIndex = answerPerson;
      let questionPrefix = '';

      if (answerPerson === 0) {
        // Flip to 'je': alternate between 'tu' and polite singular 'Monsieur/Madame, vous'
        if (this.qaScenarioStep % 2 === 1) {
          questionPerson = 1; // tu
        } else {
          questionPerson = 4; // vous (polite singular)
          questionPrefix = 'Monsieur, ';
        }
      } else if (answerPerson === 1) {
        questionPerson = 0; // "Est-ce que je..." -> "Oui, tu..."
      } else if (answerPerson === 3) {
        questionPerson = 4; // vous (plural) -> nous
        questionPrefix = 'Vous tous, ';
      } else if (answerPerson === 4) {
        questionPerson = 3; // "Nous..." -> "Vous..."
      }

      // Check if we should trigger the classic French "Si !" trap
      // (When the target answer is affirmative, every 3rd Q&A asks a NEGATIVE question so the answer requires "Si !")
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

      const triggerPrefix = tense.usesSubjunctiveCue
        ? `${tense.rassiasTrigger} `
        : `${tense.rassiasTrigger} `;

      const questionDisplay = `${questionPrefix}${triggerPrefix}${questionConj.fullForm} ?`;
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
      // Flip to 'yo': alternate between 'tú' and polite singular 'Señor, ¿usted...?'
      if (this.qaScenarioStep % 2 === 1) {
        questionPerson = 1; // tú
        questionSubjectLabel = 'tú';
      } else {
        questionPerson = 2; // usted
        questionSubjectLabel = 'Señor, usted';
      }
    } else if (answerPerson === 1) {
      questionPerson = 0;
      questionSubjectLabel = 'yo';
    } else if (answerPerson === 3) {
      if (this.config.includeVosotros) {
        questionPerson = 4; // vosotros -> nosotros
        questionSubjectLabel = 'vosotros';
      } else {
        questionPerson = 5; // ustedes todos -> nosotros
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

    const questionDisplay = `¿${tense.rassiasTrigger} ${questionSubjectLabel} ${questionConj.verbForm}?`;
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
    isPingPongSecondBeat: boolean
  ): DrillPromptCard {
    const pack = getLanguagePack(this.config.language);
    const verb = pack.verbs.find((v) => v.id === verbId) ?? pack.verbs[0];
    const tense = pack.tenses.find((t) => t.id === tenseId) ?? pack.tenses[0];
    const pronoun = pack.pronouns[person];
    const target = pack.conjugate(verb.id, tense.id, person, negation);

    let qaMetadata: QuestionAnswerMetadata | undefined;
    if (this.config.cadence === 'qa_flip' && !tense.isImperative) {
      const qaBuilt = this.buildQuestionAnswerMetadata(
        verb.id,
        tense.id,
        person,
        negation
      );
      qaMetadata = qaBuilt.qa;
      if (qaBuilt.requiresFrenchSi) {
        target.requiresFrenchSi = true;
      }
    }

    const negCue = this.buildNegationCueLabel(negation);

    // Build the Virtual AT's spoken cue
    let atSpokenCue: string;
    if (isPingPongSecondBeat) {
      // On Beat 2 of a Ping-Pong Negation drill, the AT simply snaps the negative trigger word!
      atSpokenCue = negCue;
    } else if (qaMetadata) {
      atSpokenCue = qaMetadata.questionSpokenByAT;
    } else if (tense.isImperative) {
      atSpokenCue = `${verb.infinitive} — ${pronoun.spokenPrimary} ${negCue}`;
    } else if (this.config.useNaturalTriggers) {
      atSpokenCue = `${verb.infinitive} — ${tense.rassiasTrigger} ${pronoun.spokenPrimary}${negCue ? ` — ${negCue}` : ''}`;
    } else {
      atSpokenCue = `${verb.infinitive}, ${tense.name} — ${pronoun.spokenPrimary}${negCue ? ` — ${negCue}` : ''}`;
    }

    const repeatWord = this.config.language === 'fr' ? 'Répétez' : '¡Repita!';
    const expectedSpokenForm = target.requiresFrenchSi
      ? `Si, ${target.fullForm}`
      : target.fullForm;
    const atSpokenCorrection = `${expectedSpokenForm} ! ${repeatWord} !`;

    return {
      id: `${verb.id}-${tense.id}-${person}-${negation}-${Date.now()}`,
      language: this.config.language,
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
      atSpokenCue,
      atSpokenCorrection,
      isBoomerang,
      isPingPongSecondBeat,
      qaMetadata,
    };
  }
}
