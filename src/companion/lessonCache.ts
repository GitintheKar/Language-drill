import { LanguageCode } from '../languages/types';
import { CompanionLesson, CompanionLessonVariant } from './lessonTypes';

const LESSON_CACHE_STORAGE_KEY = 'rassias_companion_lesson_cache_v2';
const MAX_CACHED_LESSONS = 40;

export function buildLessonCacheKey(params: {
  language: LanguageCode;
  subModuleId: string;
  recipeHash: string;
  variant: CompanionLessonVariant;
  encoreIndex: number;
}): string {
  return `${params.language}:${params.subModuleId}:${params.recipeHash}:${params.variant}:${params.encoreIndex}`;
}

function readCacheStore(): Record<string, CompanionLesson> {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(LESSON_CACHE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, CompanionLesson>;
  } catch {
    return {};
  }
}

function writeCacheStore(store: Record<string, CompanionLesson>): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const entries = Object.entries(store);
    if (entries.length > MAX_CACHED_LESSONS) {
      entries.sort((a, b) => (b[1].createdAt ?? 0) - (a[1].createdAt ?? 0));
      const trimmed = Object.fromEntries(entries.slice(0, MAX_CACHED_LESSONS));
      window.localStorage.setItem(
        LESSON_CACHE_STORAGE_KEY,
        JSON.stringify(trimmed)
      );
    } else {
      window.localStorage.setItem(
        LESSON_CACHE_STORAGE_KEY,
        JSON.stringify(store)
      );
    }
  } catch {
    // Ignore storage quota errors
  }
}

export function getCachedCompanionLesson(params: {
  language: LanguageCode;
  subModuleId: string;
  recipeHash: string;
  variant: CompanionLessonVariant;
  encoreIndex: number;
}): CompanionLesson | null {
  const key = buildLessonCacheKey(params);
  const store = readCacheStore();
  const cached = store[key];
  if (!cached || cached.recipeHash !== params.recipeHash) {
    return null;
  }
  return cached;
}

export function saveCachedCompanionLesson(lesson: CompanionLesson): void {
  const key = buildLessonCacheKey({
    language: lesson.language,
    subModuleId: lesson.subModuleId,
    recipeHash: lesson.recipeHash,
    variant: lesson.variant,
    encoreIndex: lesson.encoreIndex,
  });
  const store = readCacheStore();
  store[key] = lesson;
  writeCacheStore(store);
}

export function clearCompanionLessonCache(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(LESSON_CACHE_STORAGE_KEY);
  } catch {
    // Ignore
  }
}
