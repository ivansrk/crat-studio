import { describe, it, expect } from 'vitest'
import { formatCertNumber, certYearWarsaw } from './number'

describe('cert number', () => {
  it('формат CRAT-{год}-{NNNN} с паддингом (CERT-03)', () => {
    expect(formatCertNumber(2026, 1)).toBe('CRAT-2026-0001')
    expect(formatCertNumber(2026, 1234)).toBe('CRAT-2026-1234')
    expect(formatCertNumber(2027, 12345)).toBe('CRAT-2027-12345') // >9999 не ломается
  })
  it('год по Europe/Warsaw (UX-08): 31 декабря 23:30 UTC = 1 января Warsaw', () => {
    expect(certYearWarsaw(new Date('2026-12-31T23:30:00Z'))).toBe(2027)
    expect(certYearWarsaw(new Date('2026-06-15T12:00:00Z'))).toBe(2026)
  })
})
