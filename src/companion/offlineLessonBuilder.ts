import { MissedVerbFormItem } from '../engine/drillDirector';
import {
  pickChunkForVerb,
  ResolvedSubModulePool,
} from '../engine/roadmapResolver';
import { getLanguagePack } from '../languages';
import {
  DialogueLine,
  LanguageCode,
  LexicalChunk,
  NegationType,
  PersonIndex,
  VerbEntry,
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
  'En una cafetería de la Ciudad de México',
  'En la estación antes de salir de viaje',
  'En la oficina un lunes por la mañana',
  'Caminando por el parque después del trabajo',
  'Preparando una cena con amigos en casa',
  'En la terraza de un restaurante al mediodía',
];

const FRENCH_SCENES = [
  'Dans un petit café à Lyon',
  'À la gare avant le départ du train',
  'Au bureau un lundi matin',
  'En marchant dans le quartier après le travail',
  'En préparant le dîner entre amis à la maison',
  'Sur la terrasse d’un bistro à midi',
];

const SPANISH_INFLECTED_ADJECTIVES: Record<
  string,
  { ms: string; fs: string; mp: string; fp: string }
> = {
  cansado: { ms: 'cansado', fs: 'cansada', mp: 'cansados', fp: 'cansadas' },
  listo: { ms: 'listo', fs: 'lista', mp: 'listos', fp: 'listas' },
  loco: { ms: 'loco', fs: 'loca', mp: 'locos', fp: 'locas' },
  seguro: { ms: 'seguro', fs: 'segura', mp: 'seguros', fp: 'seguras' },
};

/**
 * Inflects target-language adjective chunks (e.g. cansado -> cansada / cansados,
 * listo -> lista / listos) to agree with the grammatical person and speaker gender.
 */
export function inflectChunkTarget(
  chunk: LexicalChunk | undefined,
  language: LanguageCode,
  person: PersonIndex,
  speakerGender: 'm' | 'f' = 'm'
): string {
  if (!chunk) return '';
  if (language === 'es') {
    const table = SPANISH_INFLECTED_ADJECTIVES[chunk.target];
    if (table) {
      const isPlural = person === 3 || person === 4 || person === 5;
      if (isPlural) {
        return table.mp;
      }
      return speakerGender === 'f' ? table.fs : table.ms;
    }
  }
  return chunk.target;
}

/**
 * Resolves the verb-specific English meaning of a chunk (e.g., estar + listo -> "ready",
 * ser + listo -> "clever", estar + loco -> "acting crazy", ser + loco -> "crazy").
 */
export function resolveChunkMeaningForVerb(
  chunk: LexicalChunk | undefined,
  verbId: string
): string {
  if (!chunk) return '';
  if (chunk.meaningByVerbId && chunk.meaningByVerbId[verbId]) {
    return chunk.meaningByVerbId[verbId];
  }
  return chunk.english.replace(/\s*\([^)]*\)/g, '').trim();
}

interface EnglishVerbForms {
  base: string;
  thirdSingular: string;
  past: string;
  participle: string;
  gerund: string;
  isBe?: boolean;
}

