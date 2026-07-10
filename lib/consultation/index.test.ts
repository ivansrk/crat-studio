import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'

vi.mock('@/lib/email', () => ({ sendEmail: vi.fn().mockResolvedValue('log-id') }))

import { createConsultation, listConsultations, updateConsultationStatus } from './index'
import { sendEmail } from '@/lib/email'
import type { ConsultationRequest, ConsultationStatus, PrismaClient } from '@/lib/generated/prisma/client'

// DI-фейковый клиент (без vi.mock('@/lib/db')) — тот же приём, что confirm.test.ts/crm/index.test.ts.
const ORIGINAL_ADMIN_EMAILS = process.env.ADMIN_EMAILS

function makeRow(overrides: Partial<ConsultationRequest> = {}): ConsultationRequest {
  return {
    id: 'c-1', name: 'Иван', contact: 'a@b.c', topic: null, message: 'Нужна автоматизация',
    status: 'NEW' as ConsultationStatus, userId: null, source: 'public',
    createdAt: new Date('2026-07-01T00:00:00Z'), updatedAt: new Date('2026-07-01T00:00:00Z'),
    ...overrides,
  }
}

function fakeClient(rows: ConsultationRequest[] = []) {
  const store = { rows: [...rows] }
  let seq = 0
  const consultationRequest = {
    create: vi.fn(async ({ data }: { data: Partial<ConsultationRequest> }) => {
      const row = makeRow({ id: `c-new-${++seq}`, createdAt: new Date(), updatedAt: new Date(), ...data })
      store.rows.push(row)
      return row
    }),
    findMany: vi.fn(async () => [...store.rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<ConsultationRequest> }) => {
      const row = store.rows.find(r => r.id === where.id)
      if (!row) throw new Error('not found')
      Object.assign(row, data)
      return row
    }),
  }
  const client = { consultationRequest } as unknown as Pick<PrismaClient, 'consultationRequest'>
  return { client, store, consultationRequest }
}

beforeEach(() => {
  vi.mocked(sendEmail).mockClear()
  process.env.ADMIN_EMAILS = 'admin1@x.com, admin2@y.com'
})

afterAll(() => { process.env.ADMIN_EMAILS = ORIGINAL_ADMIN_EMAILS })

