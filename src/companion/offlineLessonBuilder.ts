import { MissedVerbFormItem } from '../engine/drillDirector';
import {
  pickChunkForVerb,
  ResolvedSubModulePool,
} from '../engine/roadmapResolver';
import { getLanguagePack } from '../languages';
import {
  DialogueLine,
  LexicalChunk,
  PersonIndex,
} from '../languages/types';
import {
  CompanionChunkCard,
  CompanionDrillPrescription,
  CompanionLesson,
  CompanionLessonVariant,
  CompanionWarmupPrompt,
  VerbConjugationParadigm,
} from './lessonTypes';

const SPANISH_SCENES = [
  'En una cafetería del centro de Madrid',
  'En la estación de tren antes de salir',
  'En la oficina un lunes por la mañana',
  'Caminando por el parque después del trabajo',
  'Preparando una cena con amigos en casa',
];

const FRENCH_SCENES = [
  'Dans un petit café à Lyon',
  'À la gare avant le départ du train',
  'Au bureau un lundi matin',
  'En marchant dans le quartier après le travail',
  'En préparant le dîner entre amis à la maison',
];

function stripSimpleVerbPrefix(translation: string): string {
  return translation
    .replace(/^to\s+/i, '')
    .split('/')[0]
    .replace(/\([^)]*\)/g, '')
    .trim();
}

function buildDrillPrescription(
  pool: ResolvedSubModulePool
): CompanionDrillPrescription {
  const pack = getLanguagePack(pool.language);
  const verbNames = pool.focusVerbIds
    .map((id) => pack.verbs.find((v) => v.id === id)?.infinitive ?? id)
    .join(', ');
  const tenseNames = pool.focusTenseIds
    .map((id) => pack.tenses.find((t) => t.id === id)?.name ?? id)
    .join(' + ');

  return {
    subModuleId: pool.subModule.id,
    displayCode: pool.displayCode,
    focusVerbsLabel: verbNames,
    focusTensesLabel: tenseNames,
    recommendedCadence: pool.subModule.recommendedCadence,
    recommendedPolarity: pool.subModule.recommendedPolarity,
    recommendedTimerSeconds: pool.subModule.recommendedTimerSeconds,
    requiredPasses: pool.requiredPasses,
  };
}

export function buildConjugationParadigms(
  pool: ResolvedSubModulePool
): VerbConjugationParadigm[] {
  const pack = getLanguagePack(pool.language);
  const paradigms: VerbConjugationParadigm[] = [];

  for (const verbId of pool.focusVerbIds) {
    const verb = pack.verbs.find((v) => v.id === verbId);
    if (!verb) continue;

    for (const tenseId of pool.focusTenseIds) {
      const tense = pack.tenses.find((t) => t.id === tenseId);
      if (!tense) continue;

      const validPersons = tense.validPersons ?? [0, 1, 2, 3, 4, 5];
      const forms = validPersons.map((person) => {
        const conj = pack.conjugate(verb.id, tense.id, person, 'none');
        const pronounDisplay = pack.pronouns[person].display;
        const spokenAudio = pack.isProDrop
          ? `${pronounDisplay}: ${conj.verbForm}`
          : conj.fullForm;

        return {
          person,
          pronounDisplay,
          verbForm: conj.verbForm,
          fullForm: conj.fullForm,
          spokenAudio,
        };
      });

      paradigms.push({
        verbId: verb.id,
        infinitive: verb.infinitive,
        translation: verb.translation,
        tenseId: tense.id,
        tenseName: tense.name,
        forms,
      });
    }
  }

  return paradigms;
}

