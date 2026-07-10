import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCourses, lessonCount, splitCourseCatalog, soleCourseRedirect } from '@/lib/content'
import { currentUser } from '@/lib/auth/current-user'
import { getCourseProgress } from '@/lib/progress'
import { getDueDeferred } from '@/lib/progress/deferred'
import { db } from '@/lib/db'
import { t } from '@/lib/i18n'

// MC-03: единственный published-курс с публичным лендингом в MVP — /ai-basics.
// Будущие курсы без лендинга получают карточку без ссылки («скоро подробности») —
// конвенция /{slug} для будущих лендингов пока не заведена (нет ни одного примера).
const COURSE_LANDING: Record<string, string> = { 'ai-basics': '/ai-basics' }

/** MC-03: /app — хаб «Мои курсы» + каталог остальных курсов + консультации/повторение.
 *  Курсовые вещи (миссия, горизонт-прогресс, модули/уроки, мини-проект, сертификат) живут на
 *  /app/{courseSlug} — хаб их НЕ дублирует. Единственный enrollment и пустой каталог
 *  остальных курсов → редирект сразу на /app/{slug} (soleCourseRedirect), без лишнего клика. */
export default async function Cabinet() {
  // currentUser не null после layout-гейта (app/app/layout.tsx), но TS этого не знает —
  // на всякий случай (истёкшая сессия между рендерами) отправляем на /login, а не падаем.
  const user = await currentUser()
  if (!user) redirect('/login')

  const enrollments = await db.enrollment.findMany({ where: { userId: user.id } })
  const { mine, others } = splitCourseCatalog(getCourses(), enrollments.map(e => e.courseSlug))

  const redirectSlug = soleCourseRedirect(mine, others)
  if (redirectSlug) redirect(`/app/${redirectSlug}`)

  const myCourses = await Promise.all(mine.map(async entry => {
    const { completedCount } = await getCourseProgress(user.id, entry.slug)
    return { slug: entry.slug, title: entry.course.title, completedCount, total: lessonCount(entry.slug) }
  }))

  // Ф4 T2/F19: due-блок повторения (CAB-04/06) — по всем курсам студента (без courseSlug — deferred.ts T2).
  const dueReview = await getDueDeferred(user.id)

  return (
    <main className="crat-page">
      <section className="crat-section">
        <div className="crat-shell">
          <h1 className="crat-display">{t.auth.cabinetTitle}</h1>

          {dueReview && (
            <div className="crat-card cabinet-review">
              <h2 className="crat-kicker">{t.review.kicker}</h2>
              <p className="cabinet-review-title">{t.review.cabinetTitle}</p>
              <p className="crat-muted">{t.review.lessonLabel}: {dueReview.lessonTitle}</p>
              <Link className="crat-button primary" href="/app/review">{t.review.submit}</Link>
            </div>
          )}

          <section aria-label={t.cabinet.myCoursesAria} className="cabinet-hub-section">
            <h2 className="crat-kicker">{t.cabinet.myCourses}</h2>
            {myCourses.length === 0 ? (
              <p className="crat-muted">{t.cabinet.noCourses}</p>
            ) : (
              <div className="cabinet-course-grid">
                {myCourses.map(c => (
                  <Link key={c.slug} href={`/app/${c.slug}`} className="crat-card course-card">
                    <h3>{c.title}</h3>
                    <p className="crat-muted">{c.completedCount}/{c.total} · {t.cabinet.progressLabel}</p>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Ф4 T5: ссылка на каталог тренажёров (TRN-01/06) — общие для всех курсов кабинета. */}
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

          {/* T4 дизайн-аудита: каталог «Другие курсы» (сейчас — только «Демо-курс · Скоро»)
              смещён в самый низ хаба, после консультации, и приглушён — это витрина будущего,
              не действие, которое сейчас ждут от студента. */}
          {others.length > 0 && (
            <section aria-label={t.cabinet.catalogAria} className="cabinet-hub-section cabinet-hub-section-quiet">
              <h2 className="crat-kicker">{t.cabinet.catalog}</h2>
              <div className="cabinet-course-grid">
                {others.map(entry => {
                  if (!entry.published) {
                    // E-MC3/MC-02: неопубликованный курс — карточка «Скоро», без ссылки.
                    return (
                      <div key={entry.slug} className="crat-card course-card course-card-soon">
                        <h3>{entry.course.title}</h3>
                        <span className="course-card-badge">{t.cabinet.comingSoon}</span>
                      </div>
                    )
                  }
                  const landing = COURSE_LANDING[entry.slug]
                  if (!landing) {
                    // published, но лендинга пока нет (только ai-basics имеет /ai-basics) — карточка без ссылки.
                    return (
                      <div key={entry.slug} className="crat-card course-card course-card-soon">
                        <h3>{entry.course.title}</h3>
                        <p className="crat-muted">{t.cabinet.catalogDetailsSoon}</p>
                      </div>
                    )
                  }
                  return (
                    <Link key={entry.slug} href={landing} className="crat-card course-card">
                      <h3>{entry.course.title}</h3>
                      <p className="crat-muted">{lessonCount(entry.slug)} {t.cabinet.catalogLessonsLabel}</p>
                      <span className="crat-button">{t.cabinet.catalogLearnMore}</span>
                    </Link>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      </section>
    </main>
  )
}
