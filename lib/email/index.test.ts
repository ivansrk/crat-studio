import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { deliverWithRetries, RETRY_DELAYS_MS } from './index'

describe('deliverWithRetries', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('успех с первой попытки', async () => {
    const send = vi.fn().mockResolvedValue({ id: 'r1' })
    const events: string[] = []
    await deliverWithRetries(send, m => { events.push(m.status) })
    expect(send).toHaveBeenCalledTimes(1)
    expect(events).toEqual(['SENT'])
  })

  it('3 ретрая с бэкоффом 1/5/15 мин, затем FAILED (MAIL-04, D-013)', async () => {
    const send = vi.fn().mockRejectedValue(new Error('smtp down'))
    const events: string[] = []
    const done = deliverWithRetries(send, m => { events.push(`${m.status}:${m.attempts}`) })
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0])
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[1])
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[2])
    await done
    expect(send).toHaveBeenCalledTimes(4) // 1 попытка + 3 ретрая
    expect(events.at(-1)).toBe('FAILED:4')
  })

  it('успех на втором ретрае', async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error('x')).mockRejectedValueOnce(new Error('x')).mockResolvedValue({ id: 'ok' })
    const events: string[] = []
    const done = deliverWithRetries(send, m => { events.push(m.status) })
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0] + RETRY_DELAYS_MS[1])
    await done
    expect(events.at(-1)).toBe('SENT')
  })

  it('reject не-Error (строкой) → lastError сохраняет причину', async () => {
    const send = vi.fn().mockRejectedValue('boom')
    let final: { lastError?: string } | undefined
    const done = deliverWithRetries(send, m => { final = m })
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0] + RETRY_DELAYS_MS[1] + RETRY_DELAYS_MS[2])
    await done
    expect(final?.lastError).toBe('boom')
  })

  it('onFinal кинул на успехе → НЕ ретраим (нет риска дубля письма)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const send = vi.fn().mockResolvedValue({ id: 'r1' })
    const onFinal = vi.fn(() => { throw new Error('db down') })
    await deliverWithRetries(send, onFinal)
    expect(send).toHaveBeenCalledTimes(1)
    expect(onFinal).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('async-onFinal реджектнулся на успехе → без ретрая и без unhandled rejection', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const send = vi.fn().mockResolvedValue({ id: 'r1' })
    const onFinal = vi.fn(async () => { throw new Error('db down') })
    await expect(deliverWithRetries(send, onFinal)).resolves.toBeUndefined()
    expect(send).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('onFinal кинул на FAILED → промис резолвится без unhandled rejection', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const send = vi.fn().mockRejectedValue(new Error('x'))
    const onFinal = vi.fn(() => { throw new Error('db down') })
    const done = deliverWithRetries(send, onFinal)
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0] + RETRY_DELAYS_MS[1] + RETRY_DELAYS_MS[2])
    await expect(done).resolves.toBeUndefined()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
