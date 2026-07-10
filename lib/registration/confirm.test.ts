import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/email', () => ({ sendEmail: vi.fn().mockResolvedValue('log-id') }))

import { confirmRegistration } from './confirm'
import { sendEmail } from '@/lib/email'
import { hashToken } from '@/lib/auth/tokens'
import { ResetTokenPurpose } from '@/lib/generated/prisma/client'
import type { PrismaClient, RegistrationStatus, InviteLink } from '@/lib/generated/prisma/client'

// ---------------------------------------------------------------------------
// Фейковый клиент (DI, без vi.mock('@/lib/db')) — тот же приём, что reset.test.ts/login.test.ts.
// Один общий store делится между "обычными" вызовами client.* и колбэком $transaction(tx => …),
// чтобы Consent/Registration/Invite, записанные ДО транзакции, были видны внутри неё (как в реальном Prisma).
// ---------------------------------------------------------------------------

type FakeReg = {
  id: string; email: string; firstName: string; lastName: string; phone: string | null
  telegram: string | null; status: RegistrationStatus; inviteLinkId: string | null
  wantsNewsletter: boolean; confirmedAt: Date | null
}
type FakeUser = { id: string; email: string; firstName: string; lastName: string; phone: string | null; telegram: string | null; passwordHash: string | null }
type FakeConsent = { id: string; email: string; userId: string | null; type: string; granted: boolean; source: string; createdAt: Date }

const RAW = 'raw-confirm-token'

function makeReg(overrides: Partial<FakeReg> = {}): FakeReg {
  return {
    id: 'reg-1', email: 'a@b.c', firstName: 'Иван', lastName: 'Петров', phone: '+1',
    telegram: null, status: 'PENDING_OPT_IN' as RegistrationStatus, inviteLinkId: null,
    wantsNewsletter: false, confirmedAt: null,
    ...overrides,
  }
}

function makeInvite(overrides: Partial<InviteLink> = {}): InviteLink {
  return {
    id: 'inv-1', token: 'inv-tok', courseSlug: 'ai-basics', sourceLabel: 'test-source',
    active: true, maxRegistrations: null, registrationsCount: 0, expiresAt: null,
    createdById: null, createdAt: new Date('2026-01-01'),
    ...overrides,
  }
}

