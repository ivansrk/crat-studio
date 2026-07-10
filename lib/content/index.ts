import fs from 'node:fs'
import path from 'node:path'
import { loadCourse } from './loader'
import { loadArticles, publishedArticles } from './articles'
import type { CourseContent, Lesson, ContentIssue } from './types'
import type { Article, ArticleIssue } from './articles'

const CONTENT_DIR = path.join(process.cwd(), 'content')
const ARTICLES_DIR_NAME = 'articles' // не курс — отдельный раздел контента (ART), исключается из реестра курсов

// кэш на процесс: в dev правка content/ видна после рестарта (контракт: обновление урока = git push)
const g = globalThis as unknown as {
  __courses?: Map<string, CourseContent>
  __articles?: { articles: Article[]; issues: ArticleIssue[] }
}

/**
 * Сканирует каталоги content/* (кроме articles), каждый грузит через loadCourse —
 * ключ реестра = имя каталога (CourseContent.slug), не course.yaml.slug (MC-01).
 * Каталог без course.yaml тоже регистрируется — с error-issue, а не молча пропадает
 * (иначе битый курс исчезает из /health, вместо того чтобы показать ошибку).
 */
function loadCourses(): Map<string, CourseContent> {
  const map = new Map<string, CourseContent>()
  if (!fs.existsSync(CONTENT_DIR)) return map
  const dirNames = fs
    .readdirSync(CONTENT_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory() && e.name !== ARTICLES_DIR_NAME)
    .map(e => e.name)
    .sort() // MC-08: стабильная сортировка по slug для каталога курсов
  for (const slug of dirNames) map.set(slug, loadCourse(path.join(CONTENT_DIR, slug)))
  return map
}

function getCoursesMap(): Map<string, CourseContent> {
  if (!g.__courses) g.__courses = loadCourses()
  return g.__courses
}

/** ВСЕ курсы (включая неопубликованные — витрина «Скоро», MC-02/03), по slug asc. */
export function getCourses(): CourseContent[] {
  return [...getCoursesMap().values()]
}

/** Курс по slug каталога content/{slug} или null, если такого каталога нет (MC-01). */
export function getCourse(slug: string): CourseContent | null {
  return getCoursesMap().get(slug) ?? null
}

export function getLesson(courseSlug: string, lessonId: string): Lesson | null {
  return getCourse(courseSlug)?.lessons.get(lessonId) ?? null
}

/** URL-база ассетов урока, БЕЗ хвостового слэша. Знание о раскладке контента живёт в lib/content. */
export function assetBase(courseSlug: string, lesson: Lesson): string {
  return `/content-assets/${courseSlug}/module-${lesson.moduleId}/lesson-${lesson.meta.id}`
}

/** Ошибки по ВСЕМ курсам реестра, сообщение с префиксом courseSlug — для /health и логов старта. */
export function contentErrors(): ContentIssue[] {
  const errors: ContentIssue[] = []
  for (const c of getCourses())
    for (const i of c.issues.filter(i => i.level === 'error'))
      errors.push({ ...i, message: `${c.slug}: ${i.message}` })
  return errors
}

/** Общее число уроков курса по его course.yaml — каноничный знаменатель «N/N» (D-029). 0 для неизвестного slug. */
export function lessonCount(courseSlug: string): number {
  const c = getCourse(courseSlug)
  if (!c) return 0
  return c.course.modules.reduce((n, m) => n + m.lessons.length, 0)
}

/** Ф7в T4 (MC-03): разбивает реестр курсов на «мои» (по Enrollment.courseSlug пользователя)
 *  и «остальные» (каталог хаба /app) — стабильный порядок getCourses() (slug asc) в обеих группах. */
export function splitCourseCatalog(courses: CourseContent[], enrolledSlugs: string[]): { mine: CourseContent[]; others: CourseContent[] } {
  const enrolled = new Set(enrolledSlugs)
  return {
    mine: courses.filter(c => enrolled.has(c.slug)),
    others: courses.filter(c => !enrolled.has(c.slug)),
  }
}

/** Ф7в T4: ровно один «мой» курс и пустой каталог остальных (ни одного другого курса в реестре) —
 *  хаб показывать нечего, редиректим сразу на единственный курс (без лишнего клика). Возвращает
 *  его slug или null, если условие не выполнено (несколько курсов/enrollments или есть каталог). */
export function soleCourseRedirect(mine: CourseContent[], others: CourseContent[]): string | null {
  return mine.length === 1 && others.length === 0 ? mine[0].slug : null
}

/** Следующий урок по course.yaml курса или null для последнего/неизвестного курса/урока. */
export function nextLessonId(courseSlug: string, lessonId: string): string | null {
  const c = getCourse(courseSlug)
  if (!c) return null
  const ids = c.course.modules.flatMap(m => m.lessons.map(l => l.id))
  const i = ids.indexOf(lessonId)
  return i >= 0 && i + 1 < ids.length ? ids[i + 1] : null
}

function getArticlesRaw(): { articles: Article[]; issues: ArticleIssue[] } {
  if (!g.__articles) g.__articles = loadArticles(path.join(CONTENT_DIR, ARTICLES_DIR_NAME))
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
