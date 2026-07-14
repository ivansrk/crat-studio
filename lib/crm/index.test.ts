import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@/lib/resend-audience', () => ({
  syncContactSubscribe: vi.fn().mockResolvedValue('synced'),
  syncContactUnsubscribe: vi.fn().mockResolvedValue('synced'),
}))

import { listClients, getClient, updateClient, resyncClient } from './index'
import { syncContactSubscribe, syncContactUnsubscribe } from '@/lib/resend-audience'

// ---------------------------------------------------------------------------
// Фейковый клиент (DI-паттерн, как lib/invite/index.test.ts) — in-memory store,
// без vi.mock('@/lib/db').
// ---------------------------------------------------------------------------

type FakeUser = {
  id: string; email: string; firstName: string; lastName: string
  phone: string | null; telegram: string | null; whatsapp: string | null
  resendContactId: string | null; resendSyncError: string | null; createdAt: Date
}
type FakeEnrollment = { id: string; userId: string; courseSlug: string; createdAt: Date }
type FakeConsent = { id: string; email: string; userId: string | null; type: string; granted: boolean; createdAt: Date }
type FakeRegistration = { id: string; email: string; status: string }
type FakeCertificate = { id: string; userId: string; status: string; issuedAt: Date }
type FakeConsultation = { id: string; userId: string | null; createdAt: Date }

function makeUser(overrides: Partial<FakeUser> = {}): FakeUser {
  return {
    id: 'u-1', email: 'ivan@test.c', firstName: 'Иван', lastName: 'Петров',
    phone: null, telegram: null, whatsapp: null,
    resendContactId: null, resendSyncError: null, createdAt: new Date('2026-01-01'),
    ...overrides,
  }
}

function fakeClient(opts: {
  users?: FakeUser[]; enrollments?: FakeEnrollment[]; consents?: FakeConsent[]
  registrations?: FakeRegistration[]; certificates?: FakeCertificate[]; consultations?: FakeConsultation[]
} = {}) {
  const store = {
    users: opts.users ?? [],
    enrollments: opts.enrollments ?? [],
    consents: opts.consents ?? [],
    registrations: opts.registrations ?? [],
    certificates: opts.certificates ?? [],
    consultations: opts.consultations ?? [],
  }

  function matchesSearch(u: FakeUser, where: unknown): boolean {
    const w = where as {
      OR?: { firstName?: { contains: string }; lastName?: { contains: string }; email?: { contains: string }; phone?: { contains: string } }[]
      email?: { notIn: string[] }
    }
    if (w.email?.notIn?.includes(u.email.toLowerCase())) return false
    if (!w.OR) return true
    const lc = (s: string | null) => (s ?? '').toLowerCase()
    return w.OR.some(cond => {
      if (cond.firstName) return lc(u.firstName).includes(cond.firstName.contains.toLowerCase())
      if (cond.lastName) return lc(u.lastName).includes(cond.lastName.contains.toLowerCase())
      if (cond.email) return lc(u.email).includes(cond.email.contains.toLowerCase())
      if (cond.phone) return lc(u.phone).includes(cond.phone.contains.toLowerCase())
      return false
    })
  }

  const user = {
    findMany: vi.fn(async ({ where }: { where: unknown }) => {
      const matched = store.users.filter(u => matchesSearch(u, where))
      const sorted = [...matched].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      return sorted.map(u => ({
        ...u,
        enrollments: store.enrollments.filter(e => e.userId === u.id).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 1),
        consents: store.consents.filter(c => c.email === u.email && c.type === 'NEWSLETTER').sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 1),
        _count: { certificates: store.certificates.filter(c => c.userId === u.id && c.status === 'VALID').length },
      }))
    }),
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => store.users.find(u => u.id === where.id) ?? null),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<FakeUser> }) => {
      const idx = store.users.findIndex(u => u.id === where.id)
      if (idx === -1) throw new Error('not found')
      store.users[idx] = { ...store.users[idx], ...data }
      return store.users[idx]
    }),
  }
  const consent = {
    findMany: vi.fn(async ({ where }: { where: { email: string } }) =>
      [...store.consents.filter(c => c.email === where.email)].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())),
    findFirst: vi.fn(async ({ where }: { where: { email: string; type: string } }) => {
      const matched = store.consents.filter(c => c.email === where.email && c.type === where.type)
      const sorted = [...matched].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      return sorted[0] ?? null
    }),
  }
  const registration = {
    findUnique: vi.fn(async ({ where }: { where: { email: string } }) => store.registrations.find(r => r.email === where.email) ?? null),
  }
  const enrollment = {
    findMany: vi.fn(async ({ where }: { where: { userId: string } }) =>
      [...store.enrollments.filter(e => e.userId === where.userId)].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())),
  }
  const certificate = {
    findMany: vi.fn(async ({ where }: { where: { userId: string } }) =>
      [...store.certificates.filter(c => c.userId === where.userId)].sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime())),
  }
  const consultationRequest = {
    findMany: vi.fn(async ({ where }: { where: { userId: string } }) =>
      [...store.consultations.filter(c => c.userId === where.userId)].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())),
  }

  const client = { user, consent, registration, enrollment, certificate, consultationRequest } as never
  return { client, store }
}