function fakeClient(opts: {
  reg?: FakeReg | null; invite?: InviteLink | null; user?: FakeUser | null
  tokenPurpose?: ResetTokenPurpose; tokenUsed?: boolean; tokenExpired?: boolean
  enrollmentP2002?: boolean
} = {}) {
  const reg = opts.reg === undefined ? makeReg() : opts.reg
  let seq = 0

  const store = {
    reg,
    invite: opts.invite ?? null,
    user: opts.user ?? null,
    token: {
      id: 'tok-1', tokenHash: hashToken(RAW), email: reg?.email ?? 'a@b.c', userId: null as string | null,
      purpose: opts.tokenPurpose ?? ResetTokenPurpose.OPT_IN,
      expiresAt: opts.tokenExpired ? new Date(Date.now() - 1000) : new Date(Date.now() + 60_000),
      usedAt: opts.tokenUsed ? new Date() : null, createdAt: new Date(),
    },
    consents: [] as FakeConsent[],
    enrollments: [] as { userId: string; courseSlug: string; source: string }[],
  }

  const passwordResetToken = {
    findUnique: vi.fn(async () => store.token),
    updateMany: vi.fn(async ({ where }: { where: { id: string; usedAt: null } }) => {
      if (store.token.id === where.id && store.token.usedAt === null) {
        store.token = { ...store.token, usedAt: new Date() }
        return { count: 1 }
      }
      return { count: 0 }
    }),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: `t-${++seq}`, usedAt: null, createdAt: new Date(), ...data })),
  }

  const registration = {
    findUnique: vi.fn(async () => store.reg),
    update: vi.fn(async ({ data }: { data: Partial<FakeReg> }) => {
      if (!store.reg) throw new Error('no reg')
      store.reg = { ...store.reg, ...data }
      return store.reg
    }),
  }

  const consent = {
    findFirst: vi.fn(async ({ where }: { where: { email: string; type: string; granted: boolean } }) =>
      store.consents.find(c => c.email === where.email && c.type === where.type && c.granted === where.granted) ?? null),
    create: vi.fn(async ({ data }: { data: { email: string; type: string; granted: boolean; source: string; userId?: string | null } }) => {
      const created: FakeConsent = { id: `c-${++seq}`, userId: data.userId ?? null, createdAt: new Date(), ...data }
      store.consents.push(created)
      return created
    }),
    updateMany: vi.fn(async ({ where, data }: { where: { email: string; userId: null }; data: { userId: string } }) => {
      let count = 0
      store.consents = store.consents.map(c => {
        if (c.email === where.email && c.userId === null) { count++; return { ...c, userId: data.userId } }
        return c
      })
      return { count }
    }),
  }

  const inviteLink = {
    findUnique: vi.fn(async () => store.invite),
    update: vi.fn(async ({ data }: { data: { registrationsCount?: { increment: number } } }) => {
      if (!store.invite) throw new Error('no invite')
      const inc = data.registrationsCount?.increment ?? 0
      store.invite = { ...store.invite, registrationsCount: store.invite.registrationsCount + inc }
      return store.invite
    }),
  }

  const user = {
    findUnique: vi.fn(async () => store.user),
    create: vi.fn(async ({ data }: { data: Omit<FakeUser, 'id'> }) => {
      const created: FakeUser = { id: `u-${++seq}`, ...data }
      store.user = created
      return created
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<FakeUser> }) => {
      if (!store.user || store.user.id !== where.id) throw new Error('no user')
      store.user = { ...store.user, ...data }
      return store.user
    }),
  }

  const enrollmentCreate = vi.fn(async ({ data }: { data: { userId: string; courseSlug: string; source: string } }) => {
    if (opts.enrollmentP2002) throw { code: 'P2002' }
    store.enrollments.push(data)
    return { id: `enr-${++seq}` }
  })
  const enrollment = { create: enrollmentCreate }

  const tx = { passwordResetToken, registration, consent, inviteLink, user, enrollment }
  const $transaction = vi.fn((fn: (txArg: typeof tx) => Promise<unknown>) => fn(tx))

  const client = { passwordResetToken, registration, consent, inviteLink, $transaction } as unknown as PrismaClient

  return { client, store, registration, consent, inviteLink, enrollmentCreate, passwordResetToken, user }
}

beforeEach(() => {
  vi.mocked(sendEmail).mockClear()
})

describe('confirmRegistration — токен (AUTH-04/05/06 через consumeResetToken)', () => {
  it('использованный токен → invalid/used, заявка не трогается', async () => {
    const { client, registration } = fakeClient({ tokenUsed: true })
    expect(await confirmRegistration(RAW, client)).toEqual({ mode: 'invalid', reason: 'used' })
    expect(registration.update).not.toHaveBeenCalled()
  })

  it('просроченный токен → invalid/expired', async () => {
    const { client } = fakeClient({ tokenExpired: true })
    expect(await confirmRegistration(RAW, client)).toEqual({ mode: 'invalid', reason: 'expired' })
  })

  it('токен другого purpose (PASSWORD_RESET) → invalid/invalid', async () => {
    const { client } = fakeClient({ tokenPurpose: ResetTokenPurpose.PASSWORD_RESET })
    expect(await confirmRegistration(RAW, client)).toEqual({ mode: 'invalid', reason: 'invalid' })
  })

  it('нет заявки по email токена → invalid/invalid, мягко', async () => {
    const { client } = fakeClient({ reg: null })
    expect(await confirmRegistration(RAW, client)).toEqual({ mode: 'invalid', reason: 'invalid' })
  })
})

