import { describe, it, expect, vi } from 'vitest'
import { createUserWithPassword } from './provision'
import { verifyPassword } from './password'
import type { PrismaClient } from '@/lib/generated/prisma/client'

type FakeUser = {
  id: string; email: string; firstName: string; lastName: string
  phone: string | null; telegram: string | null; passwordHash: string | null
}

/** Клиент с моком user.findUnique/create/update — тот же приём DI, что login.test.ts/reset.test.ts:
 *  client: Pick<PrismaClient, 'user'> = db, без vi.mock('@/lib/db'). */
function fakeClient(existing: FakeUser | null = null) {
  const store: { user: FakeUser | null } = { user: existing }

  const findUnique = vi.fn(async () => store.user)
  const create = vi.fn(async ({ data }: { data: Omit<FakeUser, 'id'> }) => {
    const created: FakeUser = { id: `u-${Math.random().toString(36).slice(2)}`, ...data }
    store.user = created
    return created
  })
  const update = vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<FakeUser> }) => {
    if (!store.user || store.user.id !== where.id) throw new Error('not found')
    store.user = { ...store.user, ...data }
    return store.user
  })

  const client = { user: { findUnique, create, update } } as unknown as Pick<PrismaClient, 'user'>
  return { client, store, findUnique, create, update }
}

describe('createUserWithPassword (AUTH-15, F11)', () => {
  it('юзера нет → создаёт с паролем формата xxxx-xxxx-xxxx, хэш верифицируется', async () => {
    const { client, store, create } = fakeClient(null)
    const result = await createUserWithPassword(
      { email: 'new@test.c', firstName: 'Ирина', lastName: 'Петрова', phone: '+123', telegram: '@ira' },
      client,
    )

    expect(create).toHaveBeenCalledOnce()
    expect(result.plainPassword).toMatch(/^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/)
    expect(result.user.email).toBe('new@test.c')
    expect(store.user?.passwordHash).toBeTruthy()
    expect(await verifyPassword(result.plainPassword!, store.user!.passwordHash!)).toBe(true)
    // визуально неоднозначные символы (0/O/1/l/I) не встречаются (D-033)
    expect(result.plainPassword).not.toMatch(/[01lIO]/)
  })

  it('юзер существует, но passwordHash=null (D-034) → генерирует пароль, update а не create', async () => {
    const existing: FakeUser = {
      id: 'u1', email: 'nohash@test.c', firstName: 'Олег', lastName: 'Сидоров', phone: null, telegram: null, passwordHash: null,
    }
    const { client, store, create, update } = fakeClient(existing)
    const result = await createUserWithPassword({ email: 'nohash@test.c', firstName: 'Игнор', lastName: 'Игнор' }, client)

    expect(create).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledOnce()
    expect(result.plainPassword).toBeTruthy()
    expect(store.user?.passwordHash).toBeTruthy()
    // контактные поля существующего юзера не перезаписаны новыми input-значениями
    expect(store.user?.firstName).toBe('Олег')
  })

  it('юзер существует С паролем → идемпотентно: plainPassword=null, хэш не меняется, update не вызывается', async () => {
    const existing: FakeUser = {
      id: 'u2', email: 'has-pw@test.c', firstName: 'Анна', lastName: 'Кузнецова', phone: null, telegram: null, passwordHash: 'existing-hash',
    }
    const { client, store, create, update } = fakeClient(existing)
    const result = await createUserWithPassword({ email: 'has-pw@test.c', firstName: 'Игнор', lastName: 'Игнор' }, client)

    expect(result.plainPassword).toBeNull()
    expect(result.user).toEqual({ id: 'u2', email: 'has-pw@test.c' })
    expect(create).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
    expect(store.user?.passwordHash).toBe('existing-hash') // хэш не тронут — повторная выдача не пересоздаёт пароль
  })
})