// ---------------------------------------------------------------------------

describe('listClients (CRM-01/02)', () => {
  it('без query — все клиенты, новые сверху, с последним курсом и подпиской', async () => {
    const older = makeUser({ id: 'u-1', createdAt: new Date('2026-01-01') })
    const newer = makeUser({ id: 'u-2', email: 'anna@test.c', firstName: 'Анна', createdAt: new Date('2026-02-01') })
    const { client } = fakeClient({
      users: [older, newer],
      enrollments: [{ id: 'e1', userId: 'u-1', courseSlug: 'ai-basics', createdAt: new Date('2026-01-05') }],
      consents: [{ id: 'c1', email: newer.email, userId: 'u-2', type: 'NEWSLETTER', granted: true, createdAt: new Date('2026-02-02') }],
    })
    const list = await listClients(undefined, client)
    expect(list.map(c => c.id)).toEqual(['u-2', 'u-1'])
    expect(list.find(c => c.id === 'u-1')!.lastCourseSlug).toBe('ai-basics')
    expect(list.find(c => c.id === 'u-2')!.subscribed).toBe(true)
    expect(list.find(c => c.id === 'u-1')!.subscribed).toBe(false)
  })

  it('поиск по подстроке регистронезависим и частичен (имя/фамилия/email/телефон)', async () => {
    const u = makeUser({ id: 'u-1', firstName: 'Игорь', lastName: 'Волков', email: 'igor@test.c', phone: '+79991234567' })
    const other = makeUser({ id: 'u-2', firstName: 'Анна', lastName: 'Смирнова', email: 'anna@test.c', phone: null })
    const { client } = fakeClient({ users: [u, other] })

    expect((await listClients('волк', client)).map(c => c.id)).toEqual(['u-1'])
    expect((await listClients('ИГОРЬ', client)).map(c => c.id)).toEqual(['u-1'])
    expect((await listClients('igor@', client)).map(c => c.id)).toEqual(['u-1'])
    expect((await listClients('9991234', client)).map(c => c.id)).toEqual(['u-1'])
    expect((await listClients('  ', client)).map(c => c.id).sort()).toEqual(['u-1', 'u-2']) // пробелы → как без query
  })

  it('2+ enrollments — последний курс выбирается по createdAt, не по порядку вставки', async () => {
    const u = makeUser({ id: 'u-1' })
    const { client } = fakeClient({
      users: [u],
      enrollments: [
        { id: 'e1', userId: 'u-1', courseSlug: 'ai-basics', createdAt: new Date('2026-01-01') },
        { id: 'e2', userId: 'u-1', courseSlug: 'second-course', createdAt: new Date('2026-03-01') },
      ],
    })
    const list = await listClients(undefined, client)
    expect(list[0].lastCourseSlug).toBe('second-course')
  })

  it('resendSyncError отражается флагом', async () => {
    const u = makeUser({ id: 'u-1', resendSyncError: 'boom' })
    const { client } = fakeClient({ users: [u] })
    expect((await listClients(undefined, client))[0].resendSyncError).toBe(true)
  })

  // ADM-12: колонка «Сертификаты» — число VALID-сертификатов клиента; REVOKED не считается.
  it('certCount считает только VALID-сертификаты клиента', async () => {
    const withCerts = makeUser({ id: 'u-1' })
    const withoutCerts = makeUser({ id: 'u-2', email: 'nocert@test.c' })
    const { client } = fakeClient({
      users: [withCerts, withoutCerts],
      certificates: [
        { id: 'cert-1', userId: 'u-1', status: 'VALID', issuedAt: new Date('2026-01-01') },
        { id: 'cert-2', userId: 'u-1', status: 'VALID', issuedAt: new Date('2026-02-01') },
        { id: 'cert-3', userId: 'u-1', status: 'REVOKED', issuedAt: new Date('2026-03-01') },
      ],
    })
    const list = await listClients(undefined, client)
    expect(list.find(c => c.id === 'u-1')!.certCount).toBe(2)
    expect(list.find(c => c.id === 'u-2')!.certCount).toBe(0)
  })

  // T8 дизайн-аудита (П2): админы — не клиенты студии, не должны попадать в CRM-базу.
  const ORIGINAL_ADMIN_EMAILS = process.env.ADMIN_EMAILS
  afterEach(() => { process.env.ADMIN_EMAILS = ORIGINAL_ADMIN_EMAILS })

  it('email из ADMIN_EMAILS исключён из списка', async () => {
    const admin = makeUser({ id: 'u-1', email: 'admin@test.c' })
    const client_ = makeUser({ id: 'u-2', email: 'anna@test.c', createdAt: new Date('2026-02-01') })
    const { client } = fakeClient({ users: [admin, client_] })
    process.env.ADMIN_EMAILS = 'admin@test.c'
    expect((await listClients(undefined, client)).map(c => c.id)).toEqual(['u-2'])
  })

  it('без ADMIN_EMAILS фильтр не применяется — все клиенты видны', async () => {
    const u = makeUser({ id: 'u-1' })
    const { client } = fakeClient({ users: [u] })
    process.env.ADMIN_EMAILS = ''
    expect((await listClients(undefined, client)).map(c => c.id)).toEqual(['u-1'])
  })
})

