import { db } from '@/lib/db'
import { mintResetToken } from '@/lib/auth/reset'
import { sendEmail } from '@/lib/email'
import { renderEmail } from '@/lib/email/templates'
import { t } from '@/lib/i18n'
import { ResetTokenPurpose } from '@/lib/generated/prisma/client'

export type ResendOptInResult = 'sent' | 'not_found' | 'not_pending'

// ADM-14 (уточнение Ивана 2026-07-20): пока свежее письмо-подтверждение «в пути», кнопка
// переотправки не показывается — она путает («письмо уже ушло — зачем кнопки?»). Появляется,
// когда человек явно застрял: сутки тишины (токен живёт 72 ч — запас остаётся). Резервный путь
// переотправки в любой момент — раздел «Письма» (ADM-08).
export const OPT_IN_RESEND_AFTER_MS = 24 * 60 * 60 * 1000

/** true, если админу пора показать кнопку «Отправить подтверждение ещё раз». */
export function canResendOptIn(lastOptInSentAt: Date | null, now: Date): boolean {
  return !lastOptInSentAt || now.getTime() - lastOptInSentAt.getTime() >= OPT_IN_RESEND_AFTER_MS
}

/** Свежий OPT_IN-токен (72 ч, REG-11) + письмо DOUBLE_OPT_IN — общий низ для обеих точек
 *  переотправки (строка заявки ADM-14 и раздел «Письма» ADM-08). Исходный URL в email_log
 *  не хранится (D-028), да и был бы просрочен. Новая запись email_log (MAIL-05). */
export async function sendOptInEmail(email: string): Promise<void> {
  const { url } = await mintResetToken(email, ResetTokenPurpose.OPT_IN)
  await sendEmail({
    to: email, type: 'DOUBLE_OPT_IN', subject: t.email.doubleOptInSubject,
    html: renderEmail({ body: t.email.doubleOptInBody, buttonText: t.email.doubleOptInButton, buttonUrl: url }),
    payload: {}, // D-028: сырой URL в email_log не храним
  })
}

/** ADM-14 (D-053): переотправка письма-подтверждения по заявке PENDING_OPT_IN.
 *  Подтверждённые/зачисленные заявки не трогаем: им подтверждать нечего (not_pending). */
export async function resendOptIn(registrationId: string): Promise<ResendOptInResult> {
  const reg = await db.registration.findUnique({ where: { id: registrationId } })
  if (!reg) return 'not_found'
  if (reg.status !== 'PENDING_OPT_IN') return 'not_pending'
  await sendOptInEmail(reg.email)
  return 'sent'
}
