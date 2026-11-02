import {
  ConjugationResult,
  LanguagePack,
  NegationType,
  PersonIndex,
} from '../types';
import { SPANISH_CURRICULUM } from './curriculum';
import { SPANISH_ROADMAP } from './roadmap';
import { SPANISH_PRONOUNS, SPANISH_TENSES } from './tenses';

type SixForms = [string, string, string, string, string, string];

interface SpanishVerbOverride {
  presente?: SixForms;
  indefinido?: SixForms;
  imperfecto?: SixForms;
  futuroStem?: string;
  subjPresente?: SixForms;
  imperativoTu?: string;
  pastParticiple?: string;
  bootChange?: ['e', 'ie'] | ['o', 'ue'] | ['e', 'i'];
  irPreteriteVowel?: 'i' | 'u';
}

const HABER_FORMS: Record<
  'presente' | 'imperfecto' | 'futuro' | 'condicional' | 'subj_presente' | 'subj_imperfecto_ra' | 'subj_imperfecto_se',
  SixForms
> = {
  presente: ['he', 'has', 'ha', 'hemos', 'habéis', 'han'],
  imperfecto: ['había', 'habías', 'había', 'habíamos', 'habíais', 'habían'],
  futuro: ['habré', 'habrás', 'habrá', 'habremos', 'habréis', 'habrán'],
  condicional: ['habría', 'habrías', 'habría', 'habríamos', 'habríais', 'habrían'],
  subj_presente: ['haya', 'hayas', 'haya', 'hayamos', 'hayáis', 'hayan'],
  subj_imperfecto_ra: ['hubiera', 'hubieras', 'hubiera', 'hubiéramos', 'hubierais', 'hubieran'],
  subj_imperfecto_se: ['hubiese', 'hubieses', 'hubiese', 'hubiésemos', 'hubieseis', 'hubiesen'],
};

