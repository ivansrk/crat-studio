import { describe, it, expect, vi, beforeEach } from 'vitest'

// resendFromLog обращается к глобальному db (не DI) — тот же приём мока модуля целиком,
// что grant-access.test.ts; mintResetToken (вызывается изнутри WELCOME-ветки) тоже без DI-клиента
// уходит на этот же db.user/db.passwordResetToken.
vi.mock('@/lib/db', () => ({
  db: {
    emailLog: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    passwordResetToken: { create: vi.fn() },
    certificate: { findFirst: vi.fn() },
    registration: { findUnique: vi.fn() }, // ветка DOUBLE_OPT_IN (ADM-08/D-053-доп)
  },
}))
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn().mockResolvedValue('log-id') }))

import { isStaleQueued, STALE_QUEUED_MS, resendFromLog } from './resend-email'
import { db } from '@/lib/db'
import { sendEmail } from '@/lib/email'

describe('isStaleQueued', () => {
  const now = new Date('2026-07-09T12:00:00Z')

  it('QUEUED старше STALE_QUEUED_MS — зависло', () => {
    const log = { status: 'QUEUED' as const, createdAt: new Date(now.getTime() - STALE_QUEUED_MS - 1) }
    expect(isStaleQueued(log, now)).toBe(true)
  })

  it('QUEUED моложе порога — ещё отправляется, не зависло', () => {
    const log = { status: 'QUEUED' as const, createdAt: new Date(now.getTime() - STALE_QUEUED_MS + 1000) }
    expect(isStaleQueued(log, now)).toBe(false)
  })

  it('не QUEUED (например SENT) — никогда не "зависло", даже если старое', () => {
    const log = { status: 'SENT' as const, createdAt: new Date(now.getTime() - STALE_QUEUED_MS - 1) }
    expect(isStaleQueued(log, now)).toBe(false)
  })
})

// Ревью m4: три постоянных теста WELCOME-ветки resendFromLog (ревьюер прогонял их временно на
// живом Playwright/dev — фиксируем как обычные vitest-тесты, чтобы регресс ловился в CI).
describe('resendFromLog — WELCOME (T5/D-028)', () => {
  beforeEach(() => {
    vi.mocked(sendEmail).mockClear()
    vi.mocked(db.passwordResetToken.create).mockReset()
    vi.mocked(db.user.findUnique).mockReset()
    vi.mocked(db.emailLog.findUnique).mockReset()
  })

  it('переотправка WELCOME без пароля → свежая /reset/-ссылка в html, payload {}', async () => {
    vi.mocked(db.emailLog.findUnique).mockResolvedValue(
      { id: 'log-1', type: 'WELCOME', toEmail: 'student@test.c', userId: 'u-1' } as never,
    )
    vi.mocked(db.user.findUnique).mockResolvedValue({ id: 'u-1', email: 'student@test.c' } as never)
    // db.passwordResetToken.create типизирован по реальному PrismaClient — в тесте нужен только
    // фейковый create поверх мока (тот же приём, что db.$transaction в grant-access.test.ts).
    ;(db.passwordResetToken.create as unknown as { mockImplementation: (fn: (args: { data: Record<string, unknown> }) => Promise<unknown>) => void })
      .mockImplementation(async ({ data }) => ({ id: 'tok-1', usedAt: null, createdAt: new Date(), ...data }))

    const result = await resendFromLog('log-1')

    expect(result).toBe('sent')
    expect(sendEmail).toHaveBeenCalledOnce()
    const call = vi.mocked(sendEmail).mock.calls[0][0]
    expect(call.type).toBe('WELCOME')
    expect(call.to).toBe('student@test.c')
    expect(call.html).toContain('/reset/') // пароль невоспроизводим (хэш) — переотправка ведёт на reset, не повторяет пароль
    expect(call.payload).toEqual({}) // D-028: сырой токен/URL в email_log не попадает
    expect(db.passwordResetToken.create).toHaveBeenCalledOnce() // свежий токен на каждую переотправку (ADM-08/MAIL-05)
  })

  it('WELCOME на GDPR-удалённого адресата (пользователь не найден) → user_gone', async () => {
    vi.mocked(db.emailLog.findUnique).mockResolvedValue(
      { id: 'log-2', type: 'WELCOME', toEmail: 'gone@test.c', userId: null } as never,
    )
    vi.mocked(db.user.findUnique).mockResolvedValue(null)

    const result = await resendFromLog('log-2')

    expect(result).toBe('user_gone')
    expect(sendEmail).not.toHaveBeenCalled()
    expect(db.passwordResetToken.create).not.toHaveBeenCalled()
  })

  it('MAGIC_LINK — снят вместе с magic-link-входом (T6/D-031) → unsupported_type', async () => {
    vi.mocked(db.emailLog.findUnique).mockResolvedValue(
      { id: 'log-3', type: 'MAGIC_LINK', toEmail: 'someone@test.c', userId: 'u-3' } as never,
    )

    const result = await resendFromLog('log-3')

    expect(result).toBe('unsupported_type')
    expect(sendEmail).not.toHaveBeenCalled()
  })
})

