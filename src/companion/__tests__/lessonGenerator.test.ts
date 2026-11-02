import { afterEach, describe, expect, it, vi } from 'vitest';
import { MissedVerbFormItem } from '../../engine/drillDirector';
import { getRoadmapForLanguage, resolveSubModulePool } from '../../engine/roadmapResolver';
import { getLanguagePack } from '../../languages';
import { generateCompanionLesson } from '../aiLessonGenerator';
import { clearCompanionLessonCache } from '../lessonCache';
import {
  buildNaturalEnglishClause,
  inflectChunkTarget,
  resolveChunkMeaningForVerb,
} from '../offlineLessonBuilder';
import {
  clearRollingLessonBuffer,
  evictSubModuleFromRollingBuffer,
  getBufferedPackForSubModule,
  getRollingBufferStatus,
  syncRollingLessonBuffer,
} from '../rollingLessonBuffer';

describe('Build Module 3 — Closed-Loop Companion Lesson & Encore Remix Engine (Test Gate 3)', () => {
  afterEach(() => {
    clearCompanionLessonCache();
    clearRollingLessonBuffer();
    vi.restoreAllMocks();
  });

  it('generates valid offline baseline and Pass 2 consolidation lessons for 100% of Spanish and French Sub-Modules', async () => {
    for (const lang of ['es', 'fr'] as const) {
      const roadmap = getRoadmapForLanguage(lang);
      for (const sm of roadmap) {
        const baseline = await generateCompanionLesson({
          language: lang,
          subModuleId: sm.id,
          variant: 'baseline',
        });

        expect(baseline.subModuleId).toBe(sm.id);
        expect(baseline.dialogue.length).toBeGreaterThanOrEqual(4);
        expect(baseline.earNotes.length).toBeGreaterThanOrEqual(1);
        expect(baseline.chunkCards.length).toBeGreaterThanOrEqual(1);
        expect(baseline.warmupPrompts.length).toBe(3);
        expect(baseline.drillPrescription.requiredPasses).toBe(2);

        const pass2Scene = await generateCompanionLesson({
          language: lang,
          subModuleId: sm.id,
          variant: 'pass_2_consolidation',
        });
        expect(pass2Scene.variant).toBe('pass_2_consolidation');
        expect(pass2Scene.dialogue.length).toBeGreaterThanOrEqual(4);
        // Ensure Pass 2 Scene B is distinct from Baseline Scene A
        expect(pass2Scene.id).not.toBe(baseline.id);
      }
    }
  });

  it('spotlights the exact missed verb forms and missed chunks in Diagnostic Encore Remedial lessons', async () => {
    const missedForms: MissedVerbFormItem[] = [
      {
        verbId: 'aller',
        infinitive: 'aller',
        tenseId: 'present',
        tenseName: 'Présent',
        person: 5,
        pronounDisplay: 'ils / elles',
        negation: 'none',
        expectedFullForm: 'ils vont',
      },
      {
        verbId: 'faire',
        infinitive: 'faire',
        tenseId: 'present',
        tenseName: 'Présent',
        person: 4,
        pronounDisplay: 'vous',
        negation: 'pas',
        expectedFullForm: 'vous ne faites pas',
      },
    ];

    const encoreLesson = await generateCompanionLesson({
      language: 'fr',
      subModuleId: 'fr-1.2',
      variant: 'encore_remedial',
      encoreIndex: 1,
      missedForms,
      missedChunks: [
        {
          id: 'fr-en-retard',
          target: 'en retard',
          english: 'late',
          attachToVerbIds: ['etre'],
        },
      ],
    });

    expect(encoreLesson.variant).toBe('encore_remedial');
    const allDialogueText = encoreLesson.dialogue.map((d) => d.target).join(' ');
    expect(allDialogueText).toContain('ils vont');
    expect(allDialogueText).toContain('vous ne faites pas');

    const allDiagnostics = encoreLesson.diagnosticNotes.join(' ');
    expect(allDiagnostics).toContain('ils vont');
    expect(allDiagnostics).toContain('vous ne faites pas');
    expect(allDiagnostics).toContain('en retard');

    expect(encoreLesson.warmupPrompts[0].expectedTarget).toContain('ils vont');
    expect(encoreLesson.warmupPrompts[1].expectedTarget).toContain(
      'vous ne faites pas'
    );
  });

  it('caches generated lessons in localStorage and invalidates automatically when a Sub-Module recipe is edited', async () => {
    const store: Record<string, string> = {};
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
          store[k] = v;
        },
        removeItem: (k: string) => {
          delete store[k];
        },
      },
    });

    const firstCall = await generateCompanionLesson({
      language: 'es',
      subModuleId: 'es-2.1',
      variant: 'baseline',
    });

    const secondCall = await generateCompanionLesson({
      language: 'es',
      subModuleId: 'es-2.1',
      variant: 'baseline',
    });
    expect(secondCall.createdAt).toBe(firstCall.createdAt);
    expect(secondCall.recipeHash).toBe(firstCall.recipeHash);

    // Edit es-2.1's chunks in customRoadmap -> recipeHash changes -> cache automatically invalidates!
    const editedRoadmap = getRoadmapForLanguage('es').map((sm) =>
      sm.id === 'es-2.1'
        ? {
            ...sm,
            newChunks: [
              ...sm.newChunks,
              { id: 'es-custom-chunk', target: 'enseguida', english: 'right away' },
            ],
          }
        : sm
    );

    const afterEdit = await generateCompanionLesson({
      language: 'es',
      subModuleId: 'es-2.1',
      variant: 'baseline',
      customRoadmap: editedRoadmap,
    });
    expect(afterEdit.recipeHash).not.toBe(firstCall.recipeHash);
    expect(
      afterEdit.chunkCards.some((c) => c.target === 'enseguida')
    ).toBe(true);
  });

  it('uses BYOK Gemini when configured and falls back cleanly to the offline engine on network errors', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    sceneSetting: 'En el tren rápido hacia Sevilla',
                    dialogue: [
                      {
                        speaker: 'A',
                        speakerName: 'Mateo',
                        target: '¿Vas a trabajar esta noche?',
                        english: 'Are you going to work tonight?',
                      },
                      {
                        speaker: 'B',
                        speakerName: 'Sofía',
                        target: 'No, esta noche voy a descansar.',
                        english: 'No, tonight I am going to rest.',
                      },
                    ],
                    earNotes: ['Link voy_a smoothly.'],
                    diagnosticNotes: [],
                  }),
                },
              ],
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const aiLesson = await generateCompanionLesson({
      language: 'es',
      subModuleId: 'es-2.1',
      variant: 'pass_2_consolidation',
      byokConfig: {
        provider: 'gemini',
        geminiApiKey: 'test-gemini-key',
        openaiApiKey: '',
        geminiModel: 'gemini-2.5-flash',
      },
      bypassCache: true,
    });

    expect(aiLesson.generatedBy).toBe('byok_ai');
    expect(aiLesson.sceneSetting).toBe('En el tren rápido hacia Sevilla');
    expect(aiLesson.dialogue.length).toBe(2);

    // Now simulate a network failure -> should fall back cleanly to offline_engine without throwing!
    mockFetch.mockRejectedValueOnce(new Error('Network offline'));
    const fallbackLesson = await generateCompanionLesson({
      language: 'es',
      subModuleId: 'es-2.1',
      variant: 'pass_2_consolidation',
      encoreIndex: 2,
      byokConfig: {
        provider: 'gemini',
        geminiApiKey: 'test-gemini-key',
        openaiApiKey: '',
        geminiModel: 'gemini-2.5-flash',
      },
      bypassCache: true,
    });

    expect(fallbackLesson.generatedBy).toBe('offline_engine');
    expect(fallbackLesson.dialogue.length).toBeGreaterThanOrEqual(4);
  });

  it('defaults Spanish to Latin American 5-person paradigm (no vosotros) unless includeVosotros is true', async () => {
    const latamLesson = await generateCompanionLesson({
      language: 'es',
      subModuleId: 'es-1.1',
      variant: 'pass_2_consolidation',
      includeVosotros: false,
      bypassCache: true,
    });

    for (const p of latamLesson.conjugationParadigms) {
      expect(p.forms.length).toBe(5);
      expect(p.forms.some((f) => f.person === 4)).toBe(false);
    }

    const castilianLesson = await generateCompanionLesson({
      language: 'es',
      subModuleId: 'es-1.1',
      variant: 'pass_2_consolidation',
      includeVosotros: true,
      bypassCache: true,
    });

    for (const p of castilianLesson.conjugationParadigms) {
      expect(p.forms.length).toBe(6);
      expect(p.forms.some((f) => f.person === 4)).toBe(true);
    }
  });

  it('distinguishes ser vs estar meanings (listo/loco), inflects adjectives, and builds natural English sentences', async () => {
    const pool = resolveSubModulePool('es', 'es-1.1');
    const pack = getLanguagePack('es');
    const estarVerb = pack.verbs.find((v) => v.id === 'estar')!;
    const serVerb = pack.verbs.find((v) => v.id === 'ser')!;
    const tenerVerb = pack.verbs.find((v) => v.id === 'tener')!;

    const listoChunk = pool.focusChunks.find((c) => c.id === 'es-listo')!;
    const locoChunk = pool.focusChunks.find((c) => c.id === 'es-loco')!;
    const hambreChunk = pool.focusChunks.find((c) => c.id === 'es-hambre')!;
    const cansadoChunk = pool.focusChunks.find((c) => c.id === 'es-cansado')!;

    // 1. Verb-specific meaning contrasts for chameleon adjectives
    expect(resolveChunkMeaningForVerb(listoChunk, 'estar')).toBe('ready');
    expect(resolveChunkMeaningForVerb(listoChunk, 'ser')).toBe('clever');
    expect(resolveChunkMeaningForVerb(locoChunk, 'estar')).toBe('acting crazy');
    expect(resolveChunkMeaningForVerb(locoChunk, 'ser')).toBe('crazy');

    // 2. Natural English sentence conjugation
    expect(
      buildNaturalEnglishClause({
        language: 'es',
        verb: estarVerb,
        tenseId: 'presente',
        person: 0,
        negation: 'none',
        chunk: listoChunk,
      })
    ).toBe('I am ready');

    expect(
      buildNaturalEnglishClause({
        language: 'es',
        verb: serVerb,
        tenseId: 'presente',
        person: 2,
        negation: 'none',
        chunk: listoChunk,
      })
    ).toBe('he is clever');

    expect(
      buildNaturalEnglishClause({
        language: 'es',
        verb: tenerVerb,
        tenseId: 'presente',
        person: 1,
        negation: 'none',
        chunk: hambreChunk,
        isQuestion: true,
      })
    ).toBe('are you hungry');

    // 3. Gender and plural adjective inflection
    expect(inflectChunkTarget(cansadoChunk, 'es', 0, 'f')).toBe('cansada');
    expect(inflectChunkTarget(cansadoChunk, 'es', 3, 'm')).toBe('cansados');
    expect(inflectChunkTarget(listoChunk, 'es', 0, 'f')).toBe('lista');

    // 4. Verify Scene B is distinct in content from Scene A and free of robotic "(yo)" glosses
    const sceneA = await generateCompanionLesson({
      language: 'es',
      subModuleId: 'es-1.1',
      variant: 'baseline',
      bypassCache: true,
    });
    const sceneB = await generateCompanionLesson({
      language: 'es',
      subModuleId: 'es-1.1',
      variant: 'pass_2_consolidation',
      bypassCache: true,
    });

    expect(sceneB.dialogue[0].target).not.toBe(sceneA.dialogue[0].target);
    for (const card of sceneA.chunkCards) {
      expect(card.exampleEnglish).not.toContain('(yo)');
      expect(card.exampleEnglish).not.toContain(' — ');
    }
  });

  it('prefetches a 3-Sub-Module Rolling Buffer when online, serves Encore Remixes offline, and auto-evicts graduated modules', async () => {
    const store: Record<string, string> = {};
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
          store[k] = v;
        },
        removeItem: (k: string) => {
          delete store[k];
        },
      },
    });

    const mockFetch = vi.fn().mockImplementation(async () => ({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    consolidationScene: {
                      sceneSetting: 'En el mercado de Coyoacán',
                      dialogue: [
                        {
                          speaker: 'A',
                          speakerName: 'Mateo',
                          target: '¿Ya estás lista para pedir?',
                          english: 'Are you ready to order yet?',
                        },
                        {
                          speaker: 'B',
                          speakerName: 'Sofía',
                          target: 'Sí, estoy lista y tengo mucha hambre.',
                          english: 'Yes, I am ready and very hungry.',
                        },
                      ],
                      earNotes: ['Listen for lista vs. listo.'],
                    },
                    encoreScenes: [
                      {
                        sceneSetting: 'Encore #1: En el metro de la Ciudad de México',
                        dialogue: [
                          {
                            speaker: 'A',
                            speakerName: 'Mateo',
                            target: '¿Tienes prisa esta mañana?',
                            english: 'Are you in a hurry this morning?',
                          },
                          {
                            speaker: 'B',
                            speakerName: 'Sofía',
                            target: 'Sí, tengo mucha prisa hoy.',
                            english: 'Yes, I am in a big hurry today.',
                          },
                        ],
                      },
                      {
                        sceneSetting: 'Encore #2: En la biblioteca de la universidad',
                        dialogue: [
                          {
                            speaker: 'A',
                            speakerName: 'Mateo',
                            target: '¿Estás cansada después de la clase?',
                            english: 'Are you tired after class?',
                          },
                          {
                            speaker: 'B',
                            speakerName: 'Sofía',
                            target: 'Un poco, pero estamos aquí para estudiar.',
                            english: 'A little, but we are here to study.',
                          },
                        ],
                      },
                    ],
                    phraseLibrary: [
                      {
                        verbId: 'estar',
                        chunkId: 'es-listo',
                        targetSentence: 'Ya estamos listos para salir.',
                        englishSentence: 'We are already ready to leave.',
                      },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      }),
    }));
    vi.stubGlobal('fetch', mockFetch);

    // 1. Prefetch the 3-Sub-Module sliding window starting at es-1.1 -> [es-1.1, es-1.2, es-1.3]
    const syncRes = await syncRollingLessonBuffer({
      language: 'es',
      activeSubModuleId: 'es-1.1',
      byokConfig: {
        provider: 'gemini',
        geminiApiKey: 'test-gemini-key',
        openaiApiKey: '',
        geminiModel: 'gemini-2.5-flash',
      },
      includeVosotros: false,
    });

    expect(syncRes.windowIds).toEqual(['es-1.1', 'es-1.2', 'es-1.3']);
    expect(syncRes.prefetchedIds).toEqual(['es-1.1', 'es-1.2', 'es-1.3']);
    expect(mockFetch).toHaveBeenCalledTimes(3);

    // 2. Now disconnect the network (offline) and request Scene B and Encore Remix #1 & #2 for es-1.1
    mockFetch.mockRejectedValue(new Error('Offline'));

    const offlineSceneB = await generateCompanionLesson({
      language: 'es',
      subModuleId: 'es-1.1',
      variant: 'pass_2_consolidation',
      encoreIndex: 0,
      bypassCache: true,
    });
    expect(offlineSceneB.generatedBy).toBe('rolling_buffer');
    expect(offlineSceneB.sceneSetting).toBe('En el mercado de Coyoacán');

    const offlineEncore1 = await generateCompanionLesson({
      language: 'es',
      subModuleId: 'es-1.1',
      variant: 'baseline',
      encoreIndex: 1,
      bypassCache: true,
    });
    expect(offlineEncore1.generatedBy).toBe('rolling_buffer');
    expect(offlineEncore1.sceneSetting).toContain('Encore #1');

    const offlineEncore2 = await generateCompanionLesson({
      language: 'es',
      subModuleId: 'es-1.1',
      variant: 'baseline',
      encoreIndex: 2,
      bypassCache: true,
    });
    expect(offlineEncore2.generatedBy).toBe('rolling_buffer');
    expect(offlineEncore2.sceneSetting).toContain('Encore #2');
    expect(offlineEncore2.dialogue[0].target).not.toBe(
      offlineEncore1.dialogue[0].target
    );

    // 3. Graduate es-1.1 and advance to es-1.2 -> es-1.1 is evicted from localStorage!
    evictSubModuleFromRollingBuffer('es', 'es-1.1');
    const es11Pool = resolveSubModulePool('es', 'es-1.1');
    expect(
      getBufferedPackForSubModule({
        language: 'es',
        subModuleId: 'es-1.1',
        recipeHash: es11Pool.recipeHash,
        includeVosotros: false,
      })
    ).toBeNull();

    const statusAt12 = getRollingBufferStatus('es', 'es-1.2', undefined, false);
    expect(statusAt12.windowSubModuleIds).toEqual(['es-1.2', 'es-1.3', 'es-1.4']);
    expect(statusAt12.bufferedSubModuleIds).toEqual(['es-1.2', 'es-1.3']);
  });
});
