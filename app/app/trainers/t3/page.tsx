import Link from 'next/link'
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth/current-user'
import { hasCourseAccess } from '@/lib/progress/access'
import { db } from '@/lib/db'
import { DAILY_LIMIT, warsawDayStart } from '@/lib/trainers/limits'
import { T3_TASKS } from '@/lib/trainers/t3-tasks'
import { SectionLabel } from '@/components/site/SectionLabel'
import { T3Form } from './T3Form'
import { t } from '@/lib/i18n'

/** TRN-09: /app/trainers/t3 — серверная обёртка (гейт TRN-05/06, тот же паттерн, что T1/T2).
 *  Пул заданий — фиксированный код (lib/trainers/t3-tasks), НЕ генерируется моделью: так система
 *  точно знает, где заложена ошибка, и оценка не зависит от того, честно ли модель придумает
 *  задание на лету (D-042). Позиция в пуле — query-параметр `i`, не БД и не React state:
 *  полностью no-JS-совместимая ротация плоскими ссылками (тот же приём, что «Начать заново»
 *  в T2Form — обычный <a>, полная перезагрузка страницы). Клиенту (T3Form) передаётся только
 *  безопасное подмножество задания (id/topic/text) — errors[].truth/howToCheck остаются на
 *  сервере и никогда не попадают в браузер, иначе задание решалось бы просмотром исходного кода. */
export default async function T3Page({ searchParams }: { searchParams: Promise<{ i?: string }> }) {
  // currentUser не null после layout-гейта (app/app/layout.tsx), но TS этого не знает —
  // паттерн из app/app/page.tsx/lessons/[lessonId]/trainers/t1/t2.
  const user = await currentUser()
  if (!user) redirect('/login')
  if (!(await hasCourseAccess(user, 'ai-basics'))) redirect('/app') // тренажёры привязаны к ai-basics до мультикурсовых тренажёров (Ф8+)

  const { i } = await searchParams
  const parsed = Number.parseInt(i ?? '0', 10)
  const index = Number.isFinite(parsed) && parsed >= 0 ? parsed % T3_TASKS.length : 0
  const { id, topic, text } = T3_TASKS[index]
  const nextIndex = (index + 1) % T3_TASKS.length

  const usedToday = await db.trainerUsage.count({
    where: { userId: user.id, trainerId: 't3', usedAt: { gte: warsawDayStart(new Date()) } },
  })
  const remainingToday = Math.max(0, DAILY_LIMIT - usedToday)

  return (
    <main className="trainers-page">
      <SectionLabel kicker={t.trainers.t3Title} />
      <h1 className="crat-display">{t.trainers.t3Title}</h1>
      <p className="crat-muted">{t.trainers.t3Intro}</p>
      <p className="trainer-remaining">
        {t.trainers.remainingToday.replace('{n}', String(remainingToday)).replace('{total}', String(DAILY_LIMIT))}
      </p>

      <T3Form task={{ id, topic, text }} index={index} nextIndex={nextIndex} />

      <p><Link className="crat-button" href="/app/trainers">{t.trainers.backToCatalog}</Link></p>
    </main>
  )
}
