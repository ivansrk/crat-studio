import Link from 'next/link'
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth/current-user'
import { hasCourseAccess } from '@/lib/progress/access'
import { SectionLabel } from '@/components/site/SectionLabel'
import { t } from '@/lib/i18n'

/** Ф4 T5: каталог тренажёров (TRN-01/06, D-020 — без публичной витрины и геймификации).
 *  Гейт — как у уроков/мини-проекта: без сессии на /login, без доступа к курсу на /app. */
export default async function TrainersPage() {
  // currentUser не null после layout-гейта (app/app/layout.tsx), но TS этого не знает —
  // паттерн из app/app/page.tsx/lessons/[lessonId].
  const user = await currentUser()
  if (!user) redirect('/login')
  if (!(await hasCourseAccess(user, 'ai-basics'))) redirect('/app') // Ф7в T3: из маршрута

  return (
    <main className="trainers-page">
      <SectionLabel kicker={t.trainers.catalogTitle} />

      <div className="crat-card trainer-card">
        <h2>{t.trainers.t1Title}</h2>
        <p className="crat-muted">{t.trainers.t1Intro}</p>
        <Link className="crat-button primary" href="/app/trainers/t1">{t.trainers.open}</Link>
      </div>

      <div className="crat-card trainer-card trainer-card-soon">
        <h2>{t.trainers.t2Title}</h2>
        <span className="trainer-badge">{t.trainers.comingSoon}</span>
      </div>

      <div className="crat-card trainer-card trainer-card-soon">
        <h2>{t.trainers.t3Title}</h2>
        <span className="trainer-badge">{t.trainers.comingSoon}</span>
      </div>

      <p><Link className="crat-button" href="/app">{t.trainers.backToCabinet}</Link></p>
    </main>
  )
}
