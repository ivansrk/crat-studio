import { db } from '@/lib/db'
import { getLesson } from '@/lib/content'
import { isUniqueViolation } from '@/lib/db-errors'
import { scoreAnswers, isQuizPassed, isLessonPassed, nextQuestionIndex, isReplay, isValidChoice, QUIZ_TOTAL, type StoredAnswer } from './quiz-logic'
import type { QuizResult } from '@/lib/generated/prisma/client'

const COURSE = 'ai-basics' // MVP: один курс; мультикурс = прокинуть courseSlug через сигнатуры (схема уже courseSlug-aware)
const DEFERRED_DAYS_MS = 7 * 24 * 60 * 60 * 1000 // LES-13

/** LessonProgress создаётся при первом открытии урока (firstOpenedAt = default now).
 *  Инвариант: строки прогресса существуют только для валидных уроков из course.yaml —
 *  подделанный lessonId в POST не плодит мусор (startAttempt/setPractice тоже идут через ensureProgress).
 *  Легитимно недостижимо (страница урока проверяет getLesson раньше) → throw, ловит error boundary. */
export async function ensureProgress(userId: string, lessonId: string) {
  if (!getLesson(COURSE, lessonId)) throw new Error(`unknown lesson: ${lessonId}`)
  return db.lessonProgress.upsert({
    where: { userId_courseSlug_lessonId: { userId, courseSlug: COURSE, lessonId } },
    update: {},
    create: { userId, courseSlug: COURSE, lessonId },
  })
}

/** LES-10: каждая новая попытка — новая строка; attempt = max+1 (гонка двух вкладок ловится @@unique). */
export async function startAttempt(userId: string, lessonId: string): Promise<QuizResult> {
  await ensureProgress(userId, lessonId)
  for (let tryN = 0; tryN < 2; tryN++) {
    const last = await db.quizResult.findFirst({ where: { userId, lessonId }, orderBy: { attempt: 'desc' } })
    try {
      return await db.quizResult.create({
        data: { userId, courseSlug: COURSE, lessonId, attempt: (last?.attempt ?? 0) + 1, answers: [] },
      })
    } catch (e) {
      if (!isUniqueViolation(e) || tryN === 1) throw e // вторая вкладка успела — перечитываем max и пробуем ещё раз
    }
  }
  throw new Error('unreachable')
}

export type AnswerOutcome =
  | { ok: true; questionIndex: number; chosen: number; correct: boolean; finished: boolean; score: number; passed: boolean }
  | { ok: false; reason: 'not_found' | 'finished' | 'already_answered' | 'bad_option' }

/** Ответ на вопрос активной попытки. Правильность считает СЕРВЕР по quiz.yaml (LES-07). */
export async function recordAnswer(userId: string, lessonId: string, attemptId: string, questionIndex: number, chosen: number): Promise<AnswerOutcome> {
  const attempt = await db.quizResult.findFirst({ where: { id: attemptId, userId, lessonId } })
  if (!attempt) return { ok: false, reason: 'not_found' }
  const lesson = getLesson(COURSE, lessonId)
  if (!lesson) return { ok: false, reason: 'not_found' } // битый/удалённый урок — не путать с bad_option (ревью T2)
  const answers = (attempt.answers as StoredAnswer[] | null) ?? []

  // Двойной клик по варианту (ревью T2): повтор того же (questionIndex, chosen) — идемпотентный ok
  // с СОХРАНЁННЫМ результатом, без записи в БД; студент не вылетает из квиза.
  const replay = isReplay(answers, questionIndex, chosen)
  if (replay) {
    return {
      ok: true, questionIndex, chosen, correct: replay.correct,
      finished: !!attempt.finishedAt || nextQuestionIndex(answers) === null,
      score: attempt.score, passed: attempt.passed,
    }
  }

  if (attempt.finishedAt) return { ok: false, reason: 'finished' }
  const question = lesson.quiz.questions[questionIndex]
  if (!question || !isValidChoice(chosen, question.options.length)) return { ok: false, reason: 'bad_option' } // isValidChoice ловит и NaN (ревью T5)
  if (nextQuestionIndex(answers) !== questionIndex) return { ok: false, reason: 'already_answered' } // отвечать можно только на текущий

  const correct = chosen === question.correct
  const newAnswers = [...answers, { questionIndex, chosen, correct }]
  const finished = nextQuestionIndex(newAnswers) === null
  const score = scoreAnswers(newAnswers)
  const passed = isQuizPassed(score)

  await db.quizResult.update({
    where: { id: attempt.id },
    data: { answers: newAnswers, score, total: QUIZ_TOTAL, passed, ...(finished ? { finishedAt: new Date() } : {}) },
  })
  if (finished && passed) await onQuizPassed(userId, lessonId) // LES-09: зачтённый остаётся зачтённым
  return { ok: true, questionIndex, chosen, correct, finished, score, passed }
}

