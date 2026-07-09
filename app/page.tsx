import Link from 'next/link'
import { getContent } from '@/lib/content'
import { currentUser } from '@/lib/auth/current-user'
import { t } from '@/lib/i18n'

export default async function Home() {
  const user = await currentUser()
  const { course } = getContent()
  return (
    <main>
      <h1 className="anim-neon-pulse">{t.home.heroTitle}</h1>
      <p>{t.home.heroSubtitle}</p>
      {user && <p><Link className="mdx-download" href="/app">{t.home.toCabinet}</Link></p>}
      <h2>{t.home.coursesTitle}</h2>
      <section>
        <h3>{course.title}</h3>
        <p><Link className="mdx-download" href="/ai-basics">{t.home.courseCta}</Link></p>
      </section>
    </main>
  )
}
