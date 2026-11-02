import { describe, expect, it } from 'vitest';
import { evaluateSpokenConjugation, evaluateSpokenChunk } from '../evaluator';
import { conjugateFrench } from '../../languages/fr/conjugator';
import { conjugateSpanish } from '../../languages/es/conjugator';

describe('Phase 2 & 3.5 — French Oral Evaluation, Homophones & Negation', () => {
  it('accepts exact matches and pronoun variants (il/elle/on, ils/elles)', () => {
    const targetIl = conjugateFrench('parler', 'present', 2);
    expect(evaluateSpokenConjugation('il parle', targetIl).isCorrect).toBe(true);
    expect(evaluateSpokenConjugation('elle parle', targetIl).isCorrect).toBe(true);
    expect(evaluateSpokenConjugation('on parle', targetIl).isCorrect).toBe(true);

    const targetJe = conjugateFrench('aimer', 'present', 0);
    expect(evaluateSpokenConjugation("J'aime !", targetJe).isCorrect).toBe(true);
  });

  it('strips optional Rassias spoken triggers when the user repeats them', () => {
    const subj = conjugateFrench('aller', 'subjonctif_present', 0);
    expect(evaluateSpokenConjugation("Il faut que j'aille", subj).isCorrect).toBe(true);
    expect(evaluateSpokenConjugation("que j'aille", subj).isCorrect).toBe(true);
    expect(evaluateSpokenConjugation("j'aille", subj).isCorrect).toBe(true);

    const pc = conjugateFrench('finir', 'passe_compose', 1);
    expect(evaluateSpokenConjugation('Hier, tu as fini', pc).isCorrect).toBe(true);
  });

  it('accepts true French homophones produced by speech-to-text quirks', () => {
    const ilsParlent = conjugateFrench('parler', 'present', 5);
    const res1 = evaluateSpokenConjugation('il parle', ilsParlent);
    expect(res1.isCorrect).toBe(true);
    expect(res1.matchType).toBe('phonetic_homophone');

    const jaiParle = conjugateFrench('parler', 'passe_compose', 0);
    const res2 = evaluateSpokenConjugation("j'ai parler", jaiParle);
    expect(res2.isCorrect).toBe(true);
    expect(res2.matchType).toBe('phonetic_homophone');

    const ilsParlaient = conjugateFrench('parler', 'imparfait', 5);
    const res3 = evaluateSpokenConjugation('il parlait', ilsParlaient);
    expect(res3.isCorrect).toBe(true);

    const nousAllerPC = conjugateFrench('aller', 'passe_compose', 3);
    const res4 = evaluateSpokenConjugation('nous sommes allé', nousAllerPC);
    expect(res4.isCorrect).toBe(true);
  });

  it('conjugates and grades French Negation (ne...pas, ne...jamais, ne...plus) across simple & compound tenses', () => {
    // Simple vowel-initial verb: j'aime -> je n'aime pas
    const jeNaimePas = conjugateFrench('aimer', 'present', 0, 'pas');
    expect(jeNaimePas.fullForm).toBe("je n'aime pas");
    expect(evaluateSpokenConjugation("je n'aime pas", jeNaimePas).isCorrect).toBe(true);
    // Colloquial ne-drop ("j'aime pas") is also accepted
    expect(evaluateSpokenConjugation("j'aime pas", jeNaimePas).isCorrect).toBe(true);

    // Compound tense: wraps auxiliary only ("je n'ai pas parlé", "nous ne sommes jamais allés")
    const jeNaiPasParle = conjugateFrench('parler', 'passe_compose', 0, 'pas');
    expect(jeNaiPasParle.fullForm).toBe("je n'ai pas parlé");
    expect(evaluateSpokenConjugation("je n'ai pas parlé", jeNaiPasParle).isCorrect).toBe(true);
    expect(evaluateSpokenConjugation("Non, je n'ai pas parler", jeNaiPasParle).isCorrect).toBe(true);

    // Rejects misplaced 'pas' after the participle ("j'ai parlé pas")
    const misplacedPas = evaluateSpokenConjugation("j'ai parlé pas", jeNaiPasParle);
    expect(misplacedPas.isCorrect).toBe(false);
    expect(misplacedPas.matchType).toBe('wrong_negation');

    // ne...jamais and ne...plus
    const jamaisAller = conjugateFrench('aller', 'passe_compose', 3, 'jamais');
    expect(jamaisAller.fullForm).toBe('nous ne sommes jamais allés');
    expect(evaluateSpokenConjugation('nous ne sommes jamais allés', jamaisAller).isCorrect).toBe(true);

    const plusParler = conjugateFrench('parler', 'futur_proche', 0, 'plus');
    expect(plusParler.fullForm).toBe('je ne vais plus parler');
    expect(evaluateSpokenConjugation('je ne vais plus parler', plusParler).isCorrect).toBe(true);
  });

  it('enforces the French "Si !" trap when answering a negative question affirmatively', () => {
    const target = conjugateFrench('venir', 'present', 0, 'none');
    target.requiresFrenchSi = true;

    // Saying "Oui, je viens" to a negative question fails with wrong_french_si
    const saidOui = evaluateSpokenConjugation('Oui, je viens', target);
    expect(saidOui.isCorrect).toBe(false);
    expect(saidOui.matchType).toBe('wrong_french_si');
    expect(saidOui.shouldTriggerRepeat).toBe(true);

    // Saying "Si, je viens" succeeds!
    const saidSi = evaluateSpokenConjugation('Si, je viens', target);
    expect(saidSi.isCorrect).toBe(true);
  });

  it('rejects non-homophones between il and ils (e.g. il finit vs. ils finissent, il va vs. ils vont)', () => {
    const ilsFinissent = conjugateFrench('finir', 'present', 5);
    const wrong1 = evaluateSpokenConjugation('il finit', ilsFinissent);
    expect(wrong1.isCorrect).toBe(false);
    expect(wrong1.shouldTriggerRepeat).toBe(true);

    const ilsVont = conjugateFrench('aller', 'present', 5);
    const wrong2 = evaluateSpokenConjugation('il va', ilsVont);
    expect(wrong2.isCorrect).toBe(false);
    expect(wrong2.shouldTriggerRepeat).toBe(true);
  });

  it('flags missing subject pronouns in French (outside of Imperative) and triggers Répétez loop', () => {
    const nousParlons = conjugateFrench('parler', 'present', 3);
    const res = evaluateSpokenConjugation('parlons', nousParlons);
    expect(res.isCorrect).toBe(false);
    expect(res.matchType).toBe('missing_pronoun');
    expect(res.shouldTriggerRepeat).toBe(true);

    const impParlons = conjugateFrench('parler', 'imperatif', 3);
    expect(evaluateSpokenConjugation('parlons', impParlons).isCorrect).toBe(true);
  });

  it('flags wrong subject pronouns in French even when the verb sound matches (je parle vs. tu parles)', () => {
    const tuParles = conjugateFrench('parler', 'present', 1);
    const res = evaluateSpokenConjugation('je parle', tuParles);
    expect(res.isCorrect).toBe(false);
    expect(res.matchType).toBe('wrong_pronoun');
    expect(res.shouldTriggerRepeat).toBe(true);
  });
});

