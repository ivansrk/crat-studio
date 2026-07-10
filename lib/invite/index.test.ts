import { describe, it, expect, vi } from 'vitest'
import {
  inviteState, createInvite, revokeInvite, getInviteByToken, getInviteState,
  incrementInviteCount, listInvites,
} from './index'
import type { PrismaClient, InviteLink } from '@/lib/generated/prisma/client'

// ---------------------------------------------------------------------------
// 1. inviteState — чистая функция (INV-02/04/05, E-INV1)
// ---------------------------------------------------------------------------

describe('inviteState (INV-02/04/05, E-INV1)', () => {
  const now = new Date('2026-07-10T00:00:00Z')

  it('active=false → revoked, приоритет №1 над expired/exhausted', () => {
    expect(inviteState({ active: false, expiresAt: null, maxRegistrations: null }, now, 0)).toBe('revoked')
    expect(inviteState({ active: false, expiresAt: new Date('2099-01-01'), maxRegistrations: 100 }, now, 0)).toBe('revoked')
  })

  it('expiresAt задан и < now → expired', () => {
    expect(inviteState({ active: true, expiresAt: new Date(now.getTime() - 1000), maxRegistrations: null }, now, 0)).toBe('expired')
  })

  it('maxRegistrations задан и count >= max → exhausted', () => {
    expect(inviteState({ active: true, expiresAt: null, maxRegistrations: 5 }, now, 5)).toBe('exhausted')
    expect(inviteState({ active: true, expiresAt: null, maxRegistrations: 5 }, now, 6)).toBe('exhausted')
  })

  it('всё чисто → ok', () => {
    expect(inviteState({ active: true, expiresAt: new Date(now.getTime() + 1000), maxRegistrations: 5 }, now, 1)).toBe('ok')
  })

  it('maxRegistrations=null → никогда не исчерпывается', () => {
    expect(inviteState({ active: true, expiresAt: null, maxRegistrations: null }, now, 1_000_000)).toBe('ok')
  })

  it('expiresAt=null → никогда не истекает', () => {
    expect(inviteState({ active: true, expiresAt: null, maxRegistrations: null }, new Date('2099-01-01'), 0)).toBe('ok')
  })

  it('граница: count === max-1 → ok', () => {
    expect(inviteState({ active: true, expiresAt: null, maxRegistrations: 5 }, now, 4)).toBe('ok')
  })
})

// ---------------------------------------------------------------------------
// 2. Prisma-слой — DI client-паттерн (как lib/auth/reset.test.ts)
// ---------------------------------------------------------------------------

function makeInvite(overrides: Partial<InviteLink> = {}): InviteLink {
  return {
    id: 'inv-1', token: 'tok-0000', courseSlug: 'ai-basics', sourceLabel: 'test',
    active: true, maxRegistrations: null, registrationsCount: 0, expiresAt: null,
    createdById: null, createdAt: new Date('2026-01-01'),
    ...overrides,
  }
}

/** Фейковый inviteLink-делегат поверх массива в памяти — тот же приём DI, что в reset.test.ts:
 *  client: Pick<PrismaClient, 'inviteLink'> = db, без vi.mock('@/lib/db'). */
function fakeClient(opts: { invites?: InviteLink[] } = {}) {
  const store: { invites: InviteLink[] } = { invites: opts.invites ?? [] }

  const create = vi.fn(async ({ data }: { data: Partial<InviteLink> }) => {
    const invite: InviteLink = {
      id: `inv-${Math.random().toString(36).slice(2)}`,
      token: data.token!,
      courseSlug: data.courseSlug!,
      sourceLabel: data.sourceLabel!,
      active: true,
      maxRegistrations: data.maxRegistrations ?? null,
      registrationsCount: 0,
      expiresAt: data.expiresAt ?? null,
      createdById: data.createdById ?? null,
      createdAt: new Date(),
    }
    store.invites.push(invite)
    return invite
  })
  const findUnique = vi.fn(async ({ where }: { where: { id?: string; token?: string } }) =>
    store.invites.find(i => (where.id ? i.id === where.id : i.token === where.token)) ?? null)
  const update = vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
    const idx = store.invites.findIndex(i => i.id === where.id)
    if (idx === -1) throw new Error('not found')
    const current = store.invites[idx]
    const next: InviteLink = { ...current }
    if ('active' in data) next.active = data.active as boolean
    const inc = data.registrationsCount as { increment?: number } | undefined
    if (inc?.increment) next.registrationsCount = current.registrationsCount + inc.increment
    store.invites[idx] = next
    return next
  })
  const findMany = vi.fn(async () => [...store.invites].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()))

  const client = { inviteLink: { create, findUnique, update, findMany } } as unknown as Pick<PrismaClient, 'inviteLink'>
  return { client, store, create, findUnique, update, findMany }
}

