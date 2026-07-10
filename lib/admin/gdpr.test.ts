import { describe, it, expect, vi, beforeEach } from 'vitest'

// gdpr.ts обращается к глобальному db.$transaction/db.user (не DI) — мокаем модуль целиком,
// тот же приём, что grant-access.test.ts. syncContactDelete мокается отдельно: gdpr.ts вызывает
// его ПЕРЕД транзакцией и просто логирует сбой (.catch), поэтому не должен блокировать удаление.
vi.mock('@/lib/db', () => ({
  db: { user: { findUnique: vi.fn() }, $transaction: vi.fn() },
}))
vi.mock('@/lib/resend-audience', () => ({ syncContactDelete: vi.fn().mockResolvedValue('synced') }))

import { gdprDeleteStudent } from './gdpr'
import { db } from '@/lib/db'
import { syncContactDelete } from '@/lib/resend-audience'

type FakeUser = {
  id: string; email: string; firstName: string; lastName: string
  resendContactId: string | null
}

/** Фейковый tx с моками всех моделей, которые трогает gdprDeleteStudent (см. чеклист в gdpr.ts). */
function fakeTx() {
  const certificateUpdateMany = vi.fn(async () => ({ count: 0 }))
  const consultationRequestUpdateMany = vi.fn(async () => ({ count: 0 }))
  const passwordResetTokenDeleteMany = vi.fn(async () => ({ count: 0 }))
  const consentDeleteMany = vi.fn(async () => ({ count: 0 }))
  const registrationDeleteMany = vi.fn(async () => ({ count: 0 }))
  const userDelete = vi.fn(async () => ({}))

  const tx = {
    certificate: { updateMany: certificateUpdateMany },
    consultationRequest: { updateMany: consultationRequestUpdateMany },
    passwordResetToken: { deleteMany: passwordResetTokenDeleteMany },
    consent: { deleteMany: consentDeleteMany },
    registration: { deleteMany: registrationDeleteMany },
    user: { delete: userDelete },
  }
  return {
    tx, certificateUpdateMany, consultationRequestUpdateMany,
    passwordResetTokenDeleteMany, consentDeleteMany, registrationDeleteMany, userDelete,
  }
}

function setup(user: FakeUser | null) {
  vi.mocked(db.user.findUnique).mockResolvedValue(user as never)
  const parts = fakeTx()
  // db.$transaction типизирован по реальному PrismaClient — в тесте нужен только колбэк-раннер
  // над фейковым tx (тот же приём, что grant-access.test.ts).
  ;(db.$transaction as unknown as { mockImplementation: (fn: (cb: (tx: unknown) => unknown) => unknown) => void })
    .mockImplementation((fn: (tx: unknown) => unknown) => fn(parts.tx))
  return parts
}

const user: FakeUser = { id: 'u-1', email: 'student@test.c', firstName: 'Игорь', lastName: 'Волков', resendContactId: 'c-1' }

beforeEach(() => {
  vi.mocked(syncContactDelete).mockClear().mockResolvedValue('synced')
})

describe('gdprDeleteStudent (ADM-10/11)', () => {
  it('не найден → not_found, транзакция не запускается', async () => {
    setup(null)
    expect(await gdprDeleteStudent('missing', 'x@y.c')).toBe('not_found')
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it('email не совпадает → email_mismatch, транзакция не запускается', async () => {
    setup(user)
    expect(await gdprDeleteStudent('u-1', 'wrong@x.c')).toBe('email_mismatch')
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it('email сравнивается без учёта регистра/пробелов (ADM-11)', async () => {
    setup(user)
    expect(await gdprDeleteStudent('u-1', '  STUDENT@TEST.C  ')).toBe('deleted')
  })

  // M-2 (ревью Ф7б): ConsultationRequest раньше не обезличивался в GDPR-транзакции — заявка
  // оставалась привязана к userId удалённого студента (нарушение data-model.md:405, D-036).
  it('M-2: обезличивает ConsultationRequest — userId → null, заявка НЕ удаляется', async () => {
    const { consultationRequestUpdateMany } = setup(user)

    const result = await gdprDeleteStudent('u-1', 'student@test.c')

    expect(result).toBe('deleted')
    expect(consultationRequestUpdateMany).toHaveBeenCalledWith({
      where: { userId: 'u-1' }, data: { userId: null },
    })
  })

  it('обезличивает Certificate (REVOKED, userId/fullName → null) — не удаляет его', async () => {
    const { certificateUpdateMany } = setup(user)
    await gdprDeleteStudent('u-1', 'student@test.c')

    expect(certificateUpdateMany).toHaveBeenCalledWith({
      where: { userId: 'u-1' },
      data: expect.objectContaining({ userId: null, fullName: null, status: 'REVOKED' }),
    })
  })

  it('удаляет PasswordResetToken/Consent/Registration по email, затем User', async () => {
    const { passwordResetTokenDeleteMany, consentDeleteMany, registrationDeleteMany, userDelete } = setup(user)
    await gdprDeleteStudent('u-1', 'student@test.c')

    expect(passwordResetTokenDeleteMany).toHaveBeenCalledWith({ where: { email: 'student@test.c' } })
    expect(consentDeleteMany).toHaveBeenCalledWith({ where: { email: 'student@test.c' } })
    expect(registrationDeleteMany).toHaveBeenCalledWith({ where: { email: 'student@test.c' } })
    expect(userDelete).toHaveBeenCalledWith({ where: { id: 'u-1' } })
  })

  it('Resend-синк удаления вызывается ДО транзакции и не блокирует её при сбое (CRM-05)', async () => {
    setup(user)
    vi.mocked(syncContactDelete).mockRejectedValue(new Error('resend down'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await gdprDeleteStudent('u-1', 'student@test.c')

    expect(result).toBe('deleted')
    expect(syncContactDelete).toHaveBeenCalled()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