function buildChunkCards(pool: ResolvedSubModulePool): CompanionChunkCard[] {
  const pack = getLanguagePack(pool.language);
  const primaryTenseId =
    pool.focusTenseIds[pool.focusTenseIds.length - 1] ?? pack.tenses[0].id;
  const tense =
    pack.tenses.find((t) => t.id === primaryTenseId) ?? pack.tenses[0];
  const validPersons = tense.validPersons ?? [0, 1, 2, 3, 4, 5];

  return pool.focusChunks.map((chunk, idx) => {
    const matchedVerbId =
      chunk.attachToVerbIds?.find((vId) =>
        pool.cumulativeVerbIds.includes(vId)
      ) ??
      pool.focusVerbIds[idx % pool.focusVerbIds.length] ??
      pack.verbs[0].id;

    const verb =
      pack.verbs.find((v) => v.id === matchedVerbId) ?? pack.verbs[0];
    const person = validPersons[idx % validPersons.length];
    const conj = pack.conjugate(verb.id, tense.id, person, 'none');

    const spokenVerb =
      pack.isProDrop && (person === 0 || person === 1 || person === 3 || person === 4)
        ? conj.verbForm
        : conj.fullForm;

    const exampleTarget = pool.language === 'es'
      ? `${spokenVerb} ${chunk.target}.`
      : `${conj.fullForm} ${chunk.target}.`;

    const baseVerbEng = stripSimpleVerbPrefix(verb.translation);
    const exampleEnglish = `(${pack.pronouns[person].display}) ${baseVerbEng} — ${chunk.english}.`;

    return {
      id: chunk.id,
      target: chunk.target,
      english: chunk.english,
      exampleTarget,
      exampleEnglish,
    };
  });
}

function buildDiagnosticNotes(
  pool: ResolvedSubModulePool,
  missedForms: MissedVerbFormItem[],
  missedChunks: LexicalChunk[]
): string[] {
  const pack = getLanguagePack(pool.language);
  const notes: string[] = [];

  for (const mf of missedForms.slice(0, 4)) {
    const verb = pack.verbs.find((v) => v.id === mf.verbId);
    const tense = pack.tenses.find((t) => t.id === mf.tenseId);
    const groupNote = verb?.notes ? ` (${verb.notes})` : '';

    if (pool.language === 'fr') {
      notes.push(
        `Focus « ${mf.infinitive} » (${mf.tenseName}, ${mf.pronounDisplay}) → dites à voix haute : « ${mf.expectedFullForm} ». Repère : ${tense?.rassiasTrigger ?? ''} ${mf.expectedFullForm}${groupNote}.`
      );
    } else {
      notes.push(
        `Foco « ${mf.infinitive} » (${mf.tenseName}, ${mf.pronounDisplay}) → di en voz alta: « ${mf.expectedFullForm} ». Ancla: ${tense?.rassiasTrigger ?? ''} ${mf.expectedFullForm}${groupNote}.`
      );
    }
  }

  for (const mc of missedChunks.slice(0, 3)) {
    if (pool.language === 'fr') {
      notes.push(
        `Expression clé : « ${mc.target} » (${mc.english}) — liez-la directement après le verbe conjugué.`
      );
    } else {
      notes.push(
        `Expresión clave: « ${mc.target} » (${mc.english}) — únela directamente después del verbo conjugado.`
      );
    }
  }

  return notes;
}

function getReciprocalPerson(person: PersonIndex): PersonIndex {
  switch (person) {
    case 0:
      return 1; // yo/je -> tu/tú asks
    case 1:
      return 0; // tu/tú -> yo/je asks
    case 3:
      return 4; // nous/nosotros -> vous/vosotros asks
    case 4:
      return 3; // vous/vosotros -> nous/nosotros asks
    case 2:
      return 2; // 3rd person singular -> 3rd person singular asks
    case 5:
      return 5; // 3rd person plural -> 3rd person plural asks
  }
}

