import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth/current-user'
import { hasCourseAccess } from '@/lib/progress/access'
import { db } from '@/lib/db'
import { DAILY_LIMIT, warsawDayStart } from '@/lib/trainers/limits'
import { SectionLabel } from '@/components/site/SectionLabel'
import { TrainerFooterNav } from '@/components/site/TrainerFooterNav'
import { T2Form } from './T2Form'
import { t } from '@/lib/i18n'

/** TRN-08: /app/trainers/t2 — серверная обёртка (гейт TRN-05/06, тот же паттерн, что T1),
 *  сам двухшаговый диалог — client-компонент T2Form. Счётчик «осталось N из 20» — per-trainer
 *  (D-042): T1 и T2 считаются раздельно, trainerId='t2' здесь; шаг «дожать» тратит вторую единицу
 *  лимита T2 (два реальных вызова Anthropic — TRN-03 про запросы, не про диалоги). */
export default async function T2Page({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams // S5/D-051: урок-источник (?from), валидируется в TrainerFooterNav
  // currentUser не null после layout-гейта (app/app/layout.tsx), но TS этого не знает —
  // паттерн из app/app/page.tsx/lessons/[lessonId]/trainers/t1.
  const user = await currentUser()
  if (!user) redirect('/login')
  if (!(await hasCourseAccess(user, 'ai-basics'))) redirect('/app') // тренажёры привязаны к ai-basics до мультикурсовых тренажёров (Ф8+)

  const usedToday = await db.trainerUsage.count({
    where: { userId: user.id, trainerId: 't2', usedAt: { gte: warsawDayStart(new Date()) } },
  })
  const remainingToday = Math.max(0, DAILY_LIMIT - usedToday)

  return (
    <main className="trainers-page">
      <SectionLabel kicker={t.trainers.t2Title} />
      <h1 className="crat-display">{t.trainers.t2Title}</h1>
      <p className="crat-muted">{t.trainers.t2Intro}</p>
      <p className="trainer-remaining">
        {t.trainers.remainingToday.replace('{n}', String(remainingToday)).replace('{total}', String(DAILY_LIMIT))}
      </p>

      <T2Form />

      <TrainerFooterNav from={from} />
    </main>
  )
}
