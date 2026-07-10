import { db } from '@/lib/db'
import { consumeResetToken, mintResetToken } from '@/lib/auth/reset'
import { createUserWithPassword } from '@/lib/auth/provision'
import { sendWelcomeEmail } from '@/lib/email/welcome'
import { getInviteState, incrementInviteCount } from '@/lib/invite'
import { appendConsent } from '@/lib/registration/consents'
import { isUniqueViolation } from '@/lib/db-errors'
import { ResetTokenPurpose, type ConsentType, type PrismaClient } from '@/lib/generated/prisma/client'

export type ConfirmRegistrationResult =
  | { mode: 'auto'; plainPassword: string | null; courseSlug: string } // F14, REG-13 инвайт-путь: авто User+Enrollment
  | { mode: 'manual' } // F15, D-035: публичная заявка → CONFIRMED, доступ выдаёт админ (ADM-03)
  | { mode: 'already' } // E-INV3/E-INV5: доступ уже выдан (повторный клик/двойной токен/гонка)
  | { mode: 'invite_gone' } // E-INV2: инвайт исчерпан/отозван/просрочен между формой и подтверждением
  | { mode: 'invalid'; reason: 'invalid' | 'used' | 'expired' } // AUTH-05/06 или заявки нет

type ConfirmClient = Pick<PrismaClient, 'passwordResetToken' | 'registration' | 'consent' | 'inviteLink' | '$transaction'>

/** Идемпотентная запись действующего согласия (D-014, journal): если granted-запись такого типа
 *  для этого email уже есть — не дублируем (E-INV4/REG-15: заявку можно переотправить и подтвердить
 *  повторно новым токеном — Consent не должен расти на каждый цикл). userId проставляется позже —
 *  тем же паттерном, что и ручная выдача (grant-access.ts: consent.updateMany при создании User). */
async function ensureConsent(client: Pick<PrismaClient, 'consent'>, email: string, type: ConsentType): Promise<void> {
  const existing = await client.consent.findFirst({ where: { email, type, granted: true } })
  if (existing) return
  await appendConsent({ email, type, granted: true, source: 'REGISTRATION_FORM' }, client)
}

/** REG-13/F14/F15, D-035: подтверждение double opt-in по ссылке из письма DOUBLE_OPT_IN.
 *  Токен — OPT_IN (общая token-механика с reset, T4-обобщение consumeResetToken). Согласия
 *  фиксируются как действующие независимо от исхода авто/ручного пути; авто-выдача — только
 *  если заявка пришла по инвайту (проверяется на момент подтверждения, не на момент формы —
 *  E-INV2), иначе заявка остаётся заявкой (CONFIRMED) для ручной выдачи (ADM-03). */
export async function confirmRegistration(rawToken: string, client: ConfirmClient = db): Promise<ConfirmRegistrationResult> {
  const consumed = await consumeResetToken(rawToken, client, ResetTokenPurpose.OPT_IN)
  if (!consumed.ok) return { mode: 'invalid', reason: consumed.reason }

  const reg = await client.registration.findUnique({ where: { email: consumed.email } })
  if (!reg) return { mode: 'invalid', reason: 'invalid' } // мягко: заявка исчезла (GDPR/рассинхрон) между письмом и кликом

  if (reg.status === 'ENROLLED') return { mode: 'already' } // E-INV3: повторный клик по валидному второму токену после успеха

  // REG-13: согласия действующие в обоих исходах (даже если ниже окажется invite_gone — E-INV2).
  await ensureConsent(client, reg.email, 'DATA_PROCESSING')
  if (reg.wantsNewsletter) await ensureConsent(client, reg.email, 'NEWSLETTER')

  if (reg.inviteLinkId) {
    const invite = await client.inviteLink.findUnique({ where: { id: reg.inviteLinkId } })
    const state = invite ? getInviteState(invite) : 'revoked'
    if (!invite || state !== 'ok') {
      // E-INV2: лимит/срок/отзыв случились между отправкой формы и подтверждением — Consent уже
      // записаны (это ок), заявка не теряется — падает в тот же ручной путь, что публичная (F15).
      await client.registration.update({ where: { id: reg.id }, data: { status: 'CONFIRMED', confirmedAt: new Date() } })
      return { mode: 'invite_gone' }
    }

    let provisioned: { user: { id: string; email: string }; plainPassword: string | null; url: string }
    try {
      provisioned = await client.$transaction(async tx => {
        const p = await createUserWithPassword(
          { email: reg.email, firstName: reg.firstName, lastName: reg.lastName, phone: reg.phone, telegram: reg.telegram },
          tx,
        )
        await tx.consent.updateMany({ where: { email: reg.email, userId: null }, data: { userId: p.user.id } }) // F2, тот же приём, что grant-access
        await tx.enrollment.create({ data: { userId: p.user.id, courseSlug: invite.courseSlug, source: invite.sourceLabel } }) // P2002 → E-INV5, already
        await incrementInviteCount(tx, invite.id) // INV-05
        await tx.registration.update({ where: { id: reg.id }, data: { status: 'ENROLLED', confirmedAt: new Date() } })
        const url = p.plainPassword === null
          ? (await mintResetToken(reg.email, ResetTokenPurpose.PASSWORD_RESET, tx)).url
          : `${process.env.APP_URL ?? 'http://localhost:3000'}/login`
        return { user: p.user, plainPassword: p.plainPassword, url }
      })
    } catch (e) {
      if (isUniqueViolation(e)) return { mode: 'already' } // E-INV5: unique(userId, courseSlug) — гонка двух подтверждений
      throw e
    }

    // Транзакция уже успешна (доступ выдан) — сбой постановки письма в очередь не должен превращать
    // «доступ выдан» в ошибку (тот же принцип, что T5/T9 в grant-access.ts); ретраи доставки — фон.
    try {
      await sendWelcomeEmail(provisioned.user, provisioned.plainPassword, provisioned.url)
    } catch (e) {
      console.error('[confirm] не смог поставить WELCOME в очередь:', e)
    }
    return { mode: 'auto', plainPassword: provisioned.plainPassword, courseSlug: invite.courseSlug }
  }

  // F15/D-035: публичная заявка (без инвайта) — доступ не выдаём автоматически, курс платный.
  await client.registration.update({ where: { id: reg.id }, data: { status: 'CONFIRMED', confirmedAt: new Date() } })
  return { mode: 'manual' }
}
