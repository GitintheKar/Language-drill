import { getLanguagePack } from '../languages';
import { startsWithFrenchVowelOrMuteH } from '../languages/fr/conjugator';
import {
  ConjugationResult,
  LanguageCode,
  LexicalChunk,
  PersonIndex,
} from '../languages/types';

export type EvaluationMatchType =
  | 'exact'
  | 'phonetic_homophone'
  | 'accent_tolerant'
  | 'wrong_pronoun'
  | 'missing_pronoun'
  | 'missing_tail'
  | 'wrong_negation'
  | 'wrong_french_si'
  | 'wrong_stress_or_tense'
  | 'wrong_conjugation';

export interface EvaluationOptions {
  /**
   * Spanish pro-drop setting:
   * - 'pro_drop' (default): bare verb ("hablaba", "no hablaba") is always accepted as long as no wrong pronoun is spoken.
   * - 'disambiguate': requires speaking the subject pronoun when yo (0) and él/ella/usted (2) share the same verb form.
   */
  spanishPronounMode?: 'pro_drop' | 'disambiguate';
  /**
   * Optional pronunciation/stress coaching note returned by multimodal BYOK (e.g. Gemini 2.5 Flash).
   */
  aiPronunciationNote?: string;
  /**
   * Optional alternative recognition hypotheses from speech recognition engine (e.g. Chrome SpeechRecognition alternatives).
   */
  alternatives?: string[];
  /**
   * Optional non-verb lexical chunk attached as a sentence tail (e.g. "en casa", "à la maison").
   */
  expectedTailChunk?: LexicalChunk;
  /**
   * When true ('full_sentence' mode), requires the learner to speak the attached expectedTailChunk
   * along with the conjugated verb. When false ('two_part' mode), speaking the tail is optional.
   */
  requireTailInResponse?: boolean;
}

export interface EvaluationResult {
  isCorrect: boolean;
  matchType: EvaluationMatchType;
  heardNormalized: string;
  expectedDisplay: string;
  expectedSpoken: string;
  feedbackMessage: string;
  /** Whether the Rassias Drill Director should trigger the "Répétez ! / ¡Repita!" loop */
  shouldTriggerRepeat: boolean;
}

