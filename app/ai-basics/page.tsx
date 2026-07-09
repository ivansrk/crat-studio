import type { Metadata } from 'next'
import Link from 'next/link'
import { getContent } from '@/lib/content'
import { currentUser } from '@/lib/auth/current-user'
import { SignupForm } from '@/components/signup-form'
import { t } from '@/lib/i18n'

export const metadata: Metadata = {
  title: t.seo.landingTitle,
  description: t.seo.landingDescription,
  alternates: { canonical: '/ai-basics' },
}

export default async function Landing({ searchParams }: { searchParams: Promise<{ signup?: string }> }) {
  const { signup } = await searchParams
  const user = await currentUser()
  const { course } = getContent()
  return (
    <main>
      <h1>{course.title}</h1>
      <h2>{t.landing.forWhomTitle}</h2>
      <p>{t.landing.forWhom}</p>
      {user
        ? <p><Link className="mdx-download" href="/app">{t.home.toCabinet}</Link></p>
        : <p><a className="mdx-download" href="#signup">{t.landing.signupTitle}</a></p>}
      <h2>{t.landing.programTitle}</h2>
      {course.modules.map(m => (
        <section key={m.id}><h3>{m.title}</h3>
          <ul>{m.lessons.map(l => <li key={l.id}>{l.title}</li>)}</ul></section>
      ))}
      <h2>{t.landing.resultTitle}</h2>
      <p>{t.landing.result}</p>
      {!user && <SignupForm notice={signup === 'invalid' ? 'invalid' : signup === 'rate' ? 'rate' : undefined} />}
    </main>
  )
}
