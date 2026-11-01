import {
  ConjugationResult,
  LanguagePack,
  NegationType,
  PersonIndex,
} from '../types';
import { FRENCH_CURRICULUM } from './curriculum';
import { FRENCH_ROADMAP } from './roadmap';
import { FRENCH_PRONOUNS, FRENCH_TENSES } from './tenses';

type SixForms = [string, string, string, string, string, string];

interface FrenchVerbOverride {
  present?: SixForms;
  imparfaitStem?: string;
  imparfaitFull?: SixForms;
  futurStem?: string;
  subjPresent?: SixForms;
  imperatif?: { 1: string; 3: string; 4: string };
  pastParticiple?: string;
  usesEtre?: boolean;
}

const ETRE_VERBS = new Set([
  'aller',
  'venir',
  'sortir',
  'partir',
  'entrer',
  'arriver',
  'naitre',
  'mourir',
  'rester',
  'tomber',
  'monter',
  'descendre',
  'retourner',
  'devenir',
  'revenir',
]);

const OVERRIDES: Record<string, FrenchVerbOverride> = {
  etre: {
    present: ['suis', 'es', 'est', 'sommes', 'êtes', 'sont'],
    imparfaitStem: 'ét',
    futurStem: 'ser',
    subjPresent: ['sois', 'sois', 'soit', 'soyons', 'soyez', 'soient'],
    imperatif: { 1: 'sois', 3: 'soyons', 4: 'soyez' },
    pastParticiple: 'été',
  },
  avoir: {
    present: ['ai', 'as', 'a', 'avons', 'avez', 'ont'],
    imparfaitStem: 'av',
    futurStem: 'aur',
    subjPresent: ['aie', 'aies', 'ait', 'ayons', 'ayez', 'aient'],
    imperatif: { 1: 'aie', 3: 'ayons', 4: 'ayez' },
    pastParticiple: 'eu',
  },
  aller: {
    present: ['vais', 'vas', 'va', 'allons', 'allez', 'vont'],
    imparfaitStem: 'all',
    futurStem: 'ir',
    subjPresent: ['aille', 'ailles', 'aille', 'allions', 'alliez', 'aillent'],
    imperatif: { 1: 'va', 3: 'allons', 4: 'allez' },
    pastParticiple: 'allé',
    usesEtre: true,
  },
  faire: {
    present: ['fais', 'fais', 'fait', 'faisons', 'faites', 'font'],
    imparfaitStem: 'fais',
    futurStem: 'fer',
    subjPresent: ['fasse', 'fasses', 'fasse', 'fassions', 'fassiez', 'fassent'],
    imperatif: { 1: 'fais', 3: 'faisons', 4: 'faites' },
    pastParticiple: 'fait',
  },
  pouvoir: {
    present: ['peux', 'peux', 'peut', 'pouvons', 'pouvez', 'peuvent'],
    imparfaitStem: 'pouv',
    futurStem: 'pourr',
    subjPresent: ['puisse', 'puisses', 'puisse', 'puissions', 'puissiez', 'puissent'],
    imperatif: { 1: 'peux', 3: 'pouvons', 4: 'pouvez' },
    pastParticiple: 'pu',
  },
  vouloir: {
    present: ['veux', 'veux', 'veut', 'voulons', 'voulez', 'veulent'],
    imparfaitStem: 'voul',
    futurStem: 'voudr',
    subjPresent: ['veuille', 'veuilles', 'veuille', 'voulions', 'vouliez', 'veuillent'],
    imperatif: { 1: 'veuille', 3: 'voulons', 4: 'veuillez' },
    pastParticiple: 'voulu',
  },
  devoir: {
    present: ['dois', 'dois', 'doit', 'devons', 'devez', 'doivent'],
    imparfaitStem: 'dev',
    futurStem: 'devr',
    subjPresent: ['doive', 'doives', 'doive', 'devions', 'deviez', 'doivent'],
    pastParticiple: 'dû',
  },
  savoir: {
    present: ['sais', 'sais', 'sait', 'savons', 'savez', 'savent'],
    imparfaitStem: 'sav',
    futurStem: 'saur',
    subjPresent: ['sache', 'saches', 'sache', 'sachions', 'sachiez', 'sachent'],
    imperatif: { 1: 'sache', 3: 'sachons', 4: 'sachez' },
    pastParticiple: 'su',
  },
  venir: {
    present: ['viens', 'viens', 'vient', 'venons', 'venez', 'viennent'],
    imparfaitStem: 'ven',
    futurStem: 'viendr',
    subjPresent: ['vienne', 'viennes', 'vienne', 'venions', 'veniez', 'viennent'],
    imperatif: { 1: 'viens', 3: 'venons', 4: 'venez' },
    pastParticiple: 'venu',
    usesEtre: true,
  },
  tenir: {
    present: ['tiens', 'tiens', 'tient', 'tenons', 'tenez', 'tiennent'],
    imparfaitStem: 'ten',
    futurStem: 'tiendr',
    subjPresent: ['tienne', 'tiennes', 'tienne', 'tenions', 'teniez', 'tiennent'],
    imperatif: { 1: 'tiens', 3: 'tenons', 4: 'tenez' },
    pastParticiple: 'tenu',
  },
  prendre: {
    present: ['prends', 'prends', 'prend', 'prenons', 'prenez', 'prennent'],
    imparfaitStem: 'pren',
    futurStem: 'prendr',
    subjPresent: ['prenne', 'prennes', 'prenne', 'prenions', 'preniez', 'prennent'],
    imperatif: { 1: 'prends', 3: 'prenons', 4: 'prenez' },
    pastParticiple: 'pris',
  },
  comprendre: {
    present: ['comprends', 'comprends', 'comprend', 'comprenons', 'comprenez', 'comprennent'],
    imparfaitStem: 'compren',
    futurStem: 'comprendr',
    subjPresent: ['comprenne', 'comprennes', 'comprenne', 'comprenions', 'compreniez', 'comprennent'],
    imperatif: { 1: 'comprends', 3: 'comprenons', 4: 'comprenez' },
    pastParticiple: 'compris',
  },
  apprendre: {
    present: ['apprends', 'apprends', 'apprend', 'apprenons', 'apprenez', 'apprennent'],
    imparfaitStem: 'appren',
    futurStem: 'apprendr',
    subjPresent: ['apprenne', 'apprennes', 'apprenne', 'apprenions', 'appreniez', 'apprennent'],
    imperatif: { 1: 'apprends', 3: 'apprenons', 4: 'apprenez' },
    pastParticiple: 'appris',
  },
  voir: {
    present: ['vois', 'vois', 'voit', 'voyons', 'voyez', 'voient'],
    imparfaitStem: 'voy',
    futurStem: 'verr',
    subjPresent: ['voie', 'voies', 'voie', 'voyions', 'voyiez', 'voient'],
    imperatif: { 1: 'vois', 3: 'voyons', 4: 'voyez' },
    pastParticiple: 'vu',
  },
  dire: {
    present: ['dis', 'dis', 'dit', 'disons', 'dites', 'disent'],
    imparfaitStem: 'dis',
    futurStem: 'dir',
    subjPresent: ['dise', 'dises', 'dise', 'disions', 'disiez', 'disent'],
    imperatif: { 1: 'dis', 3: 'disons', 4: 'dites' },
    pastParticiple: 'dit',
  },
  mettre: {
    present: ['mets', 'mets', 'met', 'mettons', 'mettez', 'mettent'],
    imparfaitStem: 'mett',
    futurStem: 'mettr',
    subjPresent: ['mette', 'mettes', 'mette', 'mettions', 'mettiez', 'mettent'],
    imperatif: { 1: 'mets', 3: 'mettons', 4: 'mettez' },
    pastParticiple: 'mis',
  },
  sortir: {
    present: ['sors', 'sors', 'sort', 'sortons', 'sortez', 'sortent'],
    imparfaitStem: 'sort',
    futurStem: 'sortir',
    subjPresent: ['sorte', 'sortes', 'sorte', 'sortions', 'sortiez', 'sortent'],
    imperatif: { 1: 'sors', 3: 'sortons', 4: 'sortez' },
    pastParticiple: 'sorti',
    usesEtre: true,
  },
  partir: {
    present: ['pars', 'pars', 'part', 'partons', 'partez', 'partent'],
    imparfaitStem: 'part',
    futurStem: 'partir',
    subjPresent: ['parte', 'partes', 'parte', 'partions', 'partiez', 'partent'],
    imperatif: { 1: 'pars', 3: 'partons', 4: 'partez' },
    pastParticiple: 'parti',
    usesEtre: true,
  },
  dormir: {
    present: ['dors', 'dors', 'dort', 'dormons', 'dormez', 'dorment'],
    imparfaitStem: 'dorm',
    futurStem: 'dormir',
    subjPresent: ['dorme', 'dormes', 'dorme', 'dormions', 'dormiez', 'dorment'],
    imperatif: { 1: 'dors', 3: 'dormons', 4: 'dormez' },
    pastParticiple: 'dormi',
  },
  ouvrir: {
    present: ['ouvre', 'ouvres', 'ouvre', 'ouvrons', 'ouvrez', 'ouvrent'],
    imparfaitStem: 'ouvr',
    futurStem: 'ouvrir',
    subjPresent: ['ouvre', 'ouvres', 'ouvre', 'ouvrions', 'ouvriez', 'ouvrent'],
    imperatif: { 1: 'ouvre', 3: 'ouvrons', 4: 'ouvrez' },
    pastParticiple: 'ouvert',
  },
  acheter: {
    present: ['achète', 'achètes', 'achète', 'achetons', 'achetez', 'achètent'],
    imparfaitStem: 'achet',
    futurStem: 'achèter',
    subjPresent: ['achète', 'achètes', 'achète', 'achetions', 'achetiez', 'achètent'],
    imperatif: { 1: 'achète', 3: 'achetons', 4: 'achetez' },
    pastParticiple: 'acheté',
  },
  appeler: {
    present: ['appelle', 'appelles', 'appelle', 'appelons', 'appelez', 'appellent'],
    imparfaitStem: 'appel',
    futurStem: 'appeller',
    subjPresent: ['appelle', 'appelles', 'appelle', 'appelions', 'appeliez', 'appellent'],
    imperatif: { 1: 'appelle', 3: 'appelons', 4: 'appelez' },
    pastParticiple: 'appelé',
  },
  jeter: {
    present: ['jette', 'jettes', 'jette', 'jetons', 'jetez', 'jettent'],
    imparfaitStem: 'jet',
    futurStem: 'jetter',
    subjPresent: ['jette', 'jettes', 'jette', 'jetions', 'jetiez', 'jettent'],
    imperatif: { 1: 'jette', 3: 'jetons', 4: 'jetez' },
    pastParticiple: 'jeté',
  },
  payer: {
    present: ['paie', 'paies', 'paie', 'payons', 'payez', 'paient'],
    imparfaitStem: 'pay',
    futurStem: 'paier',
    subjPresent: ['paie', 'paies', 'paie', 'payions', 'payiez', 'paient'],
    imperatif: { 1: 'paie', 3: 'payons', 4: 'payez' },
    pastParticiple: 'payé',
  },
  envoyer: {
    present: ['envoie', 'envoies', 'envoie', 'envoyons', 'envoyez', 'envoient'],
    imparfaitStem: 'envoy',
    futurStem: 'enverr',
    subjPresent: ['envoie', 'envoies', 'envoie', 'envoyions', 'envoyiez', 'envoient'],
    imperatif: { 1: 'envoie', 3: 'envoyons', 4: 'envoyez' },
    pastParticiple: 'envoyé',
  },
  boire: {
    present: ['bois', 'bois', 'boit', 'buvons', 'buvez', 'boivent'],
    imparfaitStem: 'buv',
    futurStem: 'boir',
    subjPresent: ['boive', 'boives', 'boive', 'buvions', 'buviez', 'boivent'],
    imperatif: { 1: 'bois', 3: 'buvons', 4: 'buvez' },
    pastParticiple: 'bu',
  },
  croire: {
    present: ['crois', 'crois', 'croit', 'croyons', 'croyez', 'croient'],
    imparfaitStem: 'croy',
    futurStem: 'croir',
    subjPresent: ['croie', 'croies', 'croie', 'croyions', 'croyiez', 'croient'],
    imperatif: { 1: 'crois', 3: 'croyons', 4: 'croyez' },
    pastParticiple: 'cru',
  },
  connaitre: {
    present: ['connais', 'connais', 'connaît', 'connaissons', 'connaissez', 'connaissent'],
    imparfaitStem: 'connaiss',
    futurStem: 'connaîtr',
    subjPresent: ['connaisse', 'connaisses', 'connaisse', 'connaissions', 'connaissiez', 'connaissent'],
    imperatif: { 1: 'connais', 3: 'connaissons', 4: 'connaissez' },
    pastParticiple: 'connu',
  },
  lire: {
    present: ['lis', 'lis', 'lit', 'lisons', 'lisez', 'lisent'],
    imparfaitStem: 'lis',
    futurStem: 'lir',
    subjPresent: ['lise', 'lises', 'lise', 'lisions', 'lisiez', 'lisent'],
    imperatif: { 1: 'lis', 3: 'lisons', 4: 'lisez' },
    pastParticiple: 'lu',
  },
  ecrire: {
    present: ['écris', 'écris', 'écrit', 'écrivons', 'écrivez', 'écrivent'],
    imparfaitStem: 'écriv',
    futurStem: 'écrir',
    subjPresent: ['écrive', 'écrives', 'écrive', 'écrivions', 'écriviez', 'écrivent'],
    imperatif: { 1: 'écris', 3: 'écrivons', 4: 'écrivez' },
    pastParticiple: 'écrit',
  },
  recevoir: {
    present: ['reçois', 'reçois', 'reçoit', 'recevons', 'recevez', 'reçoivent'],
    imparfaitStem: 'recev',
    futurStem: 'recevr',
    subjPresent: ['reçoive', 'reçoives', 'reçoive', 'recevions', 'receviez', 'reçoivent'],
    imperatif: { 1: 'reçois', 3: 'recevons', 4: 'recevez' },
    pastParticiple: 'reçu',
  },
  vivre: {
    present: ['vis', 'vis', 'vit', 'vivons', 'vivez', 'vivent'],
    imparfaitStem: 'viv',
    futurStem: 'vivr',
    subjPresent: ['vive', 'vives', 'vive', 'vivions', 'viviez', 'vivent'],
    imperatif: { 1: 'vis', 3: 'vivons', 4: 'vivez' },
    pastParticiple: 'vécu',
  },
  suivre: {
    present: ['suis', 'suis', 'suit', 'suivons', 'suivez', 'suivent'],
    imparfaitStem: 'suiv',
    futurStem: 'suivr',
    subjPresent: ['suive', 'suives', 'suive', 'suivions', 'suiviez', 'suivent'],
    imperatif: { 1: 'suis', 3: 'suivons', 4: 'suivez' },
    pastParticiple: 'suivi',
  },
  courir: {
    present: ['cours', 'cours', 'court', 'courons', 'courez', 'courent'],
    imparfaitStem: 'cour',
    futurStem: 'courr',
    subjPresent: ['coure', 'coures', 'coure', 'courions', 'couriez', 'courent'],
    imperatif: { 1: 'cours', 3: 'courons', 4: 'courez' },
    pastParticiple: 'couru',
  },
};

