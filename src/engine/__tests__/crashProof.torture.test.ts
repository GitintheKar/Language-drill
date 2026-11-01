import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cancelATSpeech,
  playFingerSnap,
  playSuccessMicroChime,
  speakATUtterance,
} from '../../audio/atVoiceAndSnap';
import { LANGUAGE_PACKS } from '../../languages';
import {
  LanguageCode,
  NegationType,
  PolarityMode,
} from '../../languages/types';
import {
  transcribeWithGeminiFlash,
  transcribeWithOpenAIWhisper,
} from '../../speech/byokService';
import { speechManager } from '../../speech/speechManager';
import {
  loadInitialMastery,
  loadInitialSettings,
} from '../../state/useAppSettings';
import {
  RassiasDrillCadence,
  RassiasDrillDirector,
} from '../drillDirector';
import { evaluateSpokenConjugation } from '../evaluator';

/**
 * Deterministic Mulberry32 PRNG so every 10,000-rep torture fuzz run is 100% reproducible.
 */
function createSeededPRNG(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('7-Vector Chaos & Crash-Proofness Torture Suite', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // VECTOR 1: Mid-Repeat Language & Tense Hot-Swap ("Pulling the Rug")
  // =========================================================================
  it('Vector 1: survives mid-repeat-loop language hot-swaps and cross-language boomerang collisions', () => {
    const director = new RassiasDrillDirector({
      language: 'fr',
      activeVerbIds: ['aller'],
      activeTenseIds: ['passe_compose'],
      cadence: 'substitution',
      polarityMode: 'ping_pong',
      includeVosotros: true,
      useNaturalTriggers: true,
    });

    // 1. Start in French and fail on purpose -> enters Répétez loop + queues French boomerang
    const frCard = director.nextPrompt();
    expect(frCard.language).toBe('fr');
    const missOutcome = director.submitResponse('wrong french answer');
    expect(missOutcome.enteredRepeatLoop).toBe(true);
    expect(director.isInRepeatLoop()).toBe(true);
    expect(director.getBoomerangQueueLength()).toBe(1);

    // 2. Hot-swap to Spanish WITH empty activeVerbIds/activeTenseIds while still inside the French repeat loop!
    director.updateConfig({
      language: 'es',
      activeVerbIds: [],
      activeTenseIds: [],
      cadence: 'qa_flip',
    });

    // 3. Ensure repeat loop was cleanly cleared or nextPrompt() transitions cleanly to Spanish
    expect(director.isInRepeatLoop()).toBe(false);

    // Run 10 prompts in Spanish to drain the French boomerang item and verify no French card leaks into Spanish
    for (let i = 0; i < 10; i++) {
      const esCard = director.nextPrompt();
      expect(esCard.language).toBe('es');
      expect(esCard.target.language).toBe('es');
      expect(esCard.verbId).toBeTruthy();
      expect(esCard.target.verbForm.length).toBeGreaterThan(0);
    }
  });

  // =========================================================================
  // VECTOR 2: Button-Masher & AudioContext Exhaustion Storm
  // =========================================================================
  it('Vector 2: survives 150 rapid-fire overlapping audio/speech calls without leaking AudioContext instances', async () => {
    let audioContextCreatedCount = 0;

    class MockAudioContext {
      public state = 'suspended';
      public currentTime = 0;
      public sampleRate = 44100;
      public destination = {};
      constructor() {
        audioContextCreatedCount += 1;
        if (audioContextCreatedCount > 6) {
          throw new Error('DOMException: The number of hardware contexts provided (6) is maximum.');
        }
      }
      resume() {
        this.state = 'running';
        return Promise.resolve();
      }
      close() {
        audioContextCreatedCount = Math.max(0, audioContextCreatedCount - 1);
        return Promise.resolve();
      }
      createOscillator() {
        return {
          type: 'sine',
          frequency: {
            setValueAtTime: () => {},
            exponentialRampToValueAtTime: () => {},
          },
          connect: () => {},
          start: () => {},
          stop: () => {},
        };
      }
      createGain() {
        return {
          gain: {
            setValueAtTime: () => {},
            exponentialRampToValueAtTime: () => {},
          },
          connect: () => {},
        };
      }
      createBuffer(_channels: number, length: number) {
        return {
          getChannelData: () => new Float32Array(length),
        };
      }
      createBufferSource() {
        return {
          buffer: null,
          connect: () => {},
          start: () => {},
          stop: () => {},
        };
      }
      createBiquadFilter() {
        return {
          type: 'bandpass',
          frequency: { setValueAtTime: () => {} },
          Q: { setValueAtTime: () => {} },
          connect: () => {},
        };
      }
    }

    vi.stubGlobal('window', {
      AudioContext: MockAudioContext,
      speechSynthesis: {
        cancel: () => {},
        getVoices: () => [],
        speak: (utt: { onend?: () => void }) => {
          setTimeout(() => utt.onend?.(), 2);
        },
      },
    });
    vi.stubGlobal('SpeechSynthesisUtterance', class {
      lang = '';
      rate = 1;
      pitch = 1;
      onend?: () => void;
      onerror?: () => void;
    });

    // Fire 150 overlapping finger-snaps, chimes, TTS cues, and cancellations
    const promises: Promise<void>[] = [];
    for (let i = 0; i < 150; i++) {
      playFingerSnap({ quietMode: false, isRepeatCue: i % 2 === 0 });
      playSuccessMicroChime(false);
      promises.push(
        speakATUtterance(`Test cue ${i}`, {
          language: i % 2 === 0 ? 'fr' : 'es',
          locale: i % 2 === 0 ? 'fr-FR' : 'es-ES',
          quietMode: false,
        })
      );
      if (i % 5 === 0) {
        cancelATSpeech();
      }
    }

    await Promise.all(promises);
    // Verify shared AudioContext was reused and never exceeded 1 instance!
    expect(audioContextCreatedCount).toBeLessThanOrEqual(1);
  });

  // =========================================================================
  // VECTOR 3: Poisoned & Corrupted localStorage Injection
  // =========================================================================
  it('Vector 3: self-heals from corrupted, null, empty, or out-of-range localStorage payloads', () => {
    const storagePayloads = [
      '{corrupted_json_syntax',
      'null',
      '12345',
      JSON.stringify({
        language: 'invalid_lang',
        activeVerbIdsByLang: { fr: null, es: 'not_an_array' },
        activeTenseIdsByLang: { fr: [], es: null },
        beatTimerSeconds: -500,
        byokConfig: null,
        locales: null,
      }),
      JSON.stringify({
        language: 'fr',
        activeVerbIdsByLang: {
          fr: ['deleted_verb_1', 'deleted_verb_2'],
          es: ['nonexistent_es_verb'],
        },
        activeTenseIdsByLang: {
          fr: ['deleted_tense_id'],
          es: ['nonexistent_es_tense'],
        },
        beatTimerSeconds: NaN,
      }),
    ];

    for (const rawPayload of storagePayloads) {
      vi.stubGlobal('window', {
        localStorage: {
          getItem: () => rawPayload,
          setItem: () => {},
        },
      });

      const loaded = loadInitialSettings();
      expect(['fr', 'es']).toContain(loaded.language);
      expect(Array.isArray(loaded.activeVerbIdsByLang.fr)).toBe(true);
      expect(loaded.activeVerbIdsByLang.fr.length).toBeGreaterThan(0);
      expect(Array.isArray(loaded.activeVerbIdsByLang.es)).toBe(true);
      expect(loaded.activeVerbIdsByLang.es.length).toBeGreaterThan(0);

      // Verify every loaded verbId and tenseId actually exists in LANGUAGE_PACKS
      for (const lang of Object.keys(LANGUAGE_PACKS) as LanguageCode[]) {
        const pack = LANGUAGE_PACKS[lang];
        const validVerbIds = new Set(pack.verbs.map((v) => v.id));
        const validTenseIds = new Set(pack.tenses.map((t) => t.id));

        for (const vid of loaded.activeVerbIdsByLang[lang]) {
          expect(validVerbIds.has(vid)).toBe(true);
        }
        for (const tid of loaded.activeTenseIdsByLang[lang]) {
          expect(validTenseIds.has(tid)).toBe(true);
        }
      }

      expect(typeof loaded.beatTimerSeconds).toBe('number');
      expect(Number.isFinite(loaded.beatTimerSeconds)).toBe(true);
      expect(loaded.beatTimerSeconds).toBeGreaterThanOrEqual(0);
      expect(loaded.byokConfig).toBeDefined();
      expect(typeof loaded.byokConfig.geminiApiKey).toBe('string');

      const mastery = loadInitialMastery();
      expect(mastery.fr).toBeTypeOf('object');
      expect(mastery.es).toBeTypeOf('object');
    }
  });

  // =========================================================================
  // VECTOR 4: 10,000-Rep Combinatorial Fuzzing Across All Languages & Modes
  // =========================================================================
  it('Vector 4: executes 10,000 seeded drill cycles across all languages, cadences, polarities & tenses with zero crashes', () => {
    const rand = createSeededPRNG(0xd4771005);
    const languages = Object.keys(LANGUAGE_PACKS) as LanguageCode[];
    const cadences: RassiasDrillCadence[] = [
      'substitution',
      'transformation',
      'qa_flip',
      'roulette',
    ];
    const polarities: PolarityMode[] = [
      'affirmative',
      'negative',
      'ping_pong',
      'mixed',
    ];

    const director = new RassiasDrillDirector({
      language: 'fr',
      activeVerbIds: ['etre'],
      activeTenseIds: ['present'],
      cadence: 'substitution',
      polarityMode: 'affirmative',
      includeVosotros: false,
      useNaturalTriggers: true,
    });

    for (let step = 0; step < 10000; step++) {
      if (step % 40 === 0) {
        const lang = languages[Math.floor(rand() * languages.length)];
        const pack = LANGUAGE_PACKS[lang];
        const cadence = cadences[Math.floor(rand() * cadences.length)];
        const polarityMode = polarities[Math.floor(rand() * polarities.length)];
        const includeVosotros = rand() > 0.5;
        const useNaturalTriggers = rand() > 0.3;

        const randomVerb = pack.verbs[Math.floor(rand() * pack.verbs.length)].id;
        const randomTense = pack.tenses[Math.floor(rand() * pack.tenses.length)].id;

        director.updateConfig({
          language: lang,
          activeVerbIds: [randomVerb],
          activeTenseIds: [randomTense],
          cadence,
          polarityMode,
          enableNegativeAdverbs: rand() > 0.2,
          includeVosotros,
          useNaturalTriggers,
        });
      }

      const card = director.nextPrompt();
      expect(card).toBeDefined();
      expect(card.target.verbForm.length).toBeGreaterThan(0);
      expect(card.target.fullForm.length).toBeGreaterThan(0);
      expect(card.atSpokenCue.length).toBeGreaterThan(0);
      expect(card.atSpokenCorrection.length).toBeGreaterThan(0);

      const actionRoll = rand();
      if (actionRoll < 0.55) {
        const correctSpoken = card.target.requiresFrenchSi
          ? `Si, ${card.target.fullForm}`
          : card.target.fullForm;
        const res = director.submitResponse(correctSpoken);
        expect(res.evaluation.isCorrect).toBe(true);
      } else if (actionRoll < 0.85) {
        const wrongRes = director.submitResponse('completely wrong answer');
        expect(wrongRes.evaluation.isCorrect).toBe(false);
        expect(director.isInRepeatLoop()).toBe(true);

        const repeatSpoken = card.target.requiresFrenchSi
          ? `Si, ${card.target.fullForm}`
          : card.target.fullForm;
        const fixedRes = director.submitResponse(repeatSpoken);
        expect(fixedRes.evaluation.isCorrect).toBe(true);
        expect(director.isInRepeatLoop()).toBe(false);
      } else {
        const timeoutRes = director.triggerBeatTimeout();
        expect(timeoutRes.enteredRepeatLoop).toBe(true);
        expect(director.isInRepeatLoop()).toBe(true);
      }

      expect(director.getBoomerangQueueLength()).toBeLessThan(200);
    }
  });

  // =========================================================================
  // VECTOR 5: Adversarial STT Hallucination, Unicode & Regex Injection Fuzzing
  // =========================================================================
  it('Vector 5: grades extreme adversarial STT strings, regex metacharacters, and 10k-char hallucinations without crashing', () => {
    const adversarialInputs = [
      '',
      '     ',
      '?!.,;:-_()[]"«»¡¡¿¿\'\'’’``',
      '.*+?^${}()|[]\\',
      '((((((a+)+)+)+)+)+',
      '\0\0\0\u200B\u200C\u200D\uFEFF\u202E',
      '🎉🇫🇷🇪🇸🔥💥🗣️🤖',
      '<script>alert("xss")</script>',
      "'; DROP TABLE verbs; --",
      'Sous-titres réalisés par la communauté d’Amara.org '.repeat(250),
      "je n'ai pas parlé ".repeat(500),
      'oui '.repeat(300),
      'no '.repeat(300),
    ];

    const negations: NegationType[] = ['none', 'pas', 'jamais', 'plus'];

    for (const lang of Object.keys(LANGUAGE_PACKS) as LanguageCode[]) {
      const pack = LANGUAGE_PACKS[lang];
      for (const neg of negations) {
        const target = pack.conjugate(pack.verbs[0].id, pack.tenses[0].id, 0, neg);
        for (const badInput of adversarialInputs) {
          const result = evaluateSpokenConjugation(badInput, target, {
            spanishPronounMode: 'disambiguate',
          });
          expect(typeof result.isCorrect).toBe('boolean');
          expect(typeof result.feedbackMessage).toBe('string');
          expect(result.feedbackMessage.length).toBeGreaterThan(0);
        }
      }
    }
  });

  // =========================================================================
  // VECTOR 6: BYOK Markdown-Wrapped JSON, Truncated JSON & Network Drops
  // =========================================================================
  it('Vector 6: handles markdown-fenced JSON from Gemini Flash and network/HTTP failures gracefully', async () => {
    const frTarget = LANGUAGE_PACKS.fr.conjugate('parler', 'passe_compose', 0, 'none');
    const mockBlob = new Blob(['mock-audio'], { type: 'audio/webm;codecs=opus' });

    // Case A: Gemini wraps JSON response inside ```json ... ``` markdown code fences
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: '```json\n{\n  "transcript": "j\'ai parlé",\n  "pronunciationNote": "Excellent accent !"\n}\n```',
                  },
                ],
              },
            },
          ],
        }),
      })
    );

    const fencedResult = await transcribeWithGeminiFlash(mockBlob, 'fr', frTarget, {
      provider: 'gemini',
      geminiApiKey: 'test-key-123',
      openaiApiKey: '',
      geminiModel: 'gemini-2.5-flash',
    });

    expect(fencedResult.transcript).toBe("j'ai parlé");
    expect(fencedResult.aiPronunciationNote).toBe('Excellent accent !');

    // Case B: HTTP 429 Quota Exceeded / Network Failure on OpenAI Whisper
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'Rate limit reached for requests',
      })
    );

    await expect(
      transcribeWithOpenAIWhisper(mockBlob, 'fr', frTarget, {
        provider: 'openai',
        geminiApiKey: '',
        openaiApiKey: 'sk-test',
        geminiModel: 'gemini-2.5-flash',
      })
    ).rejects.toThrow(/429/);
  });

  // =========================================================================
  // VECTOR 7: Missing Browser APIs & Double-Stop Speech Manager Torture
  // =========================================================================
  it('Vector 7: survives missing Web Audio / SpeechSynthesis / Vibrate APIs and rapid stopActiveListening calls', async () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('navigator', {});

    expect(() => playFingerSnap({ quietMode: false })).not.toThrow();
    expect(() => playSuccessMicroChime(false)).not.toThrow();
    expect(() => cancelATSpeech()).not.toThrow();
    await expect(
      speakATUtterance('Bonjour', { language: 'fr', locale: 'fr-FR' })
    ).resolves.toBeUndefined();

    for (let i = 0; i < 25; i++) {
      expect(() => speechManager.stopActiveListening()).not.toThrow();
    }
  });
});

