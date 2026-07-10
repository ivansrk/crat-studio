import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { getCourse } from '@/lib/content'
import { getCourseProgress } from '@/lib/progress'
import { isLessonPassed } from '@/lib/progress/quiz-logic'
import { getCurrentSubmission } from '@/lib/project'
import { formatDate } from '@/lib/i18n/format-date'
import { t } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

const SUBMISSION_STATUS_LABEL = {
  DRAFT: t.project.statusDraft,
  SUBMITTED: t.project.statusSubmitted,
  NEEDS_CHANGES: t.project.statusNeedsChanges,
  APPROVED: t.project.statusApproved,
} as const

export default async function StudentProgress({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) notFound() // гейт админа — в app/admin/layout.tsx; здесь только валидность userId

  // [РЕШЕНИЕ АВТОРА]: страница прогресса студента остаётся привязанной к ai-basics —
  // единственному курсу с реальными студентами. Полный мультикурсовый вид (таблица
  // прогресса по КАЖДОМУ enrollment) — дороже (N курсов × N таблиц на одной странице ради
  // курса без учащихся) и откладывается до Ф8+/появления второго активного курса.
  const [{ byLesson }, deferred, submission, certificate] = await Promise.all([
    getCourseProgress(userId, 'ai-basics'),
    db.deferredQuizState.findMany({ where: { userId }, orderBy: { dueAt: 'asc' } }), // по всем курсам студента (F19) — без courseSlug
    getCurrentSubmission(userId, 'ai-basics'),
    db.certificate.findFirst({ where: { userId, status: { in: ['VALID', 'REVOKED'] } }, orderBy: { issuedAt: 'desc' } }),
  ])
  const lessons = getCourse('ai-basics')!.course.modules.flatMap(m => m.lessons) // все 12 строк всегда (ADM-05)

  return (
    <main className="admin-wide">
      <h1>{user.firstName} {user.lastName}</h1>
      <p>{user.email}</p>

      <h2>{t.admin.progress}</h2>
      <table className="admin-table">
        <thead>
        <tr>
          <th>{t.admin.colLesson}</th>
          <th>{t.admin.colQuiz}</th>
          <th>{t.admin.colPractice}</th>
          <th>{t.admin.colDone}</th>
        </tr>
        </thead>
        <tbody>
        {lessons.map(l => {
          const p = byLesson.get(l.id)
          // «Пройден» — ЖИВОЕ определение, как у студента (D-029/E16, isLessonPassed — правило 9);
          // completedAt — только тайминг deferred (первое достижение, не откатывается), в UI не светим.
          const doneAt = isLessonPassed(p)
            ? new Date(Math.max(p.quizPassedAt.getTime(), p.practiceDoneAt.getTime()))
            : null
          return (
            <tr key={l.id}>
              <td>{l.title}</td>
              <td>{p?.quizPassedAt ? formatDate(p.quizPassedAt) : t.admin.notYet}</td>
              <td>{p?.practiceDoneAt ? formatDate(p.practiceDoneAt) : t.admin.notYet}</td>
              <td>{doneAt ? formatDate(doneAt) : t.admin.notYet}</td>
            </tr>
          )
        })}
        </tbody>
      </table>

      <h2>{t.admin.mission}</h2>
      <p>{user.mission ?? t.admin.notYet}</p>

      <h2>{t.admin.deferredTitle}</h2>
      {deferred.length === 0 ? <p>{t.admin.notYet}</p> : (
        <table className="admin-table">
          <thead>
          <tr>
            <th>{t.admin.colLesson}</th>
            <th>{t.admin.colDueAt}</th>
            <th>{t.admin.colAnsweredAt}</th>
          </tr>
          </thead>
          <tbody>
          {deferred.map(d => (
            <tr key={d.id}>
              <td>{d.lessonId}</td>
              <td>{formatDate(d.dueAt)}</td>
              <td>{d.answeredAt ? formatDate(d.answeredAt) : t.admin.notYet}</td>
            </tr>
          ))}
          </tbody>
        </table>
      )}

      <h2>{t.admin.projectTitle}</h2>
      {submission
        ? <p>{SUBMISSION_STATUS_LABEL[submission.status]} · попытка {submission.attempt}</p>
        : <p>{t.project.statusNone}</p>}

      <h2>{t.admin.certTitle}</h2>
      {certificate ? (
        <p>
          {certificate.number} · {certificate.status === 'VALID' ? t.admin.certStatusValid : t.admin.certStatusRevoked} · {formatDate(certificate.issuedAt)}
        </p>
      ) : <p>{t.admin.notYet}</p>}
    </main>
  )
}