export function startsWithFrenchVowelOrMuteH(word: string): boolean {
  const normalized = word
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return /^[aeiouyh]/.test(normalized);
}

function getPastParticiple(verbId: string, infinitive: string): string {
  const ov = OVERRIDES[verbId];
  if (ov?.pastParticiple) return ov.pastParticiple;
  if (infinitive.endsWith('er')) return infinitive.slice(0, -2) + 'é';
  if (infinitive.endsWith('ir')) return infinitive.slice(0, -2) + 'i';
  if (infinitive.endsWith('re')) return infinitive.slice(0, -2) + 'u';
  return infinitive;
}

function usesEtreAuxiliary(verbId: string): boolean {
  return Boolean(OVERRIDES[verbId]?.usesEtre || ETRE_VERBS.has(verbId));
}

function applyStemOrthography(stem: string, endingStartsWithAorO: boolean): string {
  if (!endingStartsWithAorO) return stem;
  if (stem.endsWith('g')) return stem + 'e';
  if (stem.endsWith('c')) return stem.slice(0, -1) + 'ç';
  return stem;
}

function getPresentForms(verbId: string, infinitive: string): SixForms {
  const ov = OVERRIDES[verbId];
  if (ov?.present) return ov.present;

  if (infinitive.endsWith('er')) {
    const stem = infinitive.slice(0, -2);
    return [
      `${stem}e`,
      `${stem}es`,
      `${stem}e`,
      `${applyStemOrthography(stem, true)}ons`,
      `${stem}ez`,
      `${stem}ent`,
    ];
  }

  if (infinitive.endsWith('ir')) {
    const stem = infinitive.slice(0, -2);
    return [
      `${stem}is`,
      `${stem}is`,
      `${stem}it`,
      `${stem}issons`,
      `${stem}issez`,
      `${stem}issent`,
    ];
  }

  if (infinitive.endsWith('re')) {
    const stem = infinitive.slice(0, -2);
    const thirdSingular = stem.endsWith('d') || stem.endsWith('t') ? stem : `${stem}t`;
    return [
      `${stem}s`,
      `${stem}s`,
      thirdSingular,
      `${stem}ons`,
      `${stem}ez`,
      `${stem}ent`,
    ];
  }

  throw new Error(`Unsupported French verb infinitive: ${infinitive}`);
}

