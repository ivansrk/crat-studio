import { describe, it, expect, vi, beforeEach } from 'vitest'

// submitRegistration обращается к глобальному db.$transaction (не DI) — мокаем модуль целиком,
// тем же приёмом, что grant-access.test.ts. inviteLink — для getInviteByToken/getInviteState (INV-04).
vi.mock('@/lib/db', () => ({
  db: {
    registration: { findUnique: vi.fn() },
    inviteLink: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn().mockResolvedValue('log-id') }))

import { normalizeRegistration, submitRegistration } from './index'
import { db } from '@/lib/db'
import { sendEmail } from '@/lib/email'
import type { InviteLink, RegistrationStatus } from '@/lib/generated/prisma/client'

// ---------------------------------------------------------------------------
// 1. normalizeRegistration — чистая функция (REG-06, REG-08, REG-16)
// ---------------------------------------------------------------------------

const validInput = {
  firstName: ' Иван ', lastName: 'С', email: ' A@B.C ', phone: '+48 601-123-456', telegram: ' @iv ',
  whatsapp: ' +48601123456 ', dataConsent: true, wantsNewsletter: false, inviteToken: null,
}

describe('normalizeRegistration', () => {
  it('trim+lowercase email (REG-08), trim полей, нормализует телефон (REG-16)', () => {
    const r = normalizeRegistration(validInput)
    expect(r).toEqual({
      firstName: 'Иван', lastName: 'С', email: 'a@b.c', phone: '+48601123456', telegram: '@iv',
      whatsapp: '+48601123456', wantsNewsletter: false, inviteToken: null,
    })
  })

  it('без обязательных полей или без согласия на ПД → null (REG-06)', () => {
    expect(normalizeRegistration({ ...validInput, firstName: '' })).toBeNull()
    expect(normalizeRegistration({ ...validInput, email: 'нет-собаки' })).toBeNull()
    expect(normalizeRegistration({ ...validInput, dataConsent: false })).toBeNull()
  })

  it('без телефона или с невалидным телефоном → null (REG-16)', () => {
    expect(normalizeRegistration({ ...validInput, phone: null })).toBeNull()
    expect(normalizeRegistration({ ...validInput, phone: 'abc' })).toBeNull()
  })

  it('telegram/whatsapp/inviteToken опциональны — пусто → null-поля', () => {
    const r = normalizeRegistration({ ...validInput, telegram: null, whatsapp: null, inviteToken: null })
    expect(r).toMatchObject({ telegram: null, whatsapp: null, inviteToken: null })
  })
})

// ---------------------------------------------------------------------------
// 2. submitRegistration — DB-слой (REG-10…16, F14/F15, INV-04, E-INV1/E-INV3)
// ---------------------------------------------------------------------------

type FakeReg = {
  id: string; email: string; firstName: string; lastName: string; phone: string | null
  telegram: string | null; whatsapp: string | null; status: RegistrationStatus
  submitCount: number; inviteLinkId: string | null; wantsNewsletter: boolean; confirmedAt: Date | null
}

function makeReg(overrides: Partial<FakeReg> = {}): FakeReg {
  return {
    id: 'reg-1', email: 'a@b.c', firstName: 'Old', lastName: 'Name', phone: '111',
    telegram: null, whatsapp: null, status: 'NEW' as RegistrationStatus, submitCount: 1,
    inviteLinkId: null, wantsNewsletter: false, confirmedAt: null,
    ...overrides,
  }
}

function makeInvite(overrides: Partial<InviteLink> = {}): InviteLink {
  return {
    id: 'inv-1', token: 'tok-abc', courseSlug: 'ai-basics', sourceLabel: 'test',
    active: true, maxRegistrations: null, registrationsCount: 0, expiresAt: null,
    createdById: null, createdAt: new Date('2026-01-01'),
    ...overrides,
  }
}

/** Фейковый tx: registration (findUnique/update/create), user/passwordResetToken для mintResetToken. */
function fakeTx(existingReg: FakeReg | null) {
  const store: { reg: FakeReg | null; tokens: unknown[] } = { reg: existingReg, tokens: [] }

  const regFindUnique = vi.fn(async () => store.reg)
  const regCreate = vi.fn(async ({ data }: { data: Partial<FakeReg> }) => {
    const created = { id: 'reg-new', submitCount: 1, ...data } as FakeReg
    store.reg = created
    return created
  })
  const regUpdate = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    if (!store.reg) throw new Error('not found')
    const inc = data.submitCount as { increment?: number } | undefined
    store.reg = {
      ...store.reg, ...data,
      submitCount: inc?.increment ? store.reg.submitCount + inc.increment : store.reg.submitCount,
    } as FakeReg
    return store.reg
  })
  const userFindUnique = vi.fn(async () => null) // OPT_IN: юзера ещё нет
  const tokenCreate = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    const created = { id: 'tok-1', usedAt: null, createdAt: new Date(), ...data }
    store.tokens.push(created)
    return created
  })

  const tx = {
    registration: { findUnique: regFindUnique, create: regCreate, update: regUpdate },
    user: { findUnique: userFindUnique },
    passwordResetToken: { create: tokenCreate },
  }
  return { tx, store, regCreate, regUpdate, tokenCreate }
}