describe('confirmRegistration — публичный путь без инвайта (F15, D-035, REG-13)', () => {
  it('happy: Registration → CONFIRMED, Consent DATA_PROCESSING записан, письмо WELCOME не шлётся', async () => {
    const { client, store, registration, consent } = fakeClient({ reg: makeReg({ wantsNewsletter: true }) })
    const result = await confirmRegistration(RAW, client)

    expect(result).toEqual({ mode: 'manual' })
    expect(registration.update).toHaveBeenCalledOnce()
    expect(store.reg?.status).toBe('CONFIRMED')
    expect(store.reg?.confirmedAt).toBeInstanceOf(Date)

    expect(consent.create).toHaveBeenCalledTimes(2) // DATA_PROCESSING + NEWSLETTER (wantsNewsletter=true)
    expect(store.consents.map(c => c.type).sort()).toEqual(['DATA_PROCESSING', 'NEWSLETTER'])
    expect(store.consents.every(c => c.granted && c.source === 'REGISTRATION_FORM')).toBe(true)

    expect(sendEmail).not.toHaveBeenCalled() // ручная выдача — WELCOME шлёт grantAccess позже (ADM-03)
  })

  it('wantsNewsletter=false → NEWSLETTER не пишется, только DATA_PROCESSING', async () => {
    const { client, consent } = fakeClient({ reg: makeReg({ wantsNewsletter: false }) })
    await confirmRegistration(RAW, client)

    expect(consent.create).toHaveBeenCalledOnce()
    expect(consent.create.mock.calls[0][0].data.type).toBe('DATA_PROCESSING')
  })

  it('уже ENROLLED (повторный клик после успеха, E-INV3) → already, Consent не пишется, Registration не трогается', async () => {
    const { client, registration, consent } = fakeClient({ reg: makeReg({ status: 'ENROLLED' as RegistrationStatus }) })
    const result = await confirmRegistration(RAW, client)

    expect(result).toEqual({ mode: 'already' })
    expect(registration.update).not.toHaveBeenCalled()
    expect(consent.create).not.toHaveBeenCalled()
  })

  it('Consent-идемпотентность: повторный confirm-путь (пересдача формы → новый токен) не дублирует granted-запись', async () => {
    const { client, store, consent } = fakeClient({ reg: makeReg({ wantsNewsletter: true }) })
    await confirmRegistration(RAW, client) // первый confirm: CONFIRMED, 2 Consent-строки

    // Пересдача формы после CONFIRMED снова уводит заявку в PENDING_OPT_IN (submitRegistration, REG-15) —
    // симулируем новым токеном на тот же email, тот же общий store.
    store.reg = { ...store.reg!, status: 'PENDING_OPT_IN' as RegistrationStatus, confirmedAt: null }
    store.token = { ...store.token, id: 'tok-2', usedAt: null }

    const result = await confirmRegistration(RAW, client)
    expect(result).toEqual({ mode: 'manual' })
    expect(consent.create).toHaveBeenCalledTimes(2) // не 4 — идемпотентно
    expect(store.consents).toHaveLength(2)
  })
})

