import { describe, it, expect, vi, beforeEach } from 'vitest'
import { attemptLogin } from './login'
import { hashPassword, verifyPassword } from './password'
import { limiters } from './rate-limit'
import type { PrismaClient } from '@/lib/generated/prisma/client'

vi.mock('./password', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./password')>()
  return { ...actual, verifyPassword: vi.fn(actual.verifyPassword) }
})

type FakeUser = { id: string; email: string; passwordHash: string | null }

/** Клиент с моком findUnique — без vi.mock('@/lib/db'), тем же приёмом, что mintLoginUrl
 *  использует для инъекции в magic-link.ts (client: Pick<PrismaClient, 'user'> = db). */
function fakeClient(user: FakeUser | null) {
  const findUnique = vi.fn().mockResolvedValue(user)
  const client = { user: { findUnique } } as unknown as Pick<PrismaClient, 'user'>
  return { client, findUnique }
}

describe('attemptLogin (AUTH-12/13/19/20)', () => {
  beforeEach(() => {
    vi.mocked(verifyPassword).mockClear()
  })

  it('неверный пароль → ok:false', async () => {
    const hash = await hashPassword('correct-horse-battery')
    const { client } = fakeClient({ id: 'u1', email: 'wrong-pw@test.c', passwordHash: hash })
    const result = await attemptLogin('wrong-pw@test.c', 'totally-wrong', '10.0.0.1', client)
    expect(result).toEqual({ ok: false })
  })

  it('юзер без passwordHash (AUTH-19: до первой установки) → ok:false', async () => {
    const { client } = fakeClient({ id: 'u2', email: 'no-hash@test.c', passwordHash: null })
    const result = await attemptLogin('no-hash@test.c', 'anything', '10.0.0.2', client)
    expect(result).toEqual({ ok: false })
  })

  it('несуществующий email → ok:false, verifyPassword всё равно вызван (SEC-03/SEC-06: анти-timing)', async () => {
    const { client, findUnique } = fakeClient(null)
    const result = await attemptLogin('ghost@test.c', 'whatever', '10.0.0.3', client)
    expect(result).toEqual({ ok: false })
    expect(findUnique).toHaveBeenCalledWith({ where: { email: 'ghost@test.c' } })
    expect(verifyPassword).toHaveBeenCalledTimes(1)
  })

  it('успех → ok:true, счётчик loginEmail сброшен (AUTH-20)', async () => {
    const hash = await hashPassword('correct-horse-battery')
    const { client } = fakeClient({ id: 'u3', email: 'ok@test.c', passwordHash: hash })
    const resetSpy = vi.spyOn(limiters.loginEmail, 'reset')
    const result = await attemptLogin(' OK@Test.c ', 'correct-horse-battery', '10.0.0.4', client)
    expect(result).toEqual({ ok: true, userId: 'u3', isAdmin: expect.any(Boolean) })
    expect(resetSpy).toHaveBeenCalledWith('le:ok@test.c')
    resetSpy.mockRestore()
  })

  it('превышение лимита по email → ok:false без обращения к db (AUTH-20)', async () => {
    const email = 'flood-email@test.c'
    for (let i = 0; i < 10; i++) limiters.loginEmail.allow(`le:${email}`)
    const { client, findUnique } = fakeClient({ id: 'u4', email, passwordHash: await hashPassword('x') })
    const result = await attemptLogin(email, 'x', '10.0.0.5', client)
    expect(result).toEqual({ ok: false })
    expect(findUnique).not.toHaveBeenCalled()
  })

  it('превышение лимита по IP → ok:false без обращения к db (AUTH-20)', async () => {
    const ip = '10.0.0.6'
    for (let i = 0; i < 20; i++) limiters.loginIp.allow(`lip:${ip}`)
    const { client, findUnique } = fakeClient({ id: 'u5', email: 'flood-ip@test.c', passwordHash: await hashPassword('x') })
    const result = await attemptLogin('flood-ip@test.c', 'x', ip, client)
    expect(result).toEqual({ ok: false })
    expect(findUnique).not.toHaveBeenCalled()
  })
})
