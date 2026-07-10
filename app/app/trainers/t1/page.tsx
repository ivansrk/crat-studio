import Link from 'next/link'
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth/current-user'
import { hasCourseAccess } from '@/lib/progress/access'
import { SectionLabel } from '@/components/site/SectionLabel'
import { T1Form } from './T1Form'
import { t } from '@/lib/i18n'

/** Ф4 T5: /app/trainers/t1 — серверная обёртка (гейт TRN-05/06), сам чат — client-компонент T1Form. */
export default async function T1Page() {
  // currentUser не null после layout-гейта (app/app/layout.tsx), но TS этого не знает —
  // паттерн из app/app/page.tsx/lessons/[lessonId].
  const user = await currentUser()
  if (!user) redirect('/login')
  if (!(await hasCourseAccess(user, 'ai-basics'))) redirect('/app') // тренажёры привязаны к ai-basics до мультикурсовых тренажёров (Ф8+)

  return (
    <main className="trainers-page">
      <SectionLabel kicker={t.trainers.t1Title} />
      <h1 className="crat-display">{t.trainers.t1Title}</h1>
      <p className="crat-muted">{t.trainers.t1Intro}</p>

      <T1Form />

      <p><Link className="crat-button" href="/app/trainers">{t.trainers.backToCatalog}</Link></p>
    </main>
  )
}
