import { pathToFileURL } from 'node:url'
import { syncAdmins } from '@/lib/auth/sync-admins'
import { db } from '@/lib/db'
import { mintResetToken } from '@/lib/auth/reset'
import { hashPassword } from '@/lib/auth/password'
import { warsawDayStart } from '@/lib/trainers/limits'
import { createInvite } from '@/lib/invite'
import { checkAndIssueCertificate } from '@/lib/cert'
import { ResetTokenPurpose } from '@/lib/generated/prisma/client'

const SEED = (n: string) => `${n}@seed.crat.example`

// T8 (Ф7а, D-031): known-пароль для всех seed-юзеров (студент/дипломант/админы из ADMIN_EMAILS) —
// Иван и разработчики должны логиниться в кабинет/админку локально/на стенде без похода в письма.
// Не секрет продакшена: seed трогает только *@seed.crat.example + ADMIN_EMAILS, никогда реальных
// студентов (см. docs/seed.md). Хэш считаем один раз (bcrypt cost 12, D-032, — медленно, но на
// 3-5 seed-юзеров это доли секунды) и переиспользуем строку хэша для всех — это seed-данные, а
// не боевая учётка, отдельная соль на юзера тут ничего не защищает.
export const SEED_PASSWORD = 'seed-pass-2026'
let seedPasswordHashPromise: Promise<string> | null = null
function seedPasswordHash(): Promise<string> {
  seedPasswordHashPromise ??= hashPassword(SEED_PASSWORD)
  return seedPasswordHashPromise
}

/** Идемпотентно проставляет known-пароль (SEED_PASSWORD) юзеру по email — update, не upsert
 *  (юзер уже должен существовать, создаётся выше по коду). Повторный `npm run seed` ВСЕГДА
 *  перезаписывает passwordHash обратно на known-значение — даже если пароль поменяли руками
 *  через reset-флоу при ручном тестировании, seed остаётся надёжной точкой возврата. Молчит,
 *  если юзера с таким email нет (updateMany.count===0) — на случай вызова до создания записи. */
async function setSeedPassword(email: string): Promise<void> {
  const passwordHash = await seedPasswordHash()
  const updated = await db.user.updateMany({ where: { email }, data: { passwordHash } })
  if (updated.count > 0) console.log(`[seed] вход: ${email} / пароль: ${SEED_PASSWORD}`)
}

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

  // T8 (Ф7а, D-031): вход по email+паролю — проставляем known-пароль вместо magic-link-ссылки.
  await setSeedPassword(SEED('student'))
}

/** T8: одна демонстрационная reset-ссылка (не «вход по умолчанию» — тот теперь через
 *  SEED_PASSWORD выше) — живой пример reset-флоу (F12/AUTH-16/17) для ручной проверки без
 *  настоящего Resend. Печатается один раз из main(), не на каждого seed-юзера. */
