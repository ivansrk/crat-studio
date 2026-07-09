import { db } from '@/lib/db'
import { getCourseProgress } from '@/lib/progress'
import { isLessonPassed } from '@/lib/progress/quiz-logic'
import { lessonCount, getContent } from '@/lib/content'
import { nextCertNumber } from './number'
import { renderCertificatePdf } from './pdf'
import { sendEmail } from '@/lib/email'
import { renderEmail } from '@/lib/email/templates'
import { formatDate } from '@/lib/i18n/format-date'
import { t } from '@/lib/i18n'

const COURSE = 'ai-basics'

/** CERT-01/02: живое 12/12 (D-029) И текущий Submission APPROVED. */
export async function isEligible(userId: string): Promise<boolean> {
  const [{ byLesson }, current] = await Promise.all([
    getCourseProgress(userId),
    db.submission.findFirst({ where: { userId, courseSlug: COURSE }, orderBy: { attempt: 'desc' } }),
  ])
  const all = getContent().course.modules.flatMap(m => m.lessons.map(l => l.id))
  const passed = all.filter(id => isLessonPassed(byLesson.get(id))).length
  return passed === lessonCount() && current?.status === 'APPROVED'
}

/** Идемпотентная выдача (E12): транзакция «нет VALID → номер FOR UPDATE → insert».
 *  Вызывается на обоих триггерах CERT-01 (approve и «последний урок пройден»); повторный вызов — no-op. */
export async function checkAndIssueCertificate(userId: string): Promise<'issued' | 'already' | 'not_eligible'> {
  if (!(await isEligible(userId))) return 'not_eligible'
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) return 'not_eligible'
  const courseTitle = getContent().course.title

  let issuedNumber: string | null = null
  await db.$transaction(async tx => {
    const existing = await tx.certificate.findFirst({ where: { userId, courseSlug: COURSE, status: 'VALID' } })
    if (existing) return // E12: второй триггер выходит без действия
    const number = await nextCertNumber(tx)
    await tx.certificate.create({
      data: { number, userId, fullName: `${user.firstName} ${user.lastName}`, courseSlug: COURSE, courseTitle },
    })
    issuedNumber = number
  })
  if (!issuedNumber) return 'already'
  await sendCertificateEmail(userId, issuedNumber).catch(e => console.error('[cert] письмо не поставлено в очередь:', e))
  return 'issued'
}

/** CERT-05: письмо с PDF-вложением. Используется выдачей и переотправкой (D-028: payload {}). */
export async function sendCertificateEmail(userId: string, number: string): Promise<void> {
  const cert = await db.certificate.findUnique({ where: { number } })
  if (!cert || cert.status !== 'VALID' || !cert.fullName) throw new Error(`certificate not sendable: ${number}`)
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('user not found')
  const pdf = await renderCertificatePdf({ fullName: cert.fullName, courseTitle: cert.courseTitle, number, dateStr: formatDate(cert.issuedAt) })
  await sendEmail({
    to: user.email, userId, type: 'CERTIFICATE', subject: t.email.certSubject,
    html: renderEmail({ body: t.email.certBody, buttonText: t.email.certButton, buttonUrl: `${process.env.APP_URL}/cert/${number}` }),
    payload: {},
    attachments: [{ filename: `${number}.pdf`, content: pdf }],
  })
}