function generateProceduralDialogue(
  pool: ResolvedSubModulePool,
  variant: CompanionLessonVariant,
  encoreIndex: number,
  missedForms: MissedVerbFormItem[],
  missedChunks: LexicalChunk[]
): DialogueLine[] {
  // Use built-in starter dialogue for baseline when available
  if (
    variant === 'baseline' &&
    encoreIndex === 0 &&
    pool.subModule.starterDialogue &&
    pool.subModule.starterDialogue.length > 0
  ) {
    return pool.subModule.starterDialogue;
  }

  const pack = getLanguagePack(pool.language);
  const speakerAName = pool.language === 'fr' ? 'Luc' : 'Mateo';
  const speakerBName = pool.language === 'fr' ? 'Camille' : 'Sofía';
  const lines: DialogueLine[] = [];

  // If this is an Encore Remedial lesson with specific missedForms, weave each missed form into a Q&A pair!
  if (variant === 'encore_remedial' && missedForms.length > 0) {
    const targetItems = missedForms.slice(0, 4);
    targetItems.forEach((mf, idx) => {
      const verb =
        pack.verbs.find((v) => v.id === mf.verbId) ?? pack.verbs[0];
      const tense =
        pack.tenses.find((t) => t.id === mf.tenseId) ?? pack.tenses[0];
      const chunk =
        missedChunks[idx] ??
        pickChunkForVerb(verb.id, pool, idx + encoreIndex) ??
        pool.focusChunks[idx % Math.max(1, pool.focusChunks.length)];

      const tail = chunk ? ` ${chunk.target}` : '';
      const tailEng = chunk ? ` (${chunk.english})` : '';
      const baseVerbEng = stripSimpleVerbPrefix(verb.translation);

      // Conversational reciprocal person flip (0 <-> 1, 3 <-> 4, 2 <-> 2, 5 <-> 5)
      const qPerson = getReciprocalPerson(mf.person);
      const qConj = pack.conjugate(verb.id, tense.id, qPerson, 'none');
      const bConj = pack.conjugate(verb.id, tense.id, mf.person, mf.negation);

      if (pool.language === 'fr') {
        lines.push({
          speaker: 'A',
          speakerName: speakerAName,
          target: `Dis-moi, est-ce que ${qConj.fullForm}${tail} ?`,
          english: `Tell me, (${pack.pronouns[qPerson].display}) ${baseVerbEng}${tailEng}?`,
        });
        const prefix = mf.negation === 'none' ? 'Oui, ' : 'Non, ';
        lines.push({
          speaker: 'B',
          speakerName: speakerBName,
          target: `${prefix}${bConj.fullForm}${tail} !`,
          english: `${mf.negation === 'none' ? 'Yes' : 'No'}, (${mf.pronounDisplay}) ${baseVerbEng}${tailEng}!`,
          audioTip: `Forme ciblée : « ${bConj.fullForm} » (${mf.infinitive} — ${mf.tenseName})`,
        });
      } else {
        // Spanish natural pro-drop (drop yo, tú, nosotros, vosotros)
        const qVerbSpoken =
          qPerson === 2 || qPerson === 5
            ? `${pack.pronouns[qPerson].spokenPrimary} ${qConj.verbForm}`
            : qConj.verbForm;

        const bVerbSpoken =
          mf.person === 2 || mf.person === 5
            ? `${pack.pronouns[mf.person].spokenPrimary} ${bConj.verbForm}`
            : bConj.verbForm;

        lines.push({
          speaker: 'A',
          speakerName: speakerAName,
          target: `Oye, ¿${qVerbSpoken}${tail}?`,
          english: `Hey, (${pack.pronouns[qPerson].display}) ${baseVerbEng}${tailEng}?`,
        });
        const prefix = mf.negation === 'none' ? '¡Sí, ' : 'No, ';
        lines.push({
          speaker: 'B',
          speakerName: speakerBName,
          target: `${prefix}${bVerbSpoken}${tail}!`,
          english: `${mf.negation === 'none' ? 'Yes' : 'No'}, (${mf.pronounDisplay}) ${baseVerbEng}${tailEng}!`,
          audioTip: `Forma clave: « ${bConj.verbForm} » (${mf.infinitive} — ${mf.tenseName})`,
        });
      }
    });

    return lines;
  }

  // Standard procedural dialogue for baseline or pass_2_consolidation
  const offset = variant === 'pass_2_consolidation' ? 2 : encoreIndex;
  const verbsToUse = pool.focusVerbIds.slice(0, 4);
  const tensesToUse = pool.focusTenseIds;

  for (let i = 0; i < Math.max(3, verbsToUse.length); i++) {
    const verbId =
      verbsToUse[(i + offset) % verbsToUse.length] ?? pack.verbs[0].id;
    const tenseId =
      tensesToUse[(i + offset) % tensesToUse.length] ?? pack.tenses[0].id;
    const verb = pack.verbs.find((v) => v.id === verbId) ?? pack.verbs[0];
    const tense = pack.tenses.find((t) => t.id === tenseId) ?? pack.tenses[0];
    const validPersons = tense.validPersons ?? [0, 1, 2, 3, 4, 5];

    const qPerson = validPersons[(i + 1 + offset) % validPersons.length];
    const aPerson = getReciprocalPerson(qPerson);
    const useNeg = i % 2 === 1 && variant === 'pass_2_consolidation';

    const chunk =
      pickChunkForVerb(verb.id, pool, i + offset) ??
      pool.focusChunks[(i + offset) % Math.max(1, pool.focusChunks.length)];
    const tail = chunk ? ` ${chunk.target}` : '';
    const tailEng = chunk ? ` (${chunk.english})` : '';
    const baseVerbEng = stripSimpleVerbPrefix(verb.translation);

    const qConj = pack.conjugate(verb.id, tense.id, qPerson, 'none');
    const aConj = pack.conjugate(
      verb.id,
      tense.id,
      aPerson,
      useNeg ? 'pas' : 'none'
    );

    if (pool.language === 'fr') {
      lines.push({
        speaker: 'A',
        speakerName: speakerAName,
        target: `Dis-moi, ${qConj.fullForm}${tail} ?`,
        english: `Tell me, (${pack.pronouns[qPerson].display}) ${baseVerbEng}${tailEng}?`,
      });
      lines.push({
        speaker: 'B',
        speakerName: speakerBName,
        target: `${useNeg ? 'Non' : 'Oui'}, ${aConj.fullForm}${tail}.`,
        english: `${useNeg ? 'No' : 'Yes'}, (${pack.pronouns[aPerson].display}) ${baseVerbEng}${tailEng}.`,
      });
    } else {
      const qVerbSpoken =
        qPerson === 2 || qPerson === 5
          ? `${pack.pronouns[qPerson].spokenPrimary} ${qConj.verbForm}`
          : qConj.verbForm;

      const aVerbSpoken =
        aPerson === 2 || aPerson === 5
          ? `${pack.pronouns[aPerson].spokenPrimary} ${aConj.verbForm}`
          : aConj.verbForm;

      lines.push({
        speaker: 'A',
        speakerName: speakerAName,
        target: `¿${qVerbSpoken}${tail}?`,
        english: `(${pack.pronouns[qPerson].display}) ${baseVerbEng}${tailEng}?`,
      });
      lines.push({
        speaker: 'B',
        speakerName: speakerBName,
        target: `${useNeg ? 'No, no' : 'Sí,'} ${aVerbSpoken}${tail}.`,
        english: `${useNeg ? 'No' : 'Yes'}, (${pack.pronouns[aPerson].display}) ${baseVerbEng}${tailEng}.`,
      });
    }
  }

  return lines;
}