async function printResetLink(email: string, version: string) {
  const user = await db.user.findUnique({ where: { email } })
  if (!user) return
  const { url } = await mintResetToken(email)
  console.log(`[seed ${version}] demo reset-ссылка для ${email}: ${url}`)
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

  /** Уроки 1.1/1.2: пройдены целиком — попытка 1 провалена (верен только первый вопрос),
   *  попытка 2 зачтена, практика отмечена. chosen/correct берутся из реального quiz.yaml
   *  каждого урока (LESSON_ANSWERS — те же верные индексы, что у дипломанта ниже). */
  const wrongIdx = (correctIdx: number) => (correctIdx === 0 ? 1 : 0) // валидный индекс (вариантов ≥2), заведомо ≠ верного
  for (const lessonId of ['1.1', '1.2']) {
    const correct = LESSON_ANSWERS[lessonId]
    await db.lessonProgress.upsert({
      where: { userId_courseSlug_lessonId: { userId: student.id, courseSlug: COURSE, lessonId } },
      update: {},
      create: { userId: student.id, courseSlug: COURSE, lessonId, quizPassedAt: now, practiceDoneAt: now, completedAt: now },
    })
    await db.quizResult.upsert({
      where: { userId_courseSlug_lessonId_attempt: { userId: student.id, courseSlug: COURSE, lessonId, attempt: 1 } },
      update: {},
      create: {
        userId: student.id, courseSlug: COURSE, lessonId, attempt: 1,
        answers: correct.map((c, questionIndex) =>
          questionIndex === 0
            ? { questionIndex, chosen: c, correct: true }
            : { questionIndex, chosen: wrongIdx(c), correct: false }),
        score: 1, total: 3, passed: false, finishedAt: now,
      },
    })
    await db.quizResult.upsert({
      where: { userId_courseSlug_lessonId_attempt: { userId: student.id, courseSlug: COURSE, lessonId, attempt: 2 } },
      update: {},
      create: {
        userId: student.id, courseSlug: COURSE, lessonId, attempt: 2,
        answers: correct.map((c, questionIndex) => ({ questionIndex, chosen: c, correct: true })),
        score: 3, total: 3, passed: true, finishedAt: now,
      },
    })
    await db.deferredQuizState.upsert({
      where: { userId_courseSlug_lessonId: { userId: student.id, courseSlug: COURSE, lessonId } },
      update: {},
      create: { userId: student.id, courseSlug: COURSE, lessonId, dueAt },
    })
  }

  // Урок 1.3: квиз зачтён (correct из реального quiz.yaml), практика — нет, урок «в процессе».
  await db.lessonProgress.upsert({
    where: { userId_courseSlug_lessonId: { userId: student.id, courseSlug: COURSE, lessonId: '1.3' } },
    update: {},
    create: { userId: student.id, courseSlug: COURSE, lessonId: '1.3', quizPassedAt: now },
  })
  await db.quizResult.upsert({
    where: { userId_courseSlug_lessonId_attempt: { userId: student.id, courseSlug: COURSE, lessonId: '1.3', attempt: 1 } },
    update: {},
    create: {
      userId: student.id, courseSlug: COURSE, lessonId: '1.3', attempt: 1,
      answers: LESSON_ANSWERS['1.3'].map((c, questionIndex) => ({ questionIndex, chosen: c, correct: true })),
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
    where: { userId_courseSlug_lessonId_attempt: { userId: student.id, courseSlug: COURSE, lessonId: '2.1', attempt: 1 } },
    update: {},
    create: {
      userId: student.id, courseSlug: COURSE, lessonId: '2.1', attempt: 1,
      answers: [{ questionIndex: 0, chosen: LESSON_ANSWERS['2.1'][0], correct: true }],
      score: 1, total: 3, passed: false, finishedAt: null,
    },
  })
}

/** Правильные ответы (chosen === correct) на все 3 вопроса каждого из 12 уроков —
 *  сверены с quiz.yaml каждого урока в content/ai-basics (как в seedF2). */
const LESSON_ANSWERS: Record<string, number[]> = {
  '1.1': [1, 2, 0],
  '1.2': [0, 2, 1],
  '1.3': [1, 0, 2],
  '1.4': [2, 0, 1],
  '2.1': [1, 0, 2],
  '2.2': [0, 1, 2],
  '2.3': [1, 0, 2],
  '3.1': [1, 0, 2],
  '3.2': [0, 1, 2],
  '3.3': [0, 1, 2],
  '4.1': [1, 2, 0],
  '4.2': [1, 2, 0],
}

/** Ф3/T5 дизайн-аудита: дипломант с живым 12/12 (все LessonProgress/QuizResult/
 *  DeferredQuizState пишутся НАПРЯМУЮ через db.*, минуя lib/progress) + Submission
 *  APPROVED + выданный Certificate — «сертификат-триумф» (кабинет, /cert, PDF) проверяем
 *  смоуком без похода в /admin. Выдача — через checkAndIssueCertificate (lib/cert, ТОТ ЖЕ
 *  код, что и боевая выдача): идемпотентная транзакция, номер — из настоящего
 *  CertificateCounter (не хардкод), повторный `npm run seed` — no-op («already»).
 *  Админ-ревью смоук (кнопка «Принять»/«На доработку») остаётся живым через student@
 *  ниже — её Submission NEEDS_CHANGES с комментарием админа. */
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
      where: { userId_courseSlug_lessonId_attempt: { userId: diplomant.id, courseSlug: COURSE, lessonId, attempt: 1 } },
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

  // Submission attempt 1 APPROVED — 7 осмысленных полей, состояние согласовано с 12/12
  // выше (T5: раньше был SUBMITTED «на одну кнопку approve», теперь сразу выдан —
  // см. докстринг функции про checkAndIssueCertificate ниже).
  await db.submission.upsert({
    where: { userId_courseSlug_attempt: { userId: diplomant.id, courseSlug: COURSE, attempt: 1 } },
    // update: существующие БД (сид гонялся до T5, когда статус был SUBMITTED) должны
    // мигрировать на APPROVED повторным `npm run seed`, а не застрять в старом статусе —
    // остальные поля (описание проекта) не меняются между версиями, трогать их не нужно.
    update: { status: 'APPROVED', reviewedAt: now, adminComment: null },
    create: {
      userId: diplomant.id, courseSlug: COURSE, attempt: 1, status: 'APPROVED', submittedAt: now, reviewedAt: now,
      task: 'Составить план адаптации нового сотрудника отдела продаж на первую рабочую неделю',
      tool: 'ChatGPT (бесплатная версия)',
      prompt: 'Помоги составить план на первую неделю для нового менеджера по продажам: что изучить, с кем познакомиться, какие первые задачи дать',
      result: 'Получил план по дням: 1 день — знакомство с командой и CRM, 2–3 день — изучение продукта и скриптов, 4–5 день — первые звонки под наблюдением наставника',
      refined: 'Попросил сократить план до одной страницы и добавить чеклист для наставника, чтобы было удобно распечатать',
      verified: 'Показал план руководителю отдела продаж — он подтвердил, что порядок задач логичный, поправил только пару формулировок',
      application: 'Буду использовать этот план для адаптации каждого нового сотрудника отдела, подстраивая под роль',
    },
  })
  // T5: выдача сертификата — тот же боевой код (lib/cert), идемпотентен (повторный
  // прогон seed видит существующий VALID и возвращает 'already', номер не меняется).
  const certResult = await checkAndIssueCertificate(diplomant.id, COURSE)
  console.log(`[seed] сертификат дипломанта: ${certResult}`)

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

  await setSeedPassword(SEED('diplomant'))
}

