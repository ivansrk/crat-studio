import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { createMock, updateMock, removeMock, userUpdateMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  updateMock: vi.fn(),
  removeMock: vi.fn(),
  userUpdateMock: vi.fn(),
}))

// Резенд конструируется через `new Resend(...)` в модуле — implementation мока должен быть
// обычной function, не arrow (arrow нельзя вызвать через `new`, vitest иначе кидает
// "is not a constructor" при Reflect.construct внутри мок-обёртки).
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function ResendMock() {
    return { contacts: { create: createMock, update: updateMock, remove: removeMock } }
  }),
}))

vi.mock('@/lib/db', () => ({
  db: { user: { update: userUpdateMock } },
}))

import { syncContactSubscribe, syncContactUnsubscribe, syncContactDelete } from './index'

const AUD = 'aud-123'
const user = { id: 'u-1', email: 'a@b.c', firstName: 'Иван', lastName: 'Петров', resendContactId: null as string | null }

beforeEach(() => {
  createMock.mockReset()
  updateMock.mockReset()
  removeMock.mockReset()
  userUpdateMock.mockReset().mockResolvedValue({})
  delete process.env.RESEND_AUDIENCE_ID
})

afterEach(() => {
  delete process.env.RESEND_AUDIENCE_ID
})

describe('RESEND_AUDIENCE_ID не задан (CRM-06) — синк выключен, платформа работает', () => {
  it('subscribe/unsubscribe/delete → skipped, Resend и БД не трогаются, лог-предупреждение', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    return Promise.all([
      expect(syncContactSubscribe(user)).resolves.toBe('skipped'),
      expect(syncContactUnsubscribe(user)).resolves.toBe('skipped'),
      expect(syncContactDelete(user)).resolves.toBe('skipped'),
    ]).then(() => {
      expect(createMock).not.toHaveBeenCalled()
      expect(updateMock).not.toHaveBeenCalled()
      expect(removeMock).not.toHaveBeenCalled()
      expect(userUpdateMock).not.toHaveBeenCalled()
      expect(warn).toHaveBeenCalledTimes(3)
      warn.mockRestore()
    })
  })
})

