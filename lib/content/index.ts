import path from 'node:path'
import { loadCourse } from './loader'
import { loadArticles, publishedArticles } from './articles'
import type { CourseContent, Lesson } from './types'
import type { Article, ArticleIssue } from './articles'

const COURSE_SLUG = 'ai-basics'
// кэш на процесс: в dev правка content/ видна после рестарта (контракт: обновление урока = git push)
const g = globalThis as unknown as { __content?: CourseContent; __articles?: { articles: Article[]; issues: ArticleIssue[] } }

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
/** Общее число уроков курса по course.yaml — каноничный знаменатель «N/12» (D-029). */
export function lessonCount(): number {
  return getContent().course.modules.reduce((n, m) => n + m.lessons.length, 0)
}
/** Следующий урок по course.yaml или null для последнего. */
export function nextLessonId(lessonId: string): string | null {
  const ids = getContent().course.modules.flatMap(m => m.lessons.map(l => l.id))
  const i = ids.indexOf(lessonId)
  return i >= 0 && i + 1 < ids.length ? ids[i + 1] : null
}

function getArticlesRaw(): { articles: Article[]; issues: ArticleIssue[] } {
  if (!g.__articles) g.__articles = loadArticles(path.join(process.cwd(), 'content', 'articles'))
  return g.__articles
}
/** Опубликованные статьи (не-draft), дата убывания; кэш на процесс (ART-01…03). Раздел опционален. */
export function getArticles(): Article[] {
  return publishedArticles(getArticlesRaw().articles)
}
/** Опубликованная статья по slug или null (draft/несуществующая — тоже null). */
export function getArticle(slug: string): Article | null {
  return getArticles().find(a => a.meta.slug === slug) ?? null
}
export function articleIssues(): ArticleIssue[] {
  return getArticlesRaw().issues
}
