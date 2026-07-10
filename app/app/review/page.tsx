import Link from 'next/link'
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth/current-user'
import { getDueDeferred } from '@/lib/progress/deferred'
import { getLesson } from '@/lib/content'
import { db } from '@/lib/db'
import type { StoredAnswer } from '@/lib/progress/quiz-logic'
import { answerReviewAction } from '@/app/actions/review'
import { SectionLabel } from '@/components/site/SectionLabel'
import { t } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

/** Ф4 T2: /app/review — форма отложенного блока (CAB-04…06).
 *  Без ?done: getDueDeferred → форма на 3 вопроса. С ?done={id}: результат читается ИЗ БД
 *  (не из query — score в query можно подделать), пояснения — из quiz.deferred ?? questions
 *  урока, как при сдаче (D-012).
 *  Сознательно остаётся БЕЗ courseSlug в маршруте — due-блок выбирает самый давний
 *  отложенный вопрос по ВСЕМ курсам студента (F19, без фильтра курса в deferred.ts), так что
 *  единственный courseSlug в URL не мог бы однозначно выразить показанный курс; per-course
 *  доступ проверять здесь нечем (getDueDeferred сам решает, что показать), проверка
 *  hasCourseAccess('ai-basics') была латентным багом мультикурса — убрана. */
export default async function ReviewPage({ searchParams }: {
  searchParams: Promise<{ done?: string; error?: string }>
}) {
  const { done, error } = await searchParams
  // currentUser не null после layout-гейта (app/app/layout.tsx), но TS этого не знает —
  // паттерн из app/app/page.tsx/lessons/[lessonId].
  const user = await currentUser()
  if (!user) redirect('/login')

  if (done) {
    const state = await db.deferredQuizState.findFirst({ where: { id: done, userId: user.id } })
    if (!state || !state.answeredAt) redirect('/app') // не найден/чужой/ещё не отвечен — нечего показывать
    const lesson = getLesson(state.courseSlug, state.lessonId) // MC-05: курс — из самой строки (deferred по всем курсам)
    if (!lesson) redirect('/app') // урок пропал после сдачи (E10) — нечего показывать
    const questions = lesson.quiz.deferred ?? lesson.quiz.questions
    const answers = (state.answers as StoredAnswer[] | null) ?? []

    return (
      <main className="review-page">
        <SectionLabel kicker={t.review.kicker} />
        <h1 className="crat-display">{t.review.doneTitle}</h1>
        <p className="crat-muted">{lesson.meta.title}</p>
        <p className="review-score">{t.review.scoreLabel}: {state.score}/{questions.length}</p>

        <div className="review-results">
          {questions.map((q, i) => {
            const a = answers.find(a => a.questionIndex === i)
            return (
              <div key={i} className={`crat-card review-result ${a?.correct ? 'review-result-ok' : 'review-result-no'}`}>
                <p className="review-result-status">{a?.correct ? t.review.correct : t.review.incorrect}</p>
                <p className="review-result-question">{q.question}</p>
                <p className="crat-muted">{q.explanation}</p>
              </div>
            )
          })}
        </div>

        <p><Link className="crat-button primary" href="/app">{t.review.backToCabinet}</Link></p>
      </main>
    )
  }

  const due = await getDueDeferred(user.id)
  if (!due) redirect('/app') // нет должного блока (уже сдан/несуществует) — назад в кабинет

  return (
    <main className="review-page">
      <SectionLabel kicker={t.review.kicker} />
      <h1 className="crat-display">{due.lessonTitle}</h1>
      <p className="crat-muted">{t.review.cabinetTitle}</p>
      {error && <p role="alert" className="form-alert">{t.review.incomplete}</p>}

      <form action={answerReviewAction} className="crat-card review-form">
        <input type="hidden" name="deferredId" value={due.deferred.id} />
        {due.questions.map((q, i) => (
          <fieldset key={i} className="review-question">
            <legend>{q.question}</legend>
            <div className="review-options">
              {q.options.map((opt, oi) => (
                <label key={oi} className="review-option">
                  <input type="radio" name={`q${i}`} value={oi} required />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <button className="crat-button primary" type="submit">{t.review.submit}</button>
      </form>
    </main>
  )
}
