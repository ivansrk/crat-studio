import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// deleteParticipant обращается к глобальному db (не DI) — мокаем модуль целиком, тот же приём,
// что был у gdpr.test.ts. syncContactDelete вызывается ПЕРЕД транзакцией и только логирует сбой
// (.catch), поэтому не должен блокировать удаление.
vi.mock('@/lib/db', () => ({
  db: {
    user: { findUnique: vi.fn() },
    registration: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock('@/lib/resend-audience', () => ({ syncContactDelete: vi.fn().mockResolvedValue('synced') }))

import { deleteParticipant, DELETED_EMAIL } from './delete-participant'
import { db } from '@/lib/db'
import { syncContactDelete } from '@/lib/resend-audience'

type FakeUser = { id: string; email: string; firstName: string; lastName: string; resendContactId: string | null }
type FakeReg = { id: string; email: string }

/** Фейковый tx с моками всех моделей, которые трогает deleteParticipant. */
function fakeTx() {
  const certificateDeleteMany = vi.fn(async () => ({ count: 0 }))
  const consultationRequestUpdateMany = vi.fn(async () => ({ count: 0 }))
  const emailLogUpdateMany = vi.fn(async () => ({ count: 0 }))
  const passwordResetTokenDeleteMany = vi.fn(async () => ({ count: 0 }))
  const consentDeleteMany = vi.fn(async () => ({ count: 0 }))
  const registrationDeleteMany = vi.fn(async () => ({ count: 0 }))
  const userDelete = vi.fn(async () => ({}))
  const tx = {
    certificate: { deleteMany: certificateDeleteMany },
    consultationRequest: { updateMany: consultationRequestUpdateMany },
    emailLog: { updateMany: emailLogUpdateMany },
    passwordResetToken: { deleteMany: passwordResetTokenDeleteMany },
    consent: { deleteMany: consentDeleteMany },
    registration: { deleteMany: registrationDeleteMany },
    user: { delete: userDelete },
  }
  return {
    tx, certificateDeleteMany, consultationRequestUpdateMany, emailLogUpdateMany,
    passwordResetTokenDeleteMany, consentDeleteMany, registrationDeleteMany, userDelete,
  }
}

function setup(opts: { user?: FakeUser | null; reg?: FakeReg | null }) {
  vi.mocked(db.user.findUnique).mockResolvedValue((opts.user ?? null) as never)
  vi.mocked(db.registration.findUnique).mockResolvedValue((opts.reg ?? null) as never)
  const parts = fakeTx()
  ;(db.$transaction as unknown as { mockImplementation: (fn: (cb: (tx: unknown) => unknown) => unknown) => void })
    .mockImplementation((fn: (tx: unknown) => unknown) => fn(parts.tx))
  return parts
}

const diplomant: FakeUser = { id: 'u-1', email: 'diplomant@test.c', firstName: 'Дима', lastName: 'Дипломов', resendContactId: 'c-1' }

const ORIGINAL_ADMIN_EMAILS = process.env.ADMIN_EMAILS

beforeEach(() => {
  vi.mocked(db.user.findUnique).mockReset()
  vi.mocked(db.registration.findUnique).mockReset()
  vi.mocked(db.$transaction as unknown as { mockReset: () => void }).mockReset()
  vi.mocked(syncContactDelete).mockClear().mockResolvedValue('synced')
})
afterEach(() => { process.env.ADMIN_EMAILS = ORIGINAL_ADMIN_EMAILS })

describe('deleteParticipant (ADM-10/11/13, D-050)', () => {
  it('userId не найден → not_found, транзакция не запускается', async () => {
    setup({ user: null })
    expect(await deleteParticipant({ userId: 'missing' }, 'x@y.c')).toBe('not_found')
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it('registrationId не найден → not_found, транзакция не запускается', async () => {
    setup({ reg: null })
    expect(await deleteParticipant({ registrationId: 'missing' }, 'x@y.c')).toBe('not_found')
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it('email в ADMIN_EMAILS → is_admin, транзакция не запускается', async () => {
    setup({ user: diplomant })
    process.env.ADMIN_EMAILS = 'diplomant@test.c'
    expect(await deleteParticipant({ userId: 'u-1' }, 'diplomant@test.c')).toBe('is_admin')
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it('email не совпадает → email_mismatch, транзакция не запускается', async () => {
    setup({ user: diplomant })
    expect(await deleteParticipant({ userId: 'u-1' }, 'wrong@x.c')).toBe('email_mismatch')
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it('email сравнивается без учёта регистра/пробелов (ADM-11)', async () => {
    setup({ user: diplomant })
    expect(await deleteParticipant({ userId: 'u-1' }, '  DIPLOMANT@TEST.C  ')).toBe('deleted')
  })

  // Ключевой сценарий жалобы: дипломант с ВЫДАННЫМ сертификатом удаляется без ошибки.
  it('дипломант с сертификатом: Certificate удаляется ФИЗИЧЕСКИ (D-050), затем User', async () => {
    const { certificateDeleteMany, userDelete } = setup({ user: diplomant })
    expect(await deleteParticipant({ userId: 'u-1' }, 'diplomant@test.c')).toBe('deleted')
    expect(certificateDeleteMany).toHaveBeenCalledWith({ where: { userId: 'u-1' } })
    expect(userDelete).toHaveBeenCalledWith({ where: { id: 'u-1' } })
  })

  it('ConsultationRequest обезличивается (userId → null), лид НЕ удаляется (D-048)', async () => {
    const { consultationRequestUpdateMany } = setup({ user: diplomant })
    await deleteParticipant({ userId: 'u-1' }, 'diplomant@test.c')
    expect(consultationRequestUpdateMany).toHaveBeenCalledWith({ where: { userId: 'u-1' }, data: { userId: null } })
  })

  it('EmailLog обезличивается по userId и по адресу (userId → null, toEmail затирается)', async () => {
    const { emailLogUpdateMany } = setup({ user: diplomant })
    await deleteParticipant({ userId: 'u-1' }, 'diplomant@test.c')
    expect(emailLogUpdateMany).toHaveBeenCalledWith({ where: { userId: 'u-1' }, data: { userId: null, toEmail: DELETED_EMAIL } })
    expect(emailLogUpdateMany).toHaveBeenCalledWith({ where: { toEmail: 'diplomant@test.c' }, data: { userId: null, toEmail: DELETED_EMAIL } })
  })

  it('удаляет PasswordResetToken/Consent/Registration по email', async () => {
    const { passwordResetTokenDeleteMany, consentDeleteMany, registrationDeleteMany } = setup({ user: diplomant })
    await deleteParticipant({ userId: 'u-1' }, 'diplomant@test.c')
    expect(passwordResetTokenDeleteMany).toHaveBeenCalledWith({ where: { email: 'diplomant@test.c' } })
    expect(consentDeleteMany).toHaveBeenCalledWith({ where: { email: 'diplomant@test.c' } })
    expect(registrationDeleteMany).toHaveBeenCalledWith({ where: { email: 'diplomant@test.c' } })
  })

  // Заявка-лид без учётки (zayavka@): удаляется Registration + opt-in токены, User.delete НЕ вызывается.
  it('заявка без User: удаляет Registration/токены, user.delete НЕ вызывается, синк не дёргается', async () => {
    const parts = setup({ reg: { id: 'r-1', email: 'lead@test.c' }, user: null })
    expect(await deleteParticipant({ registrationId: 'r-1' }, 'lead@test.c')).toBe('deleted')
    expect(parts.registrationDeleteMany).toHaveBeenCalledWith({ where: { email: 'lead@test.c' } })
    expect(parts.passwordResetTokenDeleteMany).toHaveBeenCalledWith({ where: { email: 'lead@test.c' } })
    expect(parts.userDelete).not.toHaveBeenCalled()
    expect(parts.certificateDeleteMany).not.toHaveBeenCalled()
    expect(syncContactDelete).not.toHaveBeenCalled()
  })

  // Заявка, которая уже стала учёткой (ENROLLED, тот же email): удаляем и User.
  it('заявка со связанной учёткой: находит User по email и удаляет его тоже', async () => {
    const parts = setup({ reg: { id: 'r-2', email: 'diplomant@test.c' }, user: diplomant })
    expect(await deleteParticipant({ registrationId: 'r-2' }, 'diplomant@test.c')).toBe('deleted')
    expect(parts.userDelete).toHaveBeenCalledWith({ where: { id: 'u-1' } })
    expect(syncContactDelete).toHaveBeenCalled()
  })

  it('Resend-синк удаления вызывается ДО транзакции и не блокирует её при сбое (CRM-05)', async () => {
    setup({ user: diplomant })
    vi.mocked(syncContactDelete).mockRejectedValue(new Error('resend down'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await deleteParticipant({ userId: 'u-1' }, 'diplomant@test.c')).toBe('deleted')
    expect(syncContactDelete).toHaveBeenCalled()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
