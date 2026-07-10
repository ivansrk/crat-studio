import { db } from '@/lib/db'
import { isUniqueViolation } from '@/lib/db-errors'
import { normalizePhone } from './phone'
import { getInviteByToken, getInviteState } from '@/lib/invite'
import { mintResetToken } from '@/lib/auth/reset'
import { sendEmail } from '@/lib/email'
import { renderEmail } from '@/lib/email/templates'
import { t } from '@/lib/i18n'
import { ResetTokenPurpose } from '@/lib/generated/prisma/client'

export type RegistrationInput = {
  firstName: string; lastName: string; email: string
  phone: string | null; telegram: string | null; whatsapp: string | null
  dataConsent: boolean; wantsNewsletter: boolean
  inviteToken?: string | null // Ф7б INV-03: форма по /invite/{token}
}

export type NormalizedRegistration = {
  firstName: string; lastName: string; email: string
  phone: string; telegram: string | null; whatsapp: string | null
  wantsNewsletter: boolean; inviteToken: string | null
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Возвращает нормализованные данные или null, если форма невалидна
 *  (REG-06: обязательные поля + согласие на ПД; REG-16: телефон обязателен и валиден). */
export function normalizeRegistration(i: RegistrationInput): NormalizedRegistration | null {
  const email = i.email?.trim().toLowerCase() ?? ''
  const firstName = i.firstName?.trim() ?? ''
  const lastName = i.lastName?.trim() ?? ''
  const phone = normalizePhone(i.phone) // REG-16
  if (!firstName || !lastName || !EMAIL_RE.test(email) || !i.dataConsent || !phone) return null
  const opt = (v: string | null | undefined) => (v?.trim() ? v.trim() : null)
  return {
    firstName, lastName, email, phone, telegram: opt(i.telegram), whatsapp: opt(i.whatsapp),
    wantsNewsletter: !!i.wantsNewsletter, inviteToken: opt(i.inviteToken),
  }
}

export type SubmitRegistrationResult =
  | 'pending'        // REG-11: заявка создана/обновлена, письмо double opt-in отправлено
  | 'already'        // REG-14/E-INV3: email уже ENROLLED — доступ и письмо не пересоздаются
  | 'invite_invalid' // INV-04/E-INV1: инвайт неизвестен/отозван/просрочен/исчерпан
  | 'invalid'        // REG-06/REG-16: форма не прошла валидацию

/** F14/F15, REG-10…16: создаёт/обновляет заявку и запускает double opt-in.
 *  Consent НЕ пишется здесь (docs/data-model.md §2) — только после подтверждения
 *  по ссылке из письма (Task 4, REG-13). */
export async function submitRegistration(input: RegistrationInput): Promise<SubmitRegistrationResult> {
  const data = normalizeRegistration(input)
  if (!data) return 'invalid'
  const { email, firstName, lastName, phone, telegram, whatsapp, wantsNewsletter, inviteToken } = data

  let inviteLinkId: string | null = null
  if (inviteToken) {
    const invite = await getInviteByToken(inviteToken)
    if (!invite || getInviteState(invite) !== 'ok') return 'invite_invalid' // INV-04
    inviteLinkId = invite.id
  }

  type PersistResult = { already: true } | { already: false; url: string }

  // Заявка + свежий opt-in-токен — атомарно, одной транзакцией (тот же P2002-паттерн, что был в F1).
  const persist = (): Promise<PersistResult> => db.$transaction(async tx => {
    const existing = await tx.registration.findUnique({ where: { email } })
    if (existing?.status === 'ENROLLED') return { already: true } // REG-14: доступ уже выдан, не трогаем

    if (existing) {
      await tx.registration.update({                                          // REG-05/REG-15: не дубль, а update
        where: { email },
        data: {
          firstName, lastName, phone, telegram, whatsapp, wantsNewsletter, inviteLinkId,
          submitCount: { increment: 1 }, status: 'PENDING_OPT_IN', confirmedAt: null,
        },
      })
    } else {
      await tx.registration.create({
        data: { email, firstName, lastName, phone, telegram, whatsapp, wantsNewsletter, inviteLinkId, status: 'PENDING_OPT_IN' },
      })
    }
    const { url } = await mintResetToken(email, ResetTokenPurpose.OPT_IN, tx) // REG-11, TTL 60 мин (D-031)
    return { already: false, url }
  })

  let result: PersistResult
  try {
    result = await persist()
  } catch (e) {
    // Двойной сабмит (double-click): оба запроса видят findUnique=null → второй create падает P2002 →
    // повторяем транзакцию, заявка уже существует → update-ветка.
    if (!isUniqueViolation(e)) throw e
    try {
      result = await persist()
    } catch (e2) {
      // Теоретический второй P2002 подряд: данные первой гонки уже в базе и письмо уже уходит
      // от неё — пользователю чинить нечего.
      if (!isUniqueViolation(e2)) throw e2
      return 'pending'
    }
  }

  if (result.already) return 'already'

  await sendEmail({
    to: email, type: 'DOUBLE_OPT_IN', subject: t.email.doubleOptInSubject,
    html: renderEmail({ body: t.email.doubleOptInBody, buttonText: t.email.doubleOptInButton, buttonUrl: result.url }),
    payload: {}, // D-028: сырой URL в email_log не храним
  })
  return 'pending'
}