// D-053-доп (боевой случай 2026-07-20): переотправка DOUBLE_OPT_IN из «Писем» — всегда свежий
// OPT_IN-токен; для уже подтверждённых заявок — opt_in_done, а не тихий unsupported.
describe('resendFromLog — DOUBLE_OPT_IN (ADM-08/ADM-14)', () => {
  beforeEach(() => {
    vi.mocked(sendEmail).mockClear()
    vi.mocked(db.emailLog.findUnique).mockReset()
    vi.mocked(db.registration.findUnique).mockReset()
    vi.mocked(db.user.findUnique).mockReset().mockResolvedValue(null as never)
    ;(db.passwordResetToken.create as unknown as { mockImplementation: (fn: (args: { data: Record<string, unknown> }) => Promise<unknown>) => void })
      .mockImplementation(async ({ data }) => ({ id: 'tok-1', usedAt: null, createdAt: new Date(), ...data }))
    vi.mocked(db.emailLog.findUnique).mockResolvedValue(
      { id: 'log-o', type: 'DOUBLE_OPT_IN', toEmail: 'sh@test.c', userId: null } as never,
    )
  })

  it('заявка PENDING_OPT_IN → sent: свежий OPT_IN-токен, письмо DOUBLE_OPT_IN со ссылкой /invite-confirm/', async () => {
    vi.mocked(db.registration.findUnique).mockResolvedValue({ id: 'reg-1', email: 'sh@test.c', status: 'PENDING_OPT_IN' } as never)

    expect(await resendFromLog('log-o')).toBe('sent')

    const tokenData = vi.mocked(db.passwordResetToken.create).mock.calls[0][0].data
    expect(tokenData).toMatchObject({ email: 'sh@test.c', purpose: 'OPT_IN' })
    const call = vi.mocked(sendEmail).mock.calls[0][0]
    expect(call).toMatchObject({ to: 'sh@test.c', type: 'DOUBLE_OPT_IN' })
    expect(call.html).toContain('/invite-confirm/')
    expect(call.payload).toEqual({}) // D-028
  })

  it.each(['CONFIRMED', 'ENROLLED'])('заявка %s → opt_in_done, письмо не шлётся', async status => {
    vi.mocked(db.registration.findUnique).mockResolvedValue({ id: 'reg-1', email: 'sh@test.c', status } as never)
    expect(await resendFromLog('log-o')).toBe('opt_in_done')
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('заявки больше нет (удалена) → user_gone', async () => {
    vi.mocked(db.registration.findUnique).mockResolvedValue(null as never)
    expect(await resendFromLog('log-o')).toBe('user_gone')
    expect(sendEmail).not.toHaveBeenCalled()
  })
})
