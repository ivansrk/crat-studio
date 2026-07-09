import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  mintResetToken, requestPasswordReset, consumeResetToken, setPasswordViaToken, RESET_TTL_MS,
} from './reset'
import { verifyPassword } from './password'
import { limiters } from './rate-limit'
import { ResetTokenPurpose } from '@/lib/generated/prisma/client'
import type { PrismaClient } from '@/lib/generated/prisma/client'

vi.mock('@/lib/email', () => ({ sendEmail: vi.fn().mockResolvedValue('log-id') }))
import { sendEmail } from '@/lib/email'

type FakeUser = { id: string; email: string; passwordHash: string | null }
type FakeToken = {
  id: string; tokenHash: string; email: string; userId: string | null
  purpose: ResetTokenPurpose; expiresAt: Date; usedAt: Date | null; createdAt: Date
}

/** Клиент с моками user/passwordResetToken — тот же приём DI, что login.test.ts/mintLoginUrl:
 *  client: Pick<PrismaClient, ...> = db, без vi.mock('@/lib/db'). */
function fakeClient(opts: { user?: FakeUser | null; token?: FakeToken | null } = {}) {
  const store: { user: FakeUser | null; token: FakeToken | null } = { user: opts.user ?? null, token: opts.token ?? null }

  const userFindUnique = vi.fn(async () => store.user)
  const userUpdate = vi.fn(async ({ data }: { data: { passwordHash: string } }) => {
    if (store.user) store.user = { ...store.user, passwordHash: data.passwordHash }
    return store.user
  })
  const tokenCreate = vi.fn(async ({ data }: { data: Omit<FakeToken, 'id' | 'usedAt' | 'createdAt'> }) => {
    const created: FakeToken = { id: `t-${Math.random().toString(36).slice(2)}`, usedAt: null, createdAt: new Date(), ...data }
    store.token = created
    return created
  })
  const tokenFindUnique = vi.fn(async ({ where: { tokenHash } }: { where: { tokenHash: string } }) =>
    store.token && store.token.tokenHash === tokenHash ? store.token : null)
  const tokenUpdateMany = vi.fn(async ({ where, data }: { where: { id: string; usedAt: null }; data: { usedAt: Date } }) => {
    if (store.token && store.token.id === where.id && store.token.usedAt === null) {
      store.token = { ...store.token, usedAt: data.usedAt }
      return { count: 1 }
    }
    return { count: 0 }
  })

  const client = {
    user: { findUnique: userFindUnique, update: userUpdate },
    passwordResetToken: { create: tokenCreate, findUnique: tokenFindUnique, updateMany: tokenUpdateMany },
  } as unknown as Pick<PrismaClient, 'user' | 'passwordResetToken'>

  return { client, store, userFindUnique, userUpdate, tokenCreate, tokenFindUnique, tokenUpdateMany }
}

describe('mintResetToken (AUTH-16, D-031)', () => {
  it('TTL = 60 минут', () => {
    expect(RESET_TTL_MS).toBe(60 * 60 * 1000)
  })

  it('purpose=PASSWORD_RESET: создаёт запись с TTL 60 мин, userId существующего юзера, url /reset/{raw}', async () => {
    const before = Date.now()
    const { client, tokenCreate } = fakeClient({ user: { id: 'u1', email: 'a@test.c', passwordHash: null } })
    const { url, tokenId } = await mintResetToken('a@test.c', ResetTokenPurpose.PASSWORD_RESET, client)

    expect(tokenCreate).toHaveBeenCalledOnce()
    const data = tokenCreate.mock.calls[0][0].data
    expect(data.purpose).toBe('PASSWORD_RESET')
    expect(data.userId).toBe('u1')
    expect(data.expiresAt.getTime()).toBeGreaterThanOrEqual(before + RESET_TTL_MS)
    expect(url).toMatch(new RegExp(`^${process.env.APP_URL}/reset/[0-9a-f]{64}$`))
    expect(tokenId).toBeTruthy()
  })

  it('purpose=OPT_IN: userId=null если юзера ещё нет, url /invite-confirm/{raw}', async () => {
    const { client, tokenCreate } = fakeClient({ user: null })
    const { url } = await mintResetToken('new@test.c', ResetTokenPurpose.OPT_IN, client)

    const data = tokenCreate.mock.calls[0][0].data
    expect(data.userId).toBeNull()
    expect(data.purpose).toBe('OPT_IN')
    expect(url).toMatch(new RegExp(`^${process.env.APP_URL}/invite-confirm/[0-9a-f]{64}$`))
  })
})

