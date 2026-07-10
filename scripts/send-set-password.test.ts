import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runSetPasswordCampaign } from './send-set-password'
import { ResetTokenPurpose } from '@/lib/generated/prisma/client'
import type { PrismaClient } from '@/lib/generated/prisma/client'

vi.mock('@/lib/email', () => ({ sendEmail: vi.fn().mockResolvedValue('log-id') }))
import { sendEmail } from '@/lib/email'

type FakeUser = { id: string; email: string; passwordHash: string | null }
type FakeToken = {
  id: string; tokenHash: string; email: string; userId: string | null
  purpose: ResetTokenPurpose; expiresAt: Date; usedAt: Date | null; createdAt: Date
}

/** DI-клиент в духе lib/auth/reset.test.ts: моки user/passwordResetToken без vi.mock('@/lib/db'). */
function fakeClient(opts: { users?: FakeUser[]; tokens?: FakeToken[] } = {}) {
  const store: { users: FakeUser[]; tokens: FakeToken[] } = { users: opts.users ?? [], tokens: opts.tokens ?? [] }

  const userFindMany = vi.fn(async ({ where }: { where: { passwordHash: null } }) =>
    store.users.filter((u) => (where.passwordHash === null ? u.passwordHash === null : true)))
  const userFindUnique = vi.fn(async ({ where: { email } }: { where: { email: string } }) =>
    store.users.find((u) => u.email === email) ?? null)

  const tokenFindFirst = vi.fn(async ({ where }: { where: { email: string; purpose: ResetTokenPurpose; usedAt: null; expiresAt: { gt: Date } } }) =>
    store.tokens.find((tk) =>
      tk.email === where.email && tk.purpose === where.purpose && tk.usedAt === null && tk.expiresAt.getTime() > where.expiresAt.gt.getTime(),
    ) ?? null)
  const tokenCreate = vi.fn(async ({ data }: { data: Omit<FakeToken, 'id' | 'usedAt' | 'createdAt'> }) => {
    const created: FakeToken = { id: `t-${Math.random().toString(36).slice(2)}`, usedAt: null, createdAt: new Date(), ...data }
    store.tokens.push(created)
    return created
  })

  const client = {
    user: { findMany: userFindMany, findUnique: userFindUnique },
    passwordResetToken: { findFirst: tokenFindFirst, create: tokenCreate },
  } as unknown as Pick<PrismaClient, 'user' | 'passwordResetToken'>

  return { client, store, userFindMany, tokenFindFirst, tokenCreate }
}

describe('runSetPasswordCampaign (Ф7а Task 7, D-034)', () => {
  beforeEach(() => {
    vi.mocked(sendEmail).mockClear()
  })

  it('юзер без пароля и без живого токена → выбран, письмо отправлено', async () => {
    const { client, tokenCreate } = fakeClient({
      users: [{ id: 'u1', email: 'nopass@test.c', passwordHash: null }],
    })

    const result = await runSetPasswordCampaign(client)

    expect(result).toEqual({ total: 1, sent: 1, skipped: 0, failed: 0 })
    expect(sendEmail).toHaveBeenCalledOnce()
    const call = vi.mocked(sendEmail).mock.calls[0][0]
    expect(call.to).toBe('nopass@test.c')
    expect(call.type).toBe('PASSWORD_RESET')
    expect(call.payload).toEqual({}) // D-028
    expect(call.html).toContain('/reset/')
    expect(tokenCreate).toHaveBeenCalledOnce()
  })

  it('юзер с паролем → не выбран, письмо не шлётся', async () => {
    const { client } = fakeClient({
      users: [{ id: 'u2', email: 'haspass@test.c', passwordHash: 'hash' }],
    })

    const result = await runSetPasswordCampaign(client)

    expect(result).toEqual({ total: 0, sent: 0, skipped: 0, failed: 0 })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('юзер с живым (не истёкшим, не использованным) токеном → пропуск, письмо не шлётся повторно', async () => {
    const liveToken: FakeToken = {
      id: 'tok-live', tokenHash: 'h1', email: 'pending@test.c', userId: 'u3',
      purpose: ResetTokenPurpose.PASSWORD_RESET, expiresAt: new Date(Date.now() + 30 * 60 * 1000), usedAt: null, createdAt: new Date(),
    }
    const { client } = fakeClient({
      users: [{ id: 'u3', email: 'pending@test.c', passwordHash: null }],
      tokens: [liveToken],
    })

    const result = await runSetPasswordCampaign(client)

    expect(result).toEqual({ total: 1, sent: 0, skipped: 1, failed: 0 })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('истёкший токен не считается живым → письмо всё равно отправляется', async () => {
    const expiredToken: FakeToken = {
      id: 'tok-expired', tokenHash: 'h2', email: 'expired@test.c', userId: 'u4',
      purpose: ResetTokenPurpose.PASSWORD_RESET, expiresAt: new Date(Date.now() - 1000), usedAt: null, createdAt: new Date(),
    }
    const { client } = fakeClient({
      users: [{ id: 'u4', email: 'expired@test.c', passwordHash: null }],
      tokens: [expiredToken],
    })

    const result = await runSetPasswordCampaign(client)

    expect(result).toEqual({ total: 1, sent: 1, skipped: 0, failed: 0 })
    expect(sendEmail).toHaveBeenCalledOnce()
  })

  it('использованный (usedAt заполнен) токен не считается живым → письмо отправляется', async () => {
    const usedToken: FakeToken = {
      id: 'tok-used', tokenHash: 'h3', email: 'used@test.c', userId: 'u5',
      purpose: ResetTokenPurpose.PASSWORD_RESET, expiresAt: new Date(Date.now() + 30 * 60 * 1000), usedAt: new Date(), createdAt: new Date(),
    }
    const { client } = fakeClient({
      users: [{ id: 'u5', email: 'used@test.c', passwordHash: null }],
      tokens: [usedToken],
    })

    const result = await runSetPasswordCampaign(client)

    expect(result).toEqual({ total: 1, sent: 1, skipped: 0, failed: 0 })
    expect(sendEmail).toHaveBeenCalledOnce()
  })

  it('dry-run → перечисляет, но не шлёт письма и не создаёт токен', async () => {
    const { client, tokenCreate } = fakeClient({
      users: [{ id: 'u6', email: 'dry@test.c', passwordHash: null }],
    })

    const result = await runSetPasswordCampaign(client, { dryRun: true })

    expect(result).toEqual({ total: 1, sent: 1, skipped: 0, failed: 0 })
    expect(sendEmail).not.toHaveBeenCalled()
    expect(tokenCreate).not.toHaveBeenCalled()
  })

  it('несколько юзеров: сбой отправки одному не мешает остальным (try/catch на юзера)', async () => {
    const { client } = fakeClient({
      users: [
        { id: 'u7', email: 'fails@test.c', passwordHash: null },
        { id: 'u8', email: 'ok@test.c', passwordHash: null },
      ],
    })
    vi.mocked(sendEmail)
      .mockRejectedValueOnce(new Error('resend down'))
      .mockResolvedValueOnce('log-id')

    const result = await runSetPasswordCampaign(client)

    expect(result).toEqual({ total: 2, sent: 1, skipped: 0, failed: 1 })
    expect(sendEmail).toHaveBeenCalledTimes(2)
  })

  it('пустая выборка → нули, письма не шлются', async () => {
    const { client } = fakeClient({ users: [] })
    expect(await runSetPasswordCampaign(client)).toEqual({ total: 0, sent: 0, skipped: 0, failed: 0 })
    expect(sendEmail).not.toHaveBeenCalled()
  })
})
