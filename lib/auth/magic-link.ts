import { createHash, randomBytes } from 'node:crypto'
import { db } from '@/lib/db'
import { limiters } from './rate-limit'
import { isAdminEmail } from './current-user'
import { sendEmail } from '@/lib/email'
import { renderEmail } from '@/lib/email/templates'
import { t } from '@/lib/i18n'
import type { PrismaClient } from '@/lib/generated/prisma/client'

export const MAGIC_TTL_MS = 15 * 60 * 1000 // AUTH-03
export const newToken = () => randomBytes(32).toString('hex')
export const hashToken = (raw: string) => createHash('sha256').update(raw).digest('hex') // D-009

/** Выпускает новый magic-link и возвращает URL входа. Сырой токен живёт только в письме (D-028);
 *  вызывающие гарантируют существование пользователя. */
export async function mintLoginUrl(email: string, client: Pick<PrismaClient, 'passwordResetToken' | 'user'> = db): Promise<string> {
  const user = await client.user.findUnique({ where: { email } })
  if (!user) throw new Error('user not found')
  const raw = newToken()
  await client.passwordResetToken.create({ data: { tokenHash: hashToken(raw), email, userId: user.id, expiresAt: new Date(Date.now() + MAGIC_TTL_MS) } })
  return `${process.env.APP_URL}/auth/${raw}`
}

/** AUTH-02: наружу ВСЕГДА один ответ; письмо уходит только существующему пользователю. */
export async function requestMagicLink(rawEmail: string): Promise<void> {
  const email = rawEmail.trim().toLowerCase()
  if (!email || !limiters.magicLink.allow(`ml:${email}`)) return // AUTH-08: молча (ответ одинаковый)
  const user = await db.user.findUnique({ where: { email } })
  if (!user) return                                              // SEC-06: не раскрываем
  const url = await mintLoginUrl(email)
  await sendEmail({
    to: email, userId: user.id, type: 'MAGIC_LINK', subject: t.email.magicLinkSubject,
    html: renderEmail({ body: t.email.magicLinkBody, buttonText: t.email.magicLinkButton, buttonUrl: url }),
    payload: {}, // D-028: сырой URL в email_log не храним; переотправка (ADM-08) выпустит новый токен
  })
}

export type ConsumeResult = { ok: true; userId: string; isAdmin: boolean } | { ok: false; reason: 'used' | 'expired' | 'unknown' }

/** AUTH-04: строго одноразово — атомарный updateMany WHERE usedAt IS NULL. */
export async function consumeMagicLink(raw: string): Promise<ConsumeResult> {
  const tokenHash = hashToken(raw)
  const link = await db.passwordResetToken.findUnique({ where: { tokenHash } })
  if (!link) return { ok: false, reason: 'unknown' }
  if (link.usedAt) return { ok: false, reason: 'used' }            // AUTH-05
  if (link.expiresAt < new Date()) return { ok: false, reason: 'expired' } // AUTH-06
  const claimed = await db.passwordResetToken.updateMany({ where: { tokenHash, usedAt: null }, data: { usedAt: new Date() } })
  if (claimed.count !== 1) return { ok: false, reason: 'used' }    // гонка двух кликов
  const user = await db.user.findUnique({ where: { email: link.email } })
  if (!user) return { ok: false, reason: 'unknown' }               // GDPR-удалён между выпиской и кликом
  return { ok: true, userId: user.id, isAdmin: isAdminEmail(user.email) }
}