const OVERRIDES: Record<string, SpanishVerbOverride> = {
  ser: {
    presente: ['soy', 'eres', 'es', 'somos', 'sois', 'son'],
    indefinido: ['fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron'],
    imperfecto: ['era', 'eras', 'era', 'éramos', 'erais', 'eran'],
    subjPresente: ['sea', 'seas', 'sea', 'seamos', 'seáis', 'sean'],
    imperativoTu: 'sé',
    pastParticiple: 'sido',
  },
  estar: {
    presente: ['estoy', 'estás', 'está', 'estamos', 'estáis', 'están'],
    indefinido: ['estuve', 'estuviste', 'estuvo', 'estuvimos', 'estuvisteis', 'estuvieron'],
    subjPresente: ['esté', 'estés', 'esté', 'estemos', 'estéis', 'estén'],
    imperativoTu: 'está',
    pastParticiple: 'estado',
  },
  tener: {
    presente: ['tengo', 'tienes', 'tiene', 'tenemos', 'tenéis', 'tienen'],
    indefinido: ['tuve', 'tuviste', 'tuvo', 'tuvimos', 'tuvisteis', 'tuvieron'],
    futuroStem: 'tendr',
    subjPresente: ['tenga', 'tengas', 'tenga', 'tengamos', 'tengáis', 'tengan'],
    imperativoTu: 'ten',
    pastParticiple: 'tenido',
  },
  ir: {
    presente: ['voy', 'vas', 'va', 'vamos', 'vais', 'van'],
    indefinido: ['fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron'],
    imperfecto: ['iba', 'ibas', 'iba', 'íbamos', 'ibais', 'iban'],
    subjPresente: ['vaya', 'vayas', 'vaya', 'vayamos', 'vayáis', 'vayan'],
    imperativoTu: 've',
    pastParticiple: 'ido',
  },
  hacer: {
    presente: ['hago', 'haces', 'hace', 'hacemos', 'hacéis', 'hacen'],
    indefinido: ['hice', 'hiciste', 'hizo', 'hicimos', 'hicisteis', 'hicieron'],
    futuroStem: 'har',
    subjPresente: ['haga', 'hagas', 'haga', 'hagamos', 'hagáis', 'hagan'],
    imperativoTu: 'haz',
    pastParticiple: 'hecho',
  },
  poder: {
    bootChange: ['o', 'ue'],
    indefinido: ['pude', 'pudiste', 'pudo', 'pudimos', 'pudisteis', 'pudieron'],
    futuroStem: 'podr',
    pastParticiple: 'podido',
  },
  querer: {
    bootChange: ['e', 'ie'],
    indefinido: ['quise', 'quisiste', 'quiso', 'quisimos', 'quisisteis', 'quisieron'],
    futuroStem: 'querr',
    pastParticiple: 'querido',
  },
  saber: {
    presente: ['sé', 'sabes', 'sabe', 'sabemos', 'sabéis', 'saben'],
    indefinido: ['supe', 'supiste', 'supo', 'supimos', 'supisteis', 'supieron'],
    futuroStem: 'sabr',
    subjPresente: ['sepa', 'sepas', 'sepa', 'sepamos', 'sepáis', 'sepan'],
    pastParticiple: 'sabido',
  },
  venir: {
    presente: ['vengo', 'vienes', 'viene', 'venimos', 'venís', 'vienen'],
    indefinido: ['vine', 'viniste', 'vino', 'vinimos', 'vinisteis', 'vinieron'],
    futuroStem: 'vendr',
    subjPresente: ['venga', 'vengas', 'venga', 'vengamos', 'vengáis', 'vengan'],
    imperativoTu: 'ven',
    pastParticiple: 'venido',
  },
  poner: {
    presente: ['pongo', 'pones', 'pone', 'ponemos', 'ponéis', 'ponen'],
    indefinido: ['puse', 'pusiste', 'puso', 'pusimos', 'pusisteis', 'pusieron'],
    futuroStem: 'pondr',
    subjPresente: ['ponga', 'pongas', 'ponga', 'pongamos', 'pongáis', 'pongan'],
    imperativoTu: 'pon',
    pastParticiple: 'puesto',
  },
  decir: {
    presente: ['digo', 'dices', 'dice', 'decimos', 'decís', 'dicen'],
    indefinido: ['dije', 'dijiste', 'dijo', 'dijimos', 'dijisteis', 'dijeron'],
    futuroStem: 'dir',
    subjPresente: ['diga', 'digas', 'diga', 'digamos', 'digáis', 'digan'],
    imperativoTu: 'di',
    pastParticiple: 'dicho',
  },
  ver: {
    presente: ['veo', 'ves', 've', 'vemos', 'veis', 'ven'],
    indefinido: ['vi', 'viste', 'vio', 'vimos', 'visteis', 'vieron'],
    imperfecto: ['veía', 'veías', 'veía', 'veíamos', 'veíais', 'veían'],
    subjPresente: ['vea', 'veas', 'vea', 'veamos', 'veáis', 'vean'],
    pastParticiple: 'visto',
  },
  salir: {
    presente: ['salgo', 'sales', 'sale', 'salimos', 'salís', 'salen'],
    futuroStem: 'saldr',
    subjPresente: ['salga', 'salgas', 'salga', 'salgamos', 'salgáis', 'salgan'],
    imperativoTu: 'sal',
    pastParticiple: 'salido',
  },
  dar: {
    presente: ['doy', 'das', 'da', 'damos', 'dais', 'dan'],
    indefinido: ['di', 'diste', 'dio', 'dimos', 'disteis', 'dieron'],
    subjPresente: ['dé', 'des', 'dé', 'demos', 'deis', 'den'],
    pastParticiple: 'dado',
  },
  escribir: {
    pastParticiple: 'escrito',
  },
  abrir: {
    pastParticiple: 'abierto',
  },
  pensar: {
    bootChange: ['e', 'ie'],
  },
  empezar: {
    bootChange: ['e', 'ie'],
  },
  entender: {
    bootChange: ['e', 'ie'],
  },
  volver: {
    bootChange: ['o', 'ue'],
    pastParticiple: 'vuelto',
  },
  encontrar: {
    bootChange: ['o', 'ue'],
  },
  dormir: {
    bootChange: ['o', 'ue'],
    irPreteriteVowel: 'u',
  },
  morir: {
    bootChange: ['o', 'ue'],
    irPreteriteVowel: 'u',
    pastParticiple: 'muerto',
  },
  pedir: {
    bootChange: ['e', 'i'],
    irPreteriteVowel: 'i',
  },
  seguir: {
    presente: ['sigo', 'sigues', 'sigue', 'seguimos', 'seguís', 'siguen'],
    indefinido: ['seguí', 'seguiste', 'siguió', 'seguimos', 'seguisteis', 'siguieron'],
    subjPresente: ['siga', 'sigas', 'siga', 'sigamos', 'sigáis', 'sigan'],
    imperativoTu: 'sigue',
  },
  sentir: {
    bootChange: ['e', 'ie'],
    irPreteriteVowel: 'i',
  },
  conocer: {
    presente: ['conozco', 'conoces', 'conoce', 'conocemos', 'conocéis', 'conocen'],
    subjPresente: ['conozca', 'conozcas', 'conozca', 'conozcamos', 'conozcáis', 'conozcan'],
  },
  traer: {
    presente: ['traigo', 'traes', 'trae', 'traemos', 'traéis', 'traen'],
    indefinido: ['traje', 'trajiste', 'trajo', 'trajimos', 'trajisteis', 'trajeron'],
    subjPresente: ['traiga', 'traigas', 'traiga', 'traigamos', 'traigáis', 'traigan'],
    pastParticiple: 'traído',
  },
  oir: {
    presente: ['oigo', 'oyes', 'oye', 'oímos', 'oís', 'oyen'],
    indefinido: ['oí', 'oíste', 'oyó', 'oímos', 'oísteis', 'oyeron'],
    subjPresente: ['oiga', 'oigas', 'oiga', 'oigamos', 'oigáis', 'oigan'],
    imperativoTu: 'oye',
    pastParticiple: 'oído',
  },
  caer: {
    presente: ['caigo', 'caes', 'cae', 'caemos', 'caéis', 'caen'],
    indefinido: ['caí', 'caíste', 'cayó', 'caímos', 'caísteis', 'cayeron'],
    subjPresente: ['caiga', 'caigas', 'caiga', 'caigamos', 'caigáis', 'caigan'],
    pastParticiple: 'caído',
  },
  creer: {
    indefinido: ['creí', 'creíste', 'creyó', 'creímos', 'creísteis', 'creyeron'],
    pastParticiple: 'creído',
  },
  leer: {
    indefinido: ['leí', 'leíste', 'leyó', 'leímos', 'leísteis', 'leyeron'],
    pastParticiple: 'leído',
  },
  conducir: {
    presente: ['conduzco', 'conduces', 'conduce', 'conducimos', 'conducís', 'conducen'],
    indefinido: ['conduje', 'condujiste', 'condujo', 'condujimos', 'condujisteis', 'condujeron'],
    subjPresente: ['conduzca', 'conduzcas', 'conduzca', 'conduzcamos', 'conduzcáis', 'conduzcan'],
  },
  producir: {
    presente: ['produzco', 'produces', 'produce', 'producimos', 'producís', 'producen'],
    indefinido: ['produje', 'produjiste', 'produjo', 'produjimos', 'produjisteis', 'produjeron'],
    subjPresente: ['produzca', 'produzcas', 'produzca', 'produzcamos', 'produzcáis', 'produzcan'],
  },
};

