import { describe, it, expect } from 'vitest'
import { pickDueDeferred, type DeferredRow } from './deferred'

const row = (id: string, lessonId: string, dueAt: Date, answeredAt: Date | null = null, courseSlug = 'ai-basics'): DeferredRow => ({
  id, courseSlug, lessonId, dueAt, answeredAt,
})

const now = new Date('2026-07-09T12:00:00Z')

describe('pickDueDeferred', () => {
  it('пустой список → null', () => {
    expect(pickDueDeferred([], now)).toBeNull()
  })
  it('несданные с dueAt в будущем → null', () => {
    const rows = [row('1', 'l1', new Date('2026-07-10T00:00:00Z'))]
    expect(pickDueDeferred(rows, now)).toBeNull()
  })
  it('два просроченных → самый давний', () => {
    const older = row('1', 'l1', new Date('2026-07-01T00:00:00Z'))
    const newer = row('2', 'l2', new Date('2026-07-05T00:00:00Z'))
    expect(pickDueDeferred([newer, older], now)).toBe(older)
  })
  it('равные dueAt → тай-брейк по id (меньший побеждает), независимо от порядка входа', () => {
    const dueAt = new Date('2026-07-01T00:00:00Z')
    const a = row('a', 'l1', dueAt)
    const b = row('b', 'l2', dueAt)
    expect(pickDueDeferred([a, b], now)).toBe(a)
    expect(pickDueDeferred([b, a], now)).toBe(a)
  })
  it('сданные (answeredAt) игнорируются', () => {
    const answered = row('1', 'l1', new Date('2026-07-01T00:00:00Z'), new Date('2026-07-02T00:00:00Z'))
    const due = row('2', 'l2', new Date('2026-07-03T00:00:00Z'))
    expect(pickDueDeferred([answered, due], now)).toBe(due)
  })
})
