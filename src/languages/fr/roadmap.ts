import { SubModuleConfig } from '../types';

export const FRENCH_ROADMAP: SubModuleConfig[] = [
  // ============================================================================
  // PHASE 1: PRESENT TENSE FOUNDATIONS (present)
  // ============================================================================
  {
    id: 'fr-1.1',
    phase: 1,
    phaseTitle: 'Phase 1: Present Tense Foundations',
    title: 'Core Auxiliaries & Motion (être, avoir, aller)',
    newVerbIds: ['etre', 'avoir', 'aller'],
    newTenseIds: ['present'],
    newChunks: [
      { id: 'fr-en-retard', target: 'en retard', english: 'late', attachToVerbIds: ['etre'] },
      { id: 'fr-a-l-heure', target: "à l'heure", english: 'on time', attachToVerbIds: ['etre'] },
      { id: 'fr-a-la-maison', target: 'à la maison', english: 'at home', attachToVerbIds: ['etre', 'aller'] },
      { id: 'fr-au-travail', target: 'au travail', english: 'to work', attachToVerbIds: ['aller', 'etre'] },
      { id: 'fr-faim', target: 'faim', english: 'hungry (avoir faim)', attachToVerbIds: ['avoir'] },
      { id: 'fr-besoin-d-aide', target: "besoin d'aide", english: 'need help (avoir besoin de)', attachToVerbIds: ['avoir'] },
      { id: 'fr-bien', target: 'très bien', english: 'very well', attachToVerbIds: ['aller', 'etre'] },
    ],
    recommendedCadence: 'substitution',
    recommendedPolarity: 'ping_pong',
    recommendedTimerSeconds: 6,
    requiredPasses: 2,
    earRule:
      'Hear the mandatory /z/ liaison in nous avons, vous avez, vous êtes, ils ont (/nu.za.vɔ̃/, /vu.zɛt/, /il.zɔ̃/), contrasted with crisp /s/ in ils sont (/il.sɔ̃/).',
    starterDialogue: [
      {
        speaker: 'A',
        speakerName: 'Luc',
        target: 'Salut Camille ! Tu es à la maison maintenant ?',
        english: 'Hi Camille! Are you at home right now?',
      },
      {
        speaker: 'B',
        speakerName: 'Camille',
        target: 'Non, je ne suis pas à la maison. Je vais au travail et je suis en retard !',
        english: 'No, I am not at home. I am going to work and I am late!',
        audioTip: 'Notice how "je ne suis pas" flows rapidly as /ʒən.sɥi.pa/.',
      },
      {
        speaker: 'A',
        speakerName: 'Luc',
        target: 'Est-ce que vous avez faim, Paul et toi ?',
        english: 'Are you and Paul hungry?',
        audioTip: 'Link vous_avez with a voiced /z/ sound: /vu.za.ve/.',
      },
      {
        speaker: 'B',
        speakerName: 'Camille',
        target: "Oui, nous avons très faim, mais nous n'avons pas le temps.",
        english: 'Yes, we are very hungry, but we do not have time.',
      },
      {
        speaker: 'A',
        speakerName: 'Luc',
        target: "Tu n'es pas à l'heure aujourd'hui ?",
        english: 'Are you not on time today?',
      },
      {
        speaker: 'B',
        speakerName: 'Camille',
        target: "Si, je vais très bien, mais j'ai besoin d'aide ce matin !",
        english: 'Yes I am doing fine, but I need help this morning!',
      },
    ],
  },
  {
    id: 'fr-1.2',
    phase: 1,
    phaseTitle: 'Phase 1: Present Tense Foundations',
    title: 'Action & Regular Group 1 (-er) and Group 2 (-ir) Archetypes',
    newVerbIds: ['faire', 'parler', 'finir'],
    newTenseIds: [],
    newChunks: [
      { id: 'fr-attention', target: 'attention', english: 'careful (faire attention)', attachToVerbIds: ['faire'] },
      { id: 'fr-du-sport', target: 'du sport', english: 'sports', attachToVerbIds: ['faire'] },
      { id: 'fr-francais', target: 'français', english: 'French', attachToVerbIds: ['parler'] },
      { id: 'fr-avec-toi', target: 'avec toi', english: 'with you', attachToVerbIds: ['parler', 'aller', 'faire'] },
      { id: 'fr-le-travail', target: 'le travail', english: 'the work', attachToVerbIds: ['finir', 'faire'] },
      { id: 'fr-bientot', target: 'bientôt', english: 'soon', attachToVerbIds: ['finir', 'aller'] },
    ],
    recommendedCadence: 'qa_flip',
    recommendedPolarity: 'ping_pong',
    recommendedTimerSeconds: 4,
    requiredPasses: 2,
    earRule:
      'In Group 1 -er verbs (parler), 4 of the 6 persons (je, tu, il, ils) sound 100% identical (/paʁl/). Group 2 -ir verbs (finir) insert -iss- in the plural (nous finissons, ils finissent).',
    starterDialogue: [
      {
        speaker: 'A',
        speakerName: 'Luc',
        target: "Qu'est-ce que vous faites aujourd'hui ? Vous finissez le travail bientôt ?",
        english: 'What are you doing today? Are you finishing work soon?',
      },
      {
        speaker: 'B',
        speakerName: 'Camille',
        target: 'Oui, nous finissons bientôt et après nous faisons du sport.',
        english: 'Yes, we are finishing soon and afterwards we are playing sports.',
      },
      {
        speaker: 'A',
        speakerName: 'Luc',
        target: 'Tu parles français avec tes collègues au travail ?',
        english: 'Do you speak French with your colleagues at work?',
      },
      {
        speaker: 'B',
        speakerName: 'Camille',
        target: 'Oui, je parle français tous les jours et je fais très attention !',
        english: 'Yes, I speak French every day and I pay close attention!',
      },
    ],
  },
  {
    id: 'fr-1.3',
    phase: 1,
    phaseTitle: 'Phase 1: Present Tense Foundations',
    title: 'Group 1 Vowel Elision & Group 2 Expansion',
    newVerbIds: ['aimer', 'donner', 'trouver', 'choisir', 'reussir'],
    newTenseIds: [],
    newChunks: [
      { id: 'fr-beaucoup-ca', target: 'beaucoup ça', english: 'that a lot', attachToVerbIds: ['aimer'] },
      { id: 'fr-un-cadeau', target: 'un cadeau', english: 'a gift', attachToVerbIds: ['donner', 'choisir'] },
      { id: 'fr-la-reponse', target: 'la réponse', english: 'the answer', attachToVerbIds: ['trouver', 'donner'] },
      { id: 'fr-le-bon-chemin', target: 'le bon chemin', english: 'the right way', attachToVerbIds: ['trouver', 'choisir'] },
      { id: 'fr-a-chaque-fois', target: 'à chaque fois', english: 'every time', attachToVerbIds: ['reussir'] },
    ],
    recommendedCadence: 'qa_flip',
    recommendedPolarity: 'mixed',
    recommendedTimerSeconds: 4,
    requiredPasses: 2,
    earRule:
      "Before a vowel (aimer), je contracts to j'aime (/ʒɛm/), and in negative je n'aime pas, the n' attaches directly to the vowel (/ʒə.nɛm.pa/).",
  },
  {
    id: 'fr-1.4',
    phase: 1,
    phaseTitle: 'Phase 1: Present Tense Foundations',
    title: 'Regular Group 3 -dre Verbs',
    newVerbIds: ['attendre', 'vendre', 'entendre'],
    newTenseIds: [],
    newChunks: [
      { id: 'fr-le-bus', target: 'le bus', english: 'the bus', attachToVerbIds: ['attendre'] },
      { id: 'fr-depuis-longtemps', target: 'depuis longtemps', english: 'for a long time', attachToVerbIds: ['attendre'] },
      { id: 'fr-la-voiture', target: 'la voiture', english: 'the car', attachToVerbIds: ['vendre'] },
      { id: 'fr-un-bruit', target: 'un bruit', english: 'a noise', attachToVerbIds: ['entendre'] },
    ],
    recommendedCadence: 'roulette',
    recommendedPolarity: 'mixed',
    recommendedTimerSeconds: 4,
    requiredPasses: 2,
    earRule:
      'Singular -dre forms drop the final d sound (/a.tɑ̃/), while plural forms bring the /d/ consonant back clearly (nous attendons, ils attendent -> /il.za.tɑ̃d/).',
  },

  // ============================================================================
  // PHASE 2: NEAR FUTURE (futur_proche) & HIGH-FREQUENCY MODALS
  // ============================================================================
  {
    id: 'fr-2.1',
    phase: 2,
    phaseTitle: 'Phase 2: Near Future & High-Frequency Modals',
    title: 'Immediate Future (aller + infinitif)',
    newVerbIds: [],
    newTenseIds: ['futur_proche'],
    focusVerbIdsOverride: ['parler', 'finir', 'faire', 'aller', 'aimer', 'donner', 'trouver', 'attendre'],
    focusTenseIdsOverride: ['present', 'futur_proche'],
    newChunks: [
      { id: 'fr-ce-soir', target: 'ce soir', english: 'tonight', attachToVerbIds: ['parler', 'finir', 'faire', 'aller'] },
      { id: 'fr-demain-matin', target: 'demain matin', english: 'tomorrow morning', attachToVerbIds: ['aller', 'faire', 'finir'] },
      { id: 'fr-tout-de-suite', target: 'tout de suite', english: 'right away', attachToVerbIds: ['trouver', 'donner', 'aller'] },
      { id: 'fr-plus-tard', target: 'plus tard', english: 'later', attachToVerbIds: ['parler', 'attendre'] },
    ],
    recommendedCadence: 'transformation',
    recommendedPolarity: 'ping_pong',
    recommendedTimerSeconds: 4,
    requiredPasses: 2,
    earRule:
      'In negative Futur Proche, ne ... pas hugs the conjugated auxiliary aller BEFORE the infinitive: Je ne vais pas parler ("Je n\'vais pas parler").',
  },
  {
    id: 'fr-2.2',
    phase: 2,
    phaseTitle: 'Phase 2: Near Future & High-Frequency Modals',
    title: 'Core Modals (pouvoir, vouloir, devoir, savoir)',
    newVerbIds: ['pouvoir', 'vouloir', 'devoir', 'savoir'],
    newTenseIds: [],
    newChunks: [
      { id: 'fr-venir-avec-nous', target: 'venir avec nous', english: 'come with us', attachToVerbIds: ['pouvoir', 'vouloir', 'devoir'] },
      { id: 'fr-comment-faire', target: 'comment faire', english: 'how to do it', attachToVerbIds: ['savoir'] },
      { id: 'fr-rester-ici', target: 'rester ici', english: 'stay here', attachToVerbIds: ['pouvoir', 'vouloir', 'devoir'] },
      { id: 'fr-tout-ca', target: 'tout ça', english: 'all that', attachToVerbIds: ['savoir', 'vouloir'] },
    ],
    recommendedCadence: 'qa_flip',
    recommendedPolarity: 'ping_pong',
    recommendedTimerSeconds: 4,
    requiredPasses: 2,
    earRule:
      'Listen to the vowel shift between stressed singular/3rd-plural (peux/peuvent, veux/veulent, dois/doivent) and unstressed nous/vous (pouvons, voulons, devons).',
  },
  {
    id: 'fr-2.3',
    phase: 2,
    phaseTitle: 'Phase 2: Near Future & High-Frequency Modals',
    title: 'Essential Irregulars (venir, prendre, voir, dire, mettre, sortir)',
    newVerbIds: ['venir', 'prendre', 'voir', 'dire', 'mettre', 'sortir'],
    newTenseIds: [],
    newChunks: [
      { id: 'fr-le-train', target: 'le train', english: 'the train', attachToVerbIds: ['prendre', 'voir', 'attendre'] },
      { id: 'fr-la-verite', target: 'la vérité', english: 'the truth', attachToVerbIds: ['dire', 'savoir'] },
      { id: 'fr-la-table', target: 'la table', english: 'the table', attachToVerbIds: ['mettre'] },
      { id: 'fr-ensemble', target: 'ensemble', english: 'together', attachToVerbIds: ['sortir', 'venir', 'partir'] },
    ],
    recommendedCadence: 'roulette',
    recommendedPolarity: 'mixed',
    recommendedTimerSeconds: 4,
    requiredPasses: 2,
    earRule:
      'Watch out for vous dites—joining vous êtes and vous faites as the 3 everyday verbs ending in -tes instead of -ez! Hear the nasal vowel in je viens (/vjɛ̃/) vs. ils viennent (/vjɛn/).',
  },

  // ============================================================================
  // PHASE 3: CONVERSATIONAL PAST (passe_compose)
  // ============================================================================
  {
    id: 'fr-3.1',
    phase: 3,
    phaseTitle: 'Phase 3: Conversational Past (Passé Composé)',
    title: 'Passé Composé with avoir (Regular Participles First)',
    newVerbIds: [],
    newTenseIds: ['passe_compose'],
    focusVerbIdsOverride: ['parler', 'aimer', 'donner', 'trouver', 'finir', 'choisir', 'reussir', 'attendre', 'vendre', 'entendre'],
    focusTenseIdsOverride: ['present', 'passe_compose'],
    newChunks: [
      { id: 'fr-hier-soir', target: 'hier soir', english: 'last night', attachToVerbIds: ['parler', 'finir', 'attendre'] },
      { id: 'fr-deja', target: 'déjà', english: 'already', attachToVerbIds: ['choisir', 'trouver', 'donner'] },
      { id: 'fr-la-semaine-derniere', target: 'la semaine dernière', english: 'last week', attachToVerbIds: ['vendre', 'reussir'] },
    ],
    recommendedCadence: 'transformation',
    recommendedPolarity: 'ping_pong',
    recommendedTimerSeconds: 4,
    requiredPasses: 2,
    earRule:
      "For Group 1 -er verbs, parlato/parlé (/paʁ.le/) sounds 100% identical to the infinitive parler! Your ear relies on the auxiliary j'ai / tu as / il a to hear the past tense.",
  },
  {
    id: 'fr-3.2',
    phase: 3,
    phaseTitle: 'Phase 3: Conversational Past (Passé Composé)',
    title: 'Passé Composé: Irregular Participles & être Motion Verbs',
    newVerbIds: [],
    newTenseIds: [],
    focusVerbIdsOverride: ['etre', 'avoir', 'faire', 'prendre', 'voir', 'dire', 'mettre', 'pouvoir', 'vouloir', 'devoir', 'savoir', 'aller', 'venir', 'sortir'],
    focusTenseIdsOverride: ['passe_compose'],
    newChunks: [
      { id: 'fr-toute-la-journee', target: 'toute la journée', english: 'all day', attachToVerbIds: ['etre', 'faire', 'attendre'] },
      { id: 'fr-chez-moi', target: 'chez moi', english: 'to/at my place', attachToVerbIds: ['aller', 'venir', 'sortir'] },
    ],
    recommendedCadence: 'qa_flip',
    recommendedPolarity: 'mixed',
    recommendedTimerSeconds: 4,
    requiredPasses: 2,
    earRule:
      'Motion verbs (aller, venir, sortir, partir) use ÊTRE as their auxiliary (je suis allé, nous sommes venus), while modals/transitives use short -u/-is/-it participles (eu, pu, voulu, dû, su, vu, pris, mis, dit, fait).',
  },

  // ============================================================================
  // PHASE 4: THE IMPERFECT (imparfait) & TIER 4 STEM/SPELLING VERBS
  // ============================================================================
  {
    id: 'fr-4.1',
    phase: 4,
    phaseTitle: 'Phase 4: The Imperfect & Stem/Spelling Verbs',
    title: 'Imparfait (Autrefois...) & Past Contrast',
    newVerbIds: [],
    newTenseIds: ['imparfait'],
    focusVerbIdsOverride: ['etre', 'avoir', 'aller', 'faire', 'parler', 'finir', 'pouvoir', 'vouloir', 'venir', 'prendre', 'voir'],
    focusTenseIdsOverride: ['passe_compose', 'imparfait'],
    newChunks: [
      { id: 'fr-quand-j-etais-jeune', target: "quand j'étais jeune", english: 'when I was young', attachToVerbIds: ['avoir', 'aller', 'faire', 'aimer'] },
      { id: 'fr-autrefois', target: 'autrefois', english: 'in the old days', attachToVerbIds: ['etre', 'vivre', 'parler'] },
      { id: 'fr-tous-les-jours', target: 'tous les jours', english: 'every day', attachToVerbIds: ['faire', 'aller', 'venir', 'prendre'] },
    ],
    recommendedCadence: 'transformation',
    recommendedPolarity: 'ping_pong',
    recommendedTimerSeconds: 4,
    requiredPasses: 2,
    earRule:
      'Take the nous present stem (parlons -> parl-, finissons -> finiss-, faisons -> fais-) and add /ɛ/ (-ais, -ais, -ait, -aient all sound 100% identical!). Only être has an irregular stem (ét-).',
  },
  {
    id: 'fr-4.2',
    phase: 4,
    phaseTitle: 'Phase 4: The Imperfect & Stem/Spelling Verbs',
    title: 'Spelling & Stem-Changing -er Verbs',
    newVerbIds: ['manger', 'commencer', 'acheter', 'appeler', 'jeter', 'payer', 'envoyer'],
    newTenseIds: [],
    focusTenseIdsOverride: ['present', 'passe_compose', 'imparfait'],
    newChunks: [
      { id: 'fr-au-restaurant', target: 'au restaurant', english: 'at the restaurant', attachToVerbIds: ['manger', 'payer'] },
      { id: 'fr-le-diner', target: 'le dîner', english: 'dinner', attachToVerbIds: ['manger', 'commencer', 'payer'] },
      { id: 'fr-du-pain', target: 'du pain', english: 'bread', attachToVerbIds: ['acheter', 'manger'] },
      { id: 'fr-un-message', target: 'un message', english: 'a message', attachToVerbIds: ['envoyer'] },
    ],
    recommendedCadence: 'qa_flip',
    recommendedPolarity: 'mixed',
    recommendedTimerSeconds: 4,
    requiredPasses: 2,
    earRule:
      'Hear the vowel open from /ə/ (nous achetons, nous appelons) to wide /ɛ/ when stressed (j\'achète, j\'appelle, je jette).',
  },
  {
    id: 'fr-4.3',
    phase: 4,
    phaseTitle: 'Phase 4: The Imperfect & Stem/Spelling Verbs',
    title: 'Reading, Writing, Drinking & Knowing (Completes Tier 4)',
    newVerbIds: ['boire', 'croire', 'connaitre', 'lire', 'ecrire'],
    newTenseIds: [],
    focusTenseIdsOverride: ['present', 'passe_compose', 'imparfait'],
    newChunks: [
      { id: 'fr-un-verre-d-eau', target: "un verre d'eau", english: 'a glass of water', attachToVerbIds: ['boire'] },
      { id: 'fr-cette-histoire', target: 'cette histoire', english: 'this story', attachToVerbIds: ['croire', 'lire', 'ecrire', 'connaitre'] },
      { id: 'fr-ce-quartier', target: 'ce quartier', english: 'this neighborhood', attachToVerbIds: ['connaitre'] },
    ],
    recommendedCadence: 'transformation',
    recommendedPolarity: 'mixed',
    recommendedTimerSeconds: 4,
    requiredPasses: 2,
    earRule:
      'Group their short -u past participles together in your ear: bu, cru, connu, lu (plus écrit).',
  },

  // ============================================================================
  // PHASE 5: TIER 5 CONVERSATIONAL EXPANSION (COMPLETES ALL 46 VERBS!)
  // ============================================================================
  {
    id: 'fr-5.1',
    phase: 5,
    phaseTitle: 'Phase 5: Conversational Expansion (All 46 Verbs)',
    title: 'Leaving, Sleeping, Opening & Receiving',
    newVerbIds: ['partir', 'dormir', 'ouvrir', 'recevoir', 'vivre'],
    newTenseIds: [],
    focusTenseIdsOverride: ['present', 'passe_compose', 'imparfait'],
    newChunks: [
      { id: 'fr-en-vacances', target: 'en vacances', english: 'on vacation', attachToVerbIds: ['partir', 'etre'] },
      { id: 'fr-huit-heures', target: 'huit heures', english: 'eight hours', attachToVerbIds: ['dormir'] },
      { id: 'fr-la-porte', target: 'la porte', english: 'the door', attachToVerbIds: ['ouvrir'] },
      { id: 'fr-une-lettre', target: 'une lettre', english: 'a letter', attachToVerbIds: ['recevoir', 'ecrire', 'lire'] },
      { id: 'fr-a-lyon', target: 'à Lyon', english: 'in Lyon', attachToVerbIds: ['vivre', 'partir'] },
    ],
    recommendedCadence: 'qa_flip',
    recommendedPolarity: 'ping_pong',
    recommendedTimerSeconds: 4,
    requiredPasses: 2,
    earRule:
      'ouvrir is an -ir verb that conjugates in the present just like a Group 1 -er verb (j\'ouvre, tu ouvres), with participle ouvert. partir takes être in the past (je suis parti).',
  },
  {
    id: 'fr-5.2',
    phase: 5,
    phaseTitle: 'Phase 5: Conversational Expansion (All 46 Verbs)',
    title: 'Following, Running, Holding & Understanding',
    newVerbIds: ['suivre', 'courir', 'tenir', 'comprendre', 'apprendre'],
    newTenseIds: [],
    focusTenseIdsOverride: ['present', 'passe_compose', 'imparfait'],
    newChunks: [
      { id: 'fr-le-cours', target: 'le cours', english: 'the course / class', attachToVerbIds: ['suivre', 'comprendre'] },
      { id: 'fr-tres-vite', target: 'très vite', english: 'very fast', attachToVerbIds: ['courir', 'apprendre', 'comprendre'] },
      { id: 'fr-la-porte-ouverte', target: 'la porte ouverte', english: 'the door open', attachToVerbIds: ['tenir'] },
    ],
    recommendedCadence: 'roulette',
    recommendedPolarity: 'mixed',
    recommendedTimerSeconds: 4,
    requiredPasses: 2,
    earRule:
      'tenir mirrors venir (je tiens / j\'ai tenu); comprendre and apprendre mirror prendre (j\'ai compris / j\'ai appris).',
  },

  // ============================================================================
  // PHASE 6: FUTURE, CONDITIONAL, COMMANDS & SUBJUNCTIVE
  // ============================================================================
  {
    id: 'fr-6.1',
    phase: 6,
    phaseTitle: 'Phase 6: Future, Conditional, Commands & Subjunctive',
    title: 'Simple Future (Demain...)',
    newVerbIds: [],
    newTenseIds: ['futur_simple'],
    focusTenseIdsOverride: ['present', 'futur_simple'],
    newChunks: [
      { id: 'fr-demain', target: 'demain', english: 'tomorrow', attachToVerbIds: ['aller', 'faire', 'voir', 'venir'] },
      { id: 'fr-la-semaine-prochaine', target: 'la semaine prochaine', english: 'next week', attachToVerbIds: ['partir', 'commencer', 'finir'] },
      { id: 'fr-un-jour', target: 'un jour', english: 'one day', attachToVerbIds: ['etre', 'avoir', 'savoir', 'pouvoir'] },
    ],
    recommendedCadence: 'transformation',
    recommendedPolarity: 'ping_pong',
    recommendedTimerSeconds: 4,
    requiredPasses: 2,
    earRule:
      'Every verb in French uses the -r- stem + avoir present endings (-ai, -as, -a, -ons, -ez, -ont), including irregular stems ser-, aur-, ir-, fer-, pourr-, voudr-, devr-, saur-, viendr-, verr-, enverr-.',
  },
  {
    id: 'fr-6.2',
    phase: 6,
    phaseTitle: 'Phase 6: Future, Conditional, Commands & Subjunctive',
    title: "Present Conditional (Si c'était possible...)",
    newVerbIds: [],
    newTenseIds: ['conditionnel_present'],
    focusTenseIdsOverride: ['futur_simple', 'conditionnel_present'],
    newChunks: [
      { id: 'fr-a-ta-place', target: 'à ta place', english: 'in your place', attachToVerbIds: ['faire', 'dire', 'aller', 'prendre'] },
      { id: 'fr-volontiers', target: 'volontiers', english: 'gladly', attachToVerbIds: ['venir', 'accepter', 'boire'] },
    ],
    recommendedCadence: 'qa_flip',
    recommendedPolarity: 'ping_pong',
    recommendedTimerSeconds: 4,
    requiredPasses: 2,
    earRule:
      'Zero new stems to learn! Take the exact Future -r- stem (parler-, voudr-, ir-, fer-) and attach the Imperfect /ɛ/ endings (je parlerais, je voudrais, j\'irais).',
  },
  {
    id: 'fr-6.3',
    phase: 6,
    phaseTitle: 'Phase 6: Future, Conditional, Commands & Subjunctive',
    title: 'Imperative Commands (Maintenant !)',
    newVerbIds: [],
    newTenseIds: ['imperatif'],
    focusVerbIdsOverride: ['parler', 'finir', 'attendre', 'aller', 'faire', 'prendre', 'venir', 'etre', 'avoir', 'savoir', 'ouvrir'],
    focusTenseIdsOverride: ['imperatif'],
    newChunks: [
      { id: 'fr-s-il-te-plait', target: "s'il te plaît", english: 'please', attachToVerbIds: ['parler', 'attendre', 'venir', 'ouvrir'] },
      { id: 'fr-sans-attendre', target: 'sans attendre', english: 'without waiting', attachToVerbIds: ['aller', 'faire', 'partir'] },
    ],
    recommendedCadence: 'substitution',
    recommendedPolarity: 'ping_pong',
    recommendedTimerSeconds: 4,
    requiredPasses: 2,
    earRule:
      'Spoken without subject pronouns for tu, nous, and vous (Parle ! Parlons ! Parlez ! / Ne parle pas !), plus the 4 key irregulars: sois, aie, sache, va.',
  },
  {
    id: 'fr-6.4',
    phase: 6,
    phaseTitle: 'Phase 6: Future, Conditional, Commands & Subjunctive',
    title: 'Present Subjunctive (Il faut que...)',
    newVerbIds: [],
    newTenseIds: ['subjonctif_present'],
    focusTenseIdsOverride: ['present', 'subjonctif_present'],
    newChunks: [
      { id: 'fr-a-l-heure-subj', target: "à l'heure", english: 'on time', attachToVerbIds: ['etre', 'partir', 'venir'] },
      { id: 'fr-une-decision', target: 'une décision', english: 'a decision', attachToVerbIds: ['prendre', 'faire'] },
    ],
    recommendedCadence: 'transformation',
    recommendedPolarity: 'ping_pong',
    recommendedTimerSeconds: 4,
    requiredPasses: 2,
    earRule:
      'Built from the ils present stem (ils prennent -> que je prenne, ils viennent -> que je vienne), plus the 7 high-frequency irregulars: sois, aie, aille, fasse, puisse, sache, veuille.',
  },

  // ============================================================================
  // PHASE 7: COMPOUND MASTERY
  // ============================================================================
  {
    id: 'fr-7.1',
    phase: 7,
    phaseTitle: 'Phase 7: Compound Mastery',
    title: "Plus-que-parfait (Avant cela, j'avais / j'étais...)",
    newVerbIds: [],
    newTenseIds: ['plus_que_parfait'],
    focusTenseIdsOverride: ['passe_compose', 'plus_que_parfait'],
    newChunks: [
      { id: 'fr-avant-cela', target: 'avant cela', english: 'before that', attachToVerbIds: ['finir', 'partir', 'voir', 'dire'] },
    ],
    recommendedCadence: 'transformation',
    recommendedPolarity: 'ping_pong',
    recommendedTimerSeconds: 4,
    requiredPasses: 2,
    earRule:
      'Imparfait of avoir/être (j\'avais / j\'étais) + the exact same past participles you mastered in Phase 3!',
  },
  {
    id: 'fr-7.2',
    phase: 7,
    phaseTitle: 'Phase 7: Compound Mastery',
    title: "Futur Antérieur (D'ici demain, j'aurai / je serai...)",
    newVerbIds: [],
    newTenseIds: ['futur_anterieur'],
    focusTenseIdsOverride: ['futur_simple', 'futur_anterieur'],
    newChunks: [
      { id: 'fr-d-ici-demain', target: "d'ici demain", english: 'by tomorrow', attachToVerbIds: ['finir', 'trouver', 'partir', 'faire'] },
    ],
    recommendedCadence: 'transformation',
    recommendedPolarity: 'ping_pong',
    recommendedTimerSeconds: 4,
    requiredPasses: 2,
    earRule:
      'Futur Simple of avoir/être (j\'aurai / je serai) + past participle to express what "will have been done".',
  },
  {
    id: 'fr-7.3',
    phase: 7,
    phaseTitle: 'Phase 7: Compound Mastery',
    title: "Conditionnel Passé (Si j'avais su, j'aurais / je serais...)",
    newVerbIds: [],
    newTenseIds: ['conditionnel_passe'],
    focusTenseIdsOverride: ['conditionnel_present', 'conditionnel_passe'],
    newChunks: [
      { id: 'fr-autrement', target: 'autrement', english: 'differently / otherwise', attachToVerbIds: ['faire', 'dire', 'choisir'] },
    ],
    recommendedCadence: 'qa_flip',
    recommendedPolarity: 'ping_pong',
    recommendedTimerSeconds: 4,
    requiredPasses: 2,
    earRule:
      'Conditionnel Présent of avoir/être (j\'aurais / je serais) + past participle ("would have done").',
  },
  {
    id: 'fr-7.4',
    phase: 7,
    phaseTitle: 'Phase 7: Compound Mastery',
    title: "Subjonctif Passé (Bien que j'aie / je sois...)",
    newVerbIds: [],
    newTenseIds: ['subjonctif_passe'],
    focusTenseIdsOverride: ['subjonctif_present', 'subjonctif_passe'],
    newChunks: [
      { id: 'fr-deja-tout', target: 'déjà tout', english: 'everything already', attachToVerbIds: ['comprendre', 'faire', 'dire', 'voir'] },
    ],
    recommendedCadence: 'roulette',
    recommendedPolarity: 'mixed',
    recommendedTimerSeconds: 3,
    requiredPasses: 2,
    earRule:
      'Present Subjunctive of avoir/être (que j\'aie / que je sois) + past participle—completing all 12 French tenses!',
  },
];