function replaceLastOccurrence(stem: string, target: string, replacement: string): string {
  const idx = stem.lastIndexOf(target);
  if (idx === -1) return stem;
  return stem.slice(0, idx) + replacement + stem.slice(idx + target.length);
}

function applyPreteriteSubjOrthographyBeforeE(infinitive: string, stem: string): string {
  if (infinitive.endsWith('car') && stem.endsWith('c')) {
    return stem.slice(0, -1) + 'qu';
  }
  if (infinitive.endsWith('gar') && stem.endsWith('g')) {
    return stem + 'u';
  }
  if (infinitive.endsWith('zar') && stem.endsWith('z')) {
    return stem.slice(0, -1) + 'c';
  }
  return stem;
}

function getVerbEndingGroup(infinitive: string): 'ar' | 'er' | 'ir' {
  if (infinitive.endsWith('ar')) return 'ar';
  if (infinitive.endsWith('er')) return 'er';
  if (infinitive.endsWith('ir') || infinitive.endsWith('ír')) return 'ir';
  throw new Error(`Unsupported Spanish infinitive: ${infinitive}`);
}

function getSpanishPastParticiple(verbId: string, infinitive: string): string {
  const ov = OVERRIDES[verbId];
  if (ov?.pastParticiple) return ov.pastParticiple;
  const group = getVerbEndingGroup(infinitive);
  const stem = infinitive.slice(0, -2);
  return group === 'ar' ? `${stem}ado` : `${stem}ido`;
}

