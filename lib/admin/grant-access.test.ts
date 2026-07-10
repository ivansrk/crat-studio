import { describe, it, expect, vi, beforeEach } from 'vitest'

// grant-access.ts обращается к глобальному db.$transaction (не DI, как provision.ts/mintResetToken) —
// мокаем модуль целиком, тем же приёмом, что reset.test.ts мокает '@/lib/email'.
// consent.findFirst — Ф7б Task 7 (CRM-гэп): getEffectiveConsent тоже ходит через глобальный db.
vi.mock('@/lib/db', () => ({
  db: { registration: { findUnique: vi.fn() }, consent: { findFirst: vi.fn() }, $transaction: vi.fn() },
}))
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn().mockResolvedValue('log-id') }))
vi.mock('@/lib/resend-audience', () => ({ syncContactSubscribe: vi.fn().mockResolvedValue('synced') }))

import { grantAccess } from './grant-access'
import { db } from '@/lib/db'
import { sendEmail } from '@/lib/email'
import { syncContactSubscribe } from '@/lib/resend-audience'
import { verifyPassword } from '@/lib/auth/password'

type FakeUser = {
  id: string; email: string; firstName: string; lastName: string
  phone: string | null; telegram: string | null; whatsapp: string | null; passwordHash: string | null
}
type FakeReg = {
  id: string; email: string; firstName: string; lastName: string
  phone: string | null; telegram: string | null; whatsapp: string | null; status: string
}

/** Фейковый tx с моками всех моделей, которые трогает grantAccess/createUserWithPassword/mintResetToken. */
function fakeTx(existingUser: FakeUser | null) {
  const store: { user: FakeUser | null; tokens: unknown[] } = { user: existingUser, tokens: [] }

  const userFindUnique = vi.fn(async () => store.user)
  const userCreate = vi.fn(async ({ data }: { data: Omit<FakeUser, 'id'> }) => {
    const created: FakeUser = { id: 'new-user-1', ...data }
    store.user = created
    return created
  })
  const userUpdate = vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<FakeUser> }) => {
    if (!store.user || store.user.id !== where.id) throw new Error('not found')
    store.user = { ...store.user, ...data }
    return store.user
  })
  const consentUpdateMany = vi.fn(async () => ({ count: 0 }))
  const enrollmentCreate = vi.fn(async () => ({ id: 'enr-1' }))
  const registrationUpdate = vi.fn(async () => ({}))
  const tokenCreate = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    const created = { id: 'tok-1', usedAt: null, createdAt: new Date(), ...data }
    store.tokens.push(created)
    return created
  })

  const tx = {
    user: { findUnique: userFindUnique, create: userCreate, update: userUpdate },
    consent: { updateMany: consentUpdateMany },
    enrollment: { create: enrollmentCreate },
    registration: { update: registrationUpdate },
    passwordResetToken: { create: tokenCreate },
  }
  return { tx, store, userCreate, userUpdate, enrollmentCreate, tokenCreate }
}

function setup(reg: FakeReg, existingUser: FakeUser | null, opts: { enrollmentError?: unknown; subscribed?: boolean } = {}) {
  vi.mocked(db.registration.findUnique).mockResolvedValue(reg as never)
  // Ф7б Task 7 (CRM-гэп): по умолчанию нет действующего согласия NEWSLETTER — тесты, которым
  // важен сам гэп, передают opts.subscribed = true.
  vi.mocked(db.consent.findFirst).mockResolvedValue((opts.subscribed ? { granted: true } : null) as never)
  const { tx, store, userCreate, userUpdate, enrollmentCreate, tokenCreate } = fakeTx(existingUser)
  if (opts.enrollmentError) enrollmentCreate.mockRejectedValueOnce(opts.enrollmentError)
  // db.$transaction типизирован по реальному PrismaClient — в тесте нужен только колбэк-раннер
  // над фейковым tx, поэтому сигнатура сужается через any (тот же приём, что и cast client в login.test.ts).
  ;(db.$transaction as unknown as { mockImplementation: (fn: (cb: (tx: unknown) => unknown) => unknown) => void })
    .mockImplementation((fn: (tx: unknown) => unknown) => fn(tx))
  return { tx, store, userCreate, userUpdate, enrollmentCreate, tokenCreate }
}

const reg: FakeReg = {
  id: 'reg-1', email: 'student@test.c', firstName: 'Игорь', lastName: 'Волков',
  phone: '+1', telegram: null, whatsapp: '+79991234567', status: 'CONFIRMED',
}

