import { sendEmail } from '@/lib/email'
import { renderEmail, fillPlaceholders } from '@/lib/email/templates'
import { t } from '@/lib/i18n'

/** F11/AUTH-15: единое тело письма WELCOME при создании/подтверждении учётки — с паролем (новый
 *  юзер) или без (повторная выдача, юзер уже с паролем — идемпотентность createUserWithPassword,
 *  письмо ведёт на set-password/reset-ссылку вместо показа старого секрета). Вынесено из
 *  lib/admin/grant-access.ts (ручная выдача, ADM-03), переиспользуется авто-выдачей по инвайту
 *  (Ф7б Task 4, REG-13, lib/registration/confirm.ts) — тело письма и payload (D-028) должны
 *  совпадать в обоих путях. Не ловит ошибку sendEmail — caller решает, что делать со сбоем
 *  постановки в очередь (grant-access → granted_email_failed; confirm → лог и мягкое auto).
 */
export async function sendWelcomeEmail(
  user: { id: string; email: string },
  plainPassword: string | null,
  url: string,
): Promise<void> {
  const html = plainPassword !== null
    ? renderEmail({
        body: fillPlaceholders(t.email.welcomeBody, { email: user.email, password: plainPassword }),
        buttonText: t.email.welcomeButton, buttonUrl: url,
      })
    : renderEmail({ body: t.email.welcomeBodyExisting, buttonText: t.email.welcomeButtonExisting, buttonUrl: url })
  await sendEmail({
    to: user.email, userId: user.id, type: 'WELCOME', subject: t.email.welcomeSubject, html,
    payload: {}, // D-028: ни пароль, ни reset-url в email_log не попадают
  })
}
