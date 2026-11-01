import { describe, expect, it } from 'vitest';
import { conjugateFrench, FRENCH_LANGUAGE_PACK } from '../fr/conjugator';
import { conjugateSpanish, SPANISH_LANGUAGE_PACK } from '../es/conjugator';

describe('Phase 1 — French Conjugation Engine & Curriculum', () => {
  it('starts Tier 1 with the 6 Core Survival verbs', () => {
    const tier1 = FRENCH_LANGUAGE_PACK.verbs.filter((v) => v.tier === 1).map((v) => v.id);
    expect(tier1).toEqual(['etre', 'avoir', 'aller', 'faire', 'parler', 'finir']);
  });

  it('conjugates regular -er, -ir, and -re verbs in Present', () => {
    expect(conjugateFrench('parler', 'present', 0).fullForm).toBe('je parle');
    expect(conjugateFrench('parler', 'present', 3).fullForm).toBe('nous parlons');
    expect(conjugateFrench('finir', 'present', 3).fullForm).toBe('nous finissons');
    expect(conjugateFrench('finir', 'present', 5).fullForm).toBe('ils finissent');
    expect(conjugateFrench('attendre', 'present', 2).fullForm).toBe('il attend');
    expect(conjugateFrench('attendre', 'present', 4).fullForm).toBe('vous attendez');
  });

  it("handles French vowel elision (je -> j' and que il -> qu'il)", () => {
    const aimerJe = conjugateFrench('aimer', 'present', 0);
    expect(aimerJe.fullForm).toBe("j'aime");

    const avoirPC = conjugateFrench('parler', 'passe_compose', 0);
    expect(avoirPC.fullForm).toBe("j'ai parlé");

    const allerSubj = conjugateFrench('aller', 'subjonctif_present', 0);
    expect(allerSubj.fullForm).toBe("j'aille");
    expect(allerSubj.triggeredPhrase).toBe("Il faut que j'aille");

    const allerSubjIl = conjugateFrench('aller', 'subjonctif_present', 2);
    expect(allerSubjIl.triggeredPhrase).toBe("Il faut qu'il aille");
  });

  it('selects être vs. avoir accurately in compound tenses with plural agreement', () => {
    expect(conjugateFrench('parler', 'passe_compose', 3).fullForm).toBe('nous avons parlé');
    expect(conjugateFrench('aller', 'passe_compose', 0).fullForm).toBe('je suis allé');
    expect(conjugateFrench('aller', 'passe_compose', 3).fullForm).toBe('nous sommes allés');
    expect(conjugateFrench('venir', 'plus_que_parfait', 5).fullForm).toBe('ils étaient venus');
    expect(conjugateFrench('sortir', 'futur_anterieur', 3).fullForm).toBe('nous serons sortis');
    expect(conjugateFrench('partir', 'conditionnel_passe', 5).fullForm).toBe('ils seraient partis');
  });

  it('handles orthographic stem changes (-ger, -cer, acheter, appeler)', () => {
    expect(conjugateFrench('manger', 'present', 3).fullForm).toBe('nous mangeons');
    expect(conjugateFrench('manger', 'imparfait', 0).fullForm).toBe('je mangeais');
    expect(conjugateFrench('manger', 'imparfait', 3).fullForm).toBe('nous mangions');
    expect(conjugateFrench('commencer', 'present', 3).fullForm).toBe('nous commençons');
    expect(conjugateFrench('commencer', 'imparfait', 2).fullForm).toBe('il commençait');
    expect(conjugateFrench('acheter', 'present', 0).fullForm).toBe("j'achète");
    expect(conjugateFrench('acheter', 'futur_simple', 0).fullForm).toBe("j'achèterai");
    expect(conjugateFrench('appeler', 'present', 0).fullForm).toBe("j'appelle");
  });

  it('conjugates French Imperative forms and drops -s on tu for -er verbs', () => {
    expect(conjugateFrench('parler', 'imperatif', 1).verbForm).toBe('parle');
    expect(conjugateFrench('parler', 'imperatif', 3).verbForm).toBe('parlons');
    expect(conjugateFrench('aller', 'imperatif', 1).verbForm).toBe('va');
    expect(conjugateFrench('etre', 'imperatif', 1).verbForm).toBe('sois');
    expect(conjugateFrench('finir', 'imperatif', 1).verbForm).toBe('finis');
  });

  it('conjugates every verb in the French curriculum across all 12 tenses without error', () => {
    for (const verb of FRENCH_LANGUAGE_PACK.verbs) {
      for (const tense of FRENCH_LANGUAGE_PACK.tenses) {
        const results = FRENCH_LANGUAGE_PACK.conjugateAllPersons(verb.id, tense.id);
        expect(results.length).toBeGreaterThan(0);
        for (const r of results) {
          expect(r.verbForm.length).toBeGreaterThan(0);
          expect(r.triggeredPhrase.length).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('Phase 1 — Spanish Conjugation Engine & Curriculum', () => {
  it('starts Tier 1 with the 6 Core Survival verbs', () => {
    const tier1 = SPANISH_LANGUAGE_PACK.verbs.filter((v) => v.tier === 1).map((v) => v.id);
    expect(tier1).toEqual(['ser', 'estar', 'tener', 'ir', 'hacer', 'hablar']);
  });

  it('conjugates regular -ar, -er, and -ir verbs across Core tenses', () => {
    expect(conjugateSpanish('hablar', 'presente', 0).verbForm).toBe('hablo');
    expect(conjugateSpanish('hablar', 'presente', 4).verbForm).toBe('habláis');
    expect(conjugateSpanish('comer', 'preterito_indefinido', 2).verbForm).toBe('comió');
    expect(conjugateSpanish('vivir', 'preterito_imperfecto', 3).verbForm).toBe('vivíamos');
  });

  it('includes both bare pro-drop verb and pronoun+verb in acceptedForms', () => {
    const res = conjugateSpanish('hablar', 'presente', 1);
    expect(res.acceptedForms).toContain('hablas');
    expect(res.acceptedForms).toContain('tú hablas');
  });

  it('handles boot stem changes (e->ie, o->ue, e->i) and preterite/subjunctive shifts', () => {
    expect(conjugateSpanish('pensar', 'presente', 0).verbForm).toBe('pienso');
    expect(conjugateSpanish('pensar', 'presente', 3).verbForm).toBe('pensamos');
    expect(conjugateSpanish('dormir', 'presente', 0).verbForm).toBe('duermo');
    expect(conjugateSpanish('dormir', 'preterito_indefinido', 2).verbForm).toBe('durmió');
    expect(conjugateSpanish('dormir', 'subjuntivo_presente', 3).verbForm).toBe('durmamos');
    expect(conjugateSpanish('dormir', 'subjuntivo_imperfecto', 0).verbForm).toBe('durmiera');
    expect(conjugateSpanish('pedir', 'presente', 0).verbForm).toBe('pido');
    expect(conjugateSpanish('pedir', 'preterito_indefinido', 5).verbForm).toBe('pidieron');
  });

  it('handles orthographic shifts (-car, -gar, -zar) before e', () => {
    expect(conjugateSpanish('buscar', 'preterito_indefinido', 0).verbForm).toBe('busqué');
    expect(conjugateSpanish('llegar', 'preterito_indefinido', 0).verbForm).toBe('llegué');
    expect(conjugateSpanish('empezar', 'preterito_indefinido', 0).verbForm).toBe('empecé');
    expect(conjugateSpanish('empezar', 'subjuntivo_presente', 0).verbForm).toBe('empiece');
  });

  it('builds compound tenses with haber and irregular past participles', () => {
    expect(conjugateSpanish('hacer', 'preterito_perfecto', 0).verbForm).toBe('he hecho');
    expect(conjugateSpanish('escribir', 'pluscuamperfecto', 3).verbForm).toBe('habíamos escrito');
    expect(conjugateSpanish('decir', 'futuro_compuesto', 1).verbForm).toBe('habrás dicho');
    expect(conjugateSpanish('poner', 'condicional_compuesto', 2).verbForm).toBe('habría puesto');
    expect(conjugateSpanish('volver', 'subjuntivo_perfecto', 5).verbForm).toBe('hayan vuelto');
    expect(conjugateSpanish('abrir', 'subjuntivo_pluscuamperfecto', 0).verbForm).toBe('hubiera abierto');
  });

  it('conjugates Affirmative and Negative Imperatives accurately', () => {
    expect(conjugateSpanish('hablar', 'imperativo_afirmativo', 1).verbForm).toBe('habla');
    expect(conjugateSpanish('hablar', 'imperativo_negativo', 1).verbForm).toBe('no hables');
    expect(conjugateSpanish('hacer', 'imperativo_afirmativo', 1).verbForm).toBe('haz');
    expect(conjugateSpanish('hacer', 'imperativo_negativo', 1).verbForm).toBe('no hagas');
    expect(conjugateSpanish('tener', 'imperativo_afirmativo', 4).verbForm).toBe('tened');
  });

  it('conjugates every verb in the Spanish curriculum across all 16 tenses without error', () => {
    for (const verb of SPANISH_LANGUAGE_PACK.verbs) {
      for (const tense of SPANISH_LANGUAGE_PACK.tenses) {
        const results = SPANISH_LANGUAGE_PACK.conjugateAllPersons(verb.id, tense.id);
        expect(results.length).toBeGreaterThan(0);
        for (const r of results) {
          expect(r.verbForm.length).toBeGreaterThan(0);
          expect(r.triggeredPhrase.length).toBeGreaterThan(0);
        }
      }
    }
  });
});
