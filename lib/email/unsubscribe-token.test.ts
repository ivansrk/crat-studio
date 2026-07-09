import { describe, it, expect } from 'vitest'
import { makeUnsubToken, readUnsubToken } from './unsubscribe-token'

describe('unsubscribe token', () => {
  it('кодирует и читает email', () => {
    expect(readUnsubToken(makeUnsubToken('a@b.c', 's'), 's')).toBe('a@b.c')
  })
  it('подделка/чужой секрет → null', () => {
    const t = makeUnsubToken('a@b.c', 's')
    expect(readUnsubToken(t, 'other')).toBeNull()
    expect(readUnsubToken('xx.yy', 's')).toBeNull()
  })
})
