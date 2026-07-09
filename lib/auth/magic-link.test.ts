import { describe, it, expect } from 'vitest'
import { newToken, hashToken, MAGIC_TTL_MS } from './magic-link'

describe('magic link token', () => {
  it('токен 64 hex-символа, хэш детерминирован и не равен токену (D-009)', () => {
    const t1 = newToken()
    expect(t1).toMatch(/^[0-9a-f]{64}$/)
    expect(newToken()).not.toBe(t1)
    expect(hashToken(t1)).toBe(hashToken(t1))
    expect(hashToken(t1)).not.toBe(t1)
  })
  it('TTL = 15 минут (AUTH-03)', () => {
    expect(MAGIC_TTL_MS).toBe(15 * 60 * 1000)
  })
})
