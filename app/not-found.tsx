import Link from 'next/link'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'
import { SectionLabel } from '@/components/site/SectionLabel'
import { t } from '@/lib/i18n'

// T8 дизайн-аудита (П1): глобальная 404 в стиле CRAT. Раньше сюда (и во ВСЕ вызовы notFound() —
// /admin вне сессии, /app/[courseSlug] с неизвестным slug, /unsubscribe без токена в адресе и т.п.)
// падал английский дефолт Next.js — нарушение i18n (правило 4) и бренда. Тот же приём «тёмная
// сцена», что у /login /reset: auth-layout (узкая колонка текста + crat-visual-frame.horizon
// справа на ≥1024, скрыта на мобиле) — без формы, только три выхода.
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="crat-page">
        <section className="crat-section">
          <div className="crat-shell auth-layout">
            <div>
              <SectionLabel kicker={t.notFound.kicker} />
              <h1 className="crat-display">{t.notFound.title}</h1>
              <p className="crat-muted">{t.notFound.body}</p>
              <nav className="not-found-links" aria-label={t.notFound.navAria}>
                <Link className="crat-button primary" href="/">{t.notFound.toHome}</Link>
                <Link className="crat-button" href="/ai-basics">{t.notFound.toCourse}</Link>
                <Link className="crat-button" href="/app">{t.notFound.toCabinet}</Link>
              </nav>
            </div>
            <div className="crat-visual-frame horizon crat-noise auth-frame-col" aria-hidden="true" />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
