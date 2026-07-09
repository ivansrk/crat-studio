import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getContent } from '@/lib/content'
import { currentUser } from '@/lib/auth/current-user'
import { hasCourseAccess } from '@/lib/progress/access'
import { getCourseProgress } from '@/lib/progress'
import { logoutAction } from '@/app/actions/logout'
import { saveMissionAction } from '@/app/actions/lesson'
import { t } from '@/lib/i18n'

const TOTAL_LESSONS = 12 // D-029: каноничный счётчик N/12 (живое определение — «пройден» = quizPassedAt && practiceDoneAt)

export default async function Cabinet() {
  // currentUser не null после layout-гейта (app/app/layout.tsx), но TS этого не знает —
  // на всякий случай (истёкшая сессия между рендерами) отправляем на /login, а не падаем.
  const user = await currentUser()
  if (!user) redirect('/login')

  if (!(await hasCourseAccess(user))) {
    return (
      <main>
        <h1>{t.auth.cabinetTitle}</h1>
        <p>{t.cabinet.noAccess}</p>
        <form action={logoutAction}><button className="mdx-download" type="submit">{t.auth.logout}</button></form>
      </main>
    )
  }

  const { course } = getContent()
  const { byLesson, completedCount } = await getCourseProgress(user.id)
  const pct = Math.min(100, (completedCount / TOTAL_LESSONS) * 100)

  return (
    <main>
      <h1>{t.auth.cabinetTitle}</h1>

      <section aria-label={t.cabinet.progressAria}>
        <div className="progress-track">
          <span className="progress-figure" style={{ left: `${pct}%` }} aria-hidden>🚶</span>
        </div>
        <p>{completedCount}/{TOTAL_LESSONS} · {t.cabinet.progressLabel}</p>
      </section>

      <section>
        <h2>{t.lesson.missionTitle}</h2>
        <p>{t.lesson.missionHint}</p>
        <form action={saveMissionAction}>
          <input type="hidden" name="returnTo" value="/app" />
          <textarea name="mission" defaultValue={user.mission ?? ''} />
          <p><button className="mdx-download" type="submit">{t.lesson.save}</button></p>
        </form>
      </section>

      {course.modules.map(m => (
        <section key={m.id}><h3>{m.title}</h3>
          <ul>{m.lessons.map(l => {
            const p = byLesson.get(l.id)
            const status = p?.quizPassedAt && p?.practiceDoneAt
              ? `✓ ${t.cabinet.statusDone}`
              : p
                ? t.cabinet.statusInProgress
                : t.cabinet.statusNotStarted
            return (
              <li key={l.id}>
                <Link href={`/app/lessons/${l.id}`}>{l.id} · {l.title}</Link> — {status}
              </li>
            )
          })}</ul></section>
      ))}

      <form action={logoutAction}><button className="mdx-download" type="submit">{t.auth.logout}</button></form>
    </main>
  )
}
