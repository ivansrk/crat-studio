import { describe, it, expect, vi, beforeEach } from 'vitest'

// resendOptIn обращается к глобальному db (не DI) — тот же приём мока модуля целиком, что
// resend-email.test.ts; mintResetToken изнутри уходит на этот же db.user/db.passwordResetToken.
vi.mock('@/lib/db', () => ({
  db: {
    registration: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    passwordResetToken: { create: vi.fn() },
  },
}))
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn().mockResolvedValue('log-id') }))

import { resendOptIn } from './resend-opt-in'
import { OPT_IN_TTL_MS, RESET_TTL_MS, mintResetToken } from '@/lib/auth/reset'
import { ResetTokenPurpose } from '@/lib/generated/prisma/client'
import { db } from '@/lib/db'
import { sendEmail } from '@/lib/email'

const reg = { id: 'reg-1', email: 'sholpan@example.com', status: 'PENDING_OPT_IN' }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(db.user.findUnique).mockResolvedValue(null as never)
  vi.mocked(db.passwordResetToken.create).mockResolvedValue({ id: 'tok-1' } as never)
})

describe('resendOptIn (ADM-14, D-053)', () => {
  it('заявка не найдена → not_found, письмо не шлётся', async () => {
    vi.mocked(db.registration.findUnique).mockResolvedValue(null as never)
    expect(await resendOptIn('nope')).toBe('not_found')
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it.each(['CONFIRMED', 'ENROLLED', 'NEW'])('статус %s → not_pending, письмо не шлётся', async status => {
    vi.mocked(db.registration.findUnique).mockResolvedValue({ ...reg, status } as never)
    expect(await resendOptIn(reg.id)).toBe('not_pending')
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('PENDING_OPT_IN → свежий OPT_IN-токен и письмо DOUBLE_OPT_IN на email заявки', async () => {
    vi.mocked(db.registration.findUnique).mockResolvedValue(reg as never)
    expect(await resendOptIn(reg.id)).toBe('sent')

    // токен выпущен с назначением OPT_IN на email заявки
    const tokenData = vi.mocked(db.passwordResetToken.create).mock.calls[0][0].data
    expect(tokenData).toMatchObject({ email: reg.email, purpose: ResetTokenPurpose.OPT_IN })

    // письмо того же типа и на тот же адрес, ссылка ведёт на /invite-confirm/
    const mail = vi.mocked(sendEmail).mock.calls[0][0]
    expect(mail).toMatchObject({ to: reg.email, type: 'DOUBLE_OPT_IN' })
    expect(mail.html).toContain('/invite-confirm/')
  })
})

describe('TTL токена по назначению (REG-11, D-053)', () => {
  it('OPT_IN живёт 72 часа, PASSWORD_RESET — прежние 60 минут', async () => {
    const t0 = Date.now()
    await mintResetToken('a@b.c', ResetTokenPurpose.OPT_IN)
    await mintResetToken('a@b.c', ResetTokenPurpose.PASSWORD_RESET)
    const [optIn, reset] = vi.mocked(db.passwordResetToken.create).mock.calls.map(c => c[0].data)
    const ttlOf = (d: { expiresAt: Date }) => d.expiresAt.getTime() - t0
    // допуск на время исполнения теста
    expect(Math.abs(ttlOf(optIn as { expiresAt: Date }) - OPT_IN_TTL_MS)).toBeLessThan(5000)
    expect(Math.abs(ttlOf(reset as { expiresAt: Date }) - RESET_TTL_MS)).toBeLessThan(5000)
    expect(OPT_IN_TTL_MS).toBe(72 * 60 * 60 * 1000)
  })
})
