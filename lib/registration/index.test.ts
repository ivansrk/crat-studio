import { describe, it, expect } from 'vitest'
import { normalizeRegistration, isUniqueViolation } from './index'

describe('normalizeRegistration', () => {
  it('trim+lowercase email (REG-08), trim полей', () => {
    const r = normalizeRegistration({ firstName: ' Иван ', lastName: 'С', email: ' A@B.C ', phone: '', telegram: ' @iv ', dataConsent: true, newsletterConsent: false })
    expect(r).toEqual({ firstName: 'Иван', lastName: 'С', email: 'a@b.c', phone: null, telegram: '@iv', dataConsent: true, newsletterConsent: false })
  })
  it('без обязательных полей или без согласия на ПД → null (REG-06)', () => {
    expect(normalizeRegistration({ firstName: '', lastName: 'x', email: 'a@b.c', phone: null, telegram: null, dataConsent: true, newsletterConsent: false })).toBeNull()
    expect(normalizeRegistration({ firstName: 'a', lastName: 'x', email: 'нет-собаки', phone: null, telegram: null, dataConsent: true, newsletterConsent: false })).toBeNull()
    expect(normalizeRegistration({ firstName: 'a', lastName: 'x', email: 'a@b.c', phone: null, telegram: null, dataConsent: false, newsletterConsent: true })).toBeNull()
  })
})

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
