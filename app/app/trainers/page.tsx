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
  if (!(await hasCourseAccess(user, 'ai-basics'))) redirect('/app') // тренажёры привязаны к ai-basics до мультикурсовых тренажёров (Ф8+)

  return (
    <main className="trainers-page">
      <SectionLabel kicker={t.trainers.catalogTitle} />
      {/* S7 (аудит навигации 2026-07-16, D-051): видимый h1 каталога — раньше страница
          открывалась только mono-кикером, без заголовка первого уровня (та же схема, что
          на страницах отдельных тренажёров: kicker + crat-display h1). */}
      <h1 className="crat-display">{t.trainers.catalogTitle}</h1>
      <p className="crat-muted trainers-intro">{t.trainers.catalogIntro}</p>

      <div className="crat-card trainer-card">
        <h2>{t.trainers.t1Title}</h2>
        <p className="crat-muted">{t.trainers.t1Intro}</p>
        <Link className="crat-button primary" href="/app/trainers/t1">{t.trainers.open}</Link>
      </div>

      <div className="crat-card trainer-card">
        <h2>{t.trainers.t2Title}</h2>
        <p className="crat-muted">{t.trainers.t2Intro}</p>
        <Link className="crat-button primary" href="/app/trainers/t2">{t.trainers.open}</Link>
      </div>

      <div className="crat-card trainer-card">
        <h2>{t.trainers.t3Title}</h2>
        <p className="crat-muted">{t.trainers.t3Intro}</p>
        <Link className="crat-button primary" href="/app/trainers/t3">{t.trainers.open}</Link>
      </div>

      <p><Link className="crat-button" href="/app">{t.trainers.backToCabinet}</Link></p>
    </main>
  )
}
