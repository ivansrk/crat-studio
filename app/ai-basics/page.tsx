import type { Metadata } from 'next'
import Link from 'next/link'
import { getCourse, getLesson, lessonCount, lessonExcerpt } from '@/lib/content'
import { currentUser } from '@/lib/auth/current-user'
import { SignupForm } from '@/components/signup-form'
import { t } from '@/lib/i18n'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'
import { SectionLabel } from '@/components/site/SectionLabel'
import { HeroVisual } from '@/components/site/HeroVisual'
import { SectionShader } from '@/components/site/SectionShader'
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
  // Лендинг конкретного курса ai-basics — литерал корректен по смыслу маршрута.
  const { course } = getCourse('ai-basics')!
  const notice = signup === 'invalid' || signup === 'rate' || signup === 'already' ? signup : undefined
  // T7 дизайн-аудита (Б.6): «Выдержка из урока» — реальный текст урока 1.1 (lessonExcerpt
  // читает сырой lesson.mdx статично при билде). excerptFallback — честная деградация,
  // если в будущем контенте абзац не распарсится (см. lib/content/index.ts lessonExcerpt).
  const excerpt = lessonExcerpt('ai-basics', '1.1')
  const excerptText = excerpt?.text ?? t.landing.excerptFallback
  const excerptLessonTitle = excerpt?.lessonTitle ?? getLesson('ai-basics', '1.1')?.meta.title ?? ''
  const excerptCaption = t.landing.excerptCaption.replace('{title}', excerptLessonTitle)
  // Формат и условия (утверждён основателем): числа из getCourse/lessonCount, не хардкод.
  const formatFacts = t.landing.formatModulesLessons
    .replace('{modules}', String(course.modules.length))
    .replace('{lessons}', String(lessonCount('ai-basics')))

  return (
    <>
      <JsonLd data={courseSchema(course)} />
      <SiteHeader />
      <main className="crat-page">
        {/* Hero (бриф §8) */}
        <section className="crat-section hero-section">
          {/* T2 дизайн-аудита (D-042): тихий дизеринг за текстовой половиной,
              фото справа сверху не трогаем (протагонист) — .hero-section уже
              position:relative+overflow:hidden, .hero-grid уже z-index:1 (D-040). */}
          <SectionShader variant="course-dither" />
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
            <SectionLabel kicker={t.landing.forWhomKicker} />
            <h2 className="crat-display">{t.landing.forWhomTitle}</h2>
            <p className="crat-muted section-intro">{t.landing.forWhom}</p>
          </div>
        </section>

        {/* Программа — модули из course.yaml, карточная сетка */}
        <section className="crat-section" id="program">
          <div className="crat-shell">
            <SectionLabel kicker={t.landing.programKicker} />
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

        {/* «Выдержка из урока» (T7 дизайн-аудита, Б.6) — реальный текст урока 1.1,
            кадр-цитата между Программой и Результатом. */}
        <section className="crat-section">
          <div className="crat-shell">
            <SectionLabel kicker={t.landing.excerptKicker} />
            <div className="lesson-excerpt crat-visual-frame crat-noise">
              <p className="lesson-excerpt-text crat-em">{excerptText}</p>
              <span className="lesson-excerpt-caption crat-kicker">{excerptCaption}</span>
            </div>
          </div>
        </section>

        {/* Результат + Мини-проект и сертификат — один разворот (T7, Б.6): 2 колонки,
            resultTitle/projectTitle остаются подзаголовками колонок. */}
        <section className="crat-section" id="result">
          <div className="crat-shell">
            <SectionLabel kicker={t.landing.resultProjectKicker} />
            <h2 className="crat-display">{t.landing.resultProjectTitle}</h2>
            <div className="result-project-grid">
              <div className="result-project-col">
                <span className="crat-kicker">{t.landing.resultKicker}</span>
                <h3 className="crat-display result-project-heading">{t.landing.resultTitle}</h3>
                <p className="crat-muted">{t.landing.result}</p>
              </div>
              <div className="result-project-col">
                <span className="crat-kicker">{t.landing.projectKicker}</span>
                <h3 className="crat-display result-project-heading">{t.landing.projectTitle}</h3>
                <p className="crat-muted">{t.landing.projectText}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Формат и условия (утверждён основателем): факты из course, БЕЗ карточек-коробок —
            компактный список с красными линиями-разделителями (анти-дефолт). Цена/даты —
            честная заглушка до фактуры от Ивана (TODO ниже), цифры не выдумываем. */}
        <section className="crat-section">
          <div className="crat-shell">
            <SectionLabel kicker={t.landing.formatKicker} />
            <h2 className="crat-display">{t.landing.formatTitle}</h2>
            <ul className="format-facts">
              <li className="format-fact">
                <span className="crat-red-line" aria-hidden="true" />
                {formatFacts}
              </li>
              <li className="format-fact">
                <span className="crat-red-line" aria-hidden="true" />
                {t.landing.formatOnline}
              </li>
              <li className="format-fact">
                <span className="crat-red-line" aria-hidden="true" />
                {t.landing.formatPractice}
              </li>
              <li className="format-fact">
                <span className="crat-red-line" aria-hidden="true" />
                {t.landing.formatProject}
              </li>
              <li className="format-fact">
                <span className="crat-red-line" aria-hidden="true" />
                {t.landing.formatCert}
              </li>
            </ul>
            {/* TODO(Иван): факты по цене/датам старта — прислать; до тех пор честная
                заглушка вместо выдуманной цифры (запрет из брифа §13). */}
            <p className="crat-muted format-price-note">{t.landing.formatPriceNote}</p>
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