const ENGLISH_VERB_TABLE: Record<string, EnglishVerbForms> = {
  // Copulas ("to be")
  ser: { base: 'be', thirdSingular: 'is', past: 'was', participle: 'been', gerund: 'being', isBe: true },
  estar: { base: 'be', thirdSingular: 'is', past: 'was', participle: 'been', gerund: 'being', isBe: true },
  etre: { base: 'be', thirdSingular: 'is', past: 'was', participle: 'been', gerund: 'being', isBe: true },

  // Core irregulars & high-frequency verbs
  tener: { base: 'have', thirdSingular: 'has', past: 'had', participle: 'had', gerund: 'having' },
  avoir: { base: 'have', thirdSingular: 'has', past: 'had', participle: 'had', gerund: 'having' },
  ir: { base: 'go', thirdSingular: 'goes', past: 'went', participle: 'gone', gerund: 'going' },
  aller: { base: 'go', thirdSingular: 'goes', past: 'went', participle: 'gone', gerund: 'going' },
  hacer: { base: 'do', thirdSingular: 'does', past: 'did', participle: 'done', gerund: 'doing' },
  faire: { base: 'do', thirdSingular: 'does', past: 'did', participle: 'done', gerund: 'doing' },
  hablar: { base: 'speak', thirdSingular: 'speaks', past: 'spoke', participle: 'spoken', gerund: 'speaking' },
  parler: { base: 'speak', thirdSingular: 'speaks', past: 'spoke', participle: 'spoken', gerund: 'speaking' },
  trabajar: { base: 'work', thirdSingular: 'works', past: 'worked', participle: 'worked', gerund: 'working' },
  estudiar: { base: 'study', thirdSingular: 'studies', past: 'studied', participle: 'studied', gerund: 'studying' },
  llegar: { base: 'arrive', thirdSingular: 'arrives', past: 'arrived', participle: 'arrived', gerund: 'arriving' },
  comer: { base: 'eat', thirdSingular: 'eats', past: 'ate', participle: 'eaten', gerund: 'eating' },
  manger: { base: 'eat', thirdSingular: 'eats', past: 'ate', participle: 'eaten', gerund: 'eating' },
  aprender: { base: 'learn', thirdSingular: 'learns', past: 'learned', participle: 'learned', gerund: 'learning' },
  apprendre: { base: 'learn', thirdSingular: 'learns', past: 'learned', participle: 'learned', gerund: 'learning' },
  beber: { base: 'drink', thirdSingular: 'drinks', past: 'drank', participle: 'drunk', gerund: 'drinking' },
  boire: { base: 'drink', thirdSingular: 'drinks', past: 'drank', participle: 'drunk', gerund: 'drinking' },
  vivir: { base: 'live', thirdSingular: 'lives', past: 'lived', participle: 'lived', gerund: 'living' },
  vivre: { base: 'live', thirdSingular: 'lives', past: 'lived', participle: 'lived', gerund: 'living' },
  escribir: { base: 'write', thirdSingular: 'writes', past: 'wrote', participle: 'written', gerund: 'writing' },
  ecrire: { base: 'write', thirdSingular: 'writes', past: 'wrote', participle: 'written', gerund: 'writing' },
  finir: { base: 'finish', thirdSingular: 'finishes', past: 'finished', participle: 'finished', gerund: 'finishing' },
  aimer: { base: 'like', thirdSingular: 'likes', past: 'liked', participle: 'liked', gerund: 'liking' },
  donner: { base: 'give', thirdSingular: 'gives', past: 'gave', participle: 'given', gerund: 'giving' },
  dar: { base: 'give', thirdSingular: 'gives', past: 'gave', participle: 'given', gerund: 'giving' },
  trouver: { base: 'find', thirdSingular: 'finds', past: 'found', participle: 'found', gerund: 'finding' },
  encontrar: { base: 'find', thirdSingular: 'finds', past: 'found', participle: 'found', gerund: 'finding' },
  choisir: { base: 'choose', thirdSingular: 'chooses', past: 'chose', participle: 'chosen', gerund: 'choosing' },
  reussir: { base: 'succeed', thirdSingular: 'succeeds', past: 'succeeded', participle: 'succeeded', gerund: 'succeeding' },
  attendre: { base: 'wait for', thirdSingular: 'waits for', past: 'waited for', participle: 'waited for', gerund: 'waiting for' },
  vendre: { base: 'sell', thirdSingular: 'sells', past: 'sold', participle: 'sold', gerund: 'selling' },
  entendre: { base: 'hear', thirdSingular: 'hears', past: 'heard', participle: 'heard', gerund: 'hearing' },
  oir: { base: 'hear', thirdSingular: 'hears', past: 'heard', participle: 'heard', gerund: 'hearing' },
  poder: { base: 'be able to', thirdSingular: 'can', past: 'managed to', participle: 'been able to', gerund: 'being able to' },
  pouvoir: { base: 'be able to', thirdSingular: 'can', past: 'managed to', participle: 'been able to', gerund: 'being able to' },
  querer: { base: 'want', thirdSingular: 'wants', past: 'wanted', participle: 'wanted', gerund: 'wanting' },
  vouloir: { base: 'want', thirdSingular: 'wants', past: 'wanted', participle: 'wanted', gerund: 'wanting' },
  deber: { base: 'have to', thirdSingular: 'has to', past: 'had to', participle: 'had to', gerund: 'having to' },
  devoir: { base: 'have to', thirdSingular: 'has to', past: 'had to', participle: 'had to', gerund: 'having to' },
  saber: { base: 'know', thirdSingular: 'knows', past: 'found out', participle: 'known', gerund: 'knowing' },
  savoir: { base: 'know', thirdSingular: 'knows', past: 'knew', participle: 'known', gerund: 'knowing' },
  venir: { base: 'come', thirdSingular: 'comes', past: 'came', participle: 'come', gerund: 'coming' },
  poner: { base: 'put', thirdSingular: 'puts', past: 'put', participle: 'put', gerund: 'putting' },
  mettre: { base: 'put', thirdSingular: 'puts', past: 'put', participle: 'put', gerund: 'putting' },
  decir: { base: 'say', thirdSingular: 'says', past: 'said', participle: 'said', gerund: 'saying' },
  dire: { base: 'say', thirdSingular: 'says', past: 'said', participle: 'said', gerund: 'saying' },
  ver: { base: 'see', thirdSingular: 'sees', past: 'saw', participle: 'seen', gerund: 'seeing' },
  voir: { base: 'see', thirdSingular: 'sees', past: 'saw', participle: 'seen', gerund: 'seeing' },
  salir: { base: 'go out', thirdSingular: 'goes out', past: 'went out', participle: 'gone out', gerund: 'going out' },
  sortir: { base: 'go out', thirdSingular: 'goes out', past: 'went out', participle: 'gone out', gerund: 'going out' },
  partir: { base: 'leave', thirdSingular: 'leaves', past: 'left', participle: 'left', gerund: 'leaving' },
  prendre: { base: 'take', thirdSingular: 'takes', past: 'took', participle: 'taken', gerund: 'taking' },
  pensar: { base: 'think', thirdSingular: 'thinks', past: 'thought', participle: 'thought', gerund: 'thinking' },
  empezar: { base: 'start', thirdSingular: 'starts', past: 'started', participle: 'started', gerund: 'starting' },
  commencer: { base: 'start', thirdSingular: 'starts', past: 'started', participle: 'started', gerund: 'starting' },
  entender: { base: 'understand', thirdSingular: 'understands', past: 'understood', participle: 'understood', gerund: 'understanding' },
  comprendre: { base: 'understand', thirdSingular: 'understands', past: 'understood', participle: 'understood', gerund: 'understanding' },
  volver: { base: 'return', thirdSingular: 'returns', past: 'returned', participle: 'returned', gerund: 'returning' },
  dormir: { base: 'sleep', thirdSingular: 'sleeps', past: 'slept', participle: 'slept', gerund: 'sleeping' },
  pedir: { base: 'ask for', thirdSingular: 'asks for', past: 'asked for', participle: 'asked for', gerund: 'asking for' },
  seguir: { base: 'follow', thirdSingular: 'follows', past: 'followed', participle: 'followed', gerund: 'following' },
  suivre: { base: 'follow', thirdSingular: 'follows', past: 'followed', participle: 'followed', gerund: 'following' },
  conocer: { base: 'know', thirdSingular: 'knows', past: 'met', participle: 'known', gerund: 'knowing' },
  connaitre: { base: 'know', thirdSingular: 'knows', past: 'knew', participle: 'known', gerund: 'knowing' },
  traer: { base: 'bring', thirdSingular: 'brings', past: 'brought', participle: 'brought', gerund: 'bringing' },
  caer: { base: 'fall', thirdSingular: 'falls', past: 'fell', participle: 'fallen', gerund: 'falling' },
  buscar: { base: 'look for', thirdSingular: 'looks for', past: 'looked for', participle: 'looked for', gerund: 'looking for' },
  pagar: { base: 'pay', thirdSingular: 'pays', past: 'paid', participle: 'paid', gerund: 'paying' },
  payer: { base: 'pay', thirdSingular: 'pays', past: 'paid', participle: 'paid', gerund: 'paying' },
  sacar: { base: 'take out', thirdSingular: 'takes out', past: 'took out', participle: 'taken out', gerund: 'taking out' },
  creer: { base: 'believe', thirdSingular: 'believes', past: 'believed', participle: 'believed', gerund: 'believing' },
  croire: { base: 'believe', thirdSingular: 'believes', past: 'believed', participle: 'believed', gerund: 'believing' },
  leer: { base: 'read', thirdSingular: 'reads', past: 'read', participle: 'read', gerund: 'reading' },
  lire: { base: 'read', thirdSingular: 'reads', past: 'read', participle: 'read', gerund: 'reading' },
  sentir: { base: 'feel', thirdSingular: 'feels', past: 'felt', participle: 'felt', gerund: 'feeling' },
  morir: { base: 'die', thirdSingular: 'dies', past: 'died', participle: 'died', gerund: 'dying' },
  abrir: { base: 'open', thirdSingular: 'opens', past: 'opened', participle: 'opened', gerund: 'opening' },
  ouvrir: { base: 'open', thirdSingular: 'opens', past: 'opened', participle: 'opened', gerund: 'opening' },
  conducir: { base: 'drive', thirdSingular: 'drives', past: 'drove', participle: 'driven', gerund: 'driving' },
  producir: { base: 'produce', thirdSingular: 'produces', past: 'produced', participle: 'produced', gerund: 'producing' },
  acheter: { base: 'buy', thirdSingular: 'buys', past: 'bought', participle: 'bought', gerund: 'buying' },
  appeler: { base: 'call', thirdSingular: 'calls', past: 'called', participle: 'called', gerund: 'calling' },
  jeter: { base: 'throw', thirdSingular: 'throws', past: 'threw', participle: 'thrown', gerund: 'throwing' },
  envoyer: { base: 'send', thirdSingular: 'sends', past: 'sent', participle: 'sent', gerund: 'sending' },
  recevoir: { base: 'receive', thirdSingular: 'receives', past: 'received', participle: 'received', gerund: 'receiving' },
  courir: { base: 'run', thirdSingular: 'runs', past: 'ran', participle: 'run', gerund: 'running' },
  tenir: { base: 'hold', thirdSingular: 'holds', past: 'held', participle: 'held', gerund: 'holding' },
};