function buildWarmupPrompts(
  pool: ResolvedSubModulePool,
  missedForms: MissedVerbFormItem[],
  missedChunks: LexicalChunk[]
): CompanionWarmupPrompt[] {
  const pack = getLanguagePack(pool.language);
  const prompts: CompanionWarmupPrompt[] = [];

  if (missedForms.length > 0) {
    for (const mf of missedForms.slice(0, 3)) {
      const tense =
        pack.tenses.find((t) => t.id === mf.tenseId) ?? pack.tenses[0];
      const chunk =
        missedChunks[0] ?? pickChunkForVerb(mf.verbId, pool, 0);
      const tail = chunk ? ` ${chunk.target}` : '';
      const tailEng = chunk ? ` + "${chunk.english}"` : '';

      prompts.push({
        cueEnglish: `${tense.rassiasTriggerEnglish} [${mf.pronounDisplay}] + ${mf.infinitive} (${mf.negation === 'none' ? 'Affirmative' : 'Negative'})${tailEng}`,
        expectedTarget: `${tense.rassiasTrigger} ${mf.expectedFullForm}${tail}`,
        hint: `${mf.infinitive} (${mf.tenseName}) → ${mf.expectedFullForm}`,
      });
    }
    return prompts;
  }

  const primaryTenseId =
    pool.focusTenseIds[pool.focusTenseIds.length - 1] ?? pack.tenses[0].id;
  const tense =
    pack.tenses.find((t) => t.id === primaryTenseId) ?? pack.tenses[0];
  const validPersons = tense.validPersons ?? [0, 1, 2, 3, 4, 5];

  for (let i = 0; i < 3; i++) {
    const verbId =
      pool.focusVerbIds[i % pool.focusVerbIds.length] ?? pack.verbs[0].id;
    const verb = pack.verbs.find((v) => v.id === verbId) ?? pack.verbs[0];
    const person = validPersons[i % validPersons.length];
    const negation = i === 2 ? 'pas' : 'none';
    const conj = pack.conjugate(verb.id, tense.id, person, negation);
    const chunk = pickChunkForVerb(verb.id, pool, i);
    const tail = chunk ? ` ${chunk.target}` : '';
    const tailEng = chunk ? ` + "${chunk.english}"` : '';

    prompts.push({
      cueEnglish: `${tense.rassiasTriggerEnglish} [${pack.pronouns[person].display}] + ${verb.infinitive} (${ verb.translation })${negation !== 'none' ? ' [Negative]' : ''}${tailEng}`,
      expectedTarget: `${tense.rassiasTrigger} ${conj.fullForm}${tail}`,
      hint: `${verb.infinitive} (${tense.name}) → ${conj.fullForm}`,
    });
  }

  return prompts;
}