function getImparfaitForms(verbId: string, infinitive: string): SixForms {
  const ov = OVERRIDES[verbId];
  if (ov?.imparfaitFull) return ov.imparfaitFull;

  let stem = ov?.imparfaitStem;
  if (!stem) {
    const nousPresent = getPresentForms(verbId, infinitive)[3];
    stem = nousPresent.slice(0, -3);
    if (infinitive.endsWith('ger') && stem.endsWith('ge')) {
      stem = stem.slice(0, -1);
    } else if (infinitive.endsWith('cer') && stem.endsWith('ç')) {
      stem = stem.slice(0, -1) + 'c';
    }
  }

  const endings: [string, boolean][] = [
    ['ais', true],
    ['ais', true],
    ['ait', true],
    ['ions', false],
    ['iez', false],
    ['aient', true],
  ];

  return endings.map(([ending, isAorO]) => `${applyStemOrthography(stem!, isAorO)}${ending}`) as SixForms;
}

function getFuturStem(verbId: string, infinitive: string): string {
  const ov = OVERRIDES[verbId];
  if (ov?.futurStem) return ov.futurStem;
  if (infinitive.endsWith('re')) return infinitive.slice(0, -1);
  return infinitive;
}

function getFuturSimpleForms(verbId: string, infinitive: string): SixForms {
  const stem = getFuturStem(verbId, infinitive);
  const endings = ['ai', 'as', 'a', 'ons', 'ez', 'ont'];
  return endings.map((e) => `${stem}${e}`) as SixForms;
}

