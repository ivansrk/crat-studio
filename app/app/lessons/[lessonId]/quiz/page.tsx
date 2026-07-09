import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth/current-user'
import { hasCourseAccess } from '@/lib/progress/access'
import { db } from '@/lib/db'
import { getLesson } from '@/lib/content'
import { nextQuestionIndex, QUIZ_TOTAL, type StoredAnswer } from '@/lib/progress/quiz-logic'
import { answerAction } from '@/app/actions/quiz'
import { startQuizAction } from '@/app/actions/lesson'
import { t } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export default async function QuizPage({ params, searchParams }: {
  params: Promise<{ lessonId: string }>; searchParams: Promise<{ attempt?: string; feedback?: string }>
}) {
  const { lessonId } = await params
  const { attempt: attemptId, feedback } = await searchParams
  const user = await currentUser()
  if (!user || !(await hasCourseAccess(user))) redirect('/login')
  const lesson = getLesson(lessonId)
  if (!lesson) notFound()
  if (!attemptId) redirect(`/app/lessons/${lessonId}`) // LES-10: прямой заход — назад, новая попытка только кнопкой

  const attempt = await db.quizResult.findFirst({ where: { id: attemptId, userId: user.id, lessonId } })
  if (!attempt) redirect(`/app/lessons/${lessonId}`)
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
    return (
      <main className="quiz">
        {fbBlock}
        <h1>{attempt.passed ? t.quiz.passedTitle : t.quiz.failedTitle}</h1>
        <p>{t.quiz.scoreLabel}: {attempt.score}/{attempt.total}</p>
        {!attempt.passed && (
          <form action={startQuizAction}><input type="hidden" name="lessonId" value={lessonId} />
            <button className="mdx-download" type="submit">{t.lesson.retakeQuiz}</button></form>
        )}
        <p><Link className="mdx-download" href={`/app/lessons/${lessonId}`}>{t.quiz.backToLesson}</Link></p>
      </main>
    )
  }

  const qi = nextQuestionIndex(answers)
  // Рассинхрон (answers полные, finish не записан) — недостижим при атомарном update recordAnswer;
  // страховка от лупа: к уроку, а не redirect на себя же (ревью T5).
  if (qi === null) redirect(`/app/lessons/${lessonId}`)
  const q = lesson.quiz.questions[qi]

  return (
    <main className="quiz">
      <h1>{lesson.meta.title} — {t.quiz.title}</h1>
      {fbBlock}
      <p className="quiz-progress">{t.quiz.questionLabel} {qi + 1}/{QUIZ_TOTAL}</p>
      <h2>{q.question}</h2>
      <div className="quiz-options">
        {q.options.map((opt, i) => (
          <form key={i} action={answerAction}>
            <input type="hidden" name="lessonId" value={lessonId} />
            <input type="hidden" name="attemptId" value={attempt.id} />
            <input type="hidden" name="questionIndex" value={qi} />
            <input type="hidden" name="chosen" value={i} />
            <button className="quiz-option" type="submit">{opt}</button>
          </form>
        ))}
      </div>
    </main>
  )
}
