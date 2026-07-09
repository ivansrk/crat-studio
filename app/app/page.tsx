import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getContent, lessonCount } from '@/lib/content'
import { currentUser } from '@/lib/auth/current-user'
import { hasCourseAccess } from '@/lib/progress/access'
import { getCourseProgress } from '@/lib/progress'
import { isLessonPassed } from '@/lib/progress/quiz-logic'
import { logoutAction } from '@/app/actions/logout'
import { saveMissionAction } from '@/app/actions/lesson'
import { t } from '@/lib/i18n'

export default async function Cabinet() {
  // currentUser не null после layout-гейта (app/app/layout.tsx), но TS этого не знает —
  // на всякий случай (истёкшая сессия между рендерами) отправляем на /login, а не падаем.
  const user = await currentUser()
  if (!user) redirect('/login')

  if (!(await hasCourseAccess(user))) {
    return (
      <main className="crat-page">
        <section className="crat-section">
          <div className="crat-shell">
            <h1 className="crat-display">{t.auth.cabinetTitle}</h1>
            <p className="crat-muted">{t.cabinet.noAccess}</p>
            <form action={logoutAction}><button className="crat-button" type="submit">{t.auth.logout}</button></form>
          </div>
        </section>
      </main>
    )
  }

  const { course } = getContent()
  const { byLesson, completedCount } = await getCourseProgress(user.id)
  const total = lessonCount() // знаменатель «N/12» из course.yaml, не хардкод (ревью T6)
  const pct = Math.min(100, (completedCount / total) * 100)

  return (
    <main className="crat-page">
      <section className="crat-section">
        <div className="crat-shell">
          <h1 className="crat-display">{t.auth.cabinetTitle}</h1>

          {/* CAB-01 бриф §9: «линия горизонта» — 4 модуля-«здания» над полосой прогресса,
              фигурка идёт по существующему pct; статус здания считается из byLesson (данные не меняются). */}
          <section aria-label={t.cabinet.progressAria} className="horizon">
            <div className="horizon-buildings">
              {course.modules.map(m => {
                const rows = m.lessons.map(l => byLesson.get(l.id))
                const passedCount = rows.filter(r => isLessonPassed(r)).length
                const started = rows.some(Boolean)
                const status = passedCount === m.lessons.length ? 'done' : started ? 'partial' : 'none'
                return (
                  <div key={m.id} className={`building building-${status}`}>
                    <span className={`building-sign building-sign-${status}${status === 'done' ? ' red-glow' : ''}`}>{m.title}</span>
                  </div>
                )
              })}
            </div>
            <div className="progress-track">
              <span className="progress-figure" style={{ left: `${pct}%` }} aria-hidden>🚶</span>
            </div>
            <p className="crat-muted">{completedCount}/{total} · {t.cabinet.progressLabel}</p>
          </section>

          <div className="crat-card cabinet-mission">
            <h2>{t.lesson.missionTitle}</h2>
            <p className="crat-muted">{t.lesson.missionHint}</p>
            <form action={saveMissionAction}>
              <input type="hidden" name="returnTo" value="/app" />
              <textarea name="mission" defaultValue={user.mission ?? ''} />
              <p><button className="crat-button" type="submit">{t.lesson.save}</button></p>
            </form>
          </div>

          <div className="cabinet-modules">
            {course.modules.map(m => (
              <div key={m.id} className="crat-card module-card">
                <h3 className="crat-kicker module-card-title">{m.title}</h3>
                <ul className="module-lessons">{m.lessons.map(l => {
                  const p = byLesson.get(l.id)
                  const passed = isLessonPassed(p)
                  const statusClass = passed ? 'lesson-status-done' : p ? 'lesson-status-progress' : 'lesson-status-none'
                  const statusText = passed ? `✓ ${t.cabinet.statusDone}` : p ? t.cabinet.statusInProgress : t.cabinet.statusNotStarted
                  return (
                    <li key={l.id} className="module-lesson-row">
                      <Link className="reveal-line" href={`/app/lessons/${l.id}`}>{l.id} · {l.title}</Link>
                      <span className={`module-lesson-status ${statusClass}`}>{statusText}</span>
                    </li>
                  )
                })}</ul>
              </div>
            ))}
          </div>

          <form action={logoutAction}><button className="crat-button" type="submit">{t.auth.logout}</button></form>
        </div>
      </section>
    </main>
  )
}