function getEnglishVerbForms(
  verb: VerbEntry,
  chunk?: LexicalChunk
): { forms: EnglishVerbForms; chunkEnglish: string } {
  const chunkId = chunk?.id ?? '';

  // Handle idiomatic Romance "have/do + noun" expressions that translate to English "be + adj" or specific collocations
  if (
    (verb.id === 'tener' && chunkId === 'es-hambre') ||
    (verb.id === 'avoir' && chunkId === 'fr-faim')
  ) {
    return {
      forms: ENGLISH_VERB_TABLE.estar,
      chunkEnglish: 'hungry',
    };
  }
  if (verb.id === 'tener' && chunkId === 'es-prisa') {
    return {
      forms: ENGLISH_VERB_TABLE.estar,
      chunkEnglish: 'in a hurry',
    };
  }
  if (verb.id === 'tener' && chunkId === 'es-mucho-frio') {
    return {
      forms: ENGLISH_VERB_TABLE.estar,
      chunkEnglish: 'very cold',
    };
  }
  if (verb.id === 'avoir' && chunkId === 'fr-besoin-d-aide') {
    return {
      forms: {
        base: 'need',
        thirdSingular: 'needs',
        past: 'needed',
        participle: 'needed',
        gerund: 'needing',
      },
      chunkEnglish: 'help',
    };
  }
  if (verb.id === 'faire' && chunkId === 'fr-attention') {
    return {
      forms: ENGLISH_VERB_TABLE.etre,
      chunkEnglish: 'careful',
    };
  }
  if (verb.id === 'faire' && chunkId === 'fr-du-sport') {
    return {
      forms: {
        base: 'play',
        thirdSingular: 'plays',
        past: 'played',
        participle: 'played',
        gerund: 'playing',
      },
      chunkEnglish: 'sports',
    };
  }
  if (
    (verb.id === 'poner' && chunkId === 'es-la-mesa') ||
    (verb.id === 'mettre' && chunkId === 'fr-la-table')
  ) {
    return {
      forms: {
        base: 'set',
        thirdSingular: 'sets',
        past: 'set',
        participle: 'set',
        gerund: 'setting',
      },
      chunkEnglish: 'the table',
    };
  }
  if (verb.id === 'sacar' && chunkId === 'es-fotos') {
    return {
      forms: {
        base: 'take',
        thirdSingular: 'takes',
        past: 'took',
        participle: 'taken',
        gerund: 'taking',
      },
      chunkEnglish: 'photos',
    };
  }

  const baseClean = verb.translation
    .replace(/^to\s+/i, '')
    .split('/')[0]
    .replace(/\([^)]*\)/g, '')
    .trim();

  const forms = ENGLISH_VERB_TABLE[verb.id] ?? {
    base: baseClean,
    thirdSingular: `${baseClean}s`,
    past: `${baseClean}ed`,
    participle: `${baseClean}ed`,
    gerund: `${baseClean}ing`,
  };

  return {
    forms,
    chunkEnglish: resolveChunkMeaningForVerb(chunk, verb.id),
  };
}