function getConditionnelPresentForms(verbId: string, infinitive: string): SixForms {
  const stem = getFuturStem(verbId, infinitive);
  const endings = ['ais', 'ais', 'ait', 'ions', 'iez', 'aient'];
  return endings.map((e) => `${stem}${e}`) as SixForms;
}

function getSubjonctifPresentForms(verbId: string, infinitive: string): SixForms {
  const ov = OVERRIDES[verbId];
  if (ov?.subjPresent) return ov.subjPresent;

  const present = getPresentForms(verbId, infinitive);
  const ilsStem = present[5].slice(0, -3);
  const nousImparfait = getImparfaitForms(verbId, infinitive)[3];
  const vousImparfait = getImparfaitForms(verbId, infinitive)[4];

  return [
    `${ilsStem}e`,
    `${ilsStem}es`,
    `${ilsStem}e`,
    nousImparfait,
    vousImparfait,
    `${ilsStem}ent`,
  ];
}

function getImperatifForm(verbId: string, infinitive: string, person: PersonIndex): string {
  const ov = OVERRIDES[verbId];
  if (ov?.imperatif && (person === 1 || person === 3 || person === 4)) {
    return ov.imperatif[person];
  }
  const present = getPresentForms(verbId, infinitive);
  if (person === 1) {
    const tuForm = present[1];
    if ((infinitive.endsWith('er') || verbId === 'ouvrir') && tuForm.endsWith('es')) {
      return tuForm.slice(0, -1);
    }
    return tuForm;
  }
  return present[person];
}

