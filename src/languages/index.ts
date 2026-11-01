import { FRENCH_LANGUAGE_PACK } from './fr/conjugator';
import { SPANISH_LANGUAGE_PACK } from './es/conjugator';
import { LanguageCode, LanguagePack } from './types';

export const LANGUAGE_PACKS: Record<LanguageCode, LanguagePack> = {
  fr: FRENCH_LANGUAGE_PACK,
  es: SPANISH_LANGUAGE_PACK,
};

export function getLanguagePack(code: LanguageCode): LanguagePack {
  return LANGUAGE_PACKS[code];
}

export * from './types';
export { FRENCH_LANGUAGE_PACK } from './fr/conjugator';
export { SPANISH_LANGUAGE_PACK } from './es/conjugator';
export { FRENCH_ROADMAP } from './fr/roadmap';
export { SPANISH_ROADMAP } from './es/roadmap';