/** Ф4: у student@ — бэкдейт урока 1.1 (пройден ≥7 дней назад, LES-13) и dueAt его
 *  DeferredQuizState в прошлом → блок «3 вопроса» виден сразу при входе (CAB-04/06), без ожидания
 *  cron (D-005). Плюс 19 записей TrainerUsage(t1) за сегодняшний Warsaw-день — следующий запрос
 *  студента к тренажёру 20-й (ещё ok), после него — daily-отказ (TRN-03).
 *  TrainerUsage не append-only журнал (в отличие от Consent, D-014) — deleteMany+createMany
 *  делают блок идемпотентным при повторных прогонах seed, в отличие от upsert по неуникальному usedAt. */
async function seedF4() {
  const student = await db.user.findUniqueOrThrow({ where: { email: SEED('student') } })
  const now = new Date()
  const backdate = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000)

  await db.lessonProgress.update({
    where: { userId_courseSlug_lessonId: { userId: student.id, courseSlug: COURSE, lessonId: '1.1' } },
    data: { quizPassedAt: backdate, practiceDoneAt: backdate, completedAt: backdate },
  })
  await db.deferredQuizState.update({
    where: { userId_courseSlug_lessonId: { userId: student.id, courseSlug: COURSE, lessonId: '1.1' } },
    data: { dueAt: new Date(now.getTime() - 24 * 60 * 60 * 1000), answeredAt: null },
  })

  const dayStart = warsawDayStart(now)
  await db.trainerUsage.deleteMany({ where: { userId: student.id, trainerId: 't1', usedAt: { gte: dayStart } } })
  // Не в последнюю минуту — иначе minute-лимит (3/мин) сработает раньше daily (20/день) при следующем запросе.
  // windowEnd клампится минимум на dayStart+19с — защита от отрицательного/нулевого шага, если seed
  // запускается в первые минуты Warsaw-суток (в реальности не встречается, но не должно падать).
  const windowEnd = Math.max(now.getTime() - 10 * 60 * 1000, dayStart.getTime() + 19_000)
  const stepMs = (windowEnd - dayStart.getTime()) / 19
  await db.trainerUsage.createMany({
    data: Array.from({ length: 19 }, (_, i) => ({
      userId: student.id,
      trainerId: 't1',
      usedAt: new Date(dayStart.getTime() + stepMs * (i + 1)),
    })),
  })
}

/** Ф7б Task 9, INV-01/06: один активный инвайт на ai-basics, без лимита/срока, sourceLabel
 *  'seed-invite' — для ручной проверки формы регистрации по /invite/{token} и авто-enroll.
 *  InviteLink не имеет естественного бизнес-ключа кроме token (который сам и генерируется) —
 *  идемпотентность через findFirst по (courseSlug, sourceLabel): повторный прогон seed находит
 *  уже созданную ссылку и печатает ту же, а не плодит новые InviteLink на каждый запуск.
 *  createInvite (lib/invite) переиспользован для «первого раза», чтобы URL строился тем же кодом,
 *  что и в реальной админке (INV-01), а не дублировался вручную. */
async function seedInvite(): Promise<void> {
  const existing = await db.inviteLink.findFirst({ where: { courseSlug: COURSE, sourceLabel: 'seed-invite' } })
  const url = existing
    ? `${process.env.APP_URL ?? 'http://localhost:3000'}/invite/${existing.token}`
    : (await createInvite({ courseSlug: COURSE, sourceLabel: 'seed-invite' }, null)).url
  console.log(`[seed] инвайт: ${url}`)
}