function getEnglishSubject(person: PersonIndex, language: LanguageCode, includeVosotros = false): string {
  switch (person) {
    case 0:
      return 'I';
    case 1:
      return 'you';
    case 2:
      return 'he';
    case 3:
      return 'we';
    case 4:
      return language === 'fr' ? 'you' : 'you all';
    case 5:
      return language === 'es' && !includeVosotros ? 'you all' : 'they';
  }
}

function getPresentBe(person: PersonIndex): string {
  if (person === 0) return 'am';
  if (person === 2) return 'is';
  return 'are';
}

function getPastBe(person: PersonIndex): string {
  if (person === 0 || person === 2) return 'was';
  return 'were';
}

/**
 * Builds a natural, idiomatic English sentence or question for any (verb, tense, person, negation, chunk) tuple.
 */
export function buildNaturalEnglishClause(options: {
  language: LanguageCode;
  verb: VerbEntry;
  tenseId: string;
  person: PersonIndex;
  negation: NegationType;
  chunk?: LexicalChunk;
  isQuestion?: boolean;
  includeVosotros?: boolean;
}): string {
  const {
    language,
    verb,
    tenseId,
    person,
    negation,
    chunk,
    isQuestion = false,
    includeVosotros = false,
  } = options;

  const { forms, chunkEnglish } = getEnglishVerbForms(verb, chunk);
  const subj = getEnglishSubject(person, language, includeVosotros);
  const isThirdSing = person === 2;
  const isNeg = negation !== 'none';
  const tail = chunkEnglish ? ` ${chunkEnglish}` : '';

  // 1. Imperative commands
  if (
    tenseId === 'imperativo_afirmativo' ||
    tenseId === 'imperativo_negativo' ||
    tenseId === 'imperatif'
  ) {
    if (person === 3) {
      return isNeg
        ? `Let's not ${forms.base}${tail}`
        : `Let's ${forms.base}${tail}`;
    }
    return isNeg
      ? `Do not ${forms.base}${tail}`
      : `${forms.base.charAt(0).toUpperCase() + forms.base.slice(1)}${tail}`;
  }

  // 2. Near Future (ir a + inf / aller + inf)
  if (tenseId === 'futuro_proximo' || tenseId === 'futur_proche') {
    const beAux = getPresentBe(person);
    if (isQuestion) {
      return `${beAux} ${subj}${isNeg ? ' not' : ''} going to ${forms.base}${tail}`;
    }
    return `${subj} ${beAux}${isNeg ? ' not' : ''} going to ${forms.base}${tail}`;
  }

  // 3. Simple Future
  if (tenseId === 'futuro_simple' || tenseId === 'futur_simple') {
    if (isQuestion) {
      return `will ${subj}${isNeg ? ' not' : ''} ${forms.base}${tail}`;
    }
    return `${subj} will${isNeg ? ' not' : ''} ${forms.base}${tail}`;
  }

  // 4. Simple Conditional
  if (tenseId === 'condicional_simple' || tenseId === 'conditionnel_present') {
    if (isQuestion) {
      return `would ${subj}${isNeg ? ' not' : ''} ${forms.base}${tail}`;
    }
    return `${subj} would${isNeg ? ' not' : ''} ${forms.base}${tail}`;
  }

  // 5. Present Perfect / Passé Composé
  if (tenseId === 'preterito_perfecto' || tenseId === 'passe_compose') {
    const haveAux = isThirdSing ? 'has' : 'have';
    if (isQuestion) {
      return `${haveAux} ${subj}${isNeg ? ' not' : ''} ${forms.participle}${tail}`;
    }
    return `${subj} ${haveAux}${isNeg ? ' not' : ''} ${forms.participle}${tail}`;
  }

  // 6. Pluperfect
  if (
    tenseId === 'pluscuamperfecto' ||
    tenseId === 'plus_que_parfait' ||
    tenseId === 'subjuntivo_pluscuamperfecto'
  ) {
    if (isQuestion) {
      return `had ${subj}${isNeg ? ' not' : ''} ${forms.participle}${tail}`;
    }
    return `${subj} had${isNeg ? ' not' : ''} ${forms.participle}${tail}`;
  }

  // 7. Future Perfect
  if (tenseId === 'futuro_compuesto' || tenseId === 'futur_anterieur') {
    if (isQuestion) {
      return `will ${subj}${isNeg ? ' not' : ''} have ${forms.participle}${tail}`;
    }
    return `${subj} will${isNeg ? ' not' : ''} have ${forms.participle}${tail}`;
  }

  // 8. Conditional Perfect
  if (tenseId === 'condicional_compuesto' || tenseId === 'conditionnel_passe') {
    if (isQuestion) {
      return `would ${subj}${isNeg ? ' not' : ''} have ${forms.participle}${tail}`;
    }
    return `${subj} would${isNeg ? ' not' : ''} have ${forms.participle}${tail}`;
  }

  // 9. Imperfect Past
  if (tenseId === 'preterito_imperfecto' || tenseId === 'imparfait') {
    if (forms.isBe) {
      const pastBe = getPastBe(person);
      if (isQuestion) {
        return `${pastBe} ${subj}${isNeg ? ' not' : ''}${tail}`;
      }
      return `${subj} ${pastBe}${isNeg ? ' not' : ''}${tail}`;
    }
    if (isQuestion) {
      return `did ${subj}${isNeg ? ' not' : ''} use to ${forms.base}${tail}`;
    }
    return isNeg
      ? `${subj} did not use to ${forms.base}${tail}`
      : `${subj} used to ${forms.base}${tail}`;
  }

  // 10. Simple Past (Preterite)
  if (tenseId === 'preterito_indefinido') {
    if (forms.isBe) {
      const pastBe = getPastBe(person);
      if (isQuestion) {
        return `${pastBe} ${subj}${isNeg ? ' not' : ''}${tail}`;
      }
      return `${subj} ${pastBe}${isNeg ? ' not' : ''}${tail}`;
    }
    if (isQuestion) {
      return `did ${subj}${isNeg ? ' not' : ''} ${forms.base}${tail}`;
    }
    return isNeg
      ? `${subj} did not ${forms.base}${tail}`
      : `${subj} ${forms.past}${tail}`;
  }

  // 11. Present / Subjunctive
  if (forms.isBe) {
    const beAux = getPresentBe(person);
    if (isQuestion) {
      return `${beAux} ${subj}${isNeg ? ' not' : ''}${tail}`;
    }
    return `${subj} ${beAux}${isNeg ? ' not' : ''}${tail}`;
  }

  if (verb.id === 'poder' || verb.id === 'pouvoir') {
    if (isQuestion) {
      return `can ${subj}${isNeg ? ' not' : ''}${tail}`;
    }
    return `${subj} ${isNeg ? 'cannot' : 'can'}${tail}`;
  }

  const doAux = isThirdSing ? 'does' : 'do';
  if (isQuestion) {
    return `${doAux} ${subj}${isNeg ? ' not' : ''} ${forms.base}${tail}`;
  }
  if (isNeg) {
    return `${subj} ${doAux} not ${forms.base}${tail}`;
  }
  return `${subj} ${isThirdSing ? forms.thirdSingular : forms.base}${tail}`;
}

