import path from 'node:path'
import { loadCourse } from './loader'
import type { CourseContent, Lesson } from './types'

const COURSE_SLUG = 'ai-basics'
// кэш на процесс: в dev правка content/ видна после рестарта (контракт: обновление урока = git push)
const g = globalThis as unknown as { __content?: CourseContent }

/** Загружает и валидирует контент один раз на процесс; ошибки — внутрь issues, никогда не бросает. */
export function getContent(): CourseContent {
  if (!g.__content) g.__content = loadCourse(path.join(process.cwd(), 'content', COURSE_SLUG))
  return g.__content
}
export function getLesson(id: string): Lesson | null {
  return getContent().lessons.get(id) ?? null
}
/** URL-база ассетов урока, БЕЗ хвостового слэша. Знание о раскладке контента живёт в lib/content. */
export function assetBase(lesson: Lesson): string {
  return `/content-assets/${COURSE_SLUG}/module-${lesson.moduleId}/lesson-${lesson.meta.id}`
}
export function contentErrors() {
  return getContent().issues.filter(i => i.level === 'error')
}
