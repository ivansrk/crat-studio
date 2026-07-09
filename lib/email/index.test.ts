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
})
