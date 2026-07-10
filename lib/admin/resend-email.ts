import { db } from '@/lib/db'
import { sendEmail } from '@/lib/email'
import { renderEmail } from '@/lib/email/templates'
import { mintResetToken } from '@/lib/auth/reset' // T5: переотправка WELCOME — пароль невоспроизводим (только хэш)
import { ResetTokenPurpose } from '@/lib/generated/prisma/client'
import { t } from '@/lib/i18n'
import type { EmailLog } from '@/lib/generated/prisma/client'

// 15 мин последний ретрай (RETRY_DELAYS_MS в lib/email) + запас: после рестарта Render
// ретраи живут только в процессе, и письмо может навсегда остаться QUEUED (ревью T10).
export const STALE_QUEUED_MS = 20 * 60 * 1000

/** true, если письмо в QUEUED дольше STALE_QUEUED_MS — вероятно, рестарт оборвал ретраи. */
export function isStaleQueued(log: Pick<EmailLog, 'status' | 'createdAt'>, now: Date): boolean {
  return log.status === 'QUEUED' && now.getTime() - log.createdAt.getTime() > STALE_QUEUED_MS
}

export type ResendResult = 'sent' | 'not_found' | 'user_gone' | 'unsupported_type' | 'cert_gone' | 'send_failed'

/** ADM-08: переотправка = НОВАЯ запись в email_log (MAIL-05) с НОВЫМ токеном (D-028) —
 *  сырых токенов в payload не храним, свежая ссылка полезнее истёкшей. */
export async function resendFromLog(emailLogId: string): Promise<ResendResult> {
  const log = await db.emailLog.findUnique({ where: { id: emailLogId } })
  if (!log) return 'not_found'
  if (log.type === 'CERTIFICATE') {
    // Свой сценарий (не login-ссылка): ищем актуальный VALID-сертификат владельца — номер в исходном
    // письме мог быть отозван (D-010), переотправлять отозванный номер нельзя.
    const userId = log.userId
    const cert = userId
      ? await db.certificate.findFirst({ where: { userId, courseSlug: 'ai-basics', status: 'VALID' } })
      : null
    if (!cert || !userId) return 'cert_gone'
    try {
      const { sendCertificateEmail } = await import('@/lib/cert')
      await sendCertificateEmail(userId, cert.number)
    } catch (e) {
      // Playwright/рендер может упасть — админ должен увидеть баннер, а не 500 (ревью T3)
      console.error('[cert] переотправка не удалась:', e)
      return 'send_failed'
    }
    return 'sent'
  }
  if (log.type === 'WELCOME') {
    // Пароль воспроизвести нельзя (хранится только хэш, D-032/AUTH-14) — переотправка WELCOME
    // всегда ведёт на reset-ссылку «задать пароль», а не повторяет исходное письмо с секретом.
    // Полезнее unsupported: студент потерял письмо → админ жмёт «переотправить» → студент получает
    // рабочую ссылку и сам задаёт новый пароль.
    const user = await db.user.findUnique({ where: { email: log.toEmail } })
    if (!user) return 'user_gone' // GDPR-удалённый адресат
    const { url } = await mintResetToken(log.toEmail, ResetTokenPurpose.PASSWORD_RESET)
    await sendEmail({
      to: log.toEmail, userId: user.id, type: 'WELCOME', subject: t.email.welcomeSubject,
      html: renderEmail({ body: t.email.welcomeBodyExisting, buttonText: t.email.welcomeButtonExisting, buttonUrl: url }),
      payload: {}, // D-028: reset-url в payload не храним
    })
    return 'sent'
  }
  // T6 (Ф7а, D-031): MAGIC_LINK и ACCESS_GRANTED — оба сняты вместе с magic-link-входом
  // (mintLoginUrl больше не существует); переотправка этих исторических записей email_log
  // невозможна и не нужна (сама выдача доступа теперь всегда идёт через WELCOME, T5).
  // CERTIFICATE/WELCOME обработаны выше; PASSWORD_RESET/DOUBLE_OPT_IN/CONSULTATION — без
  // адресной переотправки (D-028: свежий токен запрашивается заново самим пользователем).
  return 'unsupported_type'
}
