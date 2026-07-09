import { db } from '@/lib/db'
import { sendEmail } from '@/lib/email'
import { renderEmail } from '@/lib/email/templates'
import { mintLoginUrl } from '@/lib/auth/magic-link' // хелпер из T8-фикса D-028
import { t } from '@/lib/i18n'
import type { EmailLog } from '@/lib/generated/prisma/client'

// 15 мин последний ретрай (RETRY_DELAYS_MS в lib/email) + запас: после рестарта Render
// ретраи живут только в процессе, и письмо может навсегда остаться QUEUED (ревью T10).
export const STALE_QUEUED_MS = 20 * 60 * 1000

/** true, если письмо в QUEUED дольше STALE_QUEUED_MS — вероятно, рестарт оборвал ретраи. */
export function isStaleQueued(log: Pick<EmailLog, 'status' | 'createdAt'>, now: Date): boolean {
  return log.status === 'QUEUED' && now.getTime() - log.createdAt.getTime() > STALE_QUEUED_MS
}

export type ResendResult = 'sent' | 'not_found' | 'user_gone' | 'unsupported_type' | 'cert_gone'

/** ADM-08: переотправка = НОВАЯ запись в email_log (MAIL-05) с НОВЫМ токеном (D-028) —
 *  сырых токенов в payload не храним, свежая ссылка полезнее истёкшей. */
export async function resendFromLog(emailLogId: string): Promise<ResendResult> {
  const log = await db.emailLog.findUnique({ where: { id: emailLogId } })
  if (!log) return 'not_found'
  if (log.type === 'CERTIFICATE') {
    // Свой сценарий (не login-ссылка): ищем актуальный VALID-сертификат владельца — номер в исходном
    // письме мог быть отозван (D-010), переотправлять отозванный номер нельзя.
    const userId = log.userId
    const cert = userId ? await db.certificate.findFirst({ where: { userId, status: 'VALID' } }) : null
    if (!cert || !userId) return 'cert_gone'
    const { sendCertificateEmail } = await import('@/lib/cert')
    await sendCertificateEmail(userId, cert.number)
    return 'sent'
  }
  // Исчерпывающий switch по типу: будущие типы НЕ переотправлять молча login-ссылкой.
  let body: string
  switch (log.type) {
    case 'MAGIC_LINK': body = t.email.magicLinkBody; break
    case 'ACCESS_GRANTED': body = t.email.accessBody; break
    default: return 'unsupported_type'
  }
  let url: string
  try {
    url = await mintLoginUrl(log.toEmail) // D-028: всегда свежий токен
  } catch (e) {
    if (e instanceof Error && e.message === 'user not found') return 'user_gone' // GDPR-удалённый адресат
    throw e
  }
  await sendEmail({
    to: log.toEmail, userId: log.userId, type: log.type, subject: log.subject,
    html: renderEmail({ body, buttonText: t.email.magicLinkButton, buttonUrl: url }),
    payload: {},
  })
  return 'sent'
}
