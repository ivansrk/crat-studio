import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCourse, lessonCount } from '@/lib/content'
import { currentUser } from '@/lib/auth/current-user'
import { hasCourseAccess } from '@/lib/progress/access'
import { getCourseProgress } from '@/lib/progress'
import { isLessonPassed } from '@/lib/progress/quiz-logic'
import { getDueDeferred } from '@/lib/progress/deferred'
import { logoutAction } from '@/app/actions/logout'
import { saveMissionAction } from '@/app/actions/lesson'
import { getCurrentSubmission } from '@/lib/project'
import { db } from '@/lib/db'
import { t } from '@/lib/i18n'
import type { SubmissionStatus } from '@/lib/generated/prisma/client'

const PROJECT_STATUS_LABEL: Record<SubmissionStatus, string> = {
  DRAFT: t.project.statusDraft,
  SUBMITTED: t.project.statusSubmitted,
  NEEDS_CHANGES: t.project.statusNeedsChanges,
  APPROVED: t.project.statusApproved,
}

/** Ф7в T3: /app/{courseSlug} — курсо-зависимый кабинет (MC-04), перенос app/app/page.tsx
 *  с параметризацией. /app сам по себе остаётся Ф7в T4 (каталог/«Мои курсы»). */
export default async function CourseCabinet({ params }: { params: Promise<{ courseSlug: string }> }) {
  const { courseSlug } = await params
  const entry = getCourse(courseSlug)
  if (!entry || !entry.published) notFound() // MC-01/02: неизвестный/неопубликованный курс — 404

  // currentUser не null после layout-гейта (app/app/layout.tsx), но TS этого не знает —
  // на всякий случай (истёкшая сессия между рендерами) отправляем на /login, а не падаем.
  const user = await currentUser()
  if (!user) redirect('/login')

  if (!(await hasCourseAccess(user, courseSlug))) { // MC-07
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

  const { course } = entry
  const { byLesson, completedCount } = await getCourseProgress(user.id, courseSlug)
  const total = lessonCount(courseSlug) // знаменатель «N/12» из course.yaml, не хардкод (ревью T6)
  const pct = Math.min(100, (completedCount / total) * 100)
  // Ф4 T2/F19: due-блок повторения (CAB-04/06) — по всем курсам студента (без courseSlug — deferred.ts T2),
  // один запрос, без кэша (план); показывается ВВЕРХУ кабинета.
  const dueReview = await getDueDeferred(user.id)
  const projectSubmission = await getCurrentSubmission(user.id, courseSlug) // T5: доп. запрос — приемлемо (план)
  const projectStatusText = projectSubmission ? PROJECT_STATUS_LABEL[projectSubmission.status] : t.project.statusNone
  // T7: один findFirst — есть ли действующий сертификат (CERT-06/D-011: PDF по требованию, не хранится).
  const certificate = await db.certificate.findFirst({ where: { userId: user.id, courseSlug, status: 'VALID' } })

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

          {/* Ф4 T2: повторение приоритетно — сразу после прогресса, до миссии и уроков (CAB-04…06). */}
          {dueReview && (
            <div className="crat-card cabinet-review">
              <h2 className="crat-kicker">{t.review.kicker}</h2>
              <p className="cabinet-review-title">{t.review.cabinetTitle}</p>
              <p className="crat-muted">{t.review.lessonLabel}: {dueReview.lessonTitle}</p>
              <Link className="crat-button primary" href="/app/review">{t.review.submit}</Link>
            </div>
          )}

          <div className="crat-card cabinet-mission">
            <h2>{t.lesson.missionTitle}</h2>
            <p className="crat-muted">{t.lesson.missionHint}</p>
            <form action={saveMissionAction}>
              <input type="hidden" name="courseSlug" value={courseSlug} />
              <input type="hidden" name="returnTo" value={`/app/${courseSlug}`} />
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
                      <Link className="reveal-line" href={`/app/${courseSlug}/lessons/${l.id}`}>{l.id} · {l.title}</Link>
                      <span className={`module-lesson-status ${statusClass}`}>{statusText}</span>
                    </li>
                  )
                })}</ul>
              </div>
            ))}
          </div>

          {/* T5: статус мини-проекта + ссылка — после списка уроков (PROJ-01…06). */}
          <div className="crat-card cabinet-project">
            <div>
              <h2 className="crat-kicker">{t.project.cabinetLinkLabel}</h2>
              <p className="crat-muted">{projectStatusText}</p>
            </div>
            <Link className="crat-button" href={`/app/${courseSlug}/project`}>{t.project.cabinetCta}</Link>
          </div>

          {/* Ф4 T5: ссылка на каталог тренажёров (TRN-01/06) — рядом с блоком мини-проекта.
              Тренажёры общие для кабинета (без courseSlug) — Ф7в T3 §5, не трогать /app/trainers. */}
          <div className="crat-card cabinet-project">
            <div>
              <h2 className="crat-kicker">{t.trainers.catalogTitle}</h2>
            </div>
            <Link className="crat-button" href="/app/trainers">{t.trainers.open}</Link>
          </div>

          {/* Ф7б Task 8, MC-03/CONS-01: блок-приглашение на консультацию по внедрению ИИ. */}
          <div className="crat-card cabinet-project">
            <div>
              <h2 className="crat-kicker">{t.consult.cabinetTitle}</h2>
              <p className="crat-muted">{t.consult.cabinetOfferText}</p>
            </div>
            <Link className="crat-button" href="/consult">{t.consult.cabinetCta}</Link>
          </div>

          {/* T7: блок сертификата — только при выданном VALID (CERT-01/05/06). */}
          {certificate && (
            <div className="crat-card cabinet-cert">
              <h2 className="crat-kicker">{t.cert.cabinetTitle}</h2>
              <p className="cert-number">{certificate.number}</p>
              <div className="cabinet-cert-actions">
                <Link className="crat-button primary" href={`/app/${courseSlug}/certificate`}>{t.cert.downloadPdf}</Link>
                <Link className="crat-button" href={`/cert/${certificate.number}`}>{t.cert.verifyPage}</Link>
              </div>
            </div>
          )}

          <div className="cabinet-account-row">
            <Link className="crat-button" href="/app/account">{t.auth.accountNavLabel}</Link>
            <form action={logoutAction}><button className="crat-button" type="submit">{t.auth.logout}</button></form>
          </div>
        </div>
      </section>
    </main>
  )
}
