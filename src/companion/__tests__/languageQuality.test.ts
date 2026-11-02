import { afterEach, describe, expect, it } from 'vitest';
import {
  getRoadmapForLanguage,
  pickChunkForVerb,
  resolveAllSubModulePools,
} from '../../engine/roadmapResolver';
import { generateCompanionLesson } from '../aiLessonGenerator';
import { clearCompanionLessonCache } from '../lessonCache';
import { clearRollingLessonBuffer } from '../rollingLessonBuffer';

describe('Step 4 — Comprehensive Linguistic Quality Audit Across All 35 Sub-Modules', () => {
  afterEach(() => {
    clearCompanionLessonCache();
    clearRollingLessonBuffer();
  });

  it('audits all Spanish & French chunks for strict ser vs. estar copula separation and chameleon contrast', () => {
    const esRoadmap = getRoadmapForLanguage('es');
    const allEsChunks = esRoadmap.flatMap((sm) => sm.newChunks);

    // Location & temporary states must attach to estar, never ser
    for (const chunkId of ['es-en-casa', 'es-aqui', 'es-cansado', 'es-en-la-oficina']) {
      const chunk = allEsChunks.find((c) => c.id === chunkId);
      expect(chunk, `Chunk ${chunkId} should exist`).toBeDefined();
      expect(chunk!.attachToVerbIds).toContain('estar');
      expect(chunk!.attachToVerbIds).not.toContain('ser');
    }

    // Origin must attach to ser, never estar
    const originChunk = allEsChunks.find((c) => c.id === 'es-de-mexico');
    expect(originChunk).toBeDefined();
    expect(originChunk!.attachToVerbIds).toContain('ser');
    expect(originChunk!.attachToVerbIds).not.toContain('estar');

    // Chameleon adjectives (listo, loco) must define explicit verb-specific meanings for estar vs ser
    for (const chameleonId of ['es-listo', 'es-loco']) {
      const chunk = allEsChunks.find((c) => c.id === chameleonId);
      expect(chunk).toBeDefined();
      expect(chunk!.meaningByVerbId?.estar).toBeTruthy();
      expect(chunk!.meaningByVerbId?.ser).toBeTruthy();
      expect(chunk!.meaningByVerbId?.estar).not.toBe(
        chunk!.meaningByVerbId?.ser
      );
    }
  });

  it('never pairs plural-only chunks (juntos / ensemble) with singular persons (0, 1, 2)', () => {
    for (const lang of ['es', 'fr'] as const) {
      const pools = resolveAllSubModulePools(lang);
      for (const pool of pools) {
        for (const verbId of pool.focusVerbIds) {
          for (const singularPerson of [0, 1, 2] as const) {
            const picked = pickChunkForVerb(
              verbId,
              pool,
              0,
              singularPerson
            );
            if (picked) {
              expect(
                picked.requiresPlural,
                `Plural chunk "${picked.target}" was attached to singular person ${singularPerson} in ${pool.subModule.id}`
              ).not.toBe(true);
            }
          }
        }
      }
    }
  });

  it('generates natural English sentences (zero robotic glosses) and distinct Scene A / Scene B / Encore Remixes across all 35 Sub-Modules', async () => {
    for (const lang of ['es', 'fr'] as const) {
      const roadmap = getRoadmapForLanguage(lang);

      for (const sm of roadmap) {
        const sceneA = await generateCompanionLesson({
          language: lang,
          subModuleId: sm.id,
          variant: 'baseline',
          encoreIndex: 0,
          includeVosotros: false,
          bypassCache: true,
        });

        const sceneB = await generateCompanionLesson({
          language: lang,
          subModuleId: sm.id,
          variant: 'pass_2_consolidation',
          encoreIndex: 0,
          includeVosotros: false,
          bypassCache: true,
        });

        const encore1 = await generateCompanionLesson({
          language: lang,
          subModuleId: sm.id,
          variant: 'encore_remedial',
          encoreIndex: 1,
          includeVosotros: false,
          bypassCache: true,
        });

        // 1. Scene B and Encore 1 must be distinct from Scene A
        const sceneAText = sceneA.dialogue.map((d) => d.target).join(' | ');
        const sceneBText = sceneB.dialogue.map((d) => d.target).join(' | ');
        const encore1Text = encore1.dialogue.map((d) => d.target).join(' | ');

        expect(
          sceneBText,
          `Scene B should be distinct from Scene A in ${sm.id}`
        ).not.toBe(sceneAText);
        expect(
          encore1Text,
          `Encore Remix #1 should be distinct from Scene A in ${sm.id}`
        ).not.toBe(sceneAText);

        // 2. Verify zero robotic glosses in Chunk Cards and Dialogue lines
        for (const lesson of [sceneA, sceneB, encore1]) {
          for (const card of lesson.chunkCards) {
            expect(card.exampleEnglish).not.toMatch(/\((yo|tú|je|tu|nous|vous)\)/i);
            expect(card.exampleEnglish).not.toContain(' — ');
            if (card.id === 'es-juntos') {
              expect(card.exampleEnglish.toLowerCase()).toMatch(/\b(we|you all|they)\b/);
            }
          }
          for (const line of lesson.dialogue) {
            expect(line.english).not.toMatch(/\((yo|tú|je|tu|nous|vous)\)/i);
          }

          // 3. Verify Latin American Spanish default excludes vosotros (person 4)
          if (lang === 'es') {
            for (const p of lesson.conjugationParadigms) {
              expect(p.forms.some((f) => f.person === 4)).toBe(false);
            }
          }
        }
      }
    }
  });
});
