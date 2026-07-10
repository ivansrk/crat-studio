import fs from 'node:fs'
import path from 'node:path'
import * as yaml from 'js-yaml'
import type { CourseContent, CourseYaml, ContentIssue, Lesson, LessonMeta, Quiz } from './types'
import { validateMdx } from './validate-mdx'
import { isNonEmptyString, isPlainObject, readYaml, readFile } from './yaml-utils'
import { animationIds } from '@/lib/design/animations/registry'

export function loadCourse(courseDir: string): CourseContent {
  const issues: ContentIssue[] = []
  const lessons = new Map<string, Lesson>()
  const dirSlug = path.basename(courseDir) // MC-01: реестр в lib/content/index.ts ключуется по каталогу, не по course.slug
  const empty: CourseYaml = { slug: '', title: '', modules: [] }

  const courseYamlPath = path.join(courseDir, 'course.yaml')
  if (!fs.existsSync(courseYamlPath)) {
    issues.push({ level: 'error', message: `course.yaml не найден: ${courseYamlPath}` })
    return { slug: dirSlug, published: true, course: empty, lessons, issues, loadedAt: new Date() }
  }
  let parsed: unknown
  try {
    parsed = yaml.loadAll(fs.readFileSync(courseYamlPath, 'utf8'))[0]
  } catch (e) {
    issues.push({ level: 'error', message: `course.yaml не парсится: ${(e as Error).message}` })
    return { slug: dirSlug, published: true, course: empty, lessons, issues, loadedAt: new Date() }
  }
  if (!isPlainObject(parsed)) {
    issues.push({ level: 'error', message: 'course.yaml пуст или не является объектом' })
    return { slug: dirSlug, published: true, course: empty, lessons, issues, loadedAt: new Date() }
  }
  const course = parsed as CourseYaml
  if (course.slug !== dirSlug)
    issues.push({ level: 'error', message: `slug "${course.slug}" ≠ каталогу "${dirSlug}"` })

  // MC-02: published необязателен в course.yaml — аддитивное поле контракта (D-036).
  // Отсутствует → true (обратная совместимость с курсами без флага). Не-boolean — ошибка контента.
  let published = true
  if (course.published !== undefined) {
    if (typeof course.published !== 'boolean')
      issues.push({ level: 'error', message: `published должен быть true/false, получено: ${JSON.stringify(course.published)}` })
    else
      published = course.published
  }

  const seen = new Set<string>()
  const expectedDirs = new Set<string>()
  for (const mod of course.modules ?? []) {
    for (const ref of mod.lessons ?? []) {
      expectedDirs.add(`module-${mod.id}/lesson-${ref.id}`)
      if (seen.has(ref.id)) { issues.push({ level: 'error', message: `дубль id урока ${ref.id}` }); continue }
      seen.add(ref.id)
      const lesson = loadLesson(courseDir, mod.id, ref.id, issues)
      if (lesson) lessons.set(ref.id, lesson)
    }
  }
  warnOrphanLessonDirs(courseDir, expectedDirs, issues)
  return { slug: dirSlug, published, course, lessons, issues, loadedAt: new Date() }
}

/** Warning §6: каталог урока на диске без записи в course.yaml — игнорируется, но не молча. */
function warnOrphanLessonDirs(courseDir: string, expectedDirs: Set<string>, issues: ContentIssue[]) {
  for (const modEntry of safeReaddir(courseDir)) {
    if (!modEntry.isDirectory() || !modEntry.name.startsWith('module-')) continue
    const moduleDir = path.join(courseDir, modEntry.name)
    for (const lessonEntry of safeReaddir(moduleDir)) {
      if (!lessonEntry.isDirectory() || !lessonEntry.name.startsWith('lesson-')) continue
      const key = `${modEntry.name}/${lessonEntry.name}`
      if (!expectedDirs.has(key))
        issues.push({ level: 'warning', message: `каталог ${key} не указан в course.yaml, игнорируется` })
    }
  }
}

function safeReaddir(dir: string): fs.Dirent[] {
  return fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : []
}

function loadLesson(courseDir: string, moduleId: number, id: string, issues: ContentIssue[]): Lesson | null {
  const err = (message: string) => { issues.push({ level: 'error', lessonId: id, message }) }
  const dir = path.join(courseDir, `module-${moduleId}`, `lesson-${id}`)
  if (!fs.existsSync(dir)) { err(`каталог урока ${id} не найден: ${dir}`); return null }

  const before = issues.filter(i => i.level === 'error').length
  const meta = readYaml<LessonMeta>(path.join(dir, 'meta.yaml'), err)
  const mdx = readFile(path.join(dir, 'lesson.mdx'), err)
  const quiz = readYaml<Quiz>(path.join(dir, 'quiz.yaml'), err)
  const practiceMd = readFile(path.join(dir, 'practice.md'), err)

  if (meta && meta.id !== id) err(`meta.id "${meta.id}" ≠ id урока "${id}"`)
  if (mdx !== null) {
    const assetsDir = path.join(dir, 'assets')
    const existingAssets = new Set<string>(
      fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir).map(f => `assets/${f}`) : [],
    )
    for (const m of validateMdx(mdx, { existingAssets, animationIds })) err(`lesson.mdx: ${m}`)
  }
  if (quiz) {
    validateQuiz(quiz, err)
    if (quiz.deferred == null)
      issues.push({ level: 'warning', lessonId: id, message: 'нет deferred — через 7 дней будут заданы основные вопросы (D-012)' })
  }
  const hasCheatsheet = fs.existsSync(path.join(dir, 'cheatsheet.pdf'))
  if (meta?.cheatsheet && !hasCheatsheet) err(`cheatsheet: true, а cheatsheet.pdf отсутствует`)
  if (meta && !meta.video_id) issues.push({ level: 'warning', lessonId: id, message: 'пустой video_id (LES-03, штатно)' })

  if (issues.filter(i => i.level === 'error').length > before) return null
  return { meta: meta as LessonMeta, moduleId, dir, mdx: mdx as string, quiz: quiz as Quiz, practiceMd: practiceMd as string, hasCheatsheet }
}

function validateQuiz(q: Quiz, err: (m: string) => void) {
  const blocks: [string, QuizQuestionList][] = [['questions', q.questions], ['deferred', q.deferred]]
  for (const [name, list] of blocks) {
    if (list == null) {
      // отсутствие deferred — штатно (D-012); отсутствие questions = 0 вопросов → ошибка ниже
      if (name === 'questions') err(`в quiz.yaml не ровно 3 вопроса (0)`)
      continue
    }
    if (!Array.isArray(list)) { err(`${name} должен быть списком`); continue }
    if (name === 'questions' && list.length !== 3) err(`в quiz.yaml не ровно 3 вопроса (${list.length})`)
    list.forEach((it, i) => {
      // не-строка (yaml `question: 123`) — ошибка контента, а не TypeError (правило 6)
      if (!isNonEmptyString(it.question) || !isNonEmptyString(it.explanation)) err(`${name}[${i}]: пустой или нестроковый question/explanation`)
      if (!it.options || it.options.length < 2 || it.options.length > 4) err(`${name}[${i}]: вариантов должно быть 2–4`)
      else if (!Number.isInteger(it.correct) || it.correct < 0 || it.correct >= it.options.length) err(`${name}[${i}]: correct вне диапазона`)
    })
  }
}

type QuizQuestionList = Quiz['questions'] | undefined
