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
    await printMagicLink(email, 'v1')
  }
}

/** Общий механизм печати magic-link (переиспользуется seedF1/seedF3, docs/seed.md «Вход без почты»). */
async function printMagicLink(email: string, version: string) {
  const user = await db.user.findUnique({ where: { email } })
  if (!user) return
  const raw = newToken()
  await db.magicLink.create({ data: { tokenHash: hashToken(raw), email, userId: user.id, expiresAt: new Date(Date.now() + MAGIC_TTL_MS) } })
  console.log(`[seed ${version}] вход для ${email}: ${process.env.APP_URL ?? 'http://localhost:3000'}/auth/${raw}`)
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

/** Правильные ответы (chosen === correct) на все 3 вопроса каждого из 12 уроков —
 *  сверены с quiz.yaml каждого урока в content/ai-basics (как в seedF2). */
const LESSON_ANSWERS: Record<string, number[]> = {
  '1.1': [1, 1, 1],
  '1.2': [1, 1, 1],
  '1.3': [1, 0, 1],
  '2.1': [1, 1, 0],
  '2.2': [1, 1, 1],
  '2.3': [1, 1, 0],
  '3.1': [0, 1, 1],
  '3.2': [0, 0, 1],
  '3.3': [0, 0, 1],
  '4.1': [1, 1, 1],
  '4.2': [1, 0, 1],
  '4.3': [1, 1, 0],
}

/** Ф3: дипломант с живым 12/12 (все LessonProgress/QuizResult/DeferredQuizState пишутся
 *  НАПРЯМУЮ через db.*, минуя lib/progress) + Submission SUBMITTED — «одна кнопка approve
 *  отделяет от сертификата». Так как recomputeCompletion (и, следовательно,
 *  checkAndIssueCertificate) вызывается только из lib/progress/lib/admin/review-project,
 *  а не из прямых upsert'ов в БД, сид сам сертификат НЕ выдаёт — это и есть smoke-сценарий
 *  Ивана: зайти в /admin/projects и нажать «Принять».
 *  student@ получает противоположный сценарий — NEEDS_CHANGES с комментарием админа. */
async function seedF3() {
  const diplomant = await db.user.upsert({
    where: { email: SEED('diplomant') },
    update: {},
    create: { email: SEED('diplomant'), firstName: 'Дима', lastName: 'Дипломов' },
  })
  await db.enrollment.upsert({
    where: { userId_courseSlug: { userId: diplomant.id, courseSlug: COURSE } },
    update: {},
    create: { userId: diplomant.id },
  })
  await db.registration.upsert({
    where: { email: SEED('diplomant') },
    update: { status: 'ENROLLED' },
    create: { email: SEED('diplomant'), firstName: 'Дима', lastName: 'Дипломов', status: 'ENROLLED', alreadyEnrolled: true },
  })
  await seedConsentsOnce(SEED('diplomant'), [
    { type: 'DATA_PROCESSING', granted: true, userId: diplomant.id },
    { type: 'NEWSLETTER', granted: true, userId: diplomant.id },
  ])

  const now = new Date()
  const dueAt = new Date(now.getTime() + DEFERRED_DAYS_MS)
  for (const [lessonId, chosen] of Object.entries(LESSON_ANSWERS)) {
    await db.lessonProgress.upsert({
      where: { userId_courseSlug_lessonId: { userId: diplomant.id, courseSlug: COURSE, lessonId } },
      update: {},
      create: { userId: diplomant.id, courseSlug: COURSE, lessonId, quizPassedAt: now, practiceDoneAt: now, completedAt: now },
    })
    await db.quizResult.upsert({
      where: { userId_lessonId_attempt: { userId: diplomant.id, lessonId, attempt: 1 } },
      update: {},
      create: {
        userId: diplomant.id, courseSlug: COURSE, lessonId, attempt: 1,
        answers: chosen.map((c, questionIndex) => ({ questionIndex, chosen: c, correct: true })),
        score: 3, total: 3, passed: true, finishedAt: now,
      },
    })
    await db.deferredQuizState.upsert({
      where: { userId_courseSlug_lessonId: { userId: diplomant.id, courseSlug: COURSE, lessonId } },
      update: {},
      create: { userId: diplomant.id, courseSlug: COURSE, lessonId, dueAt },
    })
  }

  // Submission attempt 1 SUBMITTED — 7 осмысленных полей, готов к approve.
  await db.submission.upsert({
    where: { userId_courseSlug_attempt: { userId: diplomant.id, courseSlug: COURSE, attempt: 1 } },
    update: {},
    create: {
      userId: diplomant.id, courseSlug: COURSE, attempt: 1, status: 'SUBMITTED', submittedAt: now,
      task: 'Составить план адаптации нового сотрудника отдела продаж на первую рабочую неделю',
      tool: 'ChatGPT (бесплатная версия)',
      prompt: 'Помоги составить план на первую неделю для нового менеджера по продажам: что изучить, с кем познакомиться, какие первые задачи дать',
      result: 'Получил план по дням: 1 день — знакомство с командой и CRM, 2–3 день — изучение продукта и скриптов, 4–5 день — первые звонки под наблюдением наставника',
      refined: 'Попросил сократить план до одной страницы и добавить чеклист для наставника, чтобы было удобно распечатать',
      verified: 'Показал план руководителю отдела продаж — он подтвердил, что порядок задач логичный, поправил только пару формулировок',
      application: 'Буду использовать этот план для адаптации каждого нового сотрудника отдела, подстраивая под роль',
    },
  })

  // student@: NEEDS_CHANGES с комментарием — контраст со SUBMITTED-статусом дипломанта.
  const student = await db.user.findUniqueOrThrow({ where: { email: SEED('student') } })
  await db.submission.upsert({
    where: { userId_courseSlug_attempt: { userId: student.id, courseSlug: COURSE, attempt: 1 } },
    update: {},
    create: {
      userId: student.id, courseSlug: COURSE, attempt: 1, status: 'NEEDS_CHANGES', submittedAt: now, reviewedAt: now,
      adminComment: 'Добавьте, как проверяли результат — шаг 6 пуст.',
      task: 'Составить письмо-напоминание клиентам о неоплаченном счёте',
      tool: 'ChatGPT (бесплатная версия)',
      prompt: 'Напиши вежливое напоминание клиенту про неоплаченный счёт, без давления и угроз',
      result: 'Получил короткое письмо с вежливым тоном и ссылкой на номер счёта',
      refined: 'Попросил сделать текст короче и явно указать срок оплаты',
      verified: null, // шаг 6 «пуст» — то, на что указывает adminComment (сценарий needs_changes)
      application: 'Буду использовать для регулярных напоминаний клиентам о задолженности',
    },
  })

  await printMagicLink(SEED('diplomant'), 'v3')
}

async function main() {
  const admins = await syncAdmins()
  console.log(`[seed v0] админы синхронизированы: ${admins.join(', ') || '(ADMIN_EMAILS пуст)'}`)
  await seedF1()
  console.log('[seed v1] заявки/студент/ссылки готовы')
  await seedF2()
  console.log('[seed v2] прогресс/попытки/брошенный квиз готовы')
  await seedF3()
  console.log('[seed v3] дипломант 12/12 + SUBMITTED, needs_changes студенту готовы')
}

main()
  .catch((e) => { console.error('[seed] ошибка:', e); process.exitCode = 1 })
  .finally(() => db.$disconnect())