describe('grantAccess (ADM-03/04, AUTH-15, F11, D-028)', () => {
  beforeEach(() => {
    vi.mocked(sendEmail).mockClear()
    vi.mocked(db.$transaction).mockClear()
    vi.mocked(syncContactSubscribe).mockClear()
  })

  it('заявка не найдена → not_found, транзакция не запускается', async () => {
    vi.mocked(db.registration.findUnique).mockResolvedValue(null)
    const result = await grantAccess('missing', 'admin-1')
    expect(result).toEqual({ status: 'not_found' })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('новый юзер → создаёт с паролем, письмо WELCOME с паролем в html, payload {} без секретов', async () => {
    const { store } = setup(reg, null)
    const result = await grantAccess(reg.id, 'admin-1')

    expect(result.status).toBe('granted')
    if (result.status !== 'granted') throw new Error('unreachable')
    expect(result.plainPassword).toMatch(/^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/)
    expect(result.email).toBe(reg.email)
    expect(store.user?.passwordHash).toBeTruthy()
    expect(await verifyPassword(result.plainPassword!, store.user!.passwordHash!)).toBe(true)
    expect(store.user?.whatsapp).toBe(reg.whatsapp) // M1: whatsapp из заявки прокинут в User

    expect(sendEmail).toHaveBeenCalledOnce()
    const call = vi.mocked(sendEmail).mock.calls[0][0]
    expect(call.type).toBe('WELCOME')
    expect(call.to).toBe(reg.email)
    expect(call.html).toContain(result.plainPassword!)
    expect(call.payload).toEqual({}) // D-028: пароль/reset-url в payload не попадают
    expect(JSON.stringify(call.payload)).not.toContain(result.plainPassword!)
  })

  it('повторная выдача юзеру с уже заданным паролем → письмо БЕЗ пароля, ссылка «задать пароль»', async () => {
    const existing: FakeUser = {
      id: 'u-existing', email: reg.email, firstName: reg.firstName, lastName: reg.lastName,
      phone: reg.phone, telegram: reg.telegram, whatsapp: reg.whatsapp, passwordHash: 'already-set-hash',
    }
    const { userCreate, userUpdate } = setup(reg, existing)
    const result = await grantAccess(reg.id, 'admin-1')

    expect(result.status).toBe('granted')
    if (result.status !== 'granted') throw new Error('unreachable')
    expect(result.plainPassword).toBeNull() // идемпотентность: пароль не перевыпущен
    expect(userCreate).not.toHaveBeenCalled()
    expect(userUpdate).not.toHaveBeenCalled() // passwordHash уже был — createUserWithPassword его не трогает

    expect(sendEmail).toHaveBeenCalledOnce()
    const call = vi.mocked(sendEmail).mock.calls[0][0]
    expect(call.type).toBe('WELCOME')
    expect(call.html).not.toContain('already-set-hash')
    expect(call.html).toContain('/reset/') // ссылка «задать пароль» вместо показа старого пароля
    expect(call.payload).toEqual({})
  })

  it('Ф7б T5/REG-13: PENDING_OPT_IN (email не подтверждён) → not_confirmed, транзакция не запускается', async () => {
    vi.mocked(db.registration.findUnique).mockResolvedValue({ ...reg, status: 'PENDING_OPT_IN' } as never)
    const result = await grantAccess(reg.id, 'admin-1')
    expect(result).toEqual({ status: 'not_confirmed' })
    expect(db.$transaction).not.toHaveBeenCalled()
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('Ф7б T5/REG-15: легаси-заявка NEW (с прода до double opt-in) → выдаётся как раньше', async () => {
    const legacyReg = { ...reg, status: 'NEW' }
    setup(legacyReg, null)
    const result = await grantAccess(legacyReg.id, 'admin-1')
    expect(result.status).toBe('granted')
    expect(sendEmail).toHaveBeenCalledOnce()
  })

  it('гонка ADM-04 (двойная выдача, unique violation) → already, письмо не шлётся', async () => {
    setup(reg, null, { enrollmentError: { code: 'P2002' } })
    const result = await grantAccess(reg.id, 'admin-1')
    expect(result).toEqual({ status: 'already' })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('сбой постановки письма в очередь → granted_email_failed, пароль всё равно возвращён', async () => {
    setup(reg, null)
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error('queue failed'))
    const result = await grantAccess(reg.id, 'admin-1')
    expect(result.status).toBe('granted_email_failed')
    if (result.status !== 'granted_email_failed') throw new Error('unreachable')
    expect(result.plainPassword).toMatch(/^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/)
  })

  // Ф7б Task 7 (CRM-гэп): F15 публичный путь — заявка уже подтвердила double opt-in с подпиской
  // (Consent NEWSLETTER granted=true по email), доступ выдаётся вручную; confirm.ts синкает
  // Resend Audience только на авто-инвайт-пути (F14), поэтому здесь контакт до сих пор не заведён.
  it('действующая NEWSLETTER-подписка по email → зовёт syncContactSubscribe после выдачи', async () => {
    setup(reg, null, { subscribed: true })
    await grantAccess(reg.id, 'admin-1')
    expect(syncContactSubscribe).toHaveBeenCalledOnce()
    expect(vi.mocked(syncContactSubscribe).mock.calls[0][0].email).toBe(reg.email)
  })

  it('нет действующей подписки → syncContactSubscribe не вызывается', async () => {
    setup(reg, null, { subscribed: false })
    await grantAccess(reg.id, 'admin-1')
    expect(syncContactSubscribe).not.toHaveBeenCalled()
  })

  it('сбой Resend-синка не роняет выдачу — доступ всё равно granted', async () => {
    setup(reg, null, { subscribed: true })
    vi.mocked(syncContactSubscribe).mockRejectedValueOnce(new Error('resend down'))
    const result = await grantAccess(reg.id, 'admin-1')
    expect(result.status).toBe('granted')
  })
})