function getPresenteForms(verbId: string, infinitive: string): SixForms {
  const ov = OVERRIDES[verbId];
  if (ov?.presente) return ov.presente;

  const group = getVerbEndingGroup(infinitive);
  const baseStem = infinitive.slice(0, -2);
  const bootStem = ov?.bootChange
    ? replaceLastOccurrence(baseStem, ov.bootChange[0], ov.bootChange[1])
    : baseStem;

  const endings: Record<'ar' | 'er' | 'ir', SixForms> = {
    ar: ['o', 'as', 'a', 'amos', 'áis', 'an'],
    er: ['o', 'es', 'e', 'emos', 'éis', 'en'],
    ir: ['o', 'es', 'e', 'imos', 'ís', 'en'],
  };

  const e = endings[group];
  return [
    `${bootStem}${e[0]}`,
    `${bootStem}${e[1]}`,
    `${bootStem}${e[2]}`,
    `${baseStem}${e[3]}`,
    `${baseStem}${e[4]}`,
    `${bootStem}${e[5]}`,
  ];
}

function getIndefinidoForms(verbId: string, infinitive: string): SixForms {
  const ov = OVERRIDES[verbId];
  if (ov?.indefinido) return ov.indefinido;

  const group = getVerbEndingGroup(infinitive);
  const baseStem = infinitive.slice(0, -2);

  if (group === 'ar') {
    const yoStem = applyPreteriteSubjOrthographyBeforeE(infinitive, baseStem);
    return [
      `${yoStem}é`,
      `${baseStem}aste`,
      `${baseStem}ó`,
      `${baseStem}amos`,
      `${baseStem}asteis`,
      `${baseStem}aron`,
    ];
  }

  const thirdStem = ov?.irPreteriteVowel
    ? replaceLastOccurrence(baseStem, ov.irPreteriteVowel === 'i' ? 'e' : 'o', ov.irPreteriteVowel)
    : baseStem;

  return [
    `${baseStem}í`,
    `${baseStem}iste`,
    `${thirdStem}ió`,
    `${baseStem}imos`,
    `${baseStem}isteis`,
    `${thirdStem}ieron`,
  ];
}

function getImperfectoForms(verbId: string, infinitive: string): SixForms {
  const ov = OVERRIDES[verbId];
  if (ov?.imperfecto) return ov.imperfecto;

  const group = getVerbEndingGroup(infinitive);
  const stem = infinitive.slice(0, -2);

  if (group === 'ar') {
    return [
      `${stem}aba`,
      `${stem}abas`,
      `${stem}aba`,
      `${stem}ábamos`,
      `${stem}abais`,
      `${stem}aban`,
    ];
  }

  return [
    `${stem}ía`,
    `${stem}ías`,
    `${stem}ía`,
    `${stem}íamos`,
    `${stem}íais`,
    `${stem}ían`,
  ];
}

