import { db } from '@/lib/db'
import { newToken } from '@/lib/auth/tokens'
import type { InviteLink, PrismaClient } from '@/lib/generated/prisma/client'

export type InviteState = 'ok' | 'revoked' | 'expired' | 'exhausted'

export type InviteStateInput = { active: boolean; expiresAt: Date | null; maxRegistrations: number | null }

/** INV-02/04/05, E-INV1: чистая проверка состояния инвайта. Порядок веток важен — revoked
 *  проверяется первым: отозванная ссылка «недействительна», даже если формально ещё не
 *  просрочена/не исчерпана (админ мог отозвать раньше срока). */
export function inviteState(invite: InviteStateInput, now: Date, count: number): InviteState {
  if (!invite.active) return 'revoked'
  if (invite.expiresAt && invite.expiresAt < now) return 'expired'
  if (invite.maxRegistrations != null && count >= invite.maxRegistrations) return 'exhausted'
  return 'ok'
}

export type CreateInviteInput = {
  courseSlug: string
  sourceLabel: string
  maxRegistrations?: number | null
  expiresAt?: Date | null
}

/** INV-01: выпускает инвайт-ссылку. Токен сырой (не хэшируется, в отличие от reset/magic-link) —
 *  сам по себе доступа не даёт (INV-03), только ведёт на форму, поэтому хранить его в открытом
 *  виде безопасно и удобно (админка должна показывать/копировать готовую ссылку — INV-06).
 *  newToken переиспользован из lib/auth/tokens.ts — тот же общий token-хелпер, что и у
 *  magic-link/reset (см. комментарий в tokens.ts про будущий Ф7б). */
export async function createInvite(
  input: CreateInviteInput,
  adminId: string | null,
  client: Pick<PrismaClient, 'inviteLink'> = db,
): Promise<InviteLink & { url: string }> {
  const token = newToken()
  const invite = await client.inviteLink.create({
    data: {
      token,
      courseSlug: input.courseSlug,
      sourceLabel: input.sourceLabel,
      maxRegistrations: input.maxRegistrations ?? null,
      expiresAt: input.expiresAt ?? null,
      createdById: adminId,
    },
  })
  const url = `${process.env.APP_URL ?? 'http://localhost:3000'}/invite/${token}`
  return { ...invite, url }
}

/** INV-02: отзыв ссылки. Идемпотентно — повторный вызов на уже отозванной ссылке не ошибка. */
export async function revokeInvite(id: string, client: Pick<PrismaClient, 'inviteLink'> = db): Promise<void> {
  await client.inviteLink.update({ where: { id }, data: { active: false } })
}

/** INV-03/04: поиск по сырому токену из URL /invite/{token}. null, если такого нет. */
export async function getInviteByToken(
  token: string,
  client: Pick<PrismaClient, 'inviteLink'> = db,
): Promise<InviteLink | null> {
  return client.inviteLink.findUnique({ where: { token } })
}

/** Обёртка inviteState поверх записи InviteLink — count берётся из registrationsCount. */
export function getInviteState(invite: InviteStateInput & { registrationsCount: number }, now: Date = new Date()): InviteState {
  return inviteState(invite, now, invite.registrationsCount)
}

/** INV-05: атомарный инкремент счётчика подтверждённых регистраций. Вызывается внутри
 *  транзакции подтверждения регистрации (Task 4) — сюда передаётся tx, а не db. */
export async function incrementInviteCount(client: Pick<PrismaClient, 'inviteLink'>, id: string): Promise<void> {
  await client.inviteLink.update({ where: { id }, data: { registrationsCount: { increment: 1 } } })
}

/** INV-06: список для админки, новые сверху. */
export async function listInvites(client: Pick<PrismaClient, 'inviteLink'> = db): Promise<InviteLink[]> {
  return client.inviteLink.findMany({ orderBy: { createdAt: 'desc' } })
}