describe('Phase 2 & 3.5 — Spanish Pro-Drop, Negation & Stress Evaluation Engine', () => {
  it('accepts both bare verb (pro-drop) and pronoun + verb by default', () => {
    const tuHablas = conjugateSpanish('hablar', 'presente', 1);
    expect(evaluateSpokenConjugation('hablas', tuHablas).isCorrect).toBe(true);
    expect(evaluateSpokenConjugation('tú hablas', tuHablas).isCorrect).toBe(true);
    expect(evaluateSpokenConjugation('¡Sí, hablas!', tuHablas).isCorrect).toBe(true);
  });

  it('conjugates and grades Spanish negation (no, nunca / no...nunca, ya no)', () => {
    const noHeHablado = conjugateSpanish('hablar', 'preterito_perfecto', 0, 'pas');
    expect(noHeHablado.verbForm).toBe('no he hablado');
    expect(evaluateSpokenConjugation('no he hablado', noHeHablado).isCorrect).toBe(true);
    expect(evaluateSpokenConjugation('yo no he hablado', noHeHablado).isCorrect).toBe(true);
    expect(evaluateSpokenConjugation('No, no he hablado', noHeHablado).isCorrect).toBe(true);

    const nuncaHablo = conjugateSpanish('hablar', 'presente', 0, 'jamais');
    expect(nuncaHablo.verbForm).toBe('nunca hablo');
    expect(evaluateSpokenConjugation('nunca hablo', nuncaHablo).isCorrect).toBe(true);
    expect(evaluateSpokenConjugation('no hablo nunca', nuncaHablo).isCorrect).toBe(true);
    expect(evaluateSpokenConjugation('yo nunca hablo', nuncaHablo).isCorrect).toBe(true);

    const yaNoHablo = conjugateSpanish('hablar', 'presente', 0, 'plus');
    expect(yaNoHablo.verbForm).toBe('ya no hablo');
    expect(evaluateSpokenConjugation('ya no hablo', yaNoHablo).isCorrect).toBe(true);
  });

  it('catches wrong spoken pronoun even when the verb conjugation is shared (yo hablaba vs. él hablaba)', () => {
    const yoHablaba = conjugateSpanish('hablar', 'preterito_imperfecto', 0);

    expect(evaluateSpokenConjugation('hablaba', yoHablaba).isCorrect).toBe(true);
    expect(evaluateSpokenConjugation('yo hablaba', yoHablaba).isCorrect).toBe(true);
    const wrongPronoun = evaluateSpokenConjugation('él hablaba', yoHablaba);
    expect(wrongPronoun.isCorrect).toBe(false);
    expect(wrongPronoun.matchType).toBe('wrong_pronoun');
    expect(wrongPronoun.shouldTriggerRepeat).toBe(true);
  });

  it('supports optional Spanish disambiguate mode on ambiguous yo/él tenses', () => {
    const yoHablaba = conjugateSpanish('hablar', 'preterito_imperfecto', 0);
    const tuHablabas = conjugateSpanish('hablar', 'preterito_imperfecto', 1);

    const missing = evaluateSpokenConjugation('hablaba', yoHablaba, {
      spanishPronounMode: 'disambiguate',
    });
    expect(missing.isCorrect).toBe(false);
    expect(missing.matchType).toBe('missing_pronoun');

    const withPronoun = evaluateSpokenConjugation('yo hablaba', yoHablaba, {
      spanishPronounMode: 'disambiguate',
    });
    expect(withPronoun.isCorrect).toBe(true);

    const unambiguous = evaluateSpokenConjugation('hablabas', tuHablabas, {
      spanishPronounMode: 'disambiguate',
    });
    expect(unambiguous.isCorrect).toBe(true);
  });

  it('detects Spanish stress/accent tense collisions (hablo vs. habló, hable vs. hablé)', () => {
    const elHablo = conjugateSpanish('hablar', 'preterito_indefinido', 2);
    const collision = evaluateSpokenConjugation('hablo', elHablo);
    expect(collision.isCorrect).toBe(false);
    expect(collision.matchType).toBe('wrong_stress_or_tense');
    expect(collision.shouldTriggerRepeat).toBe(true);

    const yoHablePreterite = conjugateSpanish('hablar', 'preterito_indefinido', 0);
    const collision2 = evaluateSpokenConjugation('hable', yoHablePreterite);
    expect(collision2.isCorrect).toBe(false);
    expect(collision2.matchType).toBe('wrong_stress_or_tense');
  });

  it('accepts both -ra and -se forms in Spanish Imperfect Subjunctive', () => {
    const subjImp = conjugateSpanish('tener', 'subjuntivo_imperfecto', 0);
    expect(evaluateSpokenConjugation('tuviera', subjImp).isCorrect).toBe(true);
    expect(evaluateSpokenConjugation('tuviese', subjImp).isCorrect).toBe(true);
    expect(evaluateSpokenConjugation('yo tuviera', subjImp).isCorrect).toBe(true);
  });

  it('handles Spanish ASR boundary fusions like "este México" for "es de México" and phonetic homophones', () => {
    const elEs = conjugateSpanish('ser', 'presente', 2);
    const deMexicoChunk = {
      id: 'es-de-mexico',
      target: 'de México',
      english: 'from Mexico',
    };

    // 1. Two-part mode where tail is optional or included ("este México" -> "es de México")
    expect(
      evaluateSpokenConjugation('este México', elEs, {
        expectedTailChunk: deMexicoChunk,
        requireTailInResponse: false,
      }).isCorrect
    ).toBe(true);

    // 2. Full-sentence mode where tail is required ("este México" / "él este México")
    expect(
      evaluateSpokenConjugation('este México', elEs, {
        expectedTailChunk: deMexicoChunk,
        requireTailInResponse: true,
      }).isCorrect
    ).toBe(true);
    expect(
      evaluateSpokenConjugation('él este mexico', elEs, {
        expectedTailChunk: deMexicoChunk,
        requireTailInResponse: true,
      }).isCorrect
    ).toBe(true);

    // 3. Step 2 chunk evaluation when user repeats the whole phrase ("es de México" heard as "este México")
    expect(evaluateSpokenChunk('este México', deMexicoChunk, 'es').isCorrect).toBe(true);
    expect(evaluateSpokenChunk('de Méjico', deMexicoChunk, 'es').isCorrect).toBe(true);

    // 4. Spanish phonetic equivalences (betacismo b/v, seseo c/s/z, yeísmo ll/y)
    const yoVoy = conjugateSpanish('ir', 'presente', 0);
    expect(evaluateSpokenConjugation('boy', yoVoy).isCorrect).toBe(true);

    const elHace = conjugateSpanish('hacer', 'presente', 2);
    expect(evaluateSpokenConjugation('ase', elHace).isCorrect).toBe(true);

    // 5. Gender/plural adjective inflections and natural intensifiers on tail chunks
    const yoEstoy = conjugateSpanish('estar', 'presente', 0);
    const cansadoChunk = {
      id: 'es-cansado',
      target: 'cansado',
      english: 'tired',
    };
    expect(
      evaluateSpokenConjugation('estoy cansada', yoEstoy, {
        expectedTailChunk: cansadoChunk,
        requireTailInResponse: true,
      }).isCorrect
    ).toBe(true);
    expect(
      evaluateSpokenConjugation('estoy muy cansada', yoEstoy, {
        expectedTailChunk: cansadoChunk,
        requireTailInResponse: true,
      }).isCorrect
    ).toBe(true);
  });
});
