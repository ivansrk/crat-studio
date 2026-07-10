import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth/current-user'
import { hasCourseAccess } from '@/lib/progress/access'
import { db } from '@/lib/db'
import { getCourse, getLesson } from '@/lib/content'
import { nextQuestionIndex, QUIZ_TOTAL, type StoredAnswer } from '@/lib/progress/quiz-logic'
import { startQuizAction } from '@/app/actions/lesson'
import { t } from '@/lib/i18n'
import { SectionShader } from '@/components/site/SectionShader'
import { QuizAnswerForm } from './QuizAnswerForm'

export const dynamic = 'force-dynamic'

/** /app/{courseSlug}/lessons/{lessonId}/quiz — перенос
 *  app/app/lessons/[lessonId]/quiz/page.tsx с параметризацией (MC-04). Логика не меняется. */
export default async function QuizPage({ params, searchParams }: {
  params: Promise<{ courseSlug: string; lessonId: string }>; searchParams: Promise<{ attempt?: string; feedback?: string }>
}) {
  const { courseSlug, lessonId } = await params
  const { attempt: attemptId, feedback } = await searchParams
  const entry = getCourse(courseSlug)
  if (!entry || !entry.published) notFound() // MC-01/02

  const user = await currentUser()
  if (!user || !(await hasCourseAccess(user, courseSlug))) redirect('/login')
  const lesson = getLesson(courseSlug, lessonId)
  if (!lesson) notFound()
  if (!attemptId) redirect(`/app/${courseSlug}/lessons/${lessonId}`) // LES-10: прямой заход — назад, новая попытка только кнопкой

  // courseSlug в where — Ф7в T2: QuizResult @@unique теперь courseSlug-aware (MC-05)
  const attempt = await db.quizResult.findFirst({ where: { id: attemptId, userId: user.id, courseSlug, lessonId } })
  if (!attempt) redirect(`/app/${courseSlug}/lessons/${lessonId}`)
  const answers = (attempt.answers as StoredAnswer[] | null) ?? []

  // Пояснение к только что отвеченному вопросу (?feedback=N) — нужно и на экране следующего
  // вопроса, и на финальном экране (ответ на 3-й вопрос ведёт сразу на финальный экран,
  // иначе его пояснение потерялось бы — LES-07 требует пояснение ПОСЛЕ КАЖДОГО ответа).
  const fb = feedback !== undefined ? answers.find(a => a.questionIndex === Number(feedback)) : undefined
  const fbQuestion = fb ? lesson.quiz.questions[fb.questionIndex] : undefined
  const fbBlock = fb && fbQuestion && (
    <aside className={fb.correct ? 'quiz-fb quiz-fb-ok' : 'quiz-fb quiz-fb-no'} role="status">
      <p>{fb.correct ? t.quiz.correct : t.quiz.incorrect}</p>
      <p>{fbQuestion.explanation}</p>
    </aside>
  )

  // Финальный экран
  if (attempt.finishedAt) {
    // T2 дизайн-аудита (D-042): прожектор-лучи только у сдавших — «Квиз не
    // сдан» без праздничного эффекта. main.quiz-stage уже position:relative
    // через .crat-noise, .quiz-result добавляет overflow:hidden (site.css).
    return (
      <main className={`quiz quiz-stage crat-noise${attempt.passed ? ' quiz-result' : ''}`}>
        {attempt.passed && <SectionShader variant="celebrate-rays" />}
        <div className="shader-content">
          {fbBlock}
          <h1 className="crat-display">{attempt.passed ? t.quiz.passedTitle : t.quiz.failedTitle}</h1>
          <p>{t.quiz.scoreLabel}: {attempt.score}/{attempt.total}</p>
          {/* T5: печать-штамп рядом с прожектор-лучами — маленький триумф сдачи (site.css). */}
          {attempt.passed && <span className="crat-stamp" aria-hidden />}
          {!attempt.passed && (
            <form action={startQuizAction}>
              <input type="hidden" name="courseSlug" value={courseSlug} />
              <input type="hidden" name="lessonId" value={lessonId} />
              <button className="crat-button" type="submit">{t.lesson.retakeQuiz}</button></form>
          )}
          <p><Link className="crat-button" href={`/app/${courseSlug}/lessons/${lessonId}`}>{t.quiz.backToLesson}</Link></p>
        </div>
      </main>
    )
  }

  const qi = nextQuestionIndex(answers)
  // Рассинхрон (answers полные, finish не записан) — недостижим при атомарном update recordAnswer;
  // страховка от лупа: к уроку, а не redirect на себя же (ревью T5).
  if (qi === null) redirect(`/app/${courseSlug}/lessons/${lessonId}`)
  const q = lesson.quiz.questions[qi]

  return (
    <main className="quiz quiz-stage crat-noise">
      <h1 className="crat-muted quiz-lesson-title">{lesson.meta.title} — {t.quiz.title}</h1>
      {fbBlock}
      {/* «Сцена с прожектором» (бриф §9): вопрос в световом пятне + конус сверху (quiz.css). */}
      <div className="quiz-spotlight">
        <p className="quiz-progress" aria-label={t.quiz.questionOfAria.replace('{n}', String(qi + 1)).replace('{total}', String(QUIZ_TOTAL))}>
          <span aria-hidden>{String(qi + 1).padStart(2, '0')} / {String(QUIZ_TOTAL).padStart(2, '0')}</span>
          <span className="crat-red-line quiz-progress-line" aria-hidden />
        </p>
        <h2 className="quiz-question">{q.question}</h2>
      </div>
      {/* T5: двухшаговый ответ — radio + отдельная кнопка «Ответить» (QuizAnswerForm, client). */}
      <QuizAnswerForm courseSlug={courseSlug} lessonId={lessonId} attemptId={attempt.id} questionIndex={qi} options={q.options} />
      <p><Link className="reveal-line" href={`/app/${courseSlug}/lessons/${lessonId}`}>{t.quiz.backToLesson}</Link></p>
    </main>
  )
}
