import fs from 'node:fs'
import path from 'node:path'
import * as yaml from 'js-yaml'
import type { CourseContent, CourseYaml, ContentIssue, Lesson, LessonMeta, Quiz } from './types'

export function loadCourse(courseDir: string): CourseContent {
  const issues: ContentIssue[] = []
  const lessons = new Map<string, Lesson>()
  const empty: CourseYaml = { slug: '', title: '', modules: [] }

  const courseYamlPath = path.join(courseDir, 'course.yaml')
  if (!fs.existsSync(courseYamlPath)) {
    issues.push({ level: 'error', message: `course.yaml не найден: ${courseYamlPath}` })
    return { course: empty, lessons, issues, loadedAt: new Date() }
  }
  let course: CourseYaml
  try {
    course = yaml.load(fs.readFileSync(courseYamlPath, 'utf8')) as CourseYaml
  } catch (e) {
    issues.push({ level: 'error', message: `course.yaml не парсится: ${(e as Error).message}` })
    return { course: empty, lessons, issues, loadedAt: new Date() }
  }
  if (course.slug !== path.basename(courseDir))
    issues.push({ level: 'error', message: `slug "${course.slug}" ≠ каталогу "${path.basename(courseDir)}"` })

  const seen = new Set<string>()
  for (const mod of course.modules ?? []) {
    for (const ref of mod.lessons ?? []) {
      if (seen.has(ref.id)) { issues.push({ level: 'error', message: `дубль id урока ${ref.id}` }); continue }
      seen.add(ref.id)
      const lesson = loadLesson(courseDir, mod.id, ref.id, issues)
      if (lesson) lessons.set(ref.id, lesson)
    }
  }
  return { course, lessons, issues, loadedAt: new Date() }
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
  if (quiz) validateQuiz(quiz, err)
  const hasCheatsheet = fs.existsSync(path.join(dir, 'cheatsheet.pdf'))
  if (meta?.cheatsheet && !hasCheatsheet) err(`cheatsheet: true, а cheatsheet.pdf отсутствует`)
  if (meta && !meta.video_id) issues.push({ level: 'warning', lessonId: id, message: 'пустой video_id (LES-03, штатно)' })

  if (issues.filter(i => i.level === 'error').length > before) return null
  return { meta: meta as LessonMeta, moduleId, dir, mdx: mdx as string, quiz: quiz as Quiz, practiceMd: practiceMd as string, hasCheatsheet }
}

function validateQuiz(q: Quiz, err: (m: string) => void) {
  const blocks: [string, QuizQuestionList][] = [['questions', q.questions], ['deferred', q.deferred]]
  for (const [name, list] of blocks) {
    if (!list) continue
    if (name === 'questions' && list.length !== 3) err(`в quiz.yaml не ровно 3 вопроса (${list.length})`)
    list.forEach((it, i) => {
      if (!it.question?.trim() || !it.explanation?.trim()) err(`${name}[${i}]: пустой question/explanation`)
      if (!it.options || it.options.length < 2 || it.options.length > 4) err(`${name}[${i}]: вариантов должно быть 2–4`)
      else if (it.correct < 0 || it.correct >= it.options.length) err(`${name}[${i}]: correct вне диапазона`)
    })
  }
}

type QuizQuestionList = Quiz['questions'] | undefined

function readYaml<T>(p: string, err: (m: string) => void): T | null {
  const raw = readFile(p, err)
  if (raw === null) return null
  try { return yaml.load(raw) as T } catch (e) { err(`${path.basename(p)} не парсится: ${(e as Error).message}`); return null }
}
function readFile(p: string, err: (m: string) => void): string | null {
  if (!fs.existsSync(p)) { err(`отсутствует обязательный файл ${path.basename(p)}`); return null }
  return fs.readFileSync(p, 'utf8')
}
