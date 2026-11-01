import { afterEach, describe, expect, it, vi } from 'vitest';
import { MissedVerbFormItem } from '../../engine/drillDirector';
import { getRoadmapForLanguage } from '../../engine/roadmapResolver';
import { generateCompanionLesson } from '../aiLessonGenerator';
import { clearCompanionLessonCache } from '../lessonCache';

describe('Build Module 3 — Closed-Loop Companion Lesson & Encore Remix Engine (Test Gate 3)', () => {
  afterEach(() => {
    clearCompanionLessonCache();
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
});