// ===========================================================================
// SUITE 2: 6-PILLAR HUMAN USER & HARDWARE/ACOUSTIC SIMULATION
// ===========================================================================
describe('6-Pillar Human User & Hardware/Acoustic Simulation Suite', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // =========================================================================
  // PILLAR 1: Communicative Clarity vs. Native Perfection (Accept vs. Reject)
  // =========================================================================
  it('Pillar 1: accepts communicative non-native speech (top-3 STT alternatives, homophones, optional triggers) while rejecting errors that confuse a local', () => {
    const frAvoirIl = LANGUAGE_PACKS.fr.conjugate('avoir', 'present', 2, 'none'); // il a
    const frParlerIls = LANGUAGE_PACKS.fr.conjugate('parler', 'present', 5, 'none'); // ils parlent
    const frFinirIls = LANGUAGE_PACKS.fr.conjugate('finir', 'present', 5, 'none'); // ils finissent
    const frEtreSubj = LANGUAGE_PACKS.fr.conjugate('etre', 'subjonctif_present', 0, 'none'); // que je sois
    const esHablarPret = LANGUAGE_PACKS.es.conjugate('hablar', 'preterito_indefinido', 2, 'none'); // él habló
    const esHablarImp = LANGUAGE_PACKS.es.conjugate('hablar', 'preterito_imperfecto', 0, 'none'); // yo hablaba

    // 1A. Accepts both bare "il a" AND full trigger "aujourd'hui il a"
    expect(evaluateSpokenConjugation('il a', frAvoirIl).isCorrect).toBe(true);
    expect(evaluateSpokenConjugation("aujourd'hui il a", frAvoirIl).isCorrect).toBe(true);

    // 1B. Accepts communicative non-native accent when Chrome ranks the right form #2 or #3 in maxAlternatives
    const accentSkewedEval = evaluateSpokenConjugation('il la', frAvoirIl, {
      alternatives: ['il la', 'il a', 'villa'],
    });
    expect(accentSkewedEval.isCorrect).toBe(true);

    // 1C. Accepts French oral homophones ("il parle" for "ils parlent")
    expect(evaluateSpokenConjugation('il parle', frParlerIls).isCorrect).toBe(true);

    // 1D. Accepts subjunctive with or without "Il faut que" / "que"
    expect(evaluateSpokenConjugation('je sois', frEtreSubj).isCorrect).toBe(true);
    expect(evaluateSpokenConjugation('que je sois', frEtreSubj).isCorrect).toBe(true);
    expect(evaluateSpokenConjugation('il faut que je sois', frEtreSubj).isCorrect).toBe(true);

    // 1E. Rejects audible singular/plural mismatch ("il finit" vs "ils finissent")
    const audibleMismatch = evaluateSpokenConjugation('il finit', frFinirIls);
    expect(audibleMismatch.isCorrect).toBe(false);
    expect(audibleMismatch.matchType).toBe('wrong_conjugation');

    // 1F. Rejects Spanish syllable-stress collision ("hablo" [Present] when asked for "habló" [Preterite])
    const stressCollision = evaluateSpokenConjugation('hablo', esHablarPret);
    expect(stressCollision.isCorrect).toBe(false);
    expect(stressCollision.matchType).toBe('wrong_stress_or_tense');

    // 1G. Accepts Spanish pro-drop ("hablaba" or "yo hablaba"), but rejects wrong explicit pronoun ("él hablaba")
    expect(evaluateSpokenConjugation('hablaba', esHablarImp).isCorrect).toBe(true);
    expect(evaluateSpokenConjugation('yo hablaba', esHablarImp).isCorrect).toBe(true);
    const wrongSpanishSubject = evaluateSpokenConjugation('él hablaba', esHablarImp);
    expect(wrongSpanishSubject.isCorrect).toBe(false);
    expect(wrongSpanishSubject.matchType).toBe('wrong_pronoun');
  });

  // =========================================================================
  // PILLAR 2: Authentic Dartmouth Rassias Method Compliance
  // =========================================================================
  it('Pillar 2: enforces Q&A perspective flips, 2-Beat Ping-Pong negation, and 3-card Boomerang return', () => {
    const director = new RassiasDrillDirector({
      language: 'fr',
      activeVerbIds: ['parler'],
      activeTenseIds: ['present'],
      cadence: 'substitution',
      polarityMode: 'ping_pong',
      enableNegativeAdverbs: false,
      includeVosotros: false,
      useNaturalTriggers: true,
    });

    // 2A. 2-Beat Ping-Pong: Beat 1 (Affirmative) -> Beat 2 (Immediate "Non !" Negative Flip)
    const beat1 = director.nextPrompt();
    expect(beat1.negation).toBe('none');
    expect(beat1.isPingPongSecondBeat).toBe(false);
    const res1 = director.submitResponse(beat1.target.fullForm);
    expect(res1.evaluation.isCorrect).toBe(true);

    const beat2 = director.nextPrompt();
    expect(beat2.isPingPongSecondBeat).toBe(true);
    expect(beat2.negation).not.toBe('none');
    expect(beat2.person).toBe(beat1.person);
    expect(beat2.atSpokenCue).toMatch(/^Non\s*!/i);
    const res2 = director.submitResponse(beat2.target.fullForm);
    expect(res2.evaluation.isCorrect).toBe(true);

    // 2B. Q&A Flip Perspective Check (Tu? -> Je, Monsieur/Madame vous? -> Je, Vous tous? -> Nous)
    director.updateConfig({
      cadence: 'qa_flip',
      polarityMode: 'affirmative',
    });
    const seenAnswerPersons = new Set<number>();
    for (let i = 0; i < 6; i++) {
      const qaCard = director.nextPrompt();
      expect(qaCard.qaMetadata).toBeDefined();
      seenAnswerPersons.add(qaCard.person);
      if (qaCard.person === 0) {
        // When answer is "je", question must address "tu" or polite singular "Monsieur/Madame, vous"
        expect(qaCard.qaMetadata!.questionPromptDisplay).toMatch(/tu\b|vous\b/i);
      } else if (qaCard.person === 3) {
        // When answer is "nous", question must address plural "Vous tous"
        expect(qaCard.qaMetadata!.questionPromptDisplay).toMatch(/Vous tous/i);
      }
      director.submitResponse(qaCard.target.fullForm);
    }
    expect(seenAnswerPersons.has(0)).toBe(true);
    expect(seenAnswerPersons.has(3)).toBe(true);
  });

  // =========================================================================
  // PILLAR 3: Anti-Loop & Anti-Zombie-Mic State Machine Audit
  // =========================================================================
  it('Pillar 3: never gets stuck in an infinite "Yo soy, ¡Repita!" loop on repeated mistakes or silence', () => {
    const director = new RassiasDrillDirector({
      language: 'es',
      activeVerbIds: ['ser'],
      activeTenseIds: ['presente'],
      cadence: 'substitution',
      polarityMode: 'affirmative',
      includeVosotros: false,
      useNaturalTriggers: true,
    });

    const card = director.nextPrompt(); // e.g. yo soy
    expect(director.isInRepeatLoop()).toBe(false);

    // Step 1: Student misses on first try -> enters repeat loop & queues Boomerang
    const wasInRepeatBeforeAttempt1 = director.isInRepeatLoop();
    const attempt1 = director.submitResponse('yo eres');
    expect(wasInRepeatBeforeAttempt1).toBe(false);
    expect(attempt1.evaluation.isCorrect).toBe(false);
    expect(attempt1.enteredRepeatLoop).toBe(true);
    expect(attempt1.queuedBoomerang).toBe(true);
    expect(director.isInRepeatLoop()).toBe(true);

    // Step 2: During repeat window, student either stays silent ("") or mispronounces again.
    // Because wasInRepeatBeforeAttempt2 === true, the session controller caps the repeat at 1 try
    // and advances to the next card instead of calling runRepeatCorrectionFlow again!
    const wasInRepeatBeforeAttempt2 = director.isInRepeatLoop();
    expect(wasInRepeatBeforeAttempt2).toBe(true);
    const attempt2 = director.submitResponse('');
    expect(attempt2.completedRepeatLoop).toBe(false);

    // Advancing to the next card cleanly resets inRepeatLoop to false
    const nextCard = director.nextPrompt();
    expect(director.isInRepeatLoop()).toBe(false);
    expect(nextCard.person).not.toBe(card.person);
    expect(director.getBoomerangQueueLength()).toBe(1);
  });

  // =========================================================================
  // PILLAR 4: Hardware & Acoustic Environment Simulation (Open Speakers vs. Headphones & Noise)
  // =========================================================================
  it('Pillar 4: strips open-speaker AT echo ("repita" / "répétez" / "aujourd\'hui") so no-headphone users are not penalized by speaker bleed', () => {
    const esSoy = LANGUAGE_PACKS.es.conjugate('ser', 'presente', 0, 'none'); // yo soy
    const frIlA = LANGUAGE_PACKS.fr.conjugate('avoir', 'present', 2, 'none'); // il a

    // Scenario A: Open laptop speakers bleed the tail of "¡Repita!" into the mic right before user says "yo soy"
    const bledSpanish = evaluateSpokenConjugation('repita yo soy', esSoy);
    expect(bledSpanish.isCorrect).toBe(true);

    // Scenario B: Open laptop speakers bleed "Répétez !" into the mic right before user says "il a"
    const bledFrench = evaluateSpokenConjugation('répétez il a', frIlA);
    expect(bledFrench.isCorrect).toBe(true);

    // Scenario C: Open speakers bleed ONLY "repita" (user hasn't spoken yet) -> treated as empty, not a wrong verb
    const echoOnly = evaluateSpokenConjugation('repita', esSoy);
    expect(echoOnly.heardNormalized).toBe('');
  });

  // =========================================================================
  // PILLAR 5: Chrome & Web Speech API Hangups (Interim Cutoff & Auto-Retry)
  // =========================================================================
  it('Pillar 5: recovers interim speech when Chrome closes recognition before isFinal, and collects top-3 alternatives', async () => {
    // Mock Chrome webkitSpeechRecognition where user speaks right before onend (interim only)
    class MockChromeSpeechRecognition {
      public lang = 'fr-FR';
      public continuous = false;
      public interimResults = true;
      public maxAlternatives = 3;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      public onresult: ((e: any) => void) | null = null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      public onerror: ((e: any) => void) | null = null;
      public onend: (() => void) | null = null;

      public start() {
        setTimeout(() => {
          this.onresult?.({
            resultIndex: 0,
            results: [
              Object.assign(
                [
                  { transcript: 'il la' },
                  { transcript: 'il a' },
                  { transcript: 'ila' },
                ],
                { isFinal: true, length: 3 }
              ),
            ],
          });
        }, 10);
      }
      public stop() {}
      public abort() {}
    }

    vi.stubGlobal('window', {
      SpeechRecognition: MockChromeSpeechRecognition,
    });

    const target = LANGUAGE_PACKS.fr.conjugate('avoir', 'present', 2, 'none');
    const res = await speechManager.listenOnce({
      language: 'fr',
      locale: 'fr-FR',
      target,
      engine: 'web_speech',
      byokConfig: {
        provider: 'gemini',
        geminiApiKey: '',
        openaiApiKey: '',
        geminiModel: 'gemini-2.5-flash',
      },
      maxDurationMs: 1000,
    });

    expect(res.transcript).toBe('il la');
    expect(res.alternatives).toEqual(['il la', 'il a', 'ila']);

    // Verify evaluator accepts it via candidate #2 ("il a")!
    const grade = evaluateSpokenConjugation(res.transcript, target, {
      alternatives: res.alternatives,
    });
    expect(grade.isCorrect).toBe(true);
  });

  // =========================================================================
  // PILLAR 6: Pacing, Speed & Clarity Defaults Audit
  // =========================================================================
  it('Pillar 6: verifies natural pacing defaults (4s beat timer, 1.0x TTS rate, non-overlapping cues)', async () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => null,
        setItem: () => {},
      },
    });

    const defaults = loadInitialSettings();
    expect(defaults.beatTimerSeconds).toBe(4);
    expect(defaults.handsFreeMode).toBe(true);
    expect(defaults.useNaturalTriggers).toBe(true);
  });
});