function buildCompoundForms(
  verbId: string,
  infinitive: string,
  auxTenseId: 'present' | 'imparfait' | 'futur_simple' | 'conditionnel_present' | 'subjonctif_present'
): SixForms {
  const isEtre = usesEtreAuxiliary(verbId);
  const auxVerbId = isEtre ? 'etre' : 'avoir';
  const auxInfinitive = isEtre ? 'être' : 'avoir';

  let auxForms: SixForms;
  switch (auxTenseId) {
    case 'present':
      auxForms = getPresentForms(auxVerbId, auxInfinitive);
      break;
    case 'imparfait':
      auxForms = getImparfaitForms(auxVerbId, auxInfinitive);
      break;
    case 'futur_simple':
      auxForms = getFuturSimpleForms(auxVerbId, auxInfinitive);
      break;
    case 'conditionnel_present':
      auxForms = getConditionnelPresentForms(auxVerbId, auxInfinitive);
      break;
    case 'subjonctif_present':
      auxForms = getSubjonctifPresentForms(auxVerbId, auxInfinitive);
      break;
  }

  const baseParticiple = getPastParticiple(verbId, infinitive);
  return auxForms.map((aux, idx) => {
    const participle =
      isEtre && (idx === 3 || idx === 5) && !baseParticiple.endsWith('s')
        ? `${baseParticiple}s`
        : baseParticiple;
    return `${aux} ${participle}`;
  }) as SixForms;
}