function capitalizeSentence(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
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

function getActiveValidPersons(
  validPersons: PersonIndex[] | undefined,
  language: LanguageCode,
  includeVosotros = false
): PersonIndex[] {
  const base: PersonIndex[] = validPersons ?? [0, 1, 2, 3, 4, 5];
  if (language === 'es' && !includeVosotros) {
    const filtered = base.filter((p) => p !== 4);
    return filtered.length > 0 ? filtered : base;
  }
  return base;
}

export function buildConjugationParadigms(
  pool: ResolvedSubModulePool,
  includeVosotros = false
): VerbConjugationParadigm[] {
  const pack = getLanguagePack(pool.language);
  const paradigms: VerbConjugationParadigm[] = [];

  for (const verbId of pool.focusVerbIds) {
    const verb = pack.verbs.find((v) => v.id === verbId);
    if (!verb) continue;

    for (const tenseId of pool.focusTenseIds) {
      const tense = pack.tenses.find((t) => t.id === tenseId);
      if (!tense) continue;

      const validPersons = getActiveValidPersons(
        tense.validPersons,
        pool.language,
        includeVosotros
      );
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

function buildChunkCards(
  pool: ResolvedSubModulePool,
  includeVosotros = false
): CompanionChunkCard[] {
  const pack = getLanguagePack(pool.language);
  const primaryTenseId =
    pool.focusTenseIds[pool.focusTenseIds.length - 1] ?? pack.tenses[0].id;
  const tense =
    pack.tenses.find((t) => t.id === primaryTenseId) ?? pack.tenses[0];
  const validPersons = getActiveValidPersons(
    tense.validPersons,
    pool.language,
    includeVosotros
  );
  const pluralPersons = validPersons.filter(
    (p) => p === 3 || p === 4 || p === 5
  );

  return pool.focusChunks.map((chunk, idx) => {
    const matchedVerbId =
      chunk.attachToVerbIds?.find((vId) =>
        pool.cumulativeVerbIds.includes(vId)
      ) ??
      pool.focusVerbIds[idx % pool.focusVerbIds.length] ??
      pack.verbs[0].id;

    const verb =
      pack.verbs.find((v) => v.id === matchedVerbId) ?? pack.verbs[0];
    const personPool =
      chunk.requiresPlural && pluralPersons.length > 0
        ? pluralPersons
        : validPersons;
    const person = personPool[idx % personPool.length];
    const conj = pack.conjugate(verb.id, tense.id, person, 'none');
    const inflectedTarget = inflectChunkTarget(chunk, pool.language, person, 'm');

    const spokenVerb =
      pack.isProDrop && (person === 0 || person === 1 || person === 3 || person === 4)
        ? conj.verbForm
        : conj.fullForm;

    const exampleTarget =
      pool.language === 'es'
        ? `${capitalizeSentence(spokenVerb)} ${inflectedTarget}.`
        : `${capitalizeSentence(conj.fullForm)} ${inflectedTarget}.`;

    const clauseEng = buildNaturalEnglishClause({
      language: pool.language,
      verb,
      tenseId: tense.id,
      person,
      negation: 'none',
      chunk,
      isQuestion: false,
      includeVosotros,
    });
    const exampleEnglish = `${capitalizeSentence(clauseEng)}.`;

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

function getReciprocalPerson(
  person: PersonIndex,
  language: LanguageCode = 'fr',
  includeVosotros = false
): PersonIndex {
  switch (person) {
    case 0:
      return 1; // yo/je -> tu/tú asks
    case 1:
      return 0; // tu/tú -> yo/je asks
    case 3:
      // In Latin American Spanish (!includeVosotros), "ustedes" (5) is the plural of "you"
      return language === 'es' && !includeVosotros ? 5 : 4;
    case 4:
      return 3; // vous/vosotros -> nous/nosotros asks
    case 2:
      return 2; // 3rd person singular -> 3rd person singular asks
    case 5:
      return 5; // 3rd person plural -> 3rd person plural asks
  }
}

const SPANISH_OPENERS = ['Oye,', 'Dime,', 'Por cierto,', 'Una pregunta:'];
const FRENCH_OPENERS = ['Dis-moi,', 'Au fait,', 'Alors,', 'Petite question :'];

function generateProceduralDialogue(
  pool: ResolvedSubModulePool,
  variant: CompanionLessonVariant,
  encoreIndex: number,
  missedForms: MissedVerbFormItem[],
  missedChunks: LexicalChunk[],
  includeVosotros = false
): DialogueLine[] {
  // 1. Use built-in starter dialogue for Scene A (baseline) when available and not remixing
  if (
    variant === 'baseline' &&
    encoreIndex === 0 &&
    pool.subModule.starterDialogue &&
    pool.subModule.starterDialogue.length > 0
  ) {
    return pool.subModule.starterDialogue;
  }

  // 2. Use built-in consolidation dialogue for Scene B (pass_2_consolidation) when available and not remixing
  if (
    variant === 'pass_2_consolidation' &&
    encoreIndex === 0 &&
    pool.subModule.consolidationDialogue &&
    pool.subModule.consolidationDialogue.length > 0
  ) {
    return pool.subModule.consolidationDialogue;
  }

  const pack = getLanguagePack(pool.language);
  const speakerAName = pool.language === 'fr' ? 'Luc' : 'Mateo';
  const speakerBName = pool.language === 'fr' ? 'Camille' : 'Sofía';
  const lines: DialogueLine[] = [];

  // 3. If this is an Encore Remedial lesson with specific missedForms, weave each missed form into a Q&A pair
  if (variant === 'encore_remedial' && missedForms.length > 0) {
    const targetItems = missedForms.slice(0, 4);
    targetItems.forEach((mf, idx) => {
      const verb =
        pack.verbs.find((v) => v.id === mf.verbId) ?? pack.verbs[0];
      const tense =
        pack.tenses.find((t) => t.id === mf.tenseId) ?? pack.tenses[0];

      // Conversational reciprocal person flip (0 <-> 1, 3 <-> 4/5, 2 <-> 2, 5 <-> 5)
      const qPerson = getReciprocalPerson(
        mf.person,
        pool.language,
        includeVosotros
      );

      const candidateChunk =
        missedChunks[idx] ??
        pickChunkForVerb(verb.id, pool, idx + encoreIndex, mf.person);
      const chunk =
        candidateChunk?.requiresPlural &&
        (mf.person === 0 || mf.person === 1 || mf.person === 2)
          ? pickChunkForVerb(verb.id, pool, idx + encoreIndex + 1, mf.person)
          : candidateChunk;

      const qInflected = inflectChunkTarget(chunk, pool.language, qPerson, 'm');
      const bInflected = inflectChunkTarget(chunk, pool.language, mf.person, 'f');
      const qTail = qInflected ? ` ${qInflected}` : '';
      const bTail = bInflected ? ` ${bInflected}` : '';

      const qConj = pack.conjugate(verb.id, tense.id, qPerson, 'none');
      const bConj = pack.conjugate(verb.id, tense.id, mf.person, mf.negation);

      const qEnglishClause = buildNaturalEnglishClause({
        language: pool.language,
        verb,
        tenseId: tense.id,
        person: qPerson,
        negation: 'none',
        chunk,
        isQuestion: true,
        includeVosotros,
      });
      const bEnglishClause = buildNaturalEnglishClause({
        language: pool.language,
        verb,
        tenseId: tense.id,
        person: mf.person,
        negation: mf.negation,
        chunk,
        isQuestion: false,
        includeVosotros,
      });

      if (pool.language === 'fr') {
        const opener = FRENCH_OPENERS[(idx + encoreIndex) % FRENCH_OPENERS.length];
        lines.push({
          speaker: 'A',
          speakerName: speakerAName,
          target: `${opener} est-ce que ${qConj.fullForm}${qTail} ?`,
          english: `${capitalizeSentence(qEnglishClause)}?`,
        });
        const prefix = mf.negation === 'none' ? 'Oui, ' : 'Non, ';
        lines.push({
          speaker: 'B',
          speakerName: speakerBName,
          target: `${prefix}${bConj.fullForm}${bTail} !`,
          english: `${mf.negation === 'none' ? 'Yes' : 'No'}, ${bEnglishClause}!`,
          audioTip: `Forme ciblée : « ${bConj.fullForm} » (${mf.infinitive} — ${mf.tenseName})`,
        });
      } else {
        const opener = SPANISH_OPENERS[(idx + encoreIndex) % SPANISH_OPENERS.length];
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
          target: `${opener} ¿${qVerbSpoken}${qTail}?`,
          english: `${capitalizeSentence(qEnglishClause)}?`,
        });
        const prefix = mf.negation === 'none' ? '¡Sí, ' : 'No, ';
        lines.push({
          speaker: 'B',
          speakerName: speakerBName,
          target: `${prefix}${bVerbSpoken}${bTail}!`,
          english: `${mf.negation === 'none' ? 'Yes' : 'No'}, ${bEnglishClause}!`,
          audioTip: `Forma clave: « ${bConj.verbForm} » (${mf.infinitive} — ${mf.tenseName})`,
        });
      }
    });

    return lines;
  }

  // 4. Standard procedural dialogue for baseline, pass_2_consolidation, or Encore Remix
  const offset =
    (variant === 'pass_2_consolidation' ? 2 : 0) + encoreIndex * 2;
  const verbsToUse =
    variant === 'pass_2_consolidation' && pool.cumulativeVerbIds.length > pool.focusVerbIds.length
      ? [...pool.focusVerbIds, ...pool.reviewVerbIds.slice(-2)].slice(0, 5)
      : pool.focusVerbIds.slice(0, 4);
  const tensesToUse = pool.focusTenseIds;

  for (let i = 0; i < Math.max(3, Math.min(4, verbsToUse.length)); i++) {
    const verbId =
      verbsToUse[(i + offset) % verbsToUse.length] ?? pack.verbs[0].id;
    const tenseId =
      tensesToUse[(i + offset) % tensesToUse.length] ?? pack.tenses[0].id;
    const verb = pack.verbs.find((v) => v.id === verbId) ?? pack.verbs[0];
    const tense = pack.tenses.find((t) => t.id === tenseId) ?? pack.tenses[0];
    const validPersons = getActiveValidPersons(
      tense.validPersons,
      pool.language,
      includeVosotros
    );

    const qPerson = validPersons[(i + 1 + offset) % validPersons.length];
    const aPerson = getReciprocalPerson(
      qPerson,
      pool.language,
      includeVosotros
    );
    const useNeg =
      (i + encoreIndex) % 2 === 1 &&
      (variant === 'pass_2_consolidation' || encoreIndex > 0);
    const aNegation: NegationType = useNeg ? 'pas' : 'none';

    const chunk = pickChunkForVerb(verb.id, pool, i + offset, aPerson);
    const qInflected = inflectChunkTarget(chunk, pool.language, qPerson, 'm');
    const aInflected = inflectChunkTarget(chunk, pool.language, aPerson, 'f');
    const qTail = qInflected ? ` ${qInflected}` : '';
    const aTail = aInflected ? ` ${aInflected}` : '';

    const qConj = pack.conjugate(verb.id, tense.id, qPerson, 'none');
    const aConj = pack.conjugate(verb.id, tense.id, aPerson, aNegation);

    const qEnglishClause = buildNaturalEnglishClause({
      language: pool.language,
      verb,
      tenseId: tense.id,
      person: qPerson,
      negation: 'none',
      chunk,
      isQuestion: true,
      includeVosotros,
    });
    const aEnglishClause = buildNaturalEnglishClause({
      language: pool.language,
      verb,
      tenseId: tense.id,
      person: aPerson,
      negation: aNegation,
      chunk,
      isQuestion: false,
      includeVosotros,
    });

    if (pool.language === 'fr') {
      const opener = FRENCH_OPENERS[(i + offset) % FRENCH_OPENERS.length];
      lines.push({
        speaker: 'A',
        speakerName: speakerAName,
        target: `${opener} ${qConj.fullForm}${qTail} ?`,
        english: `${capitalizeSentence(qEnglishClause)}?`,
      });
      lines.push({
        speaker: 'B',
        speakerName: speakerBName,
        target: `${useNeg ? 'Non' : 'Oui'}, ${aConj.fullForm}${aTail}.`,
        english: `${useNeg ? 'No' : 'Yes'}, ${aEnglishClause}.`,
      });
    } else {
      const opener = SPANISH_OPENERS[(i + offset) % SPANISH_OPENERS.length];
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
        target: `${opener} ¿${qVerbSpoken}${qTail}?`,
        english: `${capitalizeSentence(qEnglishClause)}?`,
      });
      lines.push({
        speaker: 'B',
        speakerName: speakerBName,
        target: `${useNeg ? 'No,' : 'Sí,'} ${aVerbSpoken}${aTail}.`,
        english: `${useNeg ? 'No' : 'Yes'}, ${aEnglishClause}.`,
      });
    }
  }

  return lines;
}

function buildWarmupPrompts(
  pool: ResolvedSubModulePool,
  missedForms: MissedVerbFormItem[],
  missedChunks: LexicalChunk[],
  includeVosotros = false
): CompanionWarmupPrompt[] {
  const pack = getLanguagePack(pool.language);
  const prompts: CompanionWarmupPrompt[] = [];

  if (missedForms.length > 0) {
    for (const mf of missedForms.slice(0, 3)) {
      const verb =
        pack.verbs.find((v) => v.id === mf.verbId) ?? pack.verbs[0];
      const tense =
        pack.tenses.find((t) => t.id === mf.tenseId) ?? pack.tenses[0];
      const chunk =
        missedChunks[0] ?? pickChunkForVerb(mf.verbId, pool, 0, mf.person);
      const inflected = inflectChunkTarget(chunk, pool.language, mf.person, 'm');
      const tail = inflected ? ` ${inflected}` : '';
      const naturalEng = buildNaturalEnglishClause({
        language: pool.language,
        verb,
        tenseId: tense.id,
        person: mf.person,
        negation: mf.negation,
        chunk,
        isQuestion: false,
        includeVosotros,
      });

      prompts.push({
        cueEnglish: `${tense.rassiasTriggerEnglish} ${capitalizeSentence(naturalEng)} (${mf.pronounDisplay})`,
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
  const validPersons = getActiveValidPersons(
    tense.validPersons,
    pool.language,
    includeVosotros
  );

  for (let i = 0; i < 3; i++) {
    const verbId =
      pool.focusVerbIds[i % pool.focusVerbIds.length] ?? pack.verbs[0].id;
    const verb = pack.verbs.find((v) => v.id === verbId) ?? pack.verbs[0];
    const person = validPersons[i % validPersons.length];
    const negation: NegationType = i === 2 ? 'pas' : 'none';
    const conj = pack.conjugate(verb.id, tense.id, person, negation);
    const chunk = pickChunkForVerb(verb.id, pool, i, person);
    const inflected = inflectChunkTarget(chunk, pool.language, person, 'm');
    const tail = inflected ? ` ${inflected}` : '';
    const naturalEng = buildNaturalEnglishClause({
      language: pool.language,
      verb,
      tenseId: tense.id,
      person,
      negation,
      chunk,
      isQuestion: false,
      includeVosotros,
    });

    prompts.push({
      cueEnglish: `${tense.rassiasTriggerEnglish} ${capitalizeSentence(naturalEng)} (${pack.pronouns[person].display})`,
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
  includeVosotros?: boolean;
}): CompanionLesson {
  const {
    pool,
    variant = 'baseline',
    encoreIndex = 0,
    missedForms = [],
    missedChunks = [],
    includeVosotros = false,
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
        : 'Escena A — Introducción y Patrón sonoro (Passe 1/2)';
  }

  const hasBuiltinStarter =
    encoreIndex === 0 &&
    ((variant === 'baseline' && Boolean(pool.subModule.starterDialogue?.length)) ||
      (variant === 'pass_2_consolidation' &&
        Boolean(pool.subModule.consolidationDialogue?.length)));

  const dialogue = generateProceduralDialogue(
    pool,
    variant,
    encoreIndex,
    missedForms,
    missedChunks,
    includeVosotros
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
    conjugationParadigms: buildConjugationParadigms(pool, includeVosotros),
    diagnosticNotes,
    chunkCards: buildChunkCards(pool, includeVosotros),
    warmupPrompts: buildWarmupPrompts(
      pool,
      missedForms,
      missedChunks,
      includeVosotros
    ),
    drillPrescription: buildDrillPrescription(pool),
    spotlightMissedForms: missedForms.length > 0 ? missedForms : undefined,
    spotlightMissedChunks: missedChunks.length > 0 ? missedChunks : undefined,
  };
}
