import { describe, expect, it } from 'vitest';
import { RassiasDrillDirector } from '../drillDirector';

describe('Phase 3 & 3.5 — Rassias Drill Director, Ping-Pong Negation & Question-Answer Flip', () => {
  it('runs Substitution Drill across all 6 persons for a single verb before rotating', () => {
    const director = new RassiasDrillDirector({
      language: 'fr',
      activeVerbIds: ['parler', 'finir'],
      activeTenseIds: ['present'],
      cadence: 'substitution',
      includeVosotros: true,
      useNaturalTriggers: true,
    });

    const personsSeen: number[] = [];
    for (let i = 0; i < 6; i++) {
      const card = director.nextPrompt();
      expect(card.verbId).toBe('parler');
      personsSeen.push(card.person);
    }
    expect(personsSeen).toEqual([0, 1, 2, 3, 4, 5]);

    const seventh = director.nextPrompt();
    expect(seventh.verbId).toBe('finir');
    expect(seventh.person).toBe(0);
  });

  it('runs 2-Beat Ping-Pong Negation (Affirmative on Beat 1 -> Immediate Negative Flip on Beat 2)', () => {
    const director = new RassiasDrillDirector({
      language: 'fr',
      activeVerbIds: ['parler'],
      activeTenseIds: ['passe_compose'],
      cadence: 'substitution',
      polarityMode: 'ping_pong',
      enableNegativeAdverbs: true,
      includeVosotros: true,
      useNaturalTriggers: true,
    });

    // Beat 1: Affirmative ("j'ai parlé")
    const beat1 = director.nextPrompt();
    expect(beat1.person).toBe(0);
    expect(beat1.negation).toBe('none');
    expect(beat1.target.fullForm).toBe("j'ai parlé");

    const res1 = director.submitResponse("j'ai parlé");
    expect(res1.evaluation.isCorrect).toBe(true);

    // Beat 2: Automatically keeps person 0 & passe_compose, flipping immediately to Negative ("je n'ai pas parlé")!
    const beat2 = director.nextPrompt();
    expect(beat2.person).toBe(0);
    expect(beat2.isPingPongSecondBeat).toBe(true);
    expect(beat2.negation).toBe('pas');
    expect(beat2.target.fullForm).toBe("je n'ai pas parlé");

    const res2 = director.submitResponse("je n'ai pas parlé");
    expect(res2.evaluation.isCorrect).toBe(true);

    // Next Beat 1 advances to person 1 (tu)
    const nextBeat1 = director.nextPrompt();
    expect(nextBeat1.person).toBe(1);
    expect(nextBeat1.negation).toBe('none');
  });

  it('builds Question <-> Answer Flip prompts with Tu/Monsieur-Vous -> Je and Vous tous -> Nous disambiguation', () => {
    const director = new RassiasDrillDirector({
      language: 'fr',
      activeVerbIds: ['partir'],
      activeTenseIds: ['present'],
      cadence: 'qa_flip',
      polarityMode: 'affirmative',
      includeVosotros: true,
      useNaturalTriggers: true,
    });

    // Person 0 (answer: je pars) -> Question asks with 'tu' ("Aujourd'hui, tu pars ?")
    const qaJe = director.nextPrompt();
    expect(qaJe.person).toBe(0);
    expect(qaJe.qaMetadata).toBeDefined();
    expect(qaJe.qaMetadata?.questionPromptDisplay).toContain('tu pars');
    expect(director.submitResponse('Oui, je pars').evaluation.isCorrect).toBe(true);

    // Step through to person 3 (answer: nous partons) -> Question disambiguates with "Vous tous, ... vous partez ?"
    director.nextPrompt(); // person 1
    director.nextPrompt(); // person 2
    const qaNous = director.nextPrompt(); // person 3
    expect(qaNous.person).toBe(3);
    expect(qaNous.qaMetadata?.questionPromptDisplay).toContain('Vous tous,');
    expect(qaNous.qaMetadata?.questionPromptDisplay).toContain('vous partez');
  });

  it('skips vosotros (person 4) in Spanish when includeVosotros is false', () => {
    const director = new RassiasDrillDirector({
      language: 'es',
      activeVerbIds: ['hablar'],
      activeTenseIds: ['presente'],
      cadence: 'substitution',
      includeVosotros: false,
      useNaturalTriggers: true,
    });

    const personsSeen: number[] = [];
    for (let i = 0; i < 5; i++) {
      personsSeen.push(director.nextPrompt().person);
    }
    expect(personsSeen).toEqual([0, 1, 2, 3, 5]);
    expect(personsSeen).not.toContain(4);
  });

  it('enters the "Répétez !" correction loop on a mistake and requires repeating the right form', () => {
    const director = new RassiasDrillDirector({
      language: 'fr',
      activeVerbIds: ['aller'],
      activeTenseIds: ['present'],
      cadence: 'substitution',
      includeVosotros: true,
      useNaturalTriggers: true,
    });

    const card = director.nextPrompt();
    expect(card.target.fullForm).toBe('je vais');

    const firstAttempt = director.submitResponse('je alle');
    expect(firstAttempt.evaluation.isCorrect).toBe(false);
    expect(firstAttempt.enteredRepeatLoop).toBe(true);
    expect(firstAttempt.queuedBoomerang).toBe(true);
    expect(director.isInRepeatLoop()).toBe(true);

    const repeatAttempt = director.submitResponse('je vais');
    expect(repeatAttempt.evaluation.isCorrect).toBe(true);
    expect(repeatAttempt.completedRepeatLoop).toBe(true);
    expect(director.isInRepeatLoop()).toBe(false);
  });

  it('boomerangs a missed conjugation back 3 prompts later', () => {
    const director = new RassiasDrillDirector({
      language: 'es',
      activeVerbIds: ['tener'],
      activeTenseIds: ['presente'],
      cadence: 'substitution',
      includeVosotros: false,
      useNaturalTriggers: true,
    });

    const p1 = director.nextPrompt();
    expect(p1.person).toBe(0);
    director.submitResponse('yo teno');
    director.submitResponse('tengo');

    const p2 = director.nextPrompt();
    expect(p2.person).toBe(1);
    expect(p2.isBoomerang).toBe(false);

    const p3 = director.nextPrompt();
    expect(p3.person).toBe(2);
    expect(p3.isBoomerang).toBe(false);

    const p4 = director.nextPrompt();
    expect(p4.person).toBe(0);
    expect(p4.verbId).toBe('tener');
    expect(p4.isBoomerang).toBe(true);
  });
});