function getFuturoForms(verbId: string, infinitive: string): SixForms {
  const stem = OVERRIDES[verbId]?.futuroStem ?? infinitive;
  return [
    `${stem}é`,
    `${stem}ás`,
    `${stem}á`,
    `${stem}emos`,
    `${stem}éis`,
    `${stem}án`,
  ];
}

function getCondicionalForms(verbId: string, infinitive: string): SixForms {
  const stem = OVERRIDES[verbId]?.futuroStem ?? infinitive;
  return [
    `${stem}ía`,
    `${stem}ías`,
    `${stem}ía`,
    `${stem}íamos`,
    `${stem}íais`,
    `${stem}ían`,
  ];
}

function getSubjuntivoPresenteForms(verbId: string, infinitive: string): SixForms {
  const ov = OVERRIDES[verbId];
  if (ov?.subjPresente) return ov.subjPresente;

  const group = getVerbEndingGroup(infinitive);
  const baseStem = infinitive.slice(0, -2);
  let bootStem = ov?.bootChange
    ? replaceLastOccurrence(baseStem, ov.bootChange[0], ov.bootChange[1])
    : baseStem;

  let nosVosStem = baseStem;
  if (ov?.irPreteriteVowel) {
    nosVosStem = replaceLastOccurrence(
      baseStem,
      ov.irPreteriteVowel === 'i' ? 'e' : 'o',
      ov.irPreteriteVowel
    );
  }

  if (group === 'ar') {
    bootStem = applyPreteriteSubjOrthographyBeforeE(infinitive, bootStem);
    nosVosStem = applyPreteriteSubjOrthographyBeforeE(infinitive, nosVosStem);
    return [
      `${bootStem}e`,
      `${bootStem}es`,
      `${bootStem}e`,
      `${nosVosStem}emos`,
      `${nosVosStem}éis`,
      `${bootStem}en`,
    ];
  }

  return [
    `${bootStem}a`,
    `${bootStem}as`,
    `${bootStem}a`,
    `${nosVosStem}amos`,
    `${nosVosStem}áis`,
    `${bootStem}an`,
  ];
}

function addWrittenAccentOnLastVowel(stem: string): string {
  const accentMap: Record<string, string> = {
    a: 'á',
    e: 'é',
    i: 'í',
    o: 'ó',
    u: 'ú',
  };
  for (let i = stem.length - 1; i >= 0; i--) {
    const ch = stem[i];
    if (accentMap[ch]) {
      return stem.slice(0, i) + accentMap[ch] + stem.slice(i + 1);
    }
  }
  return stem;
}

function getSubjuntivoImperfectoForms(
  verbId: string,
  infinitive: string,
  variant: 'ra' | 'se' = 'ra'
): SixForms {
  const ellosPreterite = getIndefinidoForms(verbId, infinitive)[5];
  const base = ellosPreterite.slice(0, -3);
  const nosotrosBase = addWrittenAccentOnLastVowel(base);
  const s = variant;

  return [
    `${base}${s}`,
    `${base}${s}s`,
    `${base}${s}`,
    `${nosotrosBase}${s}mos`,
    `${base}${s}is`,
    `${base}${s}n`,
  ];
}

function getImperativoAfirmativoForm(verbId: string, infinitive: string, person: PersonIndex): string {
  const ov = OVERRIDES[verbId];
  const subj = getSubjuntivoPresenteForms(verbId, infinitive);

  if (person === 1) {
    if (ov?.imperativoTu) return ov.imperativoTu;
    return getPresenteForms(verbId, infinitive)[2];
  }
  if (person === 4) {
    if (verbId === 'ir') return 'id';
    return `${infinitive.slice(0, -1)}d`;
  }
  if (person === 3 && verbId === 'ir') return 'vamos';
  return subj[person];
}