describe('getClient (CRM-03)', () => {
  it('неизвестный userId → null', async () => {
    const { client } = fakeClient()
    expect(await getClient('nope', client)).toBeNull()
  })

  it('собирает профиль + заявку + журнал + enrollments + сертификаты + действующую подписку', async () => {
    const u = makeUser({ id: 'u-1', email: 'a@b.c' })
    const { client } = fakeClient({
      users: [u],
      registrations: [{ id: 'r-1', email: 'a@b.c', status: 'ENROLLED' }],
      consents: [
        { id: 'c1', email: 'a@b.c', userId: 'u-1', type: 'NEWSLETTER', granted: true, createdAt: new Date('2026-01-01') },
        { id: 'c2', email: 'a@b.c', userId: 'u-1', type: 'NEWSLETTER', granted: false, createdAt: new Date('2026-02-01') },
        { id: 'c3', email: 'a@b.c', userId: 'u-1', type: 'DATA_PROCESSING', granted: true, createdAt: new Date('2026-01-01') },
      ],
      enrollments: [{ id: 'e1', userId: 'u-1', courseSlug: 'ai-basics', createdAt: new Date('2026-01-01') }],
      certificates: [{ id: 'cert-1', userId: 'u-1', status: 'VALID', issuedAt: new Date('2026-05-01') }],
    })
    const detail = await getClient('u-1', client)
    expect(detail).not.toBeNull()
    expect(detail!.registration?.id).toBe('r-1')
    expect(detail!.consents).toHaveLength(3)
    expect(detail!.enrollments).toHaveLength(1)
    expect(detail!.certificates.map(c => c.id)).toEqual(['cert-1'])
    expect(detail!.subscribed).toBe(false) // последняя NEWSLETTER-запись — отписка (c2)
  })

  // ADM-12: клиент с сертификатами по нескольким курсам — все возвращаются, новые сверху,
  // REVOKED тоже присутствует в списке (виден в карточке, просто без кнопки скачивания в UI).
  it('собирает все сертификаты клиента по всем курсам и статусам, новые сверху', async () => {
    const u = makeUser({ id: 'u-1' })
    const { client } = fakeClient({
      users: [u],
      certificates: [
        { id: 'cert-1', userId: 'u-1', status: 'VALID', issuedAt: new Date('2026-01-01') },
        { id: 'cert-2', userId: 'u-1', status: 'REVOKED', issuedAt: new Date('2026-04-01') },
        { id: 'cert-3', userId: 'u-1', status: 'VALID', issuedAt: new Date('2026-02-01') },
      ],
    })
    const detail = await getClient('u-1', client)
    expect(detail!.certificates.map(c => c.id)).toEqual(['cert-2', 'cert-3', 'cert-1'])
  })

  // T8 дизайн-аудита (П3): карточка клиента показывает его заявки на консультацию.
  it('собирает заявки на консультацию клиента, новые сверху', async () => {
    const u = makeUser({ id: 'u-1' })
    const { client } = fakeClient({
      users: [u],
      consultations: [
        { id: 'cons-1', userId: 'u-1', createdAt: new Date('2026-01-01') },
        { id: 'cons-2', userId: 'u-1', createdAt: new Date('2026-03-01') },
        { id: 'cons-3', userId: 'other', createdAt: new Date('2026-02-01') },
      ],
    })
    const detail = await getClient('u-1', client)
    expect(detail!.consultations.map(c => c.id)).toEqual(['cons-2', 'cons-1'])
  })
})

