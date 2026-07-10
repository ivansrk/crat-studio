import { describe, it, expect } from 'vitest'
import { normalizePhone } from './phone'

describe('normalizePhone (REG-16)', () => {
  it('снимает форматирование, оставляет ведущий + и цифры', () => {
    expect(normalizePhone('+48 601-123-456')).toBe('+48601123456')
    expect(normalizePhone('8 (999) 123 45 67')).toBe('89991234567')
  })

  it('нецифровой ввод → null', () => {
    expect(normalizePhone('abc')).toBeNull()
  })

  it('пустая строка / null / undefined → null', () => {
    expect(normalizePhone('')).toBeNull()
    expect(normalizePhone(null)).toBeNull()
    expect(normalizePhone(undefined)).toBeNull()
  })

  it('меньше 7 цифр → null (даже с ведущим +)', () => {
    expect(normalizePhone('+123456')).toBeNull()
    expect(normalizePhone('123456')).toBeNull()
  })

  it('ровно 7 цифр → валиден', () => {
    expect(normalizePhone('1234567')).toBe('1234567')
  })

  it('+ не в начале строки не считается ведущим — отбрасывается вместе с прочим мусором', () => {
    expect(normalizePhone('89991234567+')).toBe('89991234567')
  })

  it('trim пробелов по краям перед разбором', () => {
    expect(normalizePhone('  +48601123456  ')).toBe('+48601123456')
  })
})