/**
 * Wraps a French verb form (simple or compound) in `ne / n' ... pas / jamais / plus`.
 * For compound tenses and futur proche ("ai parlé", "suis allé", "vais parler"),
 * wraps ONLY the first word (the auxiliary) so "ai parlé" -> "n'ai pas parlé".
 */
export function negateFrenchVerbPhrase(
  affirmativeVerbForm: string,
  negation: Exclude<NegationType, 'none'>,
  includeNe = true
): string {
  const parts = affirmativeVerbForm.trim().split(/\s+/);
  const firstWord = parts[0];
  const rest = parts.slice(1).join(' ');

  const nePrefix = includeNe
    ? startsWithFrenchVowelOrMuteH(firstWord)
      ? "n'"
      : 'ne '
    : '';

  if (rest) {
    return `${nePrefix}${firstWord} ${negation} ${rest}`;
  }
  return `${nePrefix}${firstWord} ${negation}`;
}

function formatSubjectAndVerb(pronoun: string, verbForm: string): string {
  if (pronoun === 'je' && startsWithFrenchVowelOrMuteH(verbForm)) {
    return `j'${verbForm}`;
  }
  return `${pronoun} ${verbForm}`;
}

function formatTriggeredPhrase(
  trigger: string,
  usesSubjunctiveCue: boolean | undefined,
  isImperative: boolean | undefined,
  fullForm: string,
  verbForm: string
): string {
  if (isImperative) {
    const capVerb = verbForm.charAt(0).toUpperCase() + verbForm.slice(1);
    return `${trigger} ${capVerb} !`;
  }
  if (usesSubjunctiveCue) {
    if (startsWithFrenchVowelOrMuteH(fullForm)) {
      const baseTrigger = trigger.endsWith(' que') ? trigger.slice(0, -4) : trigger;
      return `${baseTrigger} qu'${fullForm}`;
    }
    return `${trigger} ${fullForm}`;
  }
  return `${trigger} ${fullForm}`;
}

