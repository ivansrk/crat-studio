import { db } from '@/lib/db'
import { getCourseProgress } from '@/lib/progress'
import { isLessonPassed } from '@/lib/progress/quiz-logic'
import { lessonCount, getCourse } from '@/lib/content'
import { nextCertNumber } from './number'
import { renderCertificatePdf } from './pdf'
import { buildPeriodStr, buildProgramHtml } from './program'
import { sendEmail } from '@/lib/email'
import { renderEmail } from '@/lib/email/templates'
import { t } from '@/lib/i18n'

/** CERT-01/02/MC-06: живое N/N (D-029) — знаменатель lessonCount(courseSlug) КОНКРЕТНОГО курса,
 *  не хардкод 12 — И текущий Submission APPROVED того же курса. */
export async function isEligible(userId: string, courseSlug: string): Promise<boolean> {
  const [{ byLesson }, current] = await Promise.all([
    getCourseProgress(userId, courseSlug),
    db.submission.findFirst({ where: { userId, courseSlug }, orderBy: { attempt: 'desc' } }),
  ])
  const all = getCourse(courseSlug)!.course.modules.flatMap(m => m.lessons.map(l => l.id))
  const passed = all.filter(id => isLessonPassed(byLesson.get(id))).length
  // Инвариант: после APPROVED новые попытки не создаются (PROJ-06, enforced в lib/project) —
  // current всегда остаётся APPROVED.
  return passed === lessonCount(courseSlug) && current?.status === 'APPROVED'
}

/** Идемпотентная выдача (E12): транзакция «нет VALID → номер FOR UPDATE → insert».
 *  Вызывается на обоих триггерах CERT-01 (approve и «последний урок пройден»); повторный вызов — no-op.
 *  MC-06: один VALID сертификат на (userId, courseSlug) — сертификат per-course. */
export async function checkAndIssueCertificate(userId: string, courseSlug: string): Promise<'issued' | 'already' | 'not_eligible'> {
  if (!(await isEligible(userId, courseSlug))) return 'not_eligible'
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) return 'not_eligible'
  const courseTitle = getCourse(courseSlug)!.course.title

  let issuedNumber: string | null = null
  await db.$transaction(async tx => {
    // advisory xact-lock: E12 — конкурентные триггеры одного студента сериализуются;
    // снимается автоматически на commit/rollback. Без него два одновременных вызова оба
    // видят existing=null (единственная блокировка — FOR UPDATE счётчика — стоит позже)
    // и выдают два сертификата. После ожидания lock'а existing-check видит коммит первой транзакции.
    // Ключ блокировки — userId (не userId+courseSlug): сериализует все конкурентные триггеры
    // студента, включая параллельные разных курсов — дороже, но проще и безопаснее (redo не нужен).
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`
    const existing = await tx.certificate.findFirst({ where: { userId, courseSlug, status: 'VALID' } })
    if (existing) return // E12: второй триггер выходит без действия
    const number = await nextCertNumber(tx)
    await tx.certificate.create({
      data: { number, userId, fullName: `${user.firstName} ${user.lastName}`, courseSlug, courseTitle },
    })
    issuedNumber = number
  })
  if (!issuedNumber) return 'already'
  await sendCertificateEmail(userId, issuedNumber).catch(e => console.error('[cert] письмо не поставлено в очередь:', e))
  return 'issued'
}

/** CERT-08/D-044: период обучения = Enrollment.createdAt (userId+courseSlug, Warsaw) + 3 месяца;
 *  без строки Enrollment (например, ручная выдача без записи о зачислении) — fallback на
 *  переданную дату (обычно Certificate.issuedAt). Общий хелпер для письма и обоих роутов скачивания. */
export async function resolveCertPeriodStr(userId: string, courseSlug: string, fallback: Date): Promise<string> {
  const enrollment = await db.enrollment.findUnique({ where: { userId_courseSlug: { userId, courseSlug } } })
  return buildPeriodStr(enrollment?.createdAt ?? fallback)
}

/** CERT-05: письмо с PDF-вложением. Используется выдачей и переотправкой (D-028: payload {}). */
export async function sendCertificateEmail(userId: string, number: string): Promise<void> {
  const cert = await db.certificate.findUnique({ where: { number } })
  if (!cert || cert.status !== 'VALID' || !cert.fullName) throw new Error(`certificate not sendable: ${number}`)
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('user not found')
  const periodStr = await resolveCertPeriodStr(userId, cert.courseSlug, cert.issuedAt)
  const pdf = await renderCertificatePdf({
    fullName: cert.fullName,
    courseTitle: cert.courseTitle,
    number,
    hours: getCourse(cert.courseSlug)?.hours ?? 72,
    periodStr,
    programHtml: buildProgramHtml(cert.courseSlug),
  })
  await sendEmail({
    to: user.email, userId, type: 'CERTIFICATE', subject: t.email.certSubject,
    html: renderEmail({ body: t.email.certBody, buttonText: t.email.certButton, buttonUrl: `${process.env.APP_URL}/cert/${number}` }),
    payload: {},
    attachments: [{ filename: `${number}.pdf`, content: pdf }],
  })
}