describe('confirmRegistration — путь по инвайту, авто-выдача (F14, REG-13, D-035)', () => {
  it('happy: User создан, Enrollment(courseSlug/source инвайта), счётчик +1, ENROLLED, WELCOME с паролем, payload {}', async () => {
    const invite = makeInvite({ id: 'inv-9', courseSlug: 'ai-basics', sourceLabel: 'vip-batch' })
    const reg = makeReg({ inviteLinkId: 'inv-9', wantsNewsletter: false })
    const { client, store, registration, inviteLink } = fakeClient({ reg, invite })

    const result = await confirmRegistration(RAW, client)

    expect(result).toMatchObject({ mode: 'auto', courseSlug: 'ai-basics' })
    if (result.mode !== 'auto') throw new Error('unreachable')
    expect(result.plainPassword).toMatch(/^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/)

    expect(store.user?.email).toBe(reg.email)
    expect(store.enrollments).toEqual([{ userId: store.user!.id, courseSlug: 'ai-basics', source: 'vip-batch' }])
    expect(inviteLink.update).toHaveBeenCalledOnce()
    expect(store.invite?.registrationsCount).toBe(1)
    expect(store.reg?.status).toBe('ENROLLED')
    expect(store.reg?.confirmedAt).toBeInstanceOf(Date)
    expect(registration.update).toHaveBeenCalledOnce()

    // Consent получает userId после создания User (F2, тот же приём, что grant-access)
    expect(store.consents.every(c => c.userId === store.user!.id)).toBe(true)

    expect(sendEmail).toHaveBeenCalledOnce()
    const call = vi.mocked(sendEmail).mock.calls[0][0]
    expect(call.type).toBe('WELCOME')
    expect(call.html).toContain(result.plainPassword!)
    expect(call.payload).toEqual({}) // D-028
  })

  it('инвайт исчерпан на момент подтверждения (E-INV2) → invite_gone, Consent записаны, Registration = CONFIRMED (не ENROLLED)', async () => {
    const invite = makeInvite({ id: 'inv-9', maxRegistrations: 1, registrationsCount: 1 })
    const reg = makeReg({ inviteLinkId: 'inv-9', wantsNewsletter: true })
    const { client, store, consent } = fakeClient({ reg, invite })

    const result = await confirmRegistration(RAW, client)

    expect(result).toEqual({ mode: 'invite_gone' })
    expect(store.reg?.status).toBe('CONFIRMED')
    expect(consent.create).toHaveBeenCalledTimes(2) // Consent уже записаны — это ок (E-INV2)
    expect(store.user).toBeNull() // User не создан
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('инвайт отозван → invite_gone', async () => {
    const invite = makeInvite({ id: 'inv-9', active: false })
    const reg = makeReg({ inviteLinkId: 'inv-9' })
    const { client } = fakeClient({ reg, invite })
    expect(await confirmRegistration(RAW, client)).toEqual({ mode: 'invite_gone' })
  })

  it('гонка E-INV5 (unique userId+courseSlug, P2002 на Enrollment) → already', async () => {
    const invite = makeInvite({ id: 'inv-9' })
    const reg = makeReg({ inviteLinkId: 'inv-9' })
    const { client, store } = fakeClient({ reg, invite, enrollmentP2002: true })

    const result = await confirmRegistration(RAW, client)

    expect(result).toEqual({ mode: 'already' })
    expect(store.invite?.registrationsCount).toBe(0) // инкремент не дошёл — P2002 упал раньше
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('юзер с email уже существует и имеет пароль (идемпотентность createUserWithPassword) → plainPassword null, письмо без пароля, ссылка reset', async () => {
    const invite = makeInvite({ id: 'inv-9' })
    const reg = makeReg({ inviteLinkId: 'inv-9' })
    const existingUser = { id: 'u-existing', email: reg.email, firstName: reg.firstName, lastName: reg.lastName, phone: reg.phone, telegram: reg.telegram, passwordHash: 'already-set' }
    const { client, store } = fakeClient({ reg, invite, user: existingUser })

    const result = await confirmRegistration(RAW, client)

    expect(result).toMatchObject({ mode: 'auto', plainPassword: null, courseSlug: 'ai-basics' })
    expect(store.enrollments).toEqual([{ userId: 'u-existing', courseSlug: 'ai-basics', source: invite.sourceLabel }])
    expect(sendEmail).toHaveBeenCalledOnce()
    const call = vi.mocked(sendEmail).mock.calls[0][0]
    expect(call.html).not.toContain('already-set')
    expect(call.html).toContain('/reset/')
  })
})
