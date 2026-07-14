import type { Metadata } from 'next'
import Link from 'next/link'
import { currentUser } from '@/lib/auth/current-user'
import { SignupForm } from '@/components/signup-form'
import { t } from '@/lib/i18n'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'
import { SectionLabel } from '@/components/site/SectionLabel'

export const metadata: Metadata = {
  title: t.seo.registerTitle,
  description: t.landing.signupNote,
  alternates: { canonical: '/register' },
}

/** SITE-03: та же форма заявки по прямой ссылке. */
export default async function Register({ searchParams }: { searchParams: Promise<{ signup?: string }> }) {
  const { signup } = await searchParams
  const user = await currentUser()
  const notice = signup === 'invalid' || signup === 'rate' || signup === 'already' ? signup : undefined
  return (
    <>
      <SiteHeader />
      <main className="crat-page">
        <section className="crat-section">
          {/* T9b дизайн-аудита (3 точечные правки): тот же вертикальный кадр, что на /login,
              /reset, 404 (auth-layout/auth-frame-col, components/site.css) — раньше правая
              колонка на ≥1024 пустовала. Форма первая в DOM (auth-frame-col aria-hidden), для
              клавиатуры/скринридера порядок логичный. */}
          <div className="crat-shell auth-layout">
            <div>
              <SectionLabel kicker={t.landing.courseLabel} />
              <h1 className="crat-display">{t.landing.signupTitle}</h1>
              {user
                ? <p><Link className="crat-button primary" href="/app">{t.home.toCabinet}</Link></p>
                : <SignupForm returnTo="/register" showTitle={false} notice={notice} />}
            </div>
            <div className="crat-visual-frame horizon crat-noise auth-frame-col" aria-hidden="true" />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
