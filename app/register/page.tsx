import type { Metadata } from 'next'
import Link from 'next/link'
import { currentUser } from '@/lib/auth/current-user'
import { SignupForm } from '@/components/signup-form'
import { t } from '@/lib/i18n'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'

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
      <main>
        <h1>{t.landing.signupTitle}</h1>
        {user
          ? <p><Link className="mdx-download" href="/app">{t.home.toCabinet}</Link></p>
          : <SignupForm returnTo="/register" showTitle={false} notice={signup === 'invalid' ? 'invalid' : signup === 'rate' ? 'rate' : undefined} />}
      </main>
      <SiteFooter />
    </>
  )
}