/** Фиксация зачёта квиза + пересчёт «пройден». quizPassedAt не перетирается при пересдачах —
 *  условный updateMany с фильтром quizPassedAt: null сохраняет дату ПЕРВОГО зачёта (LES-09),
 *  идемпотентно и без гонок (в отличие от безусловного update). */
async function onQuizPassed(userId: string, lessonId: string) {
  await db.lessonProgress.updateMany({
    where: { userId, courseSlug: COURSE, lessonId, quizPassedAt: null },
    data: { quizPassedAt: new Date() },
  })
  await recomputeCompletion(userId, lessonId)
}

/** LES-11: чекбокс практики; снятие → practiceDoneAt = null (completedAt НЕ откатывается — E16). */
export async function setPractice(userId: string, lessonId: string, done: boolean) {
  await ensureProgress(userId, lessonId)
  await db.lessonProgress.update({
    where: { userId_courseSlug_lessonId: { userId, courseSlug: COURSE, lessonId } },
    data: { practiceDoneAt: done ? new Date() : null },
  })
  if (done) await recomputeCompletion(userId, lessonId)
}

/** D-004/LES-12/13: единственная точка, где урок становится «пройден».
 *  completedAt ставится один раз (первое достижение) и не откатывается; deferred создаётся upsert'ом. */
export async function recomputeCompletion(userId: string, lessonId: string) {
  const p = await db.lessonProgress.findUnique({ where: { userId_courseSlug_lessonId: { userId, courseSlug: COURSE, lessonId } } })
  if (!p || p.completedAt || !p.quizPassedAt || !p.practiceDoneAt) return
  const completedAt = new Date()
  await db.lessonProgress.update({
    where: { userId_courseSlug_lessonId: { userId, courseSlug: COURSE, lessonId } },
    data: { completedAt },
  })
  await db.deferredQuizState.upsert({ // LES-13
    where: { userId_courseSlug_lessonId: { userId, courseSlug: COURSE, lessonId } },
    update: {},
    create: { userId, courseSlug: COURSE, lessonId, dueAt: new Date(completedAt.getTime() + DEFERRED_DAYS_MS) },
  })
  // CERT-01 триггер №1; dynamic — разрыв статического цикла progress↔cert
  // (E7: последний урок при уже-approved проекте — симметрично триггеру №2 в admin/review-project).
  const { checkAndIssueCertificate } = await import('@/lib/cert')
  await checkAndIssueCertificate(userId).catch(e => console.error('[cert] выдача после урока:', e))
}

export type LessonState = {
  quizPassed: boolean; practiceDone: boolean; completed: boolean
}

export async function getLessonState(userId: string, lessonId: string): Promise<LessonState> {
  const p = await db.lessonProgress.findUnique({ where: { userId_courseSlug_lessonId: { userId, courseSlug: COURSE, lessonId } } })
  return {
    quizPassed: !!p?.quizPassedAt,
    practiceDone: !!p?.practiceDoneAt,
    completed: isLessonPassed(p), // отображение «пройден» — живое (E16)
  }
}

/** Кабинет/админка: карта lessonId → состояние + счётчик пройденных. */
export async function getCourseProgress(userId: string) {
  const rows = await db.lessonProgress.findMany({ where: { userId, courseSlug: COURSE } })
  const byLesson = new Map(rows.map(r => [r.lessonId, r]))
  return {
    byLesson,
    completedCount: rows.filter(r => isLessonPassed(r)).length,
  }
}
