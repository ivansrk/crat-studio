import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth/current-user'
import { hasCourseAccess } from '@/lib/progress/access'
import { db } from '@/lib/db'
import { DAILY_LIMIT, warsawDayStart } from '@/lib/trainers/limits'
import { SectionLabel } from '@/components/site/SectionLabel'
import { TrainerFooterNav } from '@/components/site/TrainerFooterNav'
import { T1Form } from './T1Form'
import { t } from '@/lib/i18n'

/** Ф4 T5/T5 дизайн-аудита: /app/trainers/t1 — серверная обёртка (гейт TRN-05/06), сам
 *  чат — client-компонент T1Form. «Осталось N из 20 сегодня» — тот же счётчик, что
 *  проверяет tryConsume (lib/trainers/limits): дешёвый count по Warsaw-дню, без
 *  живого обновления после каждого ответа (страница не перезагружается useActionState'ом,
 *  тот же компромисс, что у остальных серверных счётчиков кабинета — обновится при заходе). */
export default async function T1Page({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams // S5/D-051: урок-источник (?from), валидируется в TrainerFooterNav
  // currentUser не null после layout-гейта (app/app/layout.tsx), но TS этого не знает —
  // паттерн из app/app/page.tsx/lessons/[lessonId].
  const user = await currentUser()
  if (!user) redirect('/login')
  if (!(await hasCourseAccess(user, 'ai-basics'))) redirect('/app') // тренажёры привязаны к ai-basics до мультикурсовых тренажёров (Ф8+)

  const usedToday = await db.trainerUsage.count({
    where: { userId: user.id, trainerId: 't1', usedAt: { gte: warsawDayStart(new Date()) } },
  })
  const remainingToday = Math.max(0, DAILY_LIMIT - usedToday)

  return (
    <main className="trainers-page">
      <SectionLabel kicker={t.trainers.t1Title} />
      <h1 className="crat-display">{t.trainers.t1Title}</h1>
      <p className="crat-muted">{t.trainers.t1Intro}</p>
      <p className="trainer-remaining">
        {t.trainers.remainingToday.replace('{n}', String(remainingToday)).replace('{total}', String(DAILY_LIMIT))}
      </p>

      <T1Form />

      <TrainerFooterNav from={from} />
    </main>
  )
}
