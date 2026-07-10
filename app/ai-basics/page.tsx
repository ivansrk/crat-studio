import type { Metadata } from 'next'
import Link from 'next/link'
import { getCourse } from '@/lib/content'
import { currentUser } from '@/lib/auth/current-user'
import { SignupForm } from '@/components/signup-form'
import { t } from '@/lib/i18n'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'
import { SectionLabel } from '@/components/site/SectionLabel'
import { HeroVisual } from '@/components/site/HeroVisual'
import { JsonLd, courseSchema } from '@/components/site/JsonLd'

export const metadata: Metadata = {
  title: t.seo.landingTitle,
  description: t.seo.landingDescription,
  alternates: { canonical: '/ai-basics' },
}

/**
 * Лендинг курса (SITE-02/03/04, бриф §8). Логика Ф1 не меняется: программа —
 * из course.yaml, форма — по якорю #signup (сам якорь живёт на <form>
 * в SignupForm), SITE-04 — «В кабинет» вместо CTA заявки при сессии.
 * Только визуальный слой: система CRAT (Task 1–4).
 */
export default async function Landing({ searchParams }: { searchParams: Promise<{ signup?: string }> }) {
  const { signup } = await searchParams
  const user = await currentUser()
  const { course } = getCourse('ai-basics')! // Ф7в T3: заменить на courseSlug из маршрута
  const notice = signup === 'invalid' || signup === 'rate' || signup === 'already' ? signup : undefined

  return (
    <>
      <JsonLd data={courseSchema(course)} />
      <SiteHeader />
      <main className="crat-page">
        {/* Hero (бриф §8) */}
        <section className="crat-section hero-section">
          <div className="crat-shell hero-grid">
            <div className="hero-copy">
              <span className="crat-kicker fade-up d1">{t.landing.courseLabel}</span>
              <span className="crat-red-line fade-up d1" aria-hidden="true" />
              <h1 className="crat-display fade-up d2">{course.title}</h1>
              <p className="crat-muted hero-subtitle fade-up d2">{t.landing.heroSubtitle}</p>
              <div className="hero-cta-row fade-up d3">
                {user
                  ? <Link href="/app" className="crat-button primary">{t.home.toCabinet}</Link>
                  : <a href="#signup" className="crat-button primary">{t.landing.signupTitle}</a>}
              </div>
            </div>
            <HeroVisual src="/images/hero-course.webp" />
          </div>
        </section>

        {/* Для кого */}
        <section className="crat-section">
          <div className="crat-shell">
            <SectionLabel kicker={t.landing.courseLabel} />
            <h2 className="crat-display">{t.landing.forWhomTitle}</h2>
            <p className="crat-muted section-intro">{t.landing.forWhom}</p>
          </div>
        </section>

        {/* Программа — модули из course.yaml, карточная сетка */}
        <section className="crat-section" id="program">
          <div className="crat-shell">
            <SectionLabel kicker={t.landing.courseLabel} />
            <h2 className="crat-display">{t.landing.programTitle}</h2>
            <div className="program-grid">
              {course.modules.map(m => (
                <article key={m.id} className="crat-card program-module">
                  <span className="crat-kicker program-module-num">{String(m.id).padStart(2, '0')}</span>
                  <h3>{m.title}</h3>
                  <ol className="program-lessons">
                    {m.lessons.map(l => (
                      <li key={l.id}>
                        <span className="crat-kicker program-lesson-num">{l.id}</span>
                        {l.title}
                      </li>
                    ))}
                  </ol>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Результат */}
        <section className="crat-section">
          <div className="crat-shell">
            <SectionLabel kicker={t.landing.courseLabel} />
            <h2 className="crat-display">{t.landing.resultTitle}</h2>
            <p className="crat-muted section-intro">{t.landing.result}</p>
          </div>
        </section>

        {/* Мини-проект и сертификат */}
        <section className="crat-section">
          <div className="crat-shell">
            <SectionLabel kicker={t.landing.courseLabel} />
            <h2 className="crat-display">{t.landing.projectTitle}</h2>
            <p className="crat-muted section-intro">{t.landing.projectText}</p>
          </div>
        </section>

        {/* Форма заявки */}
        {!user && (
          <section className="crat-section">
            <div className="crat-shell">
              <SignupForm notice={notice} />
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  )
}
