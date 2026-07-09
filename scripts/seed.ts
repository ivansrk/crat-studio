import { syncAdmins } from '@/lib/auth/sync-admins'
import { db } from '@/lib/db'
import { newToken, hashToken, MAGIC_TTL_MS } from '@/lib/auth/magic-link'

const SEED = (n: string) => `${n}@seed.crat.example`

/** Отклонение от кода плана: консенты в seed оборачиваем в проверку «уже есть записи для email»,
 *  чтобы повторные прогоны не раздували append-only журнал (D-014) до бесконечности. */
async function seedConsentsOnce(
  email: string,
  rows: { type: 'DATA_PROCESSING' | 'NEWSLETTER'; granted: boolean; userId?: string }[],
) {
  const existing = await db.consent.count({ where: { email } })
  if (existing === 0) {
    for (const row of rows) {
      await db.consent.create({ data: { email, source: 'REGISTRATION_FORM', ...row } })
    }
  }
}

async function seedF1() {
  // Заявка NEW с обоими согласиями
  await db.registration.upsert({
    where: { email: SEED('zayavka') },
    update: {},
    create: { email: SEED('zayavka'), firstName: 'Зоя', lastName: 'Заявкина' },
  })
  await seedConsentsOnce(SEED('zayavka'), [
    { type: 'DATA_PROCESSING', granted: true },
    { type: 'NEWSLETTER', granted: true },
  ])

  // Повторная заявка, БЕЗ рассылки (для CSV-фильтра)
  await db.registration.upsert({
    where: { email: SEED('povtor') },
    update: { status: 'RESUBMITTED', submitCount: 2 },
    create: { email: SEED('povtor'), firstName: 'Пётр', lastName: 'Повторов', status: 'RESUBMITTED', submitCount: 2 },
  })
  await seedConsentsOnce(SEED('povtor'), [
    { type: 'DATA_PROCESSING', granted: true },
    { type: 'NEWSLETTER', granted: false },
  ])

  // Студент: User + Enrollment + ENROLLED-заявка
  const student = await db.user.upsert({
    where: { email: SEED('student') },
    update: {},
    create: { email: SEED('student'), firstName: 'Света', lastName: 'Студентова' },
  })
  await db.enrollment.upsert({
    where: { userId_courseSlug: { userId: student.id, courseSlug: 'ai-basics' } },
    update: {},
    create: { userId: student.id },
  })
  await db.registration.upsert({
    where: { email: SEED('student') },
    update: { status: 'ENROLLED' },
    create: { email: SEED('student'), firstName: 'Света', lastName: 'Студентова', status: 'ENROLLED', alreadyEnrolled: true },
  })
  await seedConsentsOnce(SEED('student'), [
    { type: 'DATA_PROCESSING', granted: true, userId: student.id },
    { type: 'NEWSLETTER', granted: true, userId: student.id },
  ])

  // Готовые magic-link URL в stdout (docs/seed.md «Вход студентом без почты») — Resend не нужен
  for (const email of [
    SEED('student'),
    ...(process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
  ]) {
    const user = await db.user.findUnique({ where: { email } })
    if (!user) continue
    const raw = newToken()
    await db.magicLink.create({ data: { tokenHash: hashToken(raw), email, userId: user.id, expiresAt: new Date(Date.now() + MAGIC_TTL_MS) } })
    console.log(`[seed v1] вход для ${email}: ${process.env.APP_URL ?? 'http://localhost:3000'}/auth/${raw}`)
  }
}

async function main() {
  const admins = await syncAdmins()
  console.log(`[seed v0] админы синхронизированы: ${admins.join(', ') || '(ADMIN_EMAILS пуст)'}`)
  await seedF1()
  console.log('[seed v1] заявки/студент/ссылки готовы')
}

main()
  .catch((e) => { console.error('[seed] ошибка:', e); process.exitCode = 1 })
  .finally(() => db.$disconnect())