function setupTransaction(existingReg: FakeReg | null) {
  const fake = fakeTx(existingReg)
  vi.mocked(db.$transaction).mockImplementation((fn: unknown) => (fn as (tx: unknown) => Promise<unknown>)(fake.tx))
  return fake
}

const baseInput = {
  firstName: 'Иван', lastName: 'Петров', email: 'ivan@test.c', phone: '+48601123456',
  telegram: null, whatsapp: null, dataConsent: true, wantsNewsletter: false,
}

beforeEach(() => {
  vi.mocked(sendEmail).mockClear()
  vi.mocked(db.inviteLink.findUnique).mockReset()
})

describe('submitRegistration — валидация (REG-06/16)', () => {
  it('невалидная форма → invalid, до транзакции не доходит', async () => {
    vi.mocked(db.$transaction).mockClear()
    expect(await submitRegistration({ ...baseInput, phone: null })).toBe('invalid')
    expect(await submitRegistration({ ...baseInput, dataConsent: false })).toBe('invalid')
    expect(db.$transaction).not.toHaveBeenCalled()
    expect(sendEmail).not.toHaveBeenCalled()
  })
})

describe('submitRegistration — публичный путь без инвайта (REG-11, F15)', () => {
  it('новый email → создаёт Registration PENDING_OPT_IN, шлёт DOUBLE_OPT_IN, возвращает pending', async () => {
    const { regCreate, tokenCreate } = setupTransaction(null)
    const result = await submitRegistration(baseInput)

    expect(result).toBe('pending')
    expect(regCreate).toHaveBeenCalledOnce()
    const data = regCreate.mock.calls[0][0].data
    expect(data.status).toBe('PENDING_OPT_IN')
    expect(data.email).toBe('ivan@test.c')
    expect(data.inviteLinkId).toBeNull()

    expect(tokenCreate).toHaveBeenCalledOnce()
    expect(tokenCreate.mock.calls[0][0].data.purpose).toBe('OPT_IN')

    expect(sendEmail).toHaveBeenCalledOnce()
    const call = vi.mocked(sendEmail).mock.calls[0][0]
    expect(call.type).toBe('DOUBLE_OPT_IN')
    expect(call.payload).toEqual({}) // D-028
    expect(call.html).toContain('/invite-confirm/')
  })

  it('повторная отправка в PENDING_OPT_IN → update, submitCount+1, новый токен и письмо (REG-15/E-INV4)', async () => {
    const existing = makeReg({ status: 'PENDING_OPT_IN', submitCount: 1 })
    const { regUpdate, tokenCreate } = setupTransaction(existing)
    const result = await submitRegistration(baseInput)

    expect(result).toBe('pending')
    expect(regUpdate).toHaveBeenCalledOnce()
    const data = regUpdate.mock.calls[0][0].data
    expect(data.status).toBe('PENDING_OPT_IN')
    expect(data.submitCount).toEqual({ increment: 1 })
    expect(data.confirmedAt).toBeNull()
    expect(tokenCreate).toHaveBeenCalledOnce()
    expect(sendEmail).toHaveBeenCalledOnce()
  })

  it('email уже ENROLLED → already, без письма и без записи (REG-14/E-INV3)', async () => {
    const existing = makeReg({ status: 'ENROLLED' })
    const { regUpdate, regCreate } = setupTransaction(existing)
    const result = await submitRegistration(baseInput)

    expect(result).toBe('already')
    expect(regUpdate).not.toHaveBeenCalled()
    expect(regCreate).not.toHaveBeenCalled()
    expect(sendEmail).not.toHaveBeenCalled()
  })
})

describe('submitRegistration — путь по инвайту (INV-03/04, F14)', () => {
  it('неизвестный токен → invite_invalid, до транзакции не доходит', async () => {
    vi.mocked(db.inviteLink.findUnique).mockResolvedValue(null)
    vi.mocked(db.$transaction).mockClear()
    const result = await submitRegistration({ ...baseInput, inviteToken: 'unknown' })

    expect(result).toBe('invite_invalid')
    expect(db.$transaction).not.toHaveBeenCalled()
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('отозванный/просроченный/исчерпанный инвайт → invite_invalid (E-INV1)', async () => {
    vi.mocked(db.inviteLink.findUnique).mockResolvedValue(makeInvite({ active: false }))
    expect(await submitRegistration({ ...baseInput, inviteToken: 'tok-abc' })).toBe('invite_invalid')

    vi.mocked(db.inviteLink.findUnique).mockResolvedValue(makeInvite({ expiresAt: new Date('2000-01-01') }))
    expect(await submitRegistration({ ...baseInput, inviteToken: 'tok-abc' })).toBe('invite_invalid')

    vi.mocked(db.inviteLink.findUnique).mockResolvedValue(makeInvite({ maxRegistrations: 1, registrationsCount: 1 }))
    expect(await submitRegistration({ ...baseInput, inviteToken: 'tok-abc' })).toBe('invite_invalid')
  })

  it('действующий инвайт → Registration с inviteLinkId, pending', async () => {
    vi.mocked(db.inviteLink.findUnique).mockResolvedValue(makeInvite({ id: 'inv-77' }))
    const { regCreate } = setupTransaction(null)
    const result = await submitRegistration({ ...baseInput, inviteToken: 'tok-abc' })

    expect(result).toBe('pending')
    expect(regCreate.mock.calls[0][0].data.inviteLinkId).toBe('inv-77')
  })
})
