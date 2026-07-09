import { describe, it, expect } from 'vitest'
import { normalizeRegistration } from './index'

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
