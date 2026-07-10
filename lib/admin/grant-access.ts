import { db } from '@/lib/db'
import { sendWelcomeEmail } from '@/lib/email/welcome'
import { createUserWithPassword } from '@/lib/auth/provision'
import { mintResetToken } from '@/lib/auth/reset'
import { ResetTokenPurpose } from '@/lib/generated/prisma/client'
import { isUniqueViolation } from '@/lib/db-errors'

export type GrantResult =
  | { status: 'granted'; plainPassword: string | null; email: string }
  | { status: 'granted_email_failed'; plainPassword: string | null; email: string }
  | { status: 'already' }
  | { status: 'not_found' }

/** ADM-03/04: выдаёт доступ по заявке — одна транзакция, письмо шлётся после её успеха.
 *  T5 (AUTH-15/F11): вместо upsert без пароля — createUserWithPassword (идемпотентно:
 *  повторная выдача НЕ перевыпускает пароль действующего юзера, REG-14). */
export async function grantAccess(registrationId: string, adminUserId: string): Promise<GrantResult> {
  const reg = await db.registration.findUnique({ where: { id: registrationId } })
  if (!reg) return { status: 'not_found' }

  let user: { id: string; email: string }
  let plainPassword: string | null
  let url: string
  try {
    const result = await db.$transaction(async tx => {
      const provisioned = await createUserWithPassword(
        { email: reg.email, firstName: reg.firstName, lastName: reg.lastName, phone: reg.phone, telegram: reg.telegram },
        tx,
      )
      await tx.consent.updateMany({ where: { email: reg.email, userId: null }, data: { userId: provisioned.user.id } }) // F2: consents получают userId
      await tx.enrollment.create({ data: { userId: provisioned.user.id, grantedById: adminUserId } }) // бросит P2002 при дубле (ADM-04)
      await tx.registration.update({ where: { id: reg.id }, data: { status: 'ENROLLED', alreadyEnrolled: true } })
      // Пароль не перевыпущен (юзер уже был с паролем) → письмо ведёт не на показ пароля, а на
      // reset-ссылку «задать пароль» (D-028: готовый хелпер T4 вместо ручного newToken/hashToken).
      const url = provisioned.plainPassword === null
        ? (await mintResetToken(reg.email, ResetTokenPurpose.PASSWORD_RESET, tx)).url
        : `${process.env.APP_URL}/login`
      return { user: provisioned.user, plainPassword: provisioned.plainPassword, url }
    })
    user = result.user
    plainPassword = result.plainPassword
    url = result.url
  } catch (e) {
    if (isUniqueViolation(e)) return { status: 'already' } // unique(userId, courseSlug) — ADM-04, письмо НЕ шлём
    throw e
  }

  // Нота ревью T4/T9: транзакция уже успешна (доступ выдан) — сбой письма после неё не «выдача не удалась».
  // Ловим сбой ПОСТАНОВКИ письма в очередь (emailLog.create): sendEmail резолвится сразу после создания
  // записи, доставка fire-and-forget. Сбои доставки асинхронны и видны как FAILED в email_log (D-013),
  // кнопка переотправки — раздел «Письма» (T10).
  try {
    await sendWelcomeEmail(user, plainPassword, url) // Ф7б Task 4: тело письма вынесено в lib/email/welcome.ts — переиспользуется авто-выдачей по инвайту
  } catch {
    return { status: 'granted_email_failed', plainPassword, email: user.email }
  }
  return { status: 'granted', plainPassword, email: user.email }
}
