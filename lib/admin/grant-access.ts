import { db } from '@/lib/db'
import { sendEmail } from '@/lib/email'
import { renderEmail } from '@/lib/email/templates'
import { mintLoginUrl } from '@/lib/auth/magic-link'
import { isUniqueViolation } from '@/lib/db-errors'
import { t } from '@/lib/i18n'

export type GrantResult = 'granted' | 'granted_email_failed' | 'already' | 'not_found'

/** ADM-03/04: выдаёт доступ по заявке — одна транзакция, письмо шлётся после её успеха. */
export async function grantAccess(registrationId: string, adminUserId: string): Promise<GrantResult> {
  const reg = await db.registration.findUnique({ where: { id: registrationId } })
  if (!reg) return 'not_found'

  let user: { id: string; email: string }
  let url: string
  try {
    const result = await db.$transaction(async tx => {
      const user = await tx.user.upsert({
        where: { email: reg.email },
        update: {},
        create: { email: reg.email, firstName: reg.firstName, lastName: reg.lastName, phone: reg.phone, telegram: reg.telegram },
      })
      await tx.consent.updateMany({ where: { email: reg.email, userId: null }, data: { userId: user.id } }) // F2: consents получают userId
      await tx.enrollment.create({ data: { userId: user.id, grantedById: adminUserId } }) // бросит P2002 при дубле (ADM-04)
      await tx.registration.update({ where: { id: reg.id }, data: { status: 'ENROLLED', alreadyEnrolled: true } })
      const url = await mintLoginUrl(reg.email, tx) // D-028: готовый хелпер T8 вместо ручного newToken/hashToken/magicLink.create
      return { user, url }
    })
    user = result.user
    url = result.url
  } catch (e) {
    if (isUniqueViolation(e)) return 'already' // unique(userId, courseSlug) — ADM-04, письмо НЕ шлём
    throw e
  }

  // Нота ревью T4: транзакция уже успешна (доступ выдан) — сбой письма после неё не «выдача не удалась»,
  // а отдельный статус, чтобы админ переотправил письмо, а не пытался выдать доступ повторно.
  try {
    await sendEmail({
      to: user.email, userId: user.id, type: 'ACCESS_GRANTED', subject: t.email.accessSubject,
      html: renderEmail({ body: t.email.accessBody, buttonText: t.email.magicLinkButton, buttonUrl: url }),
      payload: {}, // D-028: сырых токенов в email_log не храним
    })
  } catch {
    return 'granted_email_failed'
  }
  return 'granted'
}
