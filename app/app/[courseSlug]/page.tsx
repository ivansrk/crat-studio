import Link from 'next/link'
import type { CSSProperties } from 'react'
import { notFound, redirect } from 'next/navigation'
import { getCourse, lessonCount } from '@/lib/content'
import { currentUser } from '@/lib/auth/current-user'
import { hasCourseAccess } from '@/lib/progress/access'
import { getCourseProgress } from '@/lib/progress'
import { isLessonPassed } from '@/lib/progress/quiz-logic'
import { getDueDeferred } from '@/lib/progress/deferred'
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

/** /app/{courseSlug} — курсо-зависимый кабинет (MC-04), перенос app/app/page.tsx
 *  с параметризацией. /app сам по себе остаётся хабом (каталог/«Мои курсы»). */
export default async function CourseCabinet({ params }: { params: Promise<{ courseSlug: string }> }) {
  const { courseSlug } = await params
  const entry = getCourse(courseSlug)
  if (!entry || !entry.published) notFound() // MC-01/02: неизвестный/неопубликованный курс — 404

  // currentUser не null после layout-гейта (app/app/layout.tsx), но TS этого не знает —
  // на всякий случай (истёкшая сессия между рендерами) отправляем на /login, а не падаем.
  const user = await currentUser()
  if (!user) redirect('/login')

  if (!(await hasCourseAccess(user, courseSlug))) { // MC-07
    // T4 дизайн-аудита: локальная кнопка «Выйти» убрана — CabinetHeader (app/app/layout.tsx)
    // теперь единственный источник этой ссылки на ВСЕХ страницах кабинета, дубль не нужен.
    return (
      <main className="crat-page">
        <section className="crat-section">
          <div className="crat-shell">
            <h1 className="crat-display">{t.auth.cabinetTitle}</h1>
            <p className="crat-muted">{t.cabinet.noAccess}</p>
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
              точка света идёт по существующему pct; статус здания считается из byLesson
              (данные не меняются). Статус модуля посчитан один раз — из него рендерятся
              ОБЕ сцены (десктопные здания + мобильные засечки ≤540px, cabinet.css). */}
          <section aria-label={t.cabinet.progressAria} className="horizon">
            {(() => {
              const moduleStatuses = course.modules.map(m => {
                const rows = m.lessons.map(l => byLesson.get(l.id))
                const passedCount = rows.filter(r => isLessonPassed(r)).length
                const started = rows.some(Boolean)
                const status = passedCount === m.lessons.length ? 'done' as const : started ? 'partial' as const : 'none' as const
                return { id: m.id, title: m.title, status }
              })
              return (
                <>
                  <div className="horizon-buildings">
                    {moduleStatuses.map(m => (
                      <div key={m.id} className={`building building-${m.status}`}>
                        <span className={`building-sign building-sign-${m.status}${m.status === 'done' ? ' red-glow' : ''}`}>{m.title}</span>
                      </div>
                    ))}
                  </div>
                  <div className="horizon-ticks" aria-hidden>
                    {moduleStatuses.map(m => (
                      <div key={m.id} className={`horizon-tick horizon-tick-${m.status}`}>
                        <span className="horizon-tick-dot" />
                        <span className="horizon-tick-label">M{m.id}</span>
                      </div>
                    ))}
                  </div>
                </>
              )
            })()}
            <div className="progress-track">
              {/* T3 дизайн-аудита: линия горизонта — та же величина pct, что и left
                  точки света ниже, только как коэффициент 0..1 для scaleX. */}
              <span className="progress-fill" style={{ '--p': pct / 100 } as CSSProperties} aria-hidden />
              <span className="progress-figure" style={{ left: `${pct}%` }} aria-hidden />
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

          {/* T5: статус мини-проекта + ссылка — после списка уроков (PROJ-01…06).
              SUBMITTED — спокойный mono-статус (ничего делать не нужно, не тревога);
              NEEDS_CHANGES — alert-карточка с красной линией (не шёпот, П6 дизайн-аудита):
              полный комментарий проверяющего — на самой странице проекта, здесь только
              заметный статус-триггер, чтобы студент точно не пропустил. */}
          <div className={`crat-card cabinet-project${projectSubmission?.status === 'NEEDS_CHANGES' ? ' alert-card' : ''}`}>
            <div>
              <h2 className="crat-kicker">{t.project.cabinetLinkLabel}</h2>
              {projectSubmission?.status === 'NEEDS_CHANGES' && <span className="crat-red-line alert-card-line" aria-hidden />}
              {projectSubmission?.status === 'SUBMITTED' ? (
                <p className="status-badge-calm">{t.project.statusSubmittedTitle}</p>
              ) : (
                <p className="crat-muted">{projectStatusText}</p>
              )}
            </div>
            <Link className="crat-button" href={`/app/${courseSlug}/project`}>{t.project.cabinetCta}</Link>
          </div>

          {/* T4 дизайн-аудита: карточки «Тренажёры»/«Консультация» убраны с курсовой
              страницы (дублировали хаб /app) — остаются только там, курсовая страница
              теперь только про сам курс (модули/уроки/проект/сертификат). */}

          {/* T7/T5: блок сертификата — только при выданном VALID (CERT-01/05/06).
              T5 дизайн-аудита: «сертификат-триумф» — кремовый документ (.cert-document)
              вместо голого номера, печать CRAT, кнопки под документом.
              Ревью T4-T5 m6: GodRays (SectionShader celebrate-rays) сознательно только на
              /cert и финале квиза — в кабинете документ сам является праздником, лучи за
              уже светлым cream-документом со штампом перегрузили бы блок. */}
          {certificate && (
            <div className="crat-card cabinet-cert">
              <h2 className="crat-kicker">{t.cert.cabinetReadyTitle}</h2>
              <div className="cert-document">
                <span className="crat-stamp" aria-hidden />
                <p className="crat-kicker cert-document-kicker">{t.cert.issuedTo}</p>
                <p className="cert-document-name">{certificate.fullName ?? '—'}</p>
                <p className="cert-document-course">{t.cert.completedCourse} «{certificate.courseTitle}»</p>
                <p className="cert-document-number">{certificate.number}</p>
              </div>
              <div className="cabinet-cert-actions">
                <Link className="crat-button primary" href={`/app/${courseSlug}/certificate`}>{t.cert.downloadPdf}</Link>
                <Link className="crat-button" href={`/cert/${certificate.number}`}>{t.cert.verifyPage}</Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
