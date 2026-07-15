import Link from 'next/link'
import { getCourses, lessonCount } from '@/lib/content'
import { t } from '@/lib/i18n'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'
import { HeroVisual } from '@/components/site/HeroVisual'
import { SectionLabel } from '@/components/site/SectionLabel'
import { DirectionCard } from '@/components/site/DirectionCard'
import { CourseCard } from '@/components/site/CourseCard'
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
  // Каталог курсов строится от данных: getCourses() (slug asc), только опубликованные —
  // неопубликованные (demo-course, published:false) на публичную главную не выводим.
  // Сейчас это ровно один курс; второй появится карточкой без правок кода (MC-02).
  // Первый курс — крупная афиша с кадром hero-course.webp (протагонист), остальные —
  // тихие карточки; фото у первого литералом, новый курс нового ассета не требует.
  const courses = getCourses().filter(c => c.published)

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

        {/* 3. Каталог курсов (бриф §7.4) — от данных getCourses(); якорь #course сохранён
            (на него ссылаются шапка и футер «Курсы»). Композиция «афиша + тумба»: первый
            курс — крупная киноафиша (протагонист-кадр), рядом рельс с остальными курсами
            и тихой заглушкой «скоро». Не симметричная сетка 3×N — монтаж 3fr/2fr. */}
        <section className="crat-section" id="course">
          <div className="crat-shell">
            <SectionLabel kicker={t.home.coursesKicker} />
            <h2 className="crat-display">{t.home.coursesTitle}</h2>
            <div className="courses-catalog">
              <div className="courses-featured">
                {courses.slice(0, 1).map(c => (
                  <CourseCard
                    key={c.slug}
                    href={`/${c.slug}`}
                    title={c.course.title}
                    modules={c.course.modules.length}
                    lessons={lessonCount(c.slug)}
                    hours={c.hours}
                    featured
                    image="/images/hero-course.webp"
                  />
                ))}
              </div>
              <div className="courses-rail">
                {courses.slice(1).map(c => (
                  <CourseCard
                    key={c.slug}
                    href={`/${c.slug}`}
                    title={c.course.title}
                    modules={c.course.modules.length}
                    lessons={lessonCount(c.slug)}
                    hours={c.hours}
                  />
                ))}
                {/* Тихий слот будущих курсов — редакционная заглушка, не битая карточка:
                    dashed-контур + mono-лейбл «Скоро» отличают её от настоящих карточек. */}
                <aside className="course-upcoming">
                  <span className="crat-kicker course-upcoming-label">{t.home.coursesUpcomingLabel}</span>
                  <p className="course-upcoming-title">{t.home.coursesUpcomingTitle}</p>
                  <p className="crat-muted course-upcoming-text">{t.home.coursesUpcomingText}</p>
                  <Link href="/consult" className="crat-button secondary course-upcoming-cta">{t.home.coursesUpcomingCta}</Link>
                </aside>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Автоматизации (бриф §7.5) — T6: mono-список с display-цифрами вместо карточной сетки */}
        <section className="crat-section" id="automation">
          <div className="crat-shell">
            <h2 className="crat-display">{t.home.automationSectionTitle}</h2>
            <p className="crat-muted section-intro">{t.home.automationSectionText}</p>
            {/* impeccable Assessment A: display-цифры 01–04 убраны — список не последовательность
                шагов, номера читались как рефлекс дизайна, а не смысл; красная линия-разделитель
                (.mono-list-row border-bottom) остаётся единственным ритмическим элементом. */}
            <ul className="mono-list">
              {t.home.automationCards.map((card) => (
                <li key={card} className="mono-list-row">
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
              {/* T7 дизайн-аудита (Б.8): mono-подписи под кадрами — честные к содержимому
                  (см. комментарий у home.studioCaption* в ru.ts). grid-area переехала на
                  <figure>, картинка/зерно — на вложенный .crat-visual-frame (aria-hidden). */}
              <figure className="studio-frame-a">
                <div className="crat-visual-frame crat-noise" aria-hidden="true">
                  <Image src="/images/studio-1.webp" alt="" fill sizes="(max-width: 760px) 100vw, 50vw" className="crat-frame-img" />
                </div>
                <figcaption className="studio-frame-caption">{t.home.studioCaptionA}</figcaption>
              </figure>
              <figure className="studio-frame-b">
                <div className="crat-visual-frame crat-noise" aria-hidden="true">
                  <Image src="/images/studio-2.webp" alt="" fill sizes="(max-width: 760px) 100vw, 25vw" className="crat-frame-img" />
                </div>
                <figcaption className="studio-frame-caption">{t.home.studioCaptionB}</figcaption>
              </figure>
              <figure className="studio-frame-c">
                <div className="crat-visual-frame crat-noise" aria-hidden="true">
                  <Image src="/images/studio-3.webp" alt="" fill sizes="(max-width: 760px) 100vw, 25vw" className="crat-frame-img" />
                </div>
                <figcaption className="studio-frame-caption">{t.home.studioCaptionC}</figcaption>
              </figure>
              <figure className="studio-frame-d">
                <div className="crat-visual-frame crat-noise" aria-hidden="true">
                  <Image src="/images/studio-4.webp" alt="" fill sizes="(max-width: 760px) 100vw, 50vw" className="crat-frame-img" />
                </div>
                <figcaption className="studio-frame-caption">{t.home.studioCaptionD}</figcaption>
              </figure>
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
                  photo={member.photo}
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

        {/* Перфорация киноплёнки (T7 дизайн-аудита, Б.8) — тихий разделитель-décor перед
            финальным CTA; main.crat-home уже full-bleed, вылезать из crat-shell не нужно. */}
        <div className="film-perforation" aria-hidden="true" />

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
