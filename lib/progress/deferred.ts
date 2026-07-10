import { db } from '@/lib/db'
import { getLesson } from '@/lib/content'
import { scoreAnswers, type StoredAnswer } from './quiz-logic'
import type { QuizQuestion } from '@/lib/content/types'

export type DeferredRow = { id: string; courseSlug: string; lessonId: string; dueAt: Date; answeredAt: Date | null }
export type DeferredQuestion = QuizQuestion

/** CAB-04/06: должный и несданный блок — самый давний по dueAt; null если нет.
 *  Сравнение по timestamp (dueAt хранится UTC; «7 дней» заложены при создании — LES-13).
 *  При равных dueAt (реальный кейс: seed пишет один dueAt на несколько уроков) — тай-брейк
 *  по id (меньший побеждает): выбор детерминирован независимо от порядка входа (ревью T1). */
export function pickDueDeferred(rows: DeferredRow[], now: Date): DeferredRow | null {
  const due = rows.filter(r => r.answeredAt === null && r.dueAt.getTime() <= now.getTime())
  if (due.length === 0) return null
  return due.reduce((oldest, r) => {
    const dt = r.dueAt.getTime() - oldest.dueAt.getTime()
    return dt < 0 || (dt === 0 && r.id < oldest.id) ? r : oldest
  })
}

export type DueDeferred = { deferred: DeferredRow; courseSlug: string; lessonId: string; lessonTitle: string; questions: QuizQuestion[] }

/** Выборка due-блока при входе (CAB-04/06) с вопросами урока (D-012: deferred ?? questions).
 *  MC-05/F19: кабинет показывает отложенные вопросы ПО ВСЕМ курсам студента разом (самый давний
 *  выигрывает независимо от курса) — поэтому БЕЗ фильтра courseSlug в where; каждая строка несёт
 *  свой courseSlug (используется для getLesson и для ответа — answerDeferred по id, курс не теряется).
 *  Урок битый/пропал (E10) → пропускаем строку и берём следующую по давности, а не падаем. */
export async function getDueDeferred(userId: string): Promise<DueDeferred | null> {
  const rows = await db.deferredQuizState.findMany({
    where: { userId, answeredAt: null },
    orderBy: [{ dueAt: 'asc' }, { id: 'asc' }], // детерминированный порядок при равных dueAt (ревью T1)
  })
  const now = new Date()
  let remaining: DeferredRow[] = rows
  let picked = pickDueDeferred(remaining, now)
  while (picked) {
    const lesson = getLesson(picked.courseSlug, picked.lessonId)
    if (lesson) {
      const questions = lesson.quiz.deferred ?? lesson.quiz.questions
      return { deferred: picked, courseSlug: picked.courseSlug, lessonId: picked.lessonId, lessonTitle: lesson.meta.title, questions }
    }
    // E10: битый/пропавший урок — пропускаем строку, берём следующую давнюю
    remaining = remaining.filter(r => r.id !== picked!.id)
    picked = pickDueDeferred(remaining, now)
  }
  return null
}

export type AnswerDeferredOutcome = { ok: true; score: number } | { ok: false; reason: 'already' }

/** Запись результата отложенного блока (CAB-05). Статусы уроков НЕ трогаются —
 *  deferred существует отдельно от LessonProgress/QuizResult, повторение не влияет на «пройден».
 *  Без courseSlug в where: строка уже однозначно определена id+userId, курс в неё не переносится. */
export async function answerDeferred(userId: string, deferredId: string, answers: StoredAnswer[]): Promise<AnswerDeferredOutcome> {
  const score = scoreAnswers(answers)
  const result = await db.deferredQuizState.updateMany({
    where: { id: deferredId, userId, answeredAt: null },
    data: { answeredAt: new Date(), answers, score },
  })
  if (result.count !== 1) return { ok: false, reason: 'already' } // идемпотентность двойного сабмита
  return { ok: true, score }
}
