import { describe, it, expect } from 'vitest'
import { generatePassword, hashPassword, verifyPassword } from './password'

describe('generatePassword (D-033)', () => {
  it('≥12 символов, читаемый, без неоднозначных', () => {
    const p = generatePassword()
    expect(p.replace(/-/g, '').length).toBeGreaterThanOrEqual(12)
    expect(p).toMatch(/^[a-hj-km-np-z2-9]{4}-[a-hj-km-np-z2-9]{4}-[a-hj-km-np-z2-9]{4}$/)
  })
  it('уникален', () => expect(generatePassword()).not.toBe(generatePassword()))
})

describe('hashPassword / verifyPassword (D-032)', () => {
  it('round-trip: verifyPassword(raw) после hashPassword(raw) === true, для другого пароля === false', async () => {
    const raw = generatePassword()
    const hash = await hashPassword(raw)
    expect(await verifyPassword(raw, hash)).toBe(true)
    expect(await verifyPassword(generatePassword(), hash)).toBe(false)
  })
})
