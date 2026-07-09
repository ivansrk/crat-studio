import { describe, it, expect } from 'vitest'
import { isStaleQueued, STALE_QUEUED_MS } from './resend-email'

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
