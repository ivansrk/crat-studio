import Link from 'next/link'
import { getCourse, lessonCount } from '@/lib/content'
import { t } from '@/lib/i18n'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'
import { HeroVisual } from '@/components/site/HeroVisual'
import { SectionLabel } from '@/components/site/SectionLabel'
import { DirectionCard } from '@/components/site/DirectionCard'
import { TeamCard } from '@/components/site/TeamCard'
import { JsonLd, organizationSchema } from '@/components/site/JsonLd'
import { HeroShader } from '@/components/site/HeroShader'
import { SectionShader } from '@/components/site/SectionShader'
import Image from 'next/image'

/**
 * Главная — редакционный монтаж CRAT (SITE-01/07/08/09, бриф §7).
 * Порядок секций строго по брифу: hero → направления → курс в фокусе →
 * автоматизации → студия → этика → процесс → команда → опыт → контакты.
 * SITE-04 (Войти/В кабинет) — целиком в SiteHeader, hero-CTA не зависят от сессии.
 */
export default function Home() {
  // Главная показывает первый курс литералом; при мультикаталоге на главной — переработать.
  const { course } = getCourse('ai-basics')!
  const courseFacts = t.home.courseFacts
    .replace('{modules}', String(course.modules.length))
    .replace('{lessons}', String(lessonCount('ai-basics')))

  return (
    <>
      <JsonLd data={organizationSchema()} />
      <SiteHeader />
      <main className="crat-home">
        {/* 1. Hero (бриф §7.2; шейдерный фон — D-040) */}
        <section className="crat-section hero-section">
          <HeroShader />
          <div className="crat-shell hero-grid">
            <div className="hero-copy">
              <span className="crat-kicker fade-up d1">{t.home.label}</span>
              <h1 className="crat-display fade-up d2">{t.home.heroTitle}</h1>
              <p className="crat-muted hero-subtitle fade-up d2">{t.home.heroSubtitle}</p>
              <div className="hero-cta-row fade-up d3">
                <Link href="/ai-basics" className="crat-button primary">{t.home.primaryCta}</Link>
                <Link href="/#contact" className="crat-button secondary">{t.home.secondaryCta}</Link>
              </div>
            </div>
            <HeroVisual />
          </div>
        </section>

        {/* 2. Три направления (бриф §7.3) */}
        <section className="crat-section">
          <div className="crat-shell">
            <h2 className="crat-display">{t.home.directionsTitle}</h2>
            <div className="crat-grid direction-grid">
              <DirectionCard
                kicker={t.home.educationKicker}
                title={t.home.educationTitle}
                text={t.home.educationText}
                image="/images/dir-education.webp"
              />
              <DirectionCard
                kicker={t.home.automationKicker}
                title={t.home.automationTitle}
                text={t.home.automationText}
                image="/images/dir-automation.webp"
              />
              <DirectionCard
                kicker={t.home.creativeKicker}
                title={t.home.creativeTitle}
                text={t.home.creativeText}
                image="/images/dir-creative.webp"
              />
            </div>
          </div>
        </section>

        {/* 3. Курс в фокусе (бриф §7.4) — T6: киноафиша 3fr/2fr, курс как главный товар */}
        <section className="crat-section" id="course">
          <div className="crat-shell">
            <div className="course-focus-grid">
              <div className="course-focus-copy">
                <SectionLabel kicker={t.home.courseFocusTitle} />
                <h3 className="crat-display">{course.title}</h3>
                <p className="crat-muted course-facts">{courseFacts}</p>
                <Link href="/ai-basics" className="crat-button primary">{t.home.courseCta}</Link>
              </div>
              <div className="crat-visual-frame horizon crat-noise course-focus-frame" aria-hidden="true">
                <Image
                  src="/images/hero-course.webp"
                  alt=""
                  fill
                  sizes="(max-width: 860px) 100vw, 40vw"
                  className="crat-frame-img"
                />
              </div>
            </div>
          </div>
        </section>

        {/* 4. Автоматизации (бриф §7.5) — T6: mono-список с display-цифрами вместо карточной сетки */}
        <section className="crat-section" id="automation">
          <div className="crat-shell">
            <h2 className="crat-display">{t.home.automationSectionTitle}</h2>
            <p className="crat-muted section-intro">{t.home.automationSectionText}</p>
            <ul className="mono-list">
              {t.home.automationCards.map((card, i) => (
                <li key={card} className="mono-list-row">
                  <span className="mono-list-num crat-display" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                  <p className="mono-list-text">{card}</p>
                </li>
              ))}
            </ul>
            <Link href="/#contact" className="crat-button">{t.home.automationCta}</Link>
          </div>
        </section>

        {/* 5. Креативная студия (бриф §7.6) — T6: full-bleed сетка + лаймовый горизонт (D-041) */}
        <section className="crat-section studio-section" id="studio">
          <div className="crat-shell">
            <SectionLabel kicker={t.footer.navStudio} />
            <h2 className="crat-display">{t.home.creativeSectionTitle}</h2>
            <p className="crat-muted section-intro">{t.home.creativeSectionText}</p>
          </div>
          <div className="studio-bleed">
            <span className="studio-horizon" aria-hidden="true" />
            <div className="studio-grid">
              <div className="crat-visual-frame crat-noise studio-frame-a" aria-hidden="true">
                <Image src="/images/studio-1.webp" alt="" fill sizes="(max-width: 760px) 100vw, 50vw" className="crat-frame-img" />
              </div>
              <div className="crat-visual-frame crat-noise studio-frame-b" aria-hidden="true">
                <Image src="/images/studio-2.webp" alt="" fill sizes="(max-width: 760px) 100vw, 25vw" className="crat-frame-img" />
              </div>
              <div className="crat-visual-frame crat-noise studio-frame-c" aria-hidden="true">
                <Image src="/images/studio-3.webp" alt="" fill sizes="(max-width: 760px) 100vw, 25vw" className="crat-frame-img" />
              </div>
              <div className="crat-visual-frame crat-noise studio-frame-d" aria-hidden="true">
                <Image src="/images/studio-4.webp" alt="" fill sizes="(max-width: 760px) 100vw, 50vw" className="crat-frame-img" />
              </div>
            </div>
          </div>
        </section>

        {/* 6. Этика (бриф §7.7) — T6: full-bleed манифест, единственный «цветовой акт» страницы */}
        <section className="crat-section ethics-section">
          <div className="crat-shell">
            <h2 className="crat-display">{t.home.ethicsTitle}</h2>
          </div>
          <div className="ethics-manifesto">
            <div className="crat-shell">
              <p className="crat-display ethics-manifesto-text">{t.home.ethicsManifesto}</p>
              <p className="crat-muted ethics-manifesto-sub">{t.home.ethicsText}</p>
            </div>
          </div>
        </section>

        {/* 7. Как мы работаем (бриф §7.8) — T6: монтажная линейка на красной линии */}
        <section className="crat-section">
          <div className="crat-shell">
            <h2 className="crat-display">{t.home.processTitle}</h2>
            <ol className="process-line">
              {t.home.processSteps.map((step, i) => (
                <li key={step} className="process-line-step">
                  <span className="process-line-num crat-display" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                  <p className="process-line-text">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 8. Команда (бриф §7.9 / §11) */}
        <section className="crat-section" id="team">
          <div className="crat-shell">
            <h2 className="crat-display">{t.home.teamTitle}</h2>
            <p className="crat-muted section-intro">{t.home.teamSubtitle}</p>
            <div className="team-grid">
              {t.team.map(member => (
                <TeamCard
                  key={member.num}
                  num={member.num}
                  name={member.name}
                  role={member.role}
                  text={member.text}
                  tags={member.tags}
                />
              ))}
            </div>
          </div>
        </section>

        {/* 9. Опыт (бриф §7.10) */}
        <section className="crat-section">
          <div className="crat-shell">
            <h2 className="crat-display">{t.home.expTitle}</h2>
            <p className="crat-muted section-intro">{t.home.expText}</p>
            <ul className="exp-facts">
              {t.home.expFacts.map(fact => (
                <li key={fact} className="exp-fact">
                  <span className="crat-red-line" aria-hidden="true" />
                  {fact}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 10. Контакты (бриф §7.11) */}
        <section className="crat-section shader-scope" id="contact">
          {/* T2 дизайн-аудита (D-042): волна-эхо hero-шейдера, тише — см. site.css .section-shader--contact-ripple. */}
          <SectionShader variant="contact-ripple" />
          <div className="crat-shell shader-content">
            <h2 className="crat-display">{t.home.contactTitle}</h2>
            <p className="crat-muted section-intro">{t.home.contactText}</p>
            <div className="hero-cta-row">
              <Link href="/ai-basics#signup" className="crat-button primary">{t.home.contactCourseCta}</Link>
              <a href={`mailto:${t.footer.contactEmail}`} className="crat-button secondary">{t.home.contactProjectCta}</a>
              {/* Ф7б Task 8, CONS-01: вторая точка входа на консультацию по внедрению ИИ, не меняя существующие кнопки. */}
              <Link href="/consult" className="crat-button secondary">{t.home.contactConsultCta}</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
