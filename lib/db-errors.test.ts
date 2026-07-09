import { describe, it, expect } from 'vitest'
import { isUniqueViolation } from './db-errors'

describe('isUniqueViolation', () => {
  it('P2002 → true, прочее → false', () => {
    expect(isUniqueViolation({ code: 'P2002' })).toBe(true)
    expect(isUniqueViolation(Object.assign(new Error('unique'), { code: 'P2002' }))).toBe(true)
    expect(isUniqueViolation({ code: 'P2025' })).toBe(false)
    expect(isUniqueViolation(new Error('x'))).toBe(false)
    expect(isUniqueViolation(null)).toBe(false)
    expect(isUniqueViolation('P2002')).toBe(false)
  })
})
