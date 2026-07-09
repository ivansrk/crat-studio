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
  return (
    <>
      <SiteHeader />
      <main className="crat-page">
        <section className="crat-section">
          <div className="crat-shell">
            <SectionLabel kicker={t.landing.courseLabel} />
            <h1 className="crat-display">{t.landing.signupTitle}</h1>
            {user
              ? <p><Link className="crat-button primary" href="/app">{t.home.toCabinet}</Link></p>
              : <SignupForm returnTo="/register" showTitle={false} notice={signup === 'invalid' ? 'invalid' : signup === 'rate' ? 'rate' : undefined} />}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
