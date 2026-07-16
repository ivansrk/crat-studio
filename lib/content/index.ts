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

/** MC-03: разбивает реестр курсов на «мои» (по Enrollment.courseSlug пользователя)
 *  и «остальные» (каталог хаба /app) — стабильный порядок getCourses() (slug asc) в обеих группах. */
export function splitCourseCatalog(courses: CourseContent[], enrolledSlugs: string[]): { mine: CourseContent[]; others: CourseContent[] } {
  const enrolled = new Set(enrolledSlugs)
  return {
    mine: courses.filter(c => enrolled.has(c.slug)),
    others: courses.filter(c => !enrolled.has(c.slug)),
  }
}

/** S3 (аудит навигации 2026-07-16, NAV-08): ровно один enrollment студента → «домой» для него
 *  это сам курс, а не хаб. /app редиректит сразу на /app/{slug} единственного курса (без лишнего
 *  клика), даже если в реестре есть другие курсы-витрины («Скоро»): каталог остальных курсов и хаб
 *  доступны отдельной тихой ссылкой «Все курсы» со страницы курса (`/app?all=1`, минует редирект).
 *  Возвращает slug или null (несколько «моих» курсов, ни одного, либо единственный не опубликован —
 *  не редиректить на 404). Раньше требовался ещё и пустой каталог остальных, из-за чего demo-course
 *  «Скоро» блокировал редирект и хаб всегда показывался лишним экраном. */
export function soleCourseRedirect(mine: CourseContent[]): string | null {
  return mine.length === 1 && mine[0].published ? mine[0].slug : null
}

/** Следующий урок по course.yaml курса или null для последнего/неизвестного курса/урока. */
export function nextLessonId(courseSlug: string, lessonId: string): string | null {
  const c = getCourse(courseSlug)
  if (!c) return null
  const ids = c.course.modules.flatMap(m => m.lessons.map(l => l.id))
  const i = ids.indexOf(lessonId)
  return i >= 0 && i + 1 < ids.length ? ids[i + 1] : null
}

/** T4 дизайн-аудита: предыдущий урок по course.yaml курса, зеркало nextLessonId —
 *  null для первого урока курса/неизвестного курса/урока. */
export function prevLessonId(courseSlug: string, lessonId: string): string | null {
  const c = getCourse(courseSlug)
  if (!c) return null
  const ids = c.course.modules.flatMap(m => m.lessons.map(l => l.id))
  const i = ids.indexOf(lessonId)
  return i > 0 ? ids[i - 1] : null
}

/** T4 дизайн-аудита: позиция урока внутри своего модуля («Урок 1 из 3 · Модуль 2») —
 *  для позиционной подписи на странице урока. null для неизвестного курса/урока. */
export function lessonPosition(courseSlug: string, lessonId: string): { index: number; total: number; moduleId: number } | null {
  const c = getCourse(courseSlug)
  if (!c) return null
  for (const m of c.course.modules) {
    const i = m.lessons.findIndex(l => l.id === lessonId)
    if (i >= 0) return { index: i + 1, total: m.lessons.length, moduleId: m.id }
  }
  return null
}

/**
 * T7 дизайн-аудита (Б.6): «Выдержка из урока» на /ai-basics — первый содержательный
 * абзац реального lesson.mdx, БЕЗ mdx-компонентов, статично при билде (mdx — сырой
 * текст с диска, а не скомпилированный React — парсинг чистый Markdown, не JSX).
 * Берёт первый блок между \n\n, который не заголовок (#), не mdx-тег (<...>), не
 * italic-заглушка курса (*...*, см. lesson.mdx module-1/lesson-1.1 — последняя строка
 * «Этот текст — заглушка для разработки» специально исключена этим фильтром) и не
 * список/цитата (T9 дизайн-аудита: строки, начинающиеся с «- », «> » или «1. » —
 * это не связная проза, для цитаты-выдержки не годится). Инлайн-разметка (**bold**,
 * *italic*, `code`, [text](url), остаточные <tag>) вычищается до простого текста.
 * 2–3 предложения — до ~380 символов, дальше грубо режет к 2.
 * null — если урок не найден или в mdx нет подходящего абзаца (честная деградация:
 * страница /ai-basics прячет блок целиком, а не показывает пустоту).
 */
export function lessonExcerpt(courseSlug: string, lessonId: string): { text: string; lessonTitle: string } | null {
  const lesson = getLesson(courseSlug, lessonId)
  if (!lesson) return null
  const blocks = lesson.mdx.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean)
  const isNonParagraph = (b: string) =>
    b.startsWith('#') || b.startsWith('<') || b.startsWith('*') ||
    b.startsWith('-') || b.startsWith('>') || /^\d+\.\s/.test(b)
  const paragraph = blocks.find(b => !isNonParagraph(b))
  if (!paragraph) return null
  const plain = paragraph
    .replace(/<[^>]+>/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
  if (!plain) return null
  const sentences = plain.match(/[^.!?…]+[.!?…]+/g) ?? [plain]
  let text = ''
  for (let i = 0; i < Math.min(3, sentences.length); i++) {
    if (i === 2 && text.length + sentences[i].length > 380) break
    text += sentences[i]
  }
  text = text.trim()
  return text ? { text, lessonTitle: lesson.meta.title } : null
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