describe('createConsultation', () => {
  it('happy: создаёт заявку NEW, шлёт письмо каждому админу с payload {} (CONS-02/03)', async () => {
    const { client, store } = fakeClient()
    const result = await createConsultation(
      { name: ' Иван ', contact: ' a@b.c ', message: ' Нужна автоматизация ', topic: 'automation' },
      null, 'ip-happy-1', client,
    )

    expect(result).toBe('accepted')
    expect(store.rows).toHaveLength(1)
    expect(store.rows[0]).toMatchObject({
      name: 'Иван', contact: 'a@b.c', message: 'Нужна автоматизация', topic: 'automation',
      status: 'NEW', userId: null, source: 'public',
    })

    expect(sendEmail).toHaveBeenCalledTimes(2)
    const calls = vi.mocked(sendEmail).mock.calls.map(c => c[0])
    expect(calls.map(c => c.to).sort()).toEqual(['admin1@x.com', 'admin2@y.com'])
    for (const c of calls) {
      expect(c.type).toBe('CONSULTATION')
      expect(c.payload).toEqual({})
      expect(c.html).toContain('Иван')
    }
  })

  it('userId прокидывается при наличии сессии → source cabinet (CONS-02/MC-03)', async () => {
    const { client, store } = fakeClient()
    await createConsultation({ name: 'И', contact: 'c', message: 'm' }, 'user-1', 'ip-happy-2', client)
    expect(store.rows[0]).toMatchObject({ userId: 'user-1', source: 'cabinet' })
  })

  it('rate-limit 5/час/IP: 6-й запрос за час → rate, без создания заявки и письма (CONS-05, E-CONS1)', async () => {
    const { client, store } = fakeClient()
    const ip = 'ip-rate-limit-test'
    for (let i = 0; i < 5; i++) {
      expect(await createConsultation({ name: 'N', contact: 'c', message: `m${i}` }, null, ip, client)).toBe('accepted')
    }
    vi.mocked(sendEmail).mockClear()

    const sixth = await createConsultation({ name: 'N', contact: 'c', message: 'm6' }, null, ip, client)
    expect(sixth).toBe('rate')
    expect(store.rows).toHaveLength(5)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('invalid: пустое message → invalid, заявка не создаётся, письмо не шлётся', async () => {
    const { client, store } = fakeClient()
    const result = await createConsultation({ name: 'Иван', contact: 'a@b.c', message: '   ' }, null, 'ip-invalid-1', client)
    expect(result).toBe('invalid')
    expect(store.rows).toHaveLength(0)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('invalid: пустое имя или контакт → invalid', async () => {
    const { client } = fakeClient()
    expect(await createConsultation({ name: ' ', contact: 'c', message: 'm' }, null, 'ip-invalid-2', client)).toBe('invalid')
    expect(await createConsultation({ name: 'N', contact: ' ', message: 'm' }, null, 'ip-invalid-3', client)).toBe('invalid')
  })

  it('invalid: message длиннее 2000 символов', async () => {
    const { client } = fakeClient()
    const long = 'a'.repeat(2001)
    expect(await createConsultation({ name: 'И', contact: 'c', message: long }, null, 'ip-invalid-4', client)).toBe('invalid')
  })

  it('message ровно 2000 символов — валидно', async () => {
    const { client, store } = fakeClient()
    const exact = 'a'.repeat(2000)
    expect(await createConsultation({ name: 'И', contact: 'c', message: exact }, null, 'ip-boundary-1', client)).toBe('accepted')
    expect(store.rows).toHaveLength(1)
  })

  it('ADMIN_EMAILS пуст → заявка создаётся, писем не шлётся', async () => {
    process.env.ADMIN_EMAILS = ''
    const { client, store } = fakeClient()
    const result = await createConsultation({ name: 'И', contact: 'c', message: 'm' }, null, 'ip-no-admins', client)
    expect(result).toBe('accepted')
    expect(store.rows).toHaveLength(1)
    expect(sendEmail).not.toHaveBeenCalled()
  })
})

describe('listConsultations', () => {
  it('NEW сверху, потом CONTACTED, потом CLOSED; внутри группы новые первыми (CONS-04)', async () => {
    const now = Date.now()
    const rows = [
      makeRow({ id: 'closed-old', status: 'CLOSED' as ConsultationStatus, createdAt: new Date(now - 1_000) }),
      makeRow({ id: 'new-old', status: 'NEW' as ConsultationStatus, createdAt: new Date(now - 5_000) }),
      makeRow({ id: 'new-fresh', status: 'NEW' as ConsultationStatus, createdAt: new Date(now - 1_000) }),
      makeRow({ id: 'contacted', status: 'CONTACTED' as ConsultationStatus, createdAt: new Date(now - 2_000) }),
    ]
    const { client } = fakeClient(rows)

    const result = await listConsultations(client)

    expect(result.map(r => r.id)).toEqual(['new-fresh', 'new-old', 'contacted', 'closed-old'])
  })

  it('пустой список — не падает', async () => {
    const { client } = fakeClient()
    expect(await listConsultations(client)).toEqual([])
  })
})

describe('updateConsultationStatus', () => {
  it('NEW → CONTACTED → CLOSED (CONS-04)', async () => {
    const { client, store } = fakeClient([makeRow({ id: 'c-1', status: 'NEW' as ConsultationStatus })])
    expect(await updateConsultationStatus('c-1', 'CONTACTED', client)).toBe('ok')
    expect(store.rows[0].status).toBe('CONTACTED')
    expect(await updateConsultationStatus('c-1', 'CLOSED', client)).toBe('ok')
    expect(store.rows[0].status).toBe('CLOSED')
  })

  it('несуществующий id → not_found', async () => {
    const { client } = fakeClient()
    expect(await updateConsultationStatus('missing', 'CLOSED', client)).toBe('not_found')
  })
})