describe('updateClient (CRM-02/03)', () => {
  it('email не редактируется — не в input, не меняется', async () => {
    const u = makeUser({ id: 'u-1', email: 'stays@same.c' })
    const { client, store } = fakeClient({ users: [u] })
    const result = await updateClient('u-1', { firstName: 'Новое', lastName: 'Имя', phone: null, telegram: null, whatsapp: null }, client)
    expect(result.status).toBe('ok')
    expect(store.users[0].email).toBe('stays@same.c')
    expect(store.users[0].firstName).toBe('Новое')
  })

  it('пустое имя/фамилия → invalid, update не вызывается', async () => {
    const u = makeUser({ id: 'u-1' })
    const { client } = fakeClient({ users: [u] })
    expect(await updateClient('u-1', { firstName: '  ', lastName: 'Волков', phone: null, telegram: null, whatsapp: null }, client))
      .toEqual({ status: 'invalid', field: 'firstName' })
    expect(await updateClient('u-1', { firstName: 'Игорь', lastName: '', phone: null, telegram: null, whatsapp: null }, client))
      .toEqual({ status: 'invalid', field: 'lastName' })
  })

  it('пустой телефон допустим (легаси-юзеры) — пишется null, не ошибка', async () => {
    const u = makeUser({ id: 'u-1', phone: '+79991234567' })
    const { client, store } = fakeClient({ users: [u] })
    const result = await updateClient('u-1', { firstName: 'Игорь', lastName: 'Волков', phone: '  ', telegram: null, whatsapp: null }, client)
    expect(result.status).toBe('ok')
    expect(store.users[0].phone).toBeNull()
  })

  it('невалидный непустой телефон → invalid, база не тронута', async () => {
    const u = makeUser({ id: 'u-1', phone: '+79991234567' })
    const { client, store } = fakeClient({ users: [u] })
    const result = await updateClient('u-1', { firstName: 'Игорь', lastName: 'Волков', phone: '123', telegram: null, whatsapp: null }, client)
    expect(result).toEqual({ status: 'invalid', field: 'phone' })
    expect(store.users[0].phone).toBe('+79991234567')
  })

  it('валидный телефон нормализуется', async () => {
    const u = makeUser({ id: 'u-1' })
    const { client, store } = fakeClient({ users: [u] })
    await updateClient('u-1', { firstName: 'Игорь', lastName: 'Волков', phone: '+7 (999) 123-45-67', telegram: null, whatsapp: null }, client)
    expect(store.users[0].phone).toBe('+79991234567')
  })

  it('неизвестный userId → not_found', async () => {
    const { client } = fakeClient()
    const result = await updateClient('nope', { firstName: 'А', lastName: 'Б', phone: null, telegram: null, whatsapp: null }, client)
    expect(result).toEqual({ status: 'not_found' })
  })
})

describe('resyncClient (CRM-05)', () => {
  it('действующая подписка есть → syncContactSubscribe', async () => {
    const u = makeUser({ id: 'u-1', email: 'a@b.c' })
    const { client } = fakeClient({
      users: [u],
      consents: [{ id: 'c1', email: 'a@b.c', userId: 'u-1', type: 'NEWSLETTER', granted: true, createdAt: new Date() }],
    })
    const result = await resyncClient('u-1', client)
    expect(result).toBe('synced')
    expect(syncContactSubscribe).toHaveBeenCalledOnce()
    expect(syncContactUnsubscribe).not.toHaveBeenCalled()
  })

  it('подписки нет/отозвана → syncContactUnsubscribe', async () => {
    vi.mocked(syncContactSubscribe).mockClear()
    vi.mocked(syncContactUnsubscribe).mockClear()
    const u = makeUser({ id: 'u-1', email: 'a@b.c' })
    const { client } = fakeClient({ users: [u] }) // журнал пуст — согласия не было
    const result = await resyncClient('u-1', client)
    expect(result).toBe('synced')
    expect(syncContactUnsubscribe).toHaveBeenCalledOnce()
    expect(syncContactSubscribe).not.toHaveBeenCalled()
  })

  it('неизвестный userId → not_found, Resend не вызывается', async () => {
    vi.mocked(syncContactSubscribe).mockClear()
    vi.mocked(syncContactUnsubscribe).mockClear()
    const { client } = fakeClient()
    expect(await resyncClient('nope', client)).toBe('not_found')
    expect(syncContactSubscribe).not.toHaveBeenCalled()
    expect(syncContactUnsubscribe).not.toHaveBeenCalled()
  })

  it('сбой Resend → error, не бросает', async () => {
    vi.mocked(syncContactSubscribe).mockRejectedValueOnce(new Error('boom'))
    const u = makeUser({ id: 'u-1', email: 'a@b.c' })
    const { client } = fakeClient({
      users: [u],
      consents: [{ id: 'c1', email: 'a@b.c', userId: 'u-1', type: 'NEWSLETTER', granted: true, createdAt: new Date() }],
    })
    await expect(resyncClient('u-1', client)).resolves.toBe('error')
  })
})
