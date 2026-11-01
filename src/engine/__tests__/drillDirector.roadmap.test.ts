import { describe, expect, it } from 'vitest';
import { loadInitialSettings } from '../../state/useAppSettings';
import { RassiasDrillDirector } from '../drillDirector';

describe('Build Module 2 — Atomic Mastery, Option C Chunks, 70/30 Weighting & 2-Pass Gate (Test Gate 2)', () => {
  it('fixes Day-1 defaults to start on Sub-Module 1.1 with Present tense only and Option C two_part mode', () => {
    const defaults = loadInitialSettings();
    expect(defaults.courseModeEnabled).toBe(true);
    expect(defaults.chunkDrillMode).toBe('two_part');
    expect(defaults.activeSubModuleIdByLang).toEqual({
      fr: 'fr-1.1',
      es: 'es-1.1',
    });
    expect(defaults.activeTenseIdsByLang.fr).toEqual(['present']);
    expect(defaults.activeTenseIdsByLang.es).toEqual(['presente']);
    expect(defaults.activeVerbIdsByLang.fr).toEqual(['etre', 'avoir', 'aller']);
    expect(defaults.activeVerbIdsByLang.es).toEqual(['ser', 'estar', 'tener']);
  });

  it('maintains a 70% Focus / 30% Review split in Course Sub-Module mode', () => {
    const director = new RassiasDrillDirector({
      language: 'es',
      activeVerbIds: [],
      activeTenseIds: [],
      activeSubModuleId: 'es-2.2', // Focus verbs: poder, querer, deber, saber
      cadence: 'substitution',
      polarityMode: 'affirmative',
      includeVosotros: false,
      useNaturalTriggers: true,
    });

    let focusCount = 0;
    let reviewCount = 0;
    const focusVerbs = new Set(['poder', 'querer', 'deber', 'saber']);

    for (let i = 0; i < 200; i++) {
      const card = director.nextPrompt();
      if (card.poolSource === 'focus') {
        focusCount += 1;
        expect(focusVerbs.has(card.verbId)).toBe(true);
      } else {
        reviewCount += 1;
        expect(focusVerbs.has(card.verbId)).toBe(false);
      }
    }

    expect(focusCount).toBe(140); // 70% of 200
    expect(reviewCount).toBe(60); // 30% of 200
  });

  it('supports Option C "two_part" mode: runs 5-snap Non-Verb Chunk Warmup before the 15 Verb Conjugation snaps', () => {
    const director = new RassiasDrillDirector({
      language: 'es',
      activeVerbIds: [],
      activeTenseIds: [],
      activeSubModuleId: 'es-1.1',
      chunkDrillMode: 'two_part',
      cadence: 'substitution',
      polarityMode: 'affirmative',
      includeVosotros: false,
      useNaturalTriggers: true,
    });

    const initialReport = director.startSubModuleCheck('es-1.1', {
      targetVerbSnaps: 5,
      chunkWarmupCount: 3,
      currentPassesCompleted: 0,
    });
    expect(initialReport.chunkSnapsTotal).toBe(3);
    expect(initialReport.targetVerbSnaps).toBe(5);

    // Snaps 1..3: Chunk Warmup cards
    for (let c = 0; c < 3; c++) {
      const card = director.nextPrompt();
      expect(card.promptKind).toBe('chunk_warmup');
      expect(card.lexicalChunk).toBeDefined();
      const res = director.submitResponse(card.lexicalChunk!.target);
      expect(res.evaluation.isCorrect).toBe(true);
    }

    // Snaps 4..8: Standard Verb Conjugation cards (speaking either bare verb or verb+tail is accepted)
    for (let v = 0; v < 5; v++) {
      const card = director.nextPrompt();
      expect(card.promptKind).toBe('verb_conjugation');
      expect(card.requireTailInResponse).toBe(false);
      const res = director.submitResponse(card.target.fullForm);
      expect(res.evaluation.isCorrect).toBe(true);
    }

    const finalReport = director.getSubModuleCheckReport()!;
    expect(finalReport.isComplete).toBe(true);
    expect(finalReport.chunkAccuracyPct).toBe(100);
    expect(finalReport.firstTryAccuracyPct).toBe(100);
    expect(finalReport.outcome).toBe('pass_1_complete');
    expect(finalReport.newPassesCompleted).toBe(1);
  });

  it('supports Option C "full_sentence" mode: requires speaking the attached Non-Verb sentence tail', () => {
    const director = new RassiasDrillDirector({
      language: 'fr',
      activeVerbIds: [],
      activeTenseIds: [],
      activeSubModuleId: 'fr-1.1',
      chunkDrillMode: 'full_sentence',
      cadence: 'substitution',
      polarityMode: 'affirmative',
      includeVosotros: false,
      useNaturalTriggers: true,
    });

    const card = director.nextPrompt();
    expect(card.promptKind).toBe('verb_conjugation');
    expect(card.lexicalChunk).toBeDefined();
    expect(card.requireTailInResponse).toBe(true);

    // 1. Speaking only the pronoun + verb WITHOUT the tail triggers a 'missing_tail' repeat loop!
    const bareRes = director.submitResponse(card.target.fullForm);
    expect(bareRes.evaluation.isCorrect).toBe(false);
    expect(bareRes.evaluation.matchType).toBe('missing_tail');
    expect(bareRes.enteredRepeatLoop).toBe(true);

    // 2. Speaking the full sentence WITH the tail completes the repeat loop!
    const fullPhrase = `${card.target.fullForm} ${card.lexicalChunk!.target}`;
    const fullRes = director.submitResponse(fullPhrase);
    expect(fullRes.evaluation.isCorrect).toBe(true);
    expect(fullRes.completedRepeatLoop).toBe(true);
  });

  it('enforces the 2-Pass Graduation Gate: <80% triggers Encore, Pass 1 reaches pass_1_complete, Pass 2 graduates', () => {
    const director = new RassiasDrillDirector({
      language: 'fr',
      activeVerbIds: [],
      activeTenseIds: [],
      activeSubModuleId: 'fr-1.1',
      chunkDrillMode: 'two_part',
      cadence: 'substitution',
      polarityMode: 'affirmative',
      includeVosotros: true,
      useNaturalTriggers: true,
    });

    // --- RUN 1: Score 11/15 (73%) -> Outcome: 'encore_required' (newPassesCompleted stays 0) ---
    director.startSubModuleCheck('fr-1.1', {
      targetVerbSnaps: 15,
      chunkWarmupCount: 0,
      currentPassesCompleted: 0,
    });

    for (let i = 0; i < 15; i++) {
      const card = director.nextPrompt();
      if (i < 4) {
        // Miss first 4 on first try, then complete repeat loop
        const miss = director.submitResponse('mauvaise réponse');
        expect(miss.enteredRepeatLoop).toBe(true);
        const fixed = director.submitResponse(card.target.fullForm);
        expect(fixed.completedRepeatLoop).toBe(true);
      } else {
        const hit = director.submitResponse(card.target.fullForm);
        expect(hit.evaluation.isCorrect).toBe(true);
      }
    }

    const run1Report = director.getSubModuleCheckReport()!;
    expect(run1Report.isComplete).toBe(true);
    expect(run1Report.firstTryAccuracyPct).toBe(73);
    expect(run1Report.outcome).toBe('encore_required');
    expect(run1Report.newPassesCompleted).toBe(0);
    expect(run1Report.missedForms.length).toBeGreaterThan(0);

    // --- RUN 2 (Pass 1 of 2): Score 13/15 (87%) -> Outcome: 'pass_1_complete' (newPassesCompleted = 1) ---
    director.startSubModuleCheck('fr-1.1', {
      targetVerbSnaps: 15,
      chunkWarmupCount: 0,
      currentPassesCompleted: 0,
    });

    for (let i = 0; i < 15; i++) {
      const card = director.nextPrompt();
      if (i < 2) {
        director.submitResponse('erreur');
        director.submitResponse(card.target.fullForm);
      } else {
        director.submitResponse(card.target.fullForm);
      }
    }

    const pass1Report = director.getSubModuleCheckReport()!;
    expect(pass1Report.isComplete).toBe(true);
    expect(pass1Report.firstTryAccuracyPct).toBe(87);
    expect(pass1Report.outcome).toBe('pass_1_complete');
    expect(pass1Report.newPassesCompleted).toBe(1);
    expect(pass1Report.requiredPasses).toBe(2);

    // --- RUN 3 (Pass 2 of 2): Score 13/15 (87%) with currentPassesCompleted=1 -> 'graduated_with_stragglers' ---
    director.startSubModuleCheck('fr-1.1', {
      targetVerbSnaps: 15,
      chunkWarmupCount: 0,
      currentPassesCompleted: 1,
    });

    for (let i = 0; i < 15; i++) {
      const card = director.nextPrompt();
      if (i < 2) {
        director.submitResponse('erreur');
        director.submitResponse(card.target.fullForm);
      } else {
        director.submitResponse(card.target.fullForm);
      }
    }

    const pass2Report = director.getSubModuleCheckReport()!;
    expect(pass2Report.isComplete).toBe(true);
    expect(pass2Report.firstTryAccuracyPct).toBe(87);
    expect(pass2Report.outcome).toBe('graduated_with_stragglers');
    expect(pass2Report.newPassesCompleted).toBe(2);
    expect(director.getStragglerQueue().length).toBeGreaterThan(0);
  });

  it('tracks atomic (verbId:tenseId) pair mastery separately across tenses and graduates stragglers after 2 hits', () => {
    const director = new RassiasDrillDirector({
      language: 'es',
      activeVerbIds: ['hablar'],
      activeTenseIds: ['presente'],
      cadence: 'substitution',
      includeVosotros: false,
      useNaturalTriggers: true,
    });

    // Miss person 0 in presente -> creates straggler for hablar:presente:0
    const c1 = director.nextPrompt();
    director.submitResponse('wrong');
    director.submitResponse(c1.target.fullForm);

    expect(director.getStragglerQueue().length).toBe(1);
    expect(director.getPairMasteryMap()['hablar:presente'].attempts).toBe(1);
    expect(director.getPairMasteryMap()['hablar:presente'].correctFirstTry).toBe(0);
    expect(director.getPairMasteryMap()['hablar:preterito_indefinido']).toBeUndefined();

    // Hit the same straggler twice on first try -> graduates out of stragglerQueue
    const straggler = director.getStragglerQueue()[0];
    director.setStragglerQueue([{ ...straggler, consecutiveCorrect: 1 }]);

    // Advance until person 0 comes back around (via boomerang in 3 prompts)
    director.nextPrompt(); // p1
    director.nextPrompt(); // p2
    const boomerangCard = director.nextPrompt(); // boomerang p0!
    expect(boomerangCard.isBoomerang).toBe(true);
    expect(boomerangCard.person).toBe(0);

    const hitRes = director.submitResponse(boomerangCard.target.fullForm);
    expect(hitRes.evaluation.isCorrect).toBe(true);
    expect(director.getStragglerQueue().length).toBe(0);
  });
});