function getImperativoNegativoForm(verbId: string, infinitive: string, person: PersonIndex): string {
  const subj = getSubjuntivoPresenteForms(verbId, infinitive);
  return `no ${subj[person]}`;
}

function buildSpanishCompoundForms(
  verbId: string,
  infinitive: string,
  auxKey: keyof typeof HABER_FORMS
): SixForms {
  const participle = getSpanishPastParticiple(verbId, infinitive);
  return HABER_FORMS[auxKey].map((aux) => `${aux} ${participle}`) as SixForms;
}

function applySpanishNegation(
  affirmativeVerb: string,
  negation: NegationType
): { primary: string; alternatives: string[] } {
  if (negation === 'none' || affirmativeVerb.startsWith('no ')) {
    return { primary: affirmativeVerb, alternatives: [] };
  }
  if (negation === 'pas') {
    return { primary: `no ${affirmativeVerb}`, alternatives: [] };
  }
  if (negation === 'jamais') {
    // In Spanish, both "nunca hablo" and "no hablo nunca" are natural!
    return {
      primary: `nunca ${affirmativeVerb}`,
      alternatives: [`no ${affirmativeVerb} nunca`, `jamás ${affirmativeVerb}`],
    };
  }
  // 'plus' -> "ya no ..."
  return {
    primary: `ya no ${affirmativeVerb}`,
    alternatives: [`no ${affirmativeVerb} más`],
  };
}

