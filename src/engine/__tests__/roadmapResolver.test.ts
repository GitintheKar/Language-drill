import { describe, expect, it } from 'vitest';
import {
  auditRoadmapCompleteness,
  getRoadmapForLanguage,
  pickChunkForVerb,
  resolveAllSubModulePools,
  resolveSubModulePool,
} from '../roadmapResolver';

describe('Build Module 1 — Delta Roadmap & Cumulative Pool Resolver (Test Gate 1)', () => {
  it('covers 100% of all 46 Spanish verbs and 16 Spanish tenses without orphans or duplicates', () => {
    const audit = auditRoadmapCompleteness('es');
    expect(audit.totalCatalogVerbs).toBe(46);
    expect(audit.totalCatalogTenses).toBe(16);
    expect(audit.missingVerbIds).toEqual([]);
    expect(audit.duplicateVerbIds).toEqual([]);
    expect(audit.unknownVerbIds).toEqual([]);
    expect(audit.missingTenseIds).toEqual([]);
    expect(audit.duplicateTenseIds).toEqual([]);
    expect(audit.unknownTenseIds).toEqual([]);
    expect(audit.isValid).toBe(true);
  });

  it('covers 100% of all 46 French verbs and 12 French tenses without orphans or duplicates', () => {
    const audit = auditRoadmapCompleteness('fr');
    expect(audit.totalCatalogVerbs).toBe(46);
    expect(audit.totalCatalogTenses).toBe(12);
    expect(audit.missingVerbIds).toEqual([]);
    expect(audit.duplicateVerbIds).toEqual([]);
    expect(audit.unknownVerbIds).toEqual([]);
    expect(audit.missingTenseIds).toEqual([]);
    expect(audit.duplicateTenseIds).toEqual([]);
    expect(audit.unknownTenseIds).toEqual([]);
    expect(audit.isValid).toBe(true);
  });

  it('starts Day 1 (es-1.1 and fr-1.1) with only Present tense and 3 survival verbs, requiring 2 passes', () => {
    const esDay1 = resolveSubModulePool('es', 'es-1.1');
    expect(esDay1.index).toBe(0);
    expect(esDay1.displayCode).toBe('1.1');
    expect(esDay1.requiredPasses).toBe(2);
    expect(esDay1.focusVerbIds).toEqual(['ser', 'estar', 'tener']);
    expect(esDay1.focusTenseIds).toEqual(['presente']);
    expect(esDay1.reviewVerbIds).toEqual([]);
    expect(esDay1.reviewTenseIds).toEqual([]);

    const frDay1 = resolveSubModulePool('fr', 'fr-1.1');
    expect(frDay1.index).toBe(0);
    expect(frDay1.displayCode).toBe('1.1');
    expect(frDay1.requiredPasses).toBe(2);
    expect(frDay1.focusVerbIds).toEqual(['etre', 'avoir', 'aller']);
    expect(frDay1.focusTenseIds).toEqual(['present']);
    expect(frDay1.reviewVerbIds).toEqual([]);
    expect(frDay1.reviewTenseIds).toEqual([]);
  });

  it('enforces the Golden Pacing Rule: after 1.1, no Sub-Module introduces both new verbs and a new tense simultaneously', () => {
    for (const lang of ['es', 'fr'] as const) {
      const roadmap = getRoadmapForLanguage(lang);
      roadmap.slice(1).forEach((sm) => {
        const addsBoth = sm.newVerbIds.length > 0 && sm.newTenseIds.length > 0;
        expect(
          addsBoth,
          `Sub-Module ${sm.id} violated the pacing rule by adding both new verbs and a new tense`
        ).toBe(false);
      });
    }
  });

  it('dynamically recomputes cumulative pools and display codes when Sub-Modules are reordered', () => {
    const originalEs = getRoadmapForLanguage('es');
    const reordered = [...originalEs];

    // Swap es-1.2 (index 1) and es-1.3 (index 2)
    const temp = reordered[1];
    reordered[1] = reordered[2];
    reordered[2] = temp;

    // Now 'es-1.3' is at index 1 (displayCode '1.2') and only has 'es-1.1' in its review pool
    const step2Resolved = resolveSubModulePool('es', 1, reordered);
    expect(step2Resolved.subModule.id).toBe('es-1.3');
    expect(step2Resolved.displayCode).toBe('1.2');
    expect(step2Resolved.reviewVerbIds).toEqual(['ser', 'estar', 'tener']);
    expect(step2Resolved.focusVerbIds).toEqual([
      'trabajar',
      'estudiar',
      'llegar',
      'comer',
    ]);
    // Verify 'ir', 'hacer', 'hablar' (from es-1.2, now at index 2) are NOT leaked into index 1!
    expect(step2Resolved.cumulativeVerbIds).not.toContain('hablar');

    // And at index 2 (displayCode '1.3'), 'es-1.2' now has both 'es-1.1' and 'es-1.3' in its review pool
    const step3Resolved = resolveSubModulePool('es', 2, reordered);
    expect(step3Resolved.subModule.id).toBe('es-1.2');
    expect(step3Resolved.displayCode).toBe('1.3');
    expect(step3Resolved.reviewVerbIds).toEqual([
      'ser',
      'estar',
      'tener',
      'trabajar',
      'estudiar',
      'llegar',
      'comer',
    ]);
  });

  it('never leaks locked future verbs or tenses even if focusVerbIdsOverride references a verb moved to a later module', () => {
    const custom = getRoadmapForLanguage('fr').map((sm) => ({ ...sm }));
    // Artificially inject a Phase 5 verb ('courir') into fr-1.2's focusVerbIdsOverride
    custom[1] = {
      ...custom[1],
      focusVerbIdsOverride: ['parler', 'courir'],
    };

    const resolved = resolveSubModulePool('fr', 1, custom);
    expect(resolved.focusVerbIds).toEqual(['parler']);
    expect(resolved.focusVerbIds).not.toContain('courir');
  });

  it('invalidates recipeHash whenever a Sub-Module delta or prior cumulative pool is edited', () => {
    const basePool = resolveSubModulePool('es', 'es-1.2');
    const modifiedRoadmap = getRoadmapForLanguage('es').map((sm) =>
      sm.id === 'es-1.2'
        ? {
            ...sm,
            newChunks: [
              ...sm.newChunks,
              { id: 'es-extra', target: 'mañana', english: 'tomorrow' },
            ],
          }
        : sm
    );
    const updatedPool = resolveSubModulePool('es', 'es-1.2', modifiedRoadmap);
    expect(updatedPool.recipeHash).not.toBe(basePool.recipeHash);
  });

  it('resolves all Sub-Module pools cleanly and picks verb-appropriate lexical chunks', () => {
    for (const lang of ['es', 'fr'] as const) {
      const allPools = resolveAllSubModulePools(lang);
      expect(allPools.length).toBeGreaterThan(20);
      const finalPool = allPools[allPools.length - 1];
      expect(finalPool.cumulativeVerbIds.length).toBe(46);
    }

    const es11 = resolveSubModulePool('es', 'es-1.1');
    const tenerChunk = pickChunkForVerb('tener', es11, 0);
    expect(tenerChunk).toBeDefined();
    expect(tenerChunk?.attachToVerbIds).toContain('tener');
  });
});