export function conjugateFrench(
  verbId: string,
  tenseId: string,
  person: PersonIndex,
  negation: NegationType = 'none'
): ConjugationResult {
  const verb = FRENCH_CURRICULUM.find((v) => v.id === verbId);
  if (!verb) {
    throw new Error(`Unknown French verbId: ${verbId}`);
  }
  const tense = FRENCH_TENSES.find((t) => t.id === tenseId);
  if (!tense) {
    throw new Error(`Unknown French tenseId: ${tenseId}`);
  }

  const pronounDef = FRENCH_PRONOUNS[person];
  let affirmativeVerbForm: string;

  switch (tenseId) {
    case 'present':
      affirmativeVerbForm = getPresentForms(verbId, verb.infinitive)[person];
      break;
    case 'imparfait':
      affirmativeVerbForm = getImparfaitForms(verbId, verb.infinitive)[person];
      break;
    case 'futur_simple':
      affirmativeVerbForm = getFuturSimpleForms(verbId, verb.infinitive)[person];
      break;
    case 'conditionnel_present':
      affirmativeVerbForm = getConditionnelPresentForms(verbId, verb.infinitive)[person];
      break;
    case 'subjonctif_present':
      affirmativeVerbForm = getSubjonctifPresentForms(verbId, verb.infinitive)[person];
      break;
    case 'passe_compose':
      affirmativeVerbForm = buildCompoundForms(verbId, verb.infinitive, 'present')[person];
      break;
    case 'plus_que_parfait':
      affirmativeVerbForm = buildCompoundForms(verbId, verb.infinitive, 'imparfait')[person];
      break;
    case 'futur_anterieur':
      affirmativeVerbForm = buildCompoundForms(verbId, verb.infinitive, 'futur_simple')[person];
      break;
    case 'conditionnel_passe':
      affirmativeVerbForm = buildCompoundForms(verbId, verb.infinitive, 'conditionnel_present')[person];
      break;
    case 'subjonctif_passe':
      affirmativeVerbForm = buildCompoundForms(verbId, verb.infinitive, 'subjonctif_present')[person];
      break;
    case 'futur_proche': {
      const allerPresent = getPresentForms('aller', 'aller')[person];
      affirmativeVerbForm = `${allerPresent} ${verb.infinitive}`;
      break;
    }
    case 'imperatif':
      affirmativeVerbForm = getImperatifForm(verbId, verb.infinitive, person);
      break;
    default:
      throw new Error(`Unhandled French tense: ${tenseId}`);
  }

  const verbForm =
    negation === 'none'
      ? affirmativeVerbForm
      : negateFrenchVerbPhrase(affirmativeVerbForm, negation, true);

  const colloquialNegVerbForm =
    negation === 'none'
      ? null
      : negateFrenchVerbPhrase(affirmativeVerbForm, negation, false);

  // Note: when negated, verbForm starts with "ne " or "n'", which is a consonant ('n'),
  // so formatSubjectAndVerb('je', "n'aime pas") automatically produces "je n'aime pas"!
  const fullForm = tense.isImperative
    ? verbForm
    : formatSubjectAndVerb(pronounDef.spokenPrimary, verbForm);

  const triggeredPhrase = formatTriggeredPhrase(
    tense.rassiasTrigger,
    tense.usesSubjunctiveCue,
    tense.isImperative,
    fullForm,
    verbForm
  );

  const acceptedSet = new Set<string>();
  if (tense.isImperative) {
    acceptedSet.add(verbForm);
    if (colloquialNegVerbForm) {
      acceptedSet.add(colloquialNegVerbForm);
    }
  } else {
    for (const p of pronounDef.acceptedVariants) {
      if (p === "j'") continue;
      const standardFull = formatSubjectAndVerb(p, verbForm);
      acceptedSet.add(standardFull);
      if (tense.usesSubjunctiveCue) {
        acceptedSet.add(
          startsWithFrenchVowelOrMuteH(standardFull) ? `qu'${standardFull}` : `que ${standardFull}`
        );
      }
      if (colloquialNegVerbForm) {
        const colloquialFull = formatSubjectAndVerb(p, colloquialNegVerbForm);
        acceptedSet.add(colloquialFull);
      }
    }
  }

  return {
    language: 'fr',
    verbId,
    infinitive: verb.infinitive,
    tenseId,
    person,
    negation,
    verbForm,
    fullForm,
    triggeredPhrase,
    acceptedForms: Array.from(acceptedSet),
  };
}

export const FRENCH_LANGUAGE_PACK: LanguagePack = {
  code: 'fr',
  name: 'French',
  nativeName: 'Français',
  defaultLocale: 'fr-FR',
  availableLocales: [
    { code: 'fr-FR', label: 'Français (France)' },
    { code: 'fr-CA', label: 'Français (Canada)' },
  ],
  pronouns: FRENCH_PRONOUNS,
  tenses: FRENCH_TENSES,
  verbs: FRENCH_CURRICULUM,
  roadmap: FRENCH_ROADMAP,
  isProDrop: false,
  conjugate: conjugateFrench,
  conjugateAllPersons: (
    verbId: string,
    tenseId: string,
    negation: NegationType = 'none'
  ) => {
    const tense = FRENCH_TENSES.find((t) => t.id === tenseId);
    const persons: PersonIndex[] = tense?.validPersons ?? [0, 1, 2, 3, 4, 5];
    return persons.map((p) => conjugateFrench(verbId, tenseId, p, negation));
  },
};
