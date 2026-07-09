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

const COURSE = 'ai-basics'
const DEFERRED_DAYS_MS = 7 * 24 * 60 * 60 * 1000 // LES-13, совпадает с lib/progress/index.ts

/** Отклонение от текста плана (Task 8): в плане брошенная попытка указана для урока «1.4»,
 *  но course.yaml определяет только 1.1–1.3 в модуле 1 (12 уроков = 3×4 модуля). Использован
 *  «2.1» — первый урок следующего модуля с реальным content/quiz.yaml, чтобы страница урока
 *  открывалась без ошибки getLesson(). Лекция без проверки порядка прохождения (LES-01) — блокировки нет. */
async function seedF2() {
  const student = await db.user.update({
    where: { email: SEED('student') },
    data: { mission: 'Хочу уверенно использовать ИИ в работе с документами' },
  })
  const now = new Date()
  const dueAt = new Date(now.getTime() + DEFERRED_DAYS_MS)

  /** Уроки 1.1/1.2: пройдены целиком — попытка 1 провалена, попытка 2 зачтена, практика отмечена.
   *  answers/correct взяты из реальных quiz.yaml (correct = [1,1,1] в обоих уроках). */
  for (const lessonId of ['1.1', '1.2']) {
    await db.lessonProgress.upsert({
      where: { userId_courseSlug_lessonId: { userId: student.id, courseSlug: COURSE, lessonId } },
      update: {},
      create: { userId: student.id, courseSlug: COURSE, lessonId, quizPassedAt: now, practiceDoneAt: now, completedAt: now },
    })
    await db.quizResult.upsert({
      where: { userId_lessonId_attempt: { userId: student.id, lessonId, attempt: 1 } },
      update: {},
      create: {
        userId: student.id, courseSlug: COURSE, lessonId, attempt: 1,
        answers: [
          { questionIndex: 0, chosen: 1, correct: true },
          { questionIndex: 1, chosen: 0, correct: false },
          { questionIndex: 2, chosen: 0, correct: false },
        ],
        score: 1, total: 3, passed: false, finishedAt: now,
      },
    })
    await db.quizResult.upsert({
      where: { userId_lessonId_attempt: { userId: student.id, lessonId, attempt: 2 } },
      update: {},
      create: {
        userId: student.id, courseSlug: COURSE, lessonId, attempt: 2,
        answers: [
          { questionIndex: 0, chosen: 1, correct: true },
          { questionIndex: 1, chosen: 1, correct: true },
          { questionIndex: 2, chosen: 1, correct: true },
        ],
        score: 3, total: 3, passed: true, finishedAt: now,
      },
    })
    await db.deferredQuizState.upsert({
      where: { userId_courseSlug_lessonId: { userId: student.id, courseSlug: COURSE, lessonId } },
      update: {},
      create: { userId: student.id, courseSlug: COURSE, lessonId, dueAt },
    })
  }

  // Урок 1.3: квиз зачтён (correct = [1,0,1]), практика — нет, урок «в процессе».
  await db.lessonProgress.upsert({
    where: { userId_courseSlug_lessonId: { userId: student.id, courseSlug: COURSE, lessonId: '1.3' } },
    update: {},
    create: { userId: student.id, courseSlug: COURSE, lessonId: '1.3', quizPassedAt: now },
  })
  await db.quizResult.upsert({
    where: { userId_lessonId_attempt: { userId: student.id, lessonId: '1.3', attempt: 1 } },
    update: {},
    create: {
      userId: student.id, courseSlug: COURSE, lessonId: '1.3', attempt: 1,
      answers: [
        { questionIndex: 0, chosen: 1, correct: true },
        { questionIndex: 1, chosen: 0, correct: true },
        { questionIndex: 2, chosen: 1, correct: true },
      ],
      score: 3, total: 3, passed: true, finishedAt: now,
    },
  })

  // Урок 2.1: брошенная попытка — отвечен только первый вопрос, попытка не завершена.
  await db.lessonProgress.upsert({
    where: { userId_courseSlug_lessonId: { userId: student.id, courseSlug: COURSE, lessonId: '2.1' } },
    update: {},
    create: { userId: student.id, courseSlug: COURSE, lessonId: '2.1' },
  })
  await db.quizResult.upsert({
    where: { userId_lessonId_attempt: { userId: student.id, lessonId: '2.1', attempt: 1 } },
    update: {},
    create: {
      userId: student.id, courseSlug: COURSE, lessonId: '2.1', attempt: 1,
      answers: [{ questionIndex: 0, chosen: 1, correct: true }],
      score: 1, total: 3, passed: false, finishedAt: null,
    },
  })
}

async function main() {
  const admins = await syncAdmins()
  console.log(`[seed v0] админы синхронизированы: ${admins.join(', ') || '(ADMIN_EMAILS пуст)'}`)
  await seedF1()
  console.log('[seed v1] заявки/студент/ссылки готовы')
  await seedF2()
  console.log('[seed v2] прогресс/попытки/брошенный квиз готовы')
}

main()
  .catch((e) => { console.error('[seed] ошибка:', e); process.exitCode = 1 })
  .finally(() => db.$disconnect())