/** Normalize punctuation, smart quotes, and extra spaces */
export function normalizeTranscript(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/\s*'\s*/g, "'")
    .replace(/[¡!¿?.,;:«»"()\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Strips the optional Rassias trigger prefix and optional Q&A interjection ("oui", "non", "si", "sí", "no")
 * if the learner included it in their spoken response.
 */
function stripOptionalTriggerAndInterjection(
  normalizedInput: string,
  language: LanguageCode,
  tenseId: string
): { cleaned: string; saidOui: boolean; saidSi: boolean } {
  const pack = getLanguagePack(language);
  const tense = pack.tenses.find((t) => t.id === tenseId);
  let result = normalizedInput;
  let saidOui = false;
  let saidSi = false;

  // 0. Strip any speaker-echoed AT repeat cue ("répétez", "repetez", "repita") from open laptop/tablet speakers
  result = result.replace(/^(répétez|repetez|repita)\s*/i, '').trim();

  // 1. Check for leading Q&A interjections (oui / non / si / sí / no)
  if (language === 'fr') {
    if (result.startsWith('oui ')) {
      saidOui = true;
      result = result.slice(4).trim();
    } else if (result.startsWith('si ')) {
      saidSi = true;
      result = result.slice(3).trim();
    } else if (result.startsWith('non ')) {
      result = result.slice(4).trim();
    }
  } else {
    if (result.startsWith('sí ') || result.startsWith('si ')) {
      saidSi = true;
      result = result.slice(3).trim();
    } else if (
      result.startsWith('no no ') ||
      result.startsWith('no nunca ') ||
      result.startsWith('no jamás ') ||
      result.startsWith('no jamas ') ||
      result.startsWith('no ya no ') ||
      /^no\s+(yo|tú|tu|él|el|ella|usted|nosotros|nosotras|vosotros|vosotras|ellos|ellas|ustedes)\s+/.test(
        result
      )
    ) {
      result = result.slice(3).trim();
    }
  }

  // 2. Strip optional Rassias trigger phrase
  if (tense) {
    const normTrigger = normalizeTranscript(tense.rassiasTrigger);
    if (normTrigger && result.startsWith(normTrigger + ' ')) {
      result = result.slice(normTrigger.length).trim();
    } else if (normTrigger.endsWith(' que')) {
      const baseTrigger = normTrigger.slice(0, -4).trim();
      if (result.startsWith(baseTrigger + " qu'")) {
        result = result.slice(baseTrigger.length + 4).trim();
      }
    }
  }

  // 3. Strip leading subjunctive "que " or "qu'" if present
  if (result.startsWith('que ')) {
    result = result.slice(4).trim();
  } else if (result.startsWith("qu'")) {
    result = result.slice(3).trim();
  }

  return { cleaned: result, saidOui, saidSi };
}

/**
 * Converts a French verb phrase (affirmative or negative) into a canonical phonetic key.
 * Expands `n'` elisions (`n'ai` -> `ne ai`) so homophone matching works across negative compound tenses too.
 */
export function toFrenchVerbPhoneticKey(verbPhrase: string): string {
  const expanded = normalizeTranscript(verbPhrase).replace(/\bn'/g, 'ne ');
  const words = expanded.split(' ').filter(Boolean);

  return words
    .map((w) => {
      let p = w;

      if (p === 'ne' || p === 'pas' || p === 'jamais' || p === 'plus') {
        return `NEG_${p.toUpperCase()}`;
      }

      const exactMap: Record<string, string> = {
        ai: 'E',
        as: 'A',
        a: 'A',
        avons: 'AVON',
        avez: 'AVE',
        ont: 'ON',
        suis: 'SUI',
        es: 'E_OPEN',
        est: 'E_OPEN',
        sommes: 'SOM',
        etes: 'ET',
        êtes: 'ET',
        sont: 'SON',
        vais: 'VE',
        vas: 'VA',
        va: 'VA',
        allons: 'ALON',
        allez: 'ALE',
        vont: 'VON',
        fais: 'FE',
        fait: 'FE',
        faisons: 'FEZON',
        faites: 'FET',
        font: 'FON',
        étais: 'ETE',
        était: 'ETE',
        étaient: 'ETE',
        avais: 'AVE_IMP',
        avait: 'AVE_IMP',
        avaient: 'AVE_IMP',
        sois: 'SWA',
        soit: 'SWA',
        soient: 'SWA',
        aie: 'E_SUBJ',
        aies: 'E_SUBJ',
        ait: 'E_SUBJ',
        aient: 'E_SUBJ',
      };
      if (exactMap[p]) return exactMap[p];

      if (/(ais|ait|aient)$/.test(p)) {
        p = p.replace(/(ais|ait|aient)$/, '_E_IMP');
        p = p.replace(/ge_E_IMP$/, 'g_E_IMP').replace(/ç/g, 's');
        return stripAccents(p);
      }

      if (/rai$/.test(p)) {
        return stripAccents(p.replace(/rai$/, '_RE_FUT'));
      }
      if (/r(as|a)$/.test(p)) {
        return stripAccents(p.replace(/r(as|a)$/, '_RA_FUT'));
      }
      if (/ront$/.test(p)) {
        return stripAccents(p.replace(/ront$/, '_RON_FUT'));
      }

      if (/(é|ée|és|ées|er|ez)$/.test(p)) {
        p = p.replace(/(é|ée|és|ées|er|ez)$/, '_E_CLOSED');
        return stripAccents(p);
      }

      if (/(is|it|i)$/.test(p) && p.length > 2) {
        p = p.replace(/(is|it|i)$/, '_I');
        return stripAccents(p);
      }

      if (/(us|ut|u|ue|ues|û)$/.test(p)) {
        p = p.replace(/(us|ut|u|ue|ues|û)$/, '_U');
        return stripAccents(p);
      }

      if (p.endsWith('ent') && p.length > 4) {
        p = p.slice(0, -3);
      } else if (p.endsWith('es') && p.length > 3) {
        p = p.slice(0, -2);
      } else if (p.endsWith('e') && p.length > 2) {
        p = p.slice(0, -1);
      }

      if (/(ds|d)$/.test(p)) {
        p = p.replace(/(ds|d)$/, '_D_SILENT');
      } else if (/(mets|met)$/.test(p)) {
        p = p.replace(/(mets|met)$/, 'me');
      } else if (/(peux|peut)$/.test(p)) {
        p = 'peu';
      } else if (/(veux|veut)$/.test(p)) {
        p = 'veu';
      } else if (/(sais|sait)$/.test(p)) {
        p = 'se';
      } else if (/(connais|connait|connaît)$/.test(p)) {
        p = 'kone';
      } else if (/(ois|oit)$/.test(p)) {
        p = p.replace(/(ois|oit)$/, 'wa');
      } else if (/(iens|ient)$/.test(p)) {
        p = p.replace(/(iens|ient)$/, 'yen');
      } else if (/(sors|sort|pars|part|dors|dort|cours|court)$/.test(p)) {
        p = p.replace(/[st]$/, '');
      }

      return stripAccents(p);
    })
    .join(' ');
}

function parseFrenchPronounAndVerb(input: string): {
  person: PersonIndex | null;
  pronounRaw: string | null;
  verbPart: string;
} {
  if (input.startsWith("j'")) {
    return { person: 0, pronounRaw: "j'", verbPart: input.slice(2).trim() };
  }

  const patterns: { regex: RegExp; person: PersonIndex; raw: string }[] = [
    { regex: /^je\s+(.+)$/, person: 0, raw: 'je' },
    { regex: /^tu\s+(.+)$/, person: 1, raw: 'tu' },
    { regex: /^t'(.+)$/, person: 1, raw: "t'" },
    { regex: /^(il|elle|on)\s+(.+)$/, person: 2, raw: 'il' },
    { regex: /^nous\s+(.+)$/, person: 3, raw: 'nous' },
    { regex: /^vous\s+(.+)$/, person: 4, raw: 'vous' },
    { regex: /^(ils|elles)\s+(.+)$/, person: 5, raw: 'ils' },
  ];

  for (const pat of patterns) {
    const match = input.match(pat.regex);
    if (match) {
      const verbPart = match[match.length - 1].trim();
      const pronounRaw = match.length === 3 ? match[1] : pat.raw;
      return { person: pat.person, pronounRaw, verbPart };
    }
  }

  return { person: null, pronounRaw: null, verbPart: input };
}

function parseSpanishPronounAndVerb(input: string): {
  person: PersonIndex | null;
  pronounRaw: string | null;
  verbPart: string;
} {
  const patterns: { regex: RegExp; person: PersonIndex }[] = [
    { regex: /^(yo)\s+(.+)$/, person: 0 },
    { regex: /^(tú|tu)\s+(.+)$/, person: 1 },
    { regex: /^(él|el|ella|usted)\s+(.+)$/, person: 2 },
    { regex: /^(nosotros|nosotras)\s+(.+)$/, person: 3 },
    { regex: /^(vosotros|vosotras)\s+(.+)$/, person: 4 },
    { regex: /^(ellos|ellas|ustedes)\s+(.+)$/, person: 5 },
  ];

  for (const pat of patterns) {
    const match = input.match(pat.regex);
    if (match) {
      return {
        person: pat.person,
        pronounRaw: match[1],
        verbPart: match[2].trim(),
      };
    }
  }

  return { person: null, pronounRaw: null, verbPart: input };
}

function evaluateFrench(
  cleanedInput: string,
  saidOui: boolean,
  target: ConjugationResult,
  options?: EvaluationOptions
): EvaluationResult {
  const pack = getLanguagePack('fr');
  const tense = pack.tenses.find((t) => t.id === target.tenseId)!;

  const displayTarget = target.requiresFrenchSi
    ? `Si, ${target.fullForm}`
    : target.fullForm;

  // 0. Classic Dartmouth Rassias "Si !" trap: answering a negative French question with "Oui" instead of "Si"
  if (target.requiresFrenchSi && saidOui) {
    return {
      isCorrect: false,
      matchType: 'wrong_french_si',
      heardNormalized: `oui ${cleanedInput}`,
      expectedDisplay: displayTarget,
      expectedSpoken: displayTarget,
      feedbackMessage: `Attention : à une question négative, répondez « Si ! » (pas « Oui ») — Répétez : « ${displayTarget} ! »`,
      shouldTriggerRepeat: true,
    };
  }

  // 1. Direct exact match against accepted forms (includes standard ne...pas and colloquial ne-dropped)
  for (const accepted of target.acceptedForms) {
    if (cleanedInput === normalizeTranscript(accepted)) {
      return {
        isCorrect: true,
        matchType: 'exact',
        heardNormalized: cleanedInput,
        expectedDisplay: displayTarget,
        expectedSpoken: displayTarget,
        feedbackMessage: options?.aiPronunciationNote || 'Très bien ! Exact.',
        shouldTriggerRepeat: false,
      };
    }
  }

  // 2. Imperative handling
  if (tense.isImperative) {
    const targetPhonetic = toFrenchVerbPhoneticKey(target.verbForm);
    const heardPhonetic = toFrenchVerbPhoneticKey(cleanedInput);
    const heardWithoutNe = toFrenchVerbPhoneticKey(`ne ${cleanedInput}`);

    if (
      targetPhonetic === heardPhonetic ||
      (target.negation !== 'none' && targetPhonetic === heardWithoutNe)
    ) {
      return {
        isCorrect: true,
        matchType: 'phonetic_homophone',
        heardNormalized: cleanedInput,
        expectedDisplay: displayTarget,
        expectedSpoken: displayTarget,
        feedbackMessage: `Très bien ! (« ${displayTarget} »)`,
        shouldTriggerRepeat: false,
      };
    }
    return {
      isCorrect: false,
      matchType: 'wrong_conjugation',
      heardNormalized: cleanedInput,
      expectedDisplay: displayTarget,
      expectedSpoken: displayTarget,
      feedbackMessage: `Répétez : « ${displayTarget} ! »`,
      shouldTriggerRepeat: true,
    };
  }

  // 3. Parse spoken pronoun and verb part
  const parsed = parseFrenchPronounAndVerb(cleanedInput);

  if (parsed.person === null) {
    return {
      isCorrect: false,
      matchType: 'missing_pronoun',
      heardNormalized: cleanedInput,
      expectedDisplay: displayTarget,
      expectedSpoken: displayTarget,
      feedbackMessage: `Dites le pronom avec le verbe — Répétez : « ${displayTarget} »`,
      shouldTriggerRepeat: true,
    };
  }

  let pronounMatches = parsed.person === target.person;
  const isThirdPersonHomophonePair =
    (target.person === 2 && parsed.person === 5) ||
    (target.person === 5 && parsed.person === 2);

  if (isThirdPersonHomophonePair && !startsWithFrenchVowelOrMuteH(target.verbForm)) {
    pronounMatches = true;
  }

  if (!pronounMatches) {
    return {
      isCorrect: false,
      matchType: 'wrong_pronoun',
      heardNormalized: cleanedInput,
      expectedDisplay: displayTarget,
      expectedSpoken: displayTarget,
      feedbackMessage: `Attention au sujet (${pack.pronouns[target.person].spokenPrimary}) — Répétez : « ${displayTarget} »`,
      shouldTriggerRepeat: true,
    };
  }

  // 4. Compare verb phonetics (supporting both standard ne...pas/jamais/plus and colloquial ne-drop)
  const targetPhonetic = toFrenchVerbPhoneticKey(target.verbForm);
  const heardPhonetic = toFrenchVerbPhoneticKey(parsed.verbPart);
  const heardWithRestoredNe = toFrenchVerbPhoneticKey(`ne ${parsed.verbPart}`);

  if (
    targetPhonetic === heardPhonetic ||
    (target.negation !== 'none' && targetPhonetic === heardWithRestoredNe)
  ) {
    return {
      isCorrect: true,
      matchType: 'phonetic_homophone',
      heardNormalized: cleanedInput,
      expectedDisplay: displayTarget,
      expectedSpoken: displayTarget,
      feedbackMessage:
        options?.aiPronunciationNote ||
        `Très bien ! Prononciation exacte (« ${displayTarget} »).`,
      shouldTriggerRepeat: false,
    };
  }

  // 5. Check if the user missed negation or misplaced "pas / jamais / plus" (e.g. "j'ai parlé pas")
  if (target.negation !== 'none') {
    return {
      isCorrect: false,
      matchType: 'wrong_negation',
      heardNormalized: cleanedInput,
      expectedDisplay: displayTarget,
      expectedSpoken: displayTarget,
      feedbackMessage: `Attention à la négation (« ne ... ${target.negation} » autour de l'auxiliaire/verbe) — Répétez : « ${displayTarget} ! »`,
      shouldTriggerRepeat: true,
    };
  }

  return {
    isCorrect: false,
    matchType: 'wrong_conjugation',
    heardNormalized: cleanedInput,
    expectedDisplay: displayTarget,
    expectedSpoken: displayTarget,
    feedbackMessage: `Répétez : « ${displayTarget} ! »`,
    shouldTriggerRepeat: true,
  };
}

function isAmbiguousSpanishForm(target: ConjugationResult): boolean {
  if (target.person !== 0 && target.person !== 2) return false;
  const pack = getLanguagePack('es');
  const yoForm = pack.conjugate(target.verbId, target.tenseId, 0, target.negation).verbForm;
  const elForm = pack.conjugate(target.verbId, target.tenseId, 2, target.negation).verbForm;
  return yoForm === elForm;
}

/**
 * Converts a Spanish phrase into a canonical Latin American phonetic key
 * (handling seseo c/s/z, betacismo b/v, yeísmo ll/y, silent h, and x/j in México/Méjico).
 */
export function toSpanishPhoneticKey(phrase: string): string {
  return stripAccents(normalizeTranscript(phrase))
    .split(' ')
    .filter(Boolean)
    .map((w) =>
      w
        .replace(/^h/, '')
        .replace(/ll/g, 'y')
        .replace(/v/g, 'b')
        .replace(/z/g, 's')
        .replace(/ce/g, 'se')
        .replace(/ci/g, 'si')
        .replace(/mexic/g, 'mejic')
    )
    .join(' ');
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0)
  );
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[a.length][b.length];
}

function collidesWithAnotherSpanishForm(
  heardVerb: string,
  target: ConjugationResult
): boolean {
  const normHeard = stripAccents(heardVerb);
  const pack = getLanguagePack('es');
  for (const tense of pack.tenses) {
    const allPersons = pack.conjugateAllPersons(
      target.verbId,
      tense.id,
      target.negation
    );
    for (const c of allPersons) {
      if (c.tenseId === target.tenseId && c.person === target.person) continue;
      if (stripAccents(normalizeTranscript(c.verbForm)) === normHeard) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Expands common continuous-speech ASR boundary fusions in Spanish:
 * - "es de México" -> often transcribed by ASR as "este México" (/es ðe/ -> /este/)
 * - "va a hablar" / "voy a hablar" -> often transcribed as "va hablar" / "voya hablar"
 */
function expandSpanishBoundaryFusions(
  cleanedInput: string,
  target?: ConjugationResult,
  tailChunk?: LexicalChunk
): string {
  let out = cleanedInput;

  const chunkNorm = tailChunk ? normalizeTranscript(tailChunk.target) : '';
  const chunkStartsWithDe = chunkNorm.startsWith('de ');
  const targetIsEs = target?.verbForm === 'es' || target?.verbForm === 'no es';

  if (targetIsEs || chunkStartsWithDe) {
    out = out
      .replace(/^(el|él|ella|usted)\s+este\s+/i, '$1 es de ')
      .replace(/^no\s+este\s+/i, 'no es de ')
      .replace(/^este\s+/i, 'es de ');
  }

  // Handle Futuro Próximo "voya " -> "voy a " or missing "a" in "va <infinitive>" / "vamos <infinitive>"
  if (target?.tenseId === 'futuro_proximo') {
    out = out
      .replace(/\bvoya\s+/g, 'voy a ')
      .replace(/\b(voy|vas|va|vamos|vais|van)\s+(?!a\b)([a-záéíóúñ]+r\b)/g, '$1 a $2');
  }

  return out;
}

function findSpanishStressCollision(
  heardVerb: string,
  target: ConjugationResult
): { collidedForm: string; collidedTenseName: string } | null {
  if (heardVerb === target.verbForm) return null;
  if (stripAccents(heardVerb) !== stripAccents(target.verbForm)) return null;

  const pack = getLanguagePack('es');
  for (const tense of pack.tenses) {
    const allPersons = pack.conjugateAllPersons(target.verbId, tense.id, target.negation);
    for (const c of allPersons) {
      if (
        c.verbForm === heardVerb &&
        (c.tenseId !== target.tenseId || c.person !== target.person)
      ) {
        return {
          collidedForm: c.verbForm,
          collidedTenseName: tense.name,
        };
      }
    }
  }
  return null;
}

function evaluateSpanish(
  cleanedInput: string,
  target: ConjugationResult,
  options?: EvaluationOptions
): EvaluationResult {
  const pack = getLanguagePack('es');
  const tense = pack.tenses.find((t) => t.id === target.tenseId)!;
  const pronounMode = options?.spanishPronounMode ?? 'pro_drop';

  if (tense.isImperative) {
    const normExpected = normalizeTranscript(target.verbForm);
    if (
      cleanedInput === normExpected ||
      stripAccents(cleanedInput) === stripAccents(normExpected)
    ) {
      return {
        isCorrect: true,
        matchType: cleanedInput === normExpected ? 'exact' : 'accent_tolerant',
        heardNormalized: cleanedInput,
        expectedDisplay: `¡${target.verbForm}!`,
        expectedSpoken: target.verbForm,
        feedbackMessage: options?.aiPronunciationNote || `¡Muy bien! (« ¡${target.verbForm}! »)`,
        shouldTriggerRepeat: false,
      };
    }
    return {
      isCorrect: false,
      matchType: 'wrong_conjugation',
      heardNormalized: cleanedInput,
      expectedDisplay: `¡${target.verbForm}!`,
      expectedSpoken: target.verbForm,
      feedbackMessage: `¡Repita!: « ¡${target.verbForm}! »`,
      shouldTriggerRepeat: true,
    };
  }

  const parsed = parseSpanishPronounAndVerb(cleanedInput);

  if (parsed.person !== null && parsed.person !== target.person) {
    return {
      isCorrect: false,
      matchType: 'wrong_pronoun',
      heardNormalized: cleanedInput,
      expectedDisplay: target.fullForm,
      expectedSpoken: target.fullForm,
      feedbackMessage: `Cuidado con el sujeto (${pack.pronouns[target.person].spokenPrimary}, no « ${parsed.pronounRaw} ») — ¡Repita!: « ${target.fullForm} »`,
      shouldTriggerRepeat: true,
    };
  }

  if (
    pronounMode === 'disambiguate' &&
    parsed.person === null &&
    isAmbiguousSpanishForm(target)
  ) {
    return {
      isCorrect: false,
      matchType: 'missing_pronoun',
      heardNormalized: cleanedInput,
      expectedDisplay: target.fullForm,
      expectedSpoken: target.fullForm,
      feedbackMessage: `Forma ambigua: incluye el pronombre « ${pack.pronouns[target.person].spokenPrimary} » — ¡Repita!: « ${target.fullForm} »`,
      shouldTriggerRepeat: true,
    };
  }

  const validBareVerbs = target.acceptedForms.filter(
    (f) => !f.startsWith('que ') && parseSpanishPronounAndVerb(normalizeTranscript(f)).person === null
  );

  for (const validVerb of validBareVerbs) {
    const normValid = normalizeTranscript(validVerb);
    if (parsed.verbPart === normValid) {
      return {
        isCorrect: true,
        matchType: 'exact',
        heardNormalized: cleanedInput,
        expectedDisplay: target.fullForm,
        expectedSpoken: target.verbForm,
        feedbackMessage: options?.aiPronunciationNote || '¡Excelente!',
        shouldTriggerRepeat: false,
      };
    }
  }

  const stressCollision = findSpanishStressCollision(parsed.verbPart, target);
  if (stressCollision) {
    return {
      isCorrect: false,
      matchType: 'wrong_stress_or_tense',
      heardNormalized: cleanedInput,
      expectedDisplay: target.fullForm,
      expectedSpoken: target.verbForm,
      feedbackMessage: `Cuidado con el acento/acentuación: dijiste « ${stressCollision.collidedForm} » (${stressCollision.collidedTenseName}) en vez de « ${target.verbForm} » — ¡Repita!: « ${target.fullForm} »`,
      shouldTriggerRepeat: true,
    };
  }

  for (const validVerb of validBareVerbs) {
    const normValid = normalizeTranscript(validVerb);
    if (stripAccents(parsed.verbPart) === stripAccents(normValid)) {
      return {
        isCorrect: true,
        matchType: 'accent_tolerant',
        heardNormalized: cleanedInput,
        expectedDisplay: target.fullForm,
        expectedSpoken: target.verbForm,
        feedbackMessage: options?.aiPronunciationNote || `¡Muy bien! (« ${target.verbForm} »)`,
        shouldTriggerRepeat: false,
      };
    }
  }

  // Phonetic & communicative ASR tolerance (b/v, c/s/z, ll/y, silent h)
  const heardPhonetic = toSpanishPhoneticKey(parsed.verbPart);
  for (const validVerb of validBareVerbs) {
    const normValid = normalizeTranscript(validVerb);
    const validPhonetic = toSpanishPhoneticKey(normValid);

    if (heardPhonetic === validPhonetic && !collidesWithAnotherSpanishForm(parsed.verbPart, target)) {
      return {
        isCorrect: true,
        matchType: 'phonetic_homophone',
        heardNormalized: cleanedInput,
        expectedDisplay: target.fullForm,
        expectedSpoken: target.verbForm,
        feedbackMessage: options?.aiPronunciationNote || `¡Muy bien! (« ${target.verbForm} »)`,
        shouldTriggerRepeat: false,
      };
    }
  }

  if (target.negation !== 'none') {
    return {
      isCorrect: false,
      matchType: 'wrong_negation',
      heardNormalized: cleanedInput,
      expectedDisplay: target.fullForm,
      expectedSpoken: target.verbForm,
      feedbackMessage: `Cuidado con la negación — ¡Repita!: « ${target.fullForm} ! »`,
      shouldTriggerRepeat: true,
    };
  }

  return {
    isCorrect: false,
    matchType: 'wrong_conjugation',
    heardNormalized: cleanedInput,
    expectedDisplay: target.fullForm,
    expectedSpoken: target.verbForm,
    feedbackMessage: `¡Repita!: « ${target.fullForm} ! »`,
    shouldTriggerRepeat: true,
  };
}

/**
 * Main entry point for grading any spoken conjugation transcript against a target ConjugationResult.
 */
export function evaluateSpokenConjugation(
  rawTranscript: string,
  target: ConjugationResult,
  options?: EvaluationOptions
): EvaluationResult {
  // First, check raw primary transcript
  const primaryEval = evaluateSingleTranscript(rawTranscript, target, options);
  if (primaryEval.isCorrect) {
    return primaryEval;
  }

  // If primary transcript did not match and we have alternative hypotheses (e.g. from Chrome speech recognition),
  // test each alternative. If any communicative alternative matches, accept it!
  if (options?.alternatives && options.alternatives.length > 0) {
    for (const alt of options.alternatives) {
      if (alt && alt !== rawTranscript) {
        const altEval = evaluateSingleTranscript(alt, target, options);
        if (altEval.isCorrect) {
          return altEval;
        }
      }
    }
  }

  return primaryEval;
}

function buildCandidateChunkTails(chunk: LexicalChunk): Set<string> {
  const normTail = normalizeTranscript(chunk.target);
  const accentFreeTail = stripAccents(normTail);
  const phoneticTail = toSpanishPhoneticKey(normTail);
  const candidateTails = new Set<string>([normTail, accentFreeTail, phoneticTail]);

  if (normTail.endsWith('o')) {
    const fem = normTail.slice(0, -1) + 'a';
    candidateTails.add(fem);
    candidateTails.add(stripAccents(fem));
    candidateTails.add(normTail + 's');
    candidateTails.add(stripAccents(normTail + 's'));
    candidateTails.add(fem + 's');
    candidateTails.add(stripAccents(fem + 's'));
  }

  // Allow natural intensifiers ("mucha hambre", "muy cansado", "un poco cansada")
  for (const base of Array.from(candidateTails)) {
    candidateTails.add(`mucha ${base}`);
    candidateTails.add(`mucho ${base}`);
    candidateTails.add(`muy ${base}`);
    candidateTails.add(`un poco ${base}`);
  }

  return candidateTails;
}

function stripTrailingLexicalChunk(
  cleanedInput: string,
  chunk?: LexicalChunk
): { verbOnlyInput: string; matchedTail: boolean } {
  if (!chunk) {
    return { verbOnlyInput: cleanedInput, matchedTail: true };
  }

  const normTail = normalizeTranscript(chunk.target);
  if (!normTail) {
    return { verbOnlyInput: cleanedInput, matchedTail: true };
  }

  const candidateTails = buildCandidateChunkTails(chunk);
  const accentFreeInput = stripAccents(cleanedInput);
  const phoneticInput = toSpanishPhoneticKey(cleanedInput);

  // Sort longest first so "mucha hambre" strips before "hambre"
  const sortedCandidates = Array.from(candidateTails).sort(
    (a, b) => b.length - a.length
  );

  for (const candidate of sortedCandidates) {
    if (cleanedInput.endsWith(' ' + candidate)) {
      const stripped = cleanedInput
        .slice(0, cleanedInput.length - candidate.length)
        .trim();
      if (stripped.length > 0) {
        return { verbOnlyInput: stripped, matchedTail: true };
      }
    }
    if (accentFreeInput.endsWith(' ' + candidate)) {
      const stripped = cleanedInput
        .slice(0, cleanedInput.length - candidate.length)
        .trim();
      if (stripped.length > 0) {
        return { verbOnlyInput: stripped, matchedTail: true };
      }
    }
    if (phoneticInput.endsWith(' ' + candidate)) {
      const words = cleanedInput.split(' ');
      const candWordCount = candidate.split(' ').length;
      if (words.length > candWordCount) {
        const stripped = words.slice(0, words.length - candWordCount).join(' ');
        return { verbOnlyInput: stripped, matchedTail: true };
      }
    }
  }

  return { verbOnlyInput: cleanedInput, matchedTail: false };
}

function evaluateSingleTranscript(
  rawTranscript: string,
  target: ConjugationResult,
  options?: EvaluationOptions
): EvaluationResult {
  const normalized = normalizeTranscript(rawTranscript);
  const { cleaned: rawCleaned, saidOui } = stripOptionalTriggerAndInterjection(
    normalized,
    target.language,
    target.tenseId
  );

  const tailChunk = options?.expectedTailChunk;
  const cleaned =
    target.language === 'es'
      ? expandSpanishBoundaryFusions(rawCleaned, target, tailChunk)
      : rawCleaned;

  const requireTail = Boolean(options?.requireTailInResponse && tailChunk);
  const fullExpectedWithTail = tailChunk
    ? `${target.fullForm} ${tailChunk.target}`
    : target.fullForm;

  if (!cleaned) {
    return {
      isCorrect: false,
      matchType: 'wrong_conjugation',
      heardNormalized: '',
      expectedDisplay: requireTail ? fullExpectedWithTail : target.fullForm,
      expectedSpoken: requireTail ? fullExpectedWithTail : target.fullForm,
      feedbackMessage:
        target.language === 'fr'
          ? `Répétez : « ${requireTail ? fullExpectedWithTail : target.fullForm} ! »`
          : `¡Repita!: « ${requireTail ? fullExpectedWithTail : target.fullForm} ! »`,
      shouldTriggerRepeat: true,
    };
  }

  const { verbOnlyInput, matchedTail } = stripTrailingLexicalChunk(cleaned, tailChunk);

  let baseEval =
    target.language === 'fr'
      ? evaluateFrench(verbOnlyInput, saidOui, target, options)
      : evaluateSpanish(verbOnlyInput, target, options);

  // In 'two_part' mode (requireTail === false), if the learner spoke the valid verb followed by
  // a slightly garbled or expanded version of the optional scene tail, do not penalize them!
  if (!baseEval.isCorrect && !requireTail && tailChunk && !matchedTail) {
    for (const acc of target.acceptedForms) {
      const normAcc = normalizeTranscript(acc);
      if (normAcc && cleaned.startsWith(normAcc + ' ')) {
        const candidateEval =
          target.language === 'fr'
            ? evaluateFrench(normAcc, saidOui, target, options)
            : evaluateSpanish(normAcc, target, options);
        if (candidateEval.isCorrect) {
          baseEval = candidateEval;
          break;
        }
      }
    }
  }

  // If the conjugation was right, but full_sentence mode required the tail and it was omitted:
  if (baseEval.isCorrect && requireTail && !matchedTail && tailChunk) {
    return {
      isCorrect: false,
      matchType: 'missing_tail',
      heardNormalized: cleaned,
      expectedDisplay: fullExpectedWithTail,
      expectedSpoken: fullExpectedWithTail,
      feedbackMessage:
        target.language === 'fr'
          ? `Ajoutez la fin de la phrase (« ${tailChunk.target} ») — Répétez : « ${fullExpectedWithTail} ! »`
          : `Incluye el complemento (« ${tailChunk.target} ») — ¡Repita!: « ${fullExpectedWithTail} ! »`,
      shouldTriggerRepeat: true,
    };
  }

  if (requireTail && tailChunk) {
    return {
      ...baseEval,
      expectedDisplay: fullExpectedWithTail,
      expectedSpoken: fullExpectedWithTail,
    };
  }

  return baseEval;
}

/**
 * Evaluates a spoken Non-Verb Lexical Chunk during the 5-snap Chunk Warmup (Part 1 of Option C 'two_part' mode).
 */
export function evaluateSpokenChunk(
  rawTranscript: string,
  chunk: LexicalChunk,
  language: LanguageCode,
  alternatives?: string[]
): EvaluationResult {
  const candidates = [rawTranscript, ...(alternatives ?? [])];
  const normExpected = normalizeTranscript(chunk.target);
  const candidateTails = buildCandidateChunkTails(chunk);

  for (const candidate of candidates) {
    const rawNorm = normalizeTranscript(candidate)
      .replace(/^(répétez|repetez|repita)\s*/i, '')
      .trim();
    if (!rawNorm) continue;

    const normHeard =
      language === 'es'
        ? expandSpanishBoundaryFusions(rawNorm, undefined, chunk)
        : rawNorm;
    const accentFreeHeard = stripAccents(normHeard);
    const phoneticHeard = toSpanishPhoneticKey(normHeard);

    for (const tailVariant of candidateTails) {
      const exactOrContains =
        normHeard === tailVariant ||
        accentFreeHeard === tailVariant ||
        phoneticHeard === tailVariant ||
        normHeard.endsWith(' ' + tailVariant) ||
        accentFreeHeard.endsWith(' ' + tailVariant) ||
        phoneticHeard.endsWith(' ' + tailVariant) ||
        (tailVariant.length >= 5 &&
          levenshteinDistance(phoneticHeard, tailVariant) === 1);

      if (exactOrContains) {
        return {
          isCorrect: true,
          matchType: normHeard === normExpected ? 'exact' : 'accent_tolerant',
          heardNormalized: normHeard,
          expectedDisplay: chunk.target,
          expectedSpoken: chunk.target,
          feedbackMessage:
            language === 'fr'
              ? `Très bien ! (« ${chunk.target} »)`
              : `¡Muy bien! (« ${chunk.target} »)`,
          shouldTriggerRepeat: false,
        };
      }
    }
  }

  const primaryNorm = normalizeTranscript(rawTranscript);
  return {
    isCorrect: false,
    matchType: 'wrong_conjugation',
    heardNormalized: primaryNorm,
    expectedDisplay: chunk.target,
    expectedSpoken: chunk.target,
    feedbackMessage:
      language === 'fr'
        ? `Répétez l'expression : « ${chunk.target} ! »`
        : `¡Repita la expresión!: « ${chunk.target} ! »`,
    shouldTriggerRepeat: true,
  };
}