describe('syncContactSubscribe (CRM-04)', () => {
  beforeEach(() => { process.env.RESEND_AUDIENCE_ID = AUD })

  it('создаёт контакт в Audience, пишет resendContactId, сбрасывает resendSyncError', async () => {
    createMock.mockResolvedValue({ data: { id: 'contact-1' }, error: null })

    const result = await syncContactSubscribe(user)

    expect(result).toBe('synced')
    expect(createMock).toHaveBeenCalledWith({
      audienceId: AUD, email: user.email, firstName: 'Иван', lastName: 'Петров', unsubscribed: false,
    })
    expect(updateMock).not.toHaveBeenCalled()
    expect(userUpdateMock).toHaveBeenCalledWith({ where: { id: 'u-1' }, data: { resendContactId: 'contact-1', resendSyncError: null } })
  })

  it('дубль (контакт уже есть в Audience) → падает в update-путь', async () => {
    createMock.mockResolvedValue({ data: null, error: { message: 'Contact already exists', statusCode: 409, name: 'validation_error' } })
    updateMock.mockResolvedValue({ data: { id: 'contact-2' }, error: null })

    const result = await syncContactSubscribe(user)

    expect(result).toBe('synced')
    expect(updateMock).toHaveBeenCalledWith({
      audienceId: AUD, email: user.email, unsubscribed: false, firstName: 'Иван', lastName: 'Петров',
    })
    expect(userUpdateMock).toHaveBeenCalledWith({ where: { id: 'u-1' }, data: { resendContactId: 'contact-2', resendSyncError: null } })
  })

  it('ошибка API (не дубль) → resendSyncError записан, функция бросает (CRM-05)', async () => {
    createMock.mockResolvedValue({ data: null, error: { message: 'internal_server_error', statusCode: 500, name: 'internal_server_error' } })

    await expect(syncContactSubscribe(user)).rejects.toThrow('internal_server_error')
    expect(userUpdateMock).toHaveBeenCalledWith({ where: { id: 'u-1' }, data: { resendSyncError: 'internal_server_error' } })
  })

  it('сетевой сбой (reject) → тоже resendSyncError записан + throw', async () => {
    createMock.mockRejectedValue(new Error('network down'))

    await expect(syncContactSubscribe(user)).rejects.toThrow('network down')
    expect(userUpdateMock).toHaveBeenCalledWith({ where: { id: 'u-1' }, data: { resendSyncError: 'network down' } })
  })

  it('запись resendSyncError сама не удалась → лог, но исходная ошибка всё равно бросается', async () => {
    createMock.mockRejectedValue(new Error('network down'))
    userUpdateMock.mockRejectedValue(new Error('db down'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(syncContactSubscribe(user)).rejects.toThrow('network down')
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('syncContactUnsubscribe (CRM-04, MAIL-06) — update unsubscribed=true, НЕ remove ([РЕШЕНИЕ АВТОРА])', () => {
  beforeEach(() => { process.env.RESEND_AUDIENCE_ID = AUD })

  it('есть resendContactId → ищет по id, не по email', async () => {
    updateMock.mockResolvedValue({ data: { id: 'c-1' }, error: null })
    const u = { ...user, resendContactId: 'c-1' }

    const result = await syncContactUnsubscribe(u)

    expect(result).toBe('synced')
    const call = updateMock.mock.calls[0][0]
    expect(call).toMatchObject({ audienceId: AUD, unsubscribed: true, id: 'c-1' })
    expect(call.email).toBeUndefined()
    expect(userUpdateMock).toHaveBeenCalledWith({ where: { id: 'u-1' }, data: { resendSyncError: null } })
  })

  it('нет resendContactId → ищет по email (fallback)', async () => {
    updateMock.mockResolvedValue({ data: { id: 'c-1' }, error: null })

    const result = await syncContactUnsubscribe(user) // resendContactId: null

    expect(result).toBe('synced')
    const call = updateMock.mock.calls[0][0]
    expect(call).toMatchObject({ audienceId: AUD, unsubscribed: true, email: user.email })
    expect(call.id).toBeUndefined()
  })

  it('сбой Resend → resendSyncError записан + throw', async () => {
    updateMock.mockResolvedValue({ data: null, error: { message: 'not_found', statusCode: 404, name: 'not_found' } })

    await expect(syncContactUnsubscribe(user)).rejects.toThrow('not_found')
    expect(userUpdateMock).toHaveBeenCalledWith({ where: { id: 'u-1' }, data: { resendSyncError: 'not_found' } })
  })
})

describe('syncContactDelete (CRM-04, ADM-10/11) — remove целиком, right to erasure', () => {
  beforeEach(() => { process.env.RESEND_AUDIENCE_ID = AUD })

  it('есть resendContactId → remove по id, не пишет resendSyncError (юзер удаляется следом)', async () => {
    removeMock.mockResolvedValue({ data: { object: 'contact', deleted: true, contact: 'c-1' }, error: null })
    const u = { ...user, resendContactId: 'c-1' }

    const result = await syncContactDelete(u)

    expect(result).toBe('synced')
    expect(removeMock).toHaveBeenCalledWith({ audienceId: AUD, id: 'c-1' })
    expect(userUpdateMock).not.toHaveBeenCalled()
  })

  it('нет resendContactId → remove по email', async () => {
    removeMock.mockResolvedValue({ data: { object: 'contact', deleted: true, contact: 'c-1' }, error: null })

    await syncContactDelete(user)

    expect(removeMock).toHaveBeenCalledWith({ audienceId: AUD, email: user.email })
  })

  it('сбой Resend → бросает (вызывающий gdpr.ts просто логирует, БД-удаление не блокируется)', async () => {
    removeMock.mockResolvedValue({ data: null, error: { message: 'internal_server_error', statusCode: 500, name: 'internal_server_error' } })

    await expect(syncContactDelete(user)).rejects.toThrow('internal_server_error')
    expect(userUpdateMock).not.toHaveBeenCalled()
  })
})