export function conjugateSpanish(
  verbId: string,
  tenseId: string,
  person: PersonIndex,
  negation: NegationType = 'none'
): ConjugationResult {
  const verb = SPANISH_CURRICULUM.find((v) => v.id === verbId);
  if (!verb) {
    throw new Error(`Unknown Spanish verbId: ${verbId}`);
  }
  const tense = SPANISH_TENSES.find((t) => t.id === tenseId);
  if (!tense) {
    throw new Error(`Unknown Spanish tenseId: ${tenseId}`);
  }

  const pronounDef = SPANISH_PRONOUNS[person];
  let baseVerbForm: string;
  const altBaseVerbForms: string[] = [];

  // Note: If an affirmative imperative is negated, Spanish grammar switches to the Negative Imperative (subjunctive)!
  const effectiveTenseId =
    tenseId === 'imperativo_afirmativo' && negation !== 'none'
      ? 'imperativo_negativo'
      : tenseId;

  switch (effectiveTenseId) {
    case 'presente':
      baseVerbForm = getPresenteForms(verbId, verb.infinitive)[person];
      break;
    case 'preterito_indefinido':
      baseVerbForm = getIndefinidoForms(verbId, verb.infinitive)[person];
      break;
    case 'preterito_imperfecto':
      baseVerbForm = getImperfectoForms(verbId, verb.infinitive)[person];
      break;
    case 'futuro_simple':
      baseVerbForm = getFuturoForms(verbId, verb.infinitive)[person];
      break;
    case 'condicional_simple':
      baseVerbForm = getCondicionalForms(verbId, verb.infinitive)[person];
      break;
    case 'subjuntivo_presente':
      baseVerbForm = getSubjuntivoPresenteForms(verbId, verb.infinitive)[person];
      break;
    case 'subjuntivo_imperfecto':
      baseVerbForm = getSubjuntivoImperfectoForms(verbId, verb.infinitive, 'ra')[person];
      altBaseVerbForms.push(
        getSubjuntivoImperfectoForms(verbId, verb.infinitive, 'se')[person]
      );
      break;
    case 'preterito_perfecto':
      baseVerbForm = buildSpanishCompoundForms(verbId, verb.infinitive, 'presente')[person];
      break;
    case 'pluscuamperfecto':
      baseVerbForm = buildSpanishCompoundForms(verbId, verb.infinitive, 'imperfecto')[person];
      break;
    case 'futuro_compuesto':
      baseVerbForm = buildSpanishCompoundForms(verbId, verb.infinitive, 'futuro')[person];
      break;
    case 'condicional_compuesto':
      baseVerbForm = buildSpanishCompoundForms(verbId, verb.infinitive, 'condicional')[person];
      break;
    case 'subjuntivo_perfecto':
      baseVerbForm = buildSpanishCompoundForms(verbId, verb.infinitive, 'subj_presente')[person];
      break;
    case 'subjuntivo_pluscuamperfecto':
      baseVerbForm = buildSpanishCompoundForms(
        verbId,
        verb.infinitive,
        'subj_imperfecto_ra'
      )[person];
      altBaseVerbForms.push(
        buildSpanishCompoundForms(verbId, verb.infinitive, 'subj_imperfecto_se')[person]
      );
      break;
    case 'futuro_proximo': {
      const irPresent = getPresenteForms('ir', 'ir')[person];
      baseVerbForm = `${irPresent} a ${verb.infinitive}`;
      break;
    }
    case 'imperativo_afirmativo':
      baseVerbForm = getImperativoAfirmativoForm(verbId, verb.infinitive, person);
      break;
    case 'imperativo_negativo':
      baseVerbForm = getImperativoNegativoForm(verbId, verb.infinitive, person);
      break;
    default:
      throw new Error(`Unhandled Spanish tense: ${tenseId}`);
  }

  const negResult = applySpanishNegation(baseVerbForm, negation);
  const verbForm = negResult.primary;

  const allTargetVerbs = [verbForm, ...negResult.alternatives];
  for (const altBase of altBaseVerbForms) {
    const altNeg = applySpanishNegation(altBase, negation);
    allTargetVerbs.push(altNeg.primary, ...altNeg.alternatives);
  }

  const fullForm = tense.isImperative ? verbForm : `${pronounDef.spokenPrimary} ${verbForm}`;
  const triggeredPhrase = tense.isImperative
    ? `${tense.rassiasTrigger} ¡${verbForm.charAt(0).toUpperCase() + verbForm.slice(1)}!`
    : `${tense.rassiasTrigger} ${fullForm}`;

  const acceptedSet = new Set<string>();
  for (const vf of allTargetVerbs) {
    acceptedSet.add(vf);
    if (!tense.isImperative) {
      for (const p of pronounDef.acceptedVariants) {
        acceptedSet.add(`${p} ${vf}`);
        if (tense.usesSubjunctiveCue) {
          acceptedSet.add(`que ${p} ${vf}`);
        }
      }
      if (tense.usesSubjunctiveCue) {
        acceptedSet.add(`que ${vf}`);
      }
    }
  }

  return {
    language: 'es',
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

export const SPANISH_LANGUAGE_PACK: LanguagePack = {
  code: 'es',
  name: 'Spanish',
  nativeName: 'Español',
  defaultLocale: 'es-MX',
  availableLocales: [
    { code: 'es-MX', label: 'Español (Latinoamérica)' },
    { code: 'es-ES', label: 'Español (España)' },
  ],
  pronouns: SPANISH_PRONOUNS,
  tenses: SPANISH_TENSES,
  verbs: SPANISH_CURRICULUM,
  roadmap: SPANISH_ROADMAP,
  isProDrop: true,
  conjugate: conjugateSpanish,
  conjugateAllPersons: (
    verbId: string,
    tenseId: string,
    negation: NegationType = 'none'
  ) => {
    const tense = SPANISH_TENSES.find((t) => t.id === tenseId);
    const persons: PersonIndex[] = tense?.validPersons ?? [0, 1, 2, 3, 4, 5];
    return persons.map((p) => conjugateSpanish(verbId, tenseId, p, negation));
  },
};