/**
 * Deterministically builds a complete, offline-ready CompanionLesson (Baseline Scene A,
 * Pass 2 Consolidation Scene B, or Diagnostic Encore Remedial Scene) for any Sub-Module.
 */
export function buildOfflineCompanionLesson(options: {
  pool: ResolvedSubModulePool;
  variant?: CompanionLessonVariant;
  encoreIndex?: number;
  missedForms?: MissedVerbFormItem[];
  missedChunks?: LexicalChunk[];
}): CompanionLesson {
  const {
    pool,
    variant = 'baseline',
    encoreIndex = 0,
    missedForms = [],
    missedChunks = [],
  } = options;

  const scenes = pool.language === 'fr' ? FRENCH_SCENES : SPANISH_SCENES;
  const sceneIdx =
    (pool.index + (variant === 'pass_2_consolidation' ? 2 : encoreIndex)) %
    scenes.length;

  let subtitle: string;
  if (variant === 'encore_remedial') {
    subtitle =
      pool.language === 'fr'
        ? `Leçon Encore #${encoreIndex + 1} — Remédiation ciblée`
        : `Lección Encore #${encoreIndex + 1} — Práctica focalizada`;
  } else if (variant === 'pass_2_consolidation') {
    subtitle =
      pool.language === 'fr'
        ? 'Scène B — Consolidation pour la Passe 2/2'
        : 'Escena B — Consolidación para el Pase 2/2';
  } else {
    subtitle =
      pool.language === 'fr'
        ? 'Scène A — Introduction & Modèle sonore (Passe 1/2)'
        : 'Escena A — Introducción y Patrón sonoro (Pase 1/2)';
  }

  const hasBuiltinStarter =
    variant === 'baseline' &&
    encoreIndex === 0 &&
    Boolean(pool.subModule.starterDialogue?.length);

  const dialogue = generateProceduralDialogue(
    pool,
    variant,
    encoreIndex,
    missedForms,
    missedChunks
  );
  const diagnosticNotes =
    variant === 'encore_remedial'
      ? buildDiagnosticNotes(pool, missedForms, missedChunks)
      : [];

  return {
    id: `${pool.subModule.id}-${variant}-${encoreIndex}-${pool.recipeHash}`,
    language: pool.language,
    subModuleId: pool.subModule.id,
    displayCode: pool.displayCode,
    phase: pool.subModule.phase,
    phaseTitle: pool.subModule.phaseTitle,
    title: `${pool.displayCode} — ${pool.subModule.title}`,
    subtitle,
    variant,
    encoreIndex,
    recipeHash: pool.recipeHash,
    generatedBy: hasBuiltinStarter ? 'starter_builtin' : 'offline_engine',
    createdAt: Date.now(),
    sceneSetting: scenes[sceneIdx],
    dialogue,
    earNotes: [pool.subModule.earRule],
    conjugationParadigms: buildConjugationParadigms(pool),
    diagnosticNotes,
    chunkCards: buildChunkCards(pool),
    warmupPrompts: buildWarmupPrompts(pool, missedForms, missedChunks),
    drillPrescription: buildDrillPrescription(pool),
    spotlightMissedForms: missedForms.length > 0 ? missedForms : undefined,
    spotlightMissedChunks: missedChunks.length > 0 ? missedChunks : undefined,
  };
}