/** Ф7б Task 9, REG-11/REG-13: заявка PENDING_OPT_IN с телефоном и wantsNewsletter=true — живой
 *  пример double opt-in для ручной проверки полного цикла (форма уже отправлена → нужно только
 *  подтвердить). Идемпотентно через upsert по email, как остальные Registration-блоки. Токен
 *  минтится заново на каждый прогон (mintResetToken создаёт новую append-only запись
 *  PasswordResetToken, тот же приём, что у printResetLink/reset-demo ниже) — старые неиспользованные
 *  OPT_IN-токены того же email просто остаются мёртвыми, на идемпотентность Registration это не влияет. */
async function seedOptInRegistration(): Promise<void> {
  await db.registration.upsert({
    where: { email: SEED('optin') },
    update: { status: 'PENDING_OPT_IN', confirmedAt: null, phone: '+79991234567', wantsNewsletter: true },
    create: {
      email: SEED('optin'), firstName: 'Ольга', lastName: 'Оптинова',
      phone: '+79991234567', wantsNewsletter: true, status: 'PENDING_OPT_IN',
    },
  })
  const { url } = await mintResetToken(SEED('optin'), ResetTokenPurpose.OPT_IN)
  console.log(`[seed] confirm: ${url}`)
}

/** Ф7б Task 9, CRM-01/02: подписанный клиент (email подтверждён, обе Consent действующие) —
 *  виден в /admin/clients с «Да» в колонке «Подписан». User создаётся напрямую (как student@ в
 *  seedF1), без Registration/Enrollment — цель блока показать CRM-список подписанных контактов,
 *  а не флоу заявки (тот отдельно проверяется через optin@ выше). */
async function seedConfirmedClient(): Promise<void> {
  const confirmed = await db.user.upsert({
    where: { email: SEED('confirmed') },
    update: {},
    create: { email: SEED('confirmed'), firstName: 'Ксения', lastName: 'Клиентова' },
  })
  await seedConsentsOnce(SEED('confirmed'), [
    { type: 'DATA_PROCESSING', granted: true, userId: confirmed.id },
    { type: 'NEWSLETTER', granted: true, userId: confirmed.id },
  ])
}

/** Ф7б Task 9, CONS-01/04: одна заявка на консультацию в статусе NEW от student@, source
 *  cabinet — видна в /admin/consultations. ConsultationRequest не имеет естественного бизнес-ключа
 *  (contact — свободный текст, не unique) — идемпотентность через findFirst по (userId, source). */
async function seedConsultation(): Promise<void> {
  const student = await db.user.findUniqueOrThrow({ where: { email: SEED('student') } })
  const existing = await db.consultationRequest.findFirst({ where: { userId: student.id, source: 'cabinet' } })
  if (!existing) {
    await db.consultationRequest.create({
      data: {
        name: `${student.firstName} ${student.lastName}`,
        contact: student.email,
        message: 'Хотим внедрить ИИ в отдел продаж — с чего начать и сколько это стоит?',
        userId: student.id,
        source: 'cabinet',
        status: 'NEW',
      },
    })
  }
}

async function seedF7b() {
  await seedInvite()
  await seedOptInRegistration()
  await seedConfirmedClient()
  await seedConsultation()
}

async function main() {
  const admins = await syncAdmins()
  console.log(`[seed v0] админы синхронизированы: ${admins.join(', ') || '(ADMIN_EMAILS пуст)'}`)
  for (const email of admins) await setSeedPassword(email) // T8: known-пароль и админам тоже
  await seedF1()
  console.log('[seed v1] заявки/студент/ссылки готовы')
  await seedF2()
  console.log('[seed v2] прогресс/попытки/брошенный квиз готовы')
  await seedF3()
  console.log('[seed v3] дипломант 12/12 + APPROVED + сертификат, needs_changes студенту готовы')
  await seedF4()
  console.log('[seed v4] повторение к сдаче, тренажёр 19/20')
  await seedF7b()
  console.log('[seed v5] инвайт/opt-in-заявка/подписанный клиент/консультация готовы')
  await printResetLink(SEED('student'), 'reset-demo') // T8: живой пример reset-флоу, см. комментарий у функции
}

// Ревью M2: тот же guard, что и scripts/send-set-password.ts — дешёвая профилактика, seed.ts
// сейчас никем не импортируется, но если это изменится, main() не должен запускаться при import.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main()
    .catch((e) => { console.error('[seed] ошибка:', e); process.exitCode = 1 })
    .finally(() => db.$disconnect())
}
