import { db } from '@/lib/db'
import { limiters } from './rate-limit'
import { newToken, hashToken } from './tokens'
import { hashPassword } from './password'
import { sendEmail } from '@/lib/email'
import { renderEmail } from '@/lib/email/templates'
import { t } from '@/lib/i18n'
import { ResetTokenPurpose, type PrismaClient } from '@/lib/generated/prisma/client'

// AUTH-16/17, D-031: reset/первый-вход на той же token-механике, что и magic-link (T8),
// но с более длинным TTL — ссылку присылают на восстановление, не на каждый вход.
export const RESET_TTL_MS = 60 * 60 * 1000

/** Выпускает reset-токен и URL. purpose=PASSWORD_RESET → /reset/{raw}; OPT_IN (Ф7б) → /invite-confirm/{raw}.
 *  Сырой токен живёт только в url — не логируется отдельно (D-028). userId проставляется, если
 *  пользователь с таким email уже существует; для OPT_IN его обычно ещё нет. */
export async function mintResetToken(
  email: string,
  purpose: ResetTokenPurpose = ResetTokenPurpose.PASSWORD_RESET,
  client: Pick<PrismaClient, 'passwordResetToken' | 'user'> = db,
): Promise<{ url: string; tokenId: string }> {
  const user = await client.user.findUnique({ where: { email } })
  const raw = newToken()
  const token = await client.passwordResetToken.create({
    data: { tokenHash: hashToken(raw), email, userId: user?.id ?? null, purpose, expiresAt: new Date(Date.now() + RESET_TTL_MS) },
  })
  const path = purpose === ResetTokenPurpose.PASSWORD_RESET ? 'reset' : 'invite-confirm'
  return { url: `${process.env.APP_URL}/${path}/${raw}`, tokenId: token.id }
}

/** AUTH-16: наружу ВСЕГДА один ответ (SEC-06, тот же приём, что requestMagicLink) — молчим и
 *  при превышении лимита, и при отсутствии пользователя. Rate-limit: свои лимитеры (resetEmail/
 *  resetIp в rate-limit.ts) со значениями magicLink/magicLinkIp, т.к. magic-link уходит целиком
 *  в Task 6 и делить с ним лимитеры не стоит. */
export async function requestPasswordReset(
  rawEmail: string,
  ip: string,
  client: Pick<PrismaClient, 'passwordResetToken' | 'user'> = db,
): Promise<void> {
  const email = rawEmail.trim().toLowerCase()
  if (!email || !limiters.resetEmail.allow(`rst:${email}`) || !limiters.resetIp.allow(`rstip:${ip}`)) return
  const user = await client.user.findUnique({ where: { email } })
  if (!user) return // SEC-06: не раскрываем существование пользователя
  const { url } = await mintResetToken(email, ResetTokenPurpose.PASSWORD_RESET, client)
  await sendEmail({
    to: email, userId: user.id, type: 'PASSWORD_RESET', subject: t.email.resetSubject,
    html: renderEmail({ body: t.email.resetBody, buttonText: t.email.resetButton, buttonUrl: url }),
    payload: {}, // D-028: сырой URL в email_log не храним; переотправка выпустит новый токен
  })
}

export type ConsumeResetResult =
  | { ok: true; email: string; userId: string | null; tokenId: string }
  | { ok: false; reason: 'invalid' | 'used' | 'expired' }

/** AUTH-04-аналог: атомарная одноразовость (updateMany WHERE usedAt IS NULL). Не создаёт
 *  сессию — reset-флоу заканчивается сменой пароля, не входом (F12). OPT_IN-токен на этом
 *  эндпоинте — invalid, эндпоинты разных purpose не взаимозаменяемы. */
export async function consumeResetToken(
  raw: string,
  client: Pick<PrismaClient, 'passwordResetToken'> = db,
): Promise<ConsumeResetResult> {
  const tokenHash = hashToken(raw)
  const token = await client.passwordResetToken.findUnique({ where: { tokenHash } })
  if (!token || token.purpose !== ResetTokenPurpose.PASSWORD_RESET) return { ok: false, reason: 'invalid' }
  if (token.usedAt) return { ok: false, reason: 'used' }             // AUTH-05 / E-PWD3
  if (token.expiresAt < new Date()) return { ok: false, reason: 'expired' } // AUTH-06 / E-PWD3
  const claimed = await client.passwordResetToken.updateMany({ where: { id: token.id, usedAt: null }, data: { usedAt: new Date() } })
  if (claimed.count !== 1) return { ok: false, reason: 'used' }      // гонка двух кликов
  return { ok: true, email: token.email, userId: token.userId, tokenId: token.id }
}

export type PeekResetResult = { status: 'ok' | 'used' | 'expired' | 'invalid' }

/** T6: GET-предпросмотр reset-ссылки — НИКОГДА не гасит токен (findUnique, не updateMany).
 *  Нужен отдельно от consumeResetToken: почтовые клиенты и боты открывают ссылку из письма
 *  на предпросмотр/сканирование ДО того, как человек её откроет — если бы GET жёг токен,
 *  реальный пользователь получал бы «ссылка использована» вместо формы. Гашение — только
 *  на POST через setPasswordViaToken (app/reset/[token]/page.tsx вызывает только эту функцию). */
export async function peekResetToken(
  raw: string,
  client: Pick<PrismaClient, 'passwordResetToken'> = db,
): Promise<PeekResetResult> {
  const token = await client.passwordResetToken.findUnique({ where: { tokenHash: hashToken(raw) } })
  if (!token || token.purpose !== ResetTokenPurpose.PASSWORD_RESET) return { status: 'invalid' }
  if (token.usedAt) return { status: 'used' }             // AUTH-05
  if (token.expiresAt < new Date()) return { status: 'expired' } // AUTH-06
  return { status: 'ok' }
}

export type SetPasswordResult = { ok: true } | { ok: false; reason: 'invalid' | 'used' | 'expired' | 'weak' | 'no_user' }

/** AUTH-17: задаёт новый пароль по reset-токену. Валидация длины (≥8) — ДО гашения токена:
 *  слабый пароль не должен сжигать одноразовую ссылку. После consume токен уже погашен
 *  независимо от исхода (кроме weak). */
export async function setPasswordViaToken(
  raw: string,
  newPassword: string,
  client: Pick<PrismaClient, 'passwordResetToken' | 'user'> = db,
): Promise<SetPasswordResult> {
  if (newPassword.length < 8) return { ok: false, reason: 'weak' } // AUTH-17, токен ещё цел

  const consumed = await consumeResetToken(raw, client)
  if (!consumed.ok) return consumed

  const userId = consumed.userId ?? (await client.user.findUnique({ where: { email: consumed.email } }))?.id ?? null
  if (!userId) return { ok: false, reason: 'no_user' } // GDPR-удалён между выпиской и кликом / OPT_IN-путаница

  const passwordHash = await hashPassword(newPassword)
  await client.user.update({ where: { id: userId }, data: { passwordHash } })
  return { ok: true }
}