describe('requestPasswordReset (AUTH-16, SEC-06)', () => {
  beforeEach(() => {
    vi.mocked(sendEmail).mockClear()
  })

  it('существующий юзер → письмо PASSWORD_RESET, payload без токена/url (D-028)', async () => {
    const { client } = fakeClient({ user: { id: 'u2', email: 'exists@test.c', passwordHash: null } })
    await requestPasswordReset('exists@test.c', '10.1.0.1', client)

    expect(sendEmail).toHaveBeenCalledOnce()
    const call = vi.mocked(sendEmail).mock.calls[0][0]
    expect(call.type).toBe('PASSWORD_RESET')
    expect(call.to).toBe('exists@test.c')
    // D-028: сырой токен/URL — только в html-письме, но НЕ в payload (это поле идёт в лог/админку)
    expect(call.payload).toEqual({})
    expect(JSON.stringify(call.payload)).not.toContain('/reset/')
    expect(call.html).toContain('/reset/')
  })

  it('несуществующий юзер → письмо не шлётся, наружу всё равно void (SEC-06)', async () => {
    const { client, userFindUnique } = fakeClient({ user: null })
    await expect(requestPasswordReset('ghost@test.c', '10.1.0.2', client)).resolves.toBeUndefined()
    expect(userFindUnique).toHaveBeenCalledOnce()
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('превышение лимита по email → письмо не шлётся, до db не доходит', async () => {
    const email = 'flood-reset@test.c'
    for (let i = 0; i < 3; i++) limiters.resetEmail.allow(`rst:${email}`)
    const { client, userFindUnique } = fakeClient({ user: { id: 'u3', email, passwordHash: null } })
    await requestPasswordReset(email, '10.1.0.3', client)
    expect(userFindUnique).not.toHaveBeenCalled()
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('превышение лимита по IP → письмо не шлётся, до db не доходит', async () => {
    const ip = '10.1.0.4'
    for (let i = 0; i < 10; i++) limiters.resetIp.allow(`rstip:${ip}`)
    const { client, userFindUnique } = fakeClient({ user: { id: 'u4', email: 'flood-ip-reset@test.c', passwordHash: null } })
    await requestPasswordReset('flood-ip-reset@test.c', ip, client)
    expect(userFindUnique).not.toHaveBeenCalled()
    expect(sendEmail).not.toHaveBeenCalled()
  })
})

function makeToken(overrides: Partial<FakeToken> = {}): FakeToken {
  return {
    id: 'tok-1', tokenHash: '', email: 'u@test.c', userId: 'u1',
    purpose: ResetTokenPurpose.PASSWORD_RESET, expiresAt: new Date(Date.now() + 60_000), usedAt: null, createdAt: new Date(),
    ...overrides,
  }
}

describe('consumeResetToken (AUTH-04/05/06)', () => {
  it('неизвестный токен → invalid', async () => {
    const { client } = fakeClient({ token: null })
    expect(await consumeResetToken('nope', client)).toEqual({ ok: false, reason: 'invalid' })
  })

  it('чужой purpose (OPT_IN) → invalid, не гасит токен', async () => {
    const raw = 'raw-optin'
    const { hashToken } = await import('./tokens')
    const token = makeToken({ tokenHash: hashToken(raw), purpose: ResetTokenPurpose.OPT_IN })
    const { client, tokenUpdateMany } = fakeClient({ token })
    expect(await consumeResetToken(raw, client)).toEqual({ ok: false, reason: 'invalid' })
    expect(tokenUpdateMany).not.toHaveBeenCalled()
  })

  it('использован → used', async () => {
    const raw = 'raw-used'
    const { hashToken } = await import('./tokens')
    const token = makeToken({ tokenHash: hashToken(raw), usedAt: new Date() })
    const { client } = fakeClient({ token })
    expect(await consumeResetToken(raw, client)).toEqual({ ok: false, reason: 'used' })
  })

  it('истёк → expired', async () => {
    const raw = 'raw-expired'
    const { hashToken } = await import('./tokens')
    const token = makeToken({ tokenHash: hashToken(raw), expiresAt: new Date(Date.now() - 1000) })
    const { client } = fakeClient({ token })
    expect(await consumeResetToken(raw, client)).toEqual({ ok: false, reason: 'expired' })
  })

  it('happy path → ok:true с email/userId/tokenId, токен погашен', async () => {
    const raw = 'raw-happy'
    const { hashToken } = await import('./tokens')
    const token = makeToken({ tokenHash: hashToken(raw), email: 'happy@test.c', userId: 'u9' })
    const { client, store } = fakeClient({ token })
    expect(await consumeResetToken(raw, client)).toEqual({ ok: true, email: 'happy@test.c', userId: 'u9', tokenId: 'tok-1' })
    expect(store.token?.usedAt).not.toBeNull()
  })

  it('двойной consume → второй раз used (гонка двух кликов)', async () => {
    const raw = 'raw-double'
    const { hashToken } = await import('./tokens')
    const token = makeToken({ tokenHash: hashToken(raw) })
    const { client } = fakeClient({ token })
    expect((await consumeResetToken(raw, client)).ok).toBe(true)
    expect(await consumeResetToken(raw, client)).toEqual({ ok: false, reason: 'used' })
  })
})

describe('setPasswordViaToken (AUTH-17)', () => {
  it('слабый пароль (<8) → weak, токен НЕ гасится', async () => {
    const raw = 'raw-weak'
    const { hashToken } = await import('./tokens')
    const token = makeToken({ tokenHash: hashToken(raw) })
    const { client, store } = fakeClient({ user: { id: 'u1', email: 'u@test.c', passwordHash: null }, token })

    expect(await setPasswordViaToken(raw, 'short1', client)).toEqual({ ok: false, reason: 'weak' })
    expect(store.token?.usedAt).toBeNull() // токен цел — можно использовать со следующим паролем

    // и токен по-прежнему рабочий: успешный вызов после weak должен пройти
    expect(await setPasswordViaToken(raw, 'longenoughpw', client)).toEqual({ ok: true })
  })

  it('успех: хэш обновлён, доступен через verifyPassword', async () => {
    const raw = 'raw-success'
    const { hashToken } = await import('./tokens')
    const token = makeToken({ tokenHash: hashToken(raw) })
    const { client, store } = fakeClient({ user: { id: 'u1', email: 'u@test.c', passwordHash: null }, token })

    expect(await setPasswordViaToken(raw, 'brand-new-pw', client)).toEqual({ ok: true })
    expect(store.user?.passwordHash).toBeTruthy()
    expect(await verifyPassword('brand-new-pw', store.user!.passwordHash!)).toBe(true)
  })

  it('повторный вызов с тем же токеном → used, пароль не меняется дважды', async () => {
    const raw = 'raw-repeat'
    const { hashToken } = await import('./tokens')
    const token = makeToken({ tokenHash: hashToken(raw) })
    const { client } = fakeClient({ user: { id: 'u1', email: 'u@test.c', passwordHash: null }, token })

    expect(await setPasswordViaToken(raw, 'first-password', client)).toEqual({ ok: true })
    expect(await setPasswordViaToken(raw, 'second-password', client)).toEqual({ ok: false, reason: 'used' })
  })

  it('userId=null и юзера по email нет → no_user (токен всё равно гасится)', async () => {
    const raw = 'raw-nouser'
    const { hashToken } = await import('./tokens')
    const token = makeToken({ tokenHash: hashToken(raw), userId: null, email: 'ghost@test.c' })
    const { client, store } = fakeClient({ user: null, token })

    expect(await setPasswordViaToken(raw, 'longenoughpw', client)).toEqual({ ok: false, reason: 'no_user' })
    expect(store.token?.usedAt).not.toBeNull()
  })
})