describe('createInvite (INV-01)', () => {
  it('генерит токен (64 hex, как newToken), сохраняет поля, возвращает invite + url /invite/{token}', async () => {
    const { client, create } = fakeClient()
    const result = await createInvite({ courseSlug: 'ai-basics', sourceLabel: 'instagram' }, 'admin-1', client)

    expect(create).toHaveBeenCalledOnce()
    const data = create.mock.calls[0][0].data
    expect(data.token).toMatch(/^[0-9a-f]{64}$/)
    expect(data.courseSlug).toBe('ai-basics')
    expect(data.sourceLabel).toBe('instagram')
    expect(data.createdById).toBe('admin-1')

    expect(result.token).toMatch(/^[0-9a-f]{64}$/)
    expect(result.url).toBe(`${process.env.APP_URL ?? 'http://localhost:3000'}/invite/${result.token}`)
    expect(result.active).toBe(true)
    expect(result.registrationsCount).toBe(0)
  })

  it('два вызова подряд → разные токены (уникальность)', async () => {
    const { client } = fakeClient()
    const a = await createInvite({ courseSlug: 'ai-basics', sourceLabel: 'a' }, null, client)
    const b = await createInvite({ courseSlug: 'ai-basics', sourceLabel: 'b' }, null, client)
    expect(a.token).not.toBe(b.token)
  })

  it('maxRegistrations/expiresAt передаются как есть, adminId может быть null', async () => {
    const { client, create } = fakeClient()
    const expiresAt = new Date('2099-01-01')
    await createInvite({ courseSlug: 'ai-basics', sourceLabel: 'x', maxRegistrations: 10, expiresAt }, null, client)
    const data = create.mock.calls[0][0].data
    expect(data.maxRegistrations).toBe(10)
    expect(data.expiresAt).toBe(expiresAt)
    expect(data.createdById).toBeNull()
  })
})

describe('revokeInvite (INV-02)', () => {
  it('active=false; повторный вызов идемпотентен', async () => {
    const { client, store } = fakeClient({ invites: [makeInvite({ id: 'i1', active: true })] })
    await revokeInvite('i1', client)
    expect(store.invites[0].active).toBe(false)
    await expect(revokeInvite('i1', client)).resolves.toBeUndefined()
    expect(store.invites[0].active).toBe(false)
  })
})

describe('getInviteByToken (INV-03)', () => {
  it('находит по token', async () => {
    const invite = makeInvite({ token: 'tok-abc' })
    const { client } = fakeClient({ invites: [invite] })
    expect(await getInviteByToken('tok-abc', client)).toEqual(invite)
  })

  it('неизвестный токен → null', async () => {
    const { client } = fakeClient()
    expect(await getInviteByToken('nope', client)).toBeNull()
  })
})

describe('getInviteState', () => {
  it('исчерпанный инвайт (registrationsCount >= max) → exhausted', () => {
    const invite = makeInvite({ maxRegistrations: 3, registrationsCount: 3 })
    expect(getInviteState(invite)).toBe('exhausted')
  })

  it('registrationsCount < max → ok', () => {
    const invite = makeInvite({ maxRegistrations: 3, registrationsCount: 2 })
    expect(getInviteState(invite)).toBe('ok')
  })

  it('отозванный исчерпанный → всё равно revoked (приоритет)', () => {
    const invite = makeInvite({ active: false, maxRegistrations: 3, registrationsCount: 3 })
    expect(getInviteState(invite)).toBe('revoked')
  })
})

describe('incrementInviteCount (INV-05, атомарно)', () => {
  it('увеличивает registrationsCount на 1 через update/increment', async () => {
    const { client, store, update } = fakeClient({ invites: [makeInvite({ id: 'i1', registrationsCount: 2 })] })
    await incrementInviteCount(client, 'i1')
    expect(update).toHaveBeenCalledWith({ where: { id: 'i1' }, data: { registrationsCount: { increment: 1 } } })
    expect(store.invites[0].registrationsCount).toBe(3)
  })
})

describe('listInvites (INV-06)', () => {
  it('все инвайты, новые сверху', async () => {
    const older = makeInvite({ id: 'i1', createdAt: new Date('2026-01-01') })
    const newer = makeInvite({ id: 'i2', createdAt: new Date('2026-02-01') })
    const { client } = fakeClient({ invites: [older, newer] })
    const list = await listInvites(client)
    expect(list.map(i => i.id)).toEqual(['i2', 'i1'])
  })
})
