import { describe, it, expect } from 'vitest'
import { plural } from './plural'

const modules = ['модуль', 'модуля', 'модулей'] as const

describe('plural (русская плюрализация)', () => {
  it('форма «один» для 1, 21, 101 (но не 11)', () => {
    expect(plural(1, modules)).toBe('модуль')
    expect(plural(21, modules)).toBe('модуль')
    expect(plural(101, modules)).toBe('модуль')
  })
  it('форма «немного» для 2–4, 22–24 (но не 12–14)', () => {
    expect(plural(2, modules)).toBe('модуля')
    expect(plural(4, modules)).toBe('модуля')
    expect(plural(23, modules)).toBe('модуля')
  })
  it('форма «много» для 0, 5–20, 11–14, 25', () => {
    expect(plural(0, modules)).toBe('модулей')
    expect(plural(5, modules)).toBe('модулей')
    expect(plural(11, modules)).toBe('модулей')
    expect(plural(12, modules)).toBe('модулей')
    expect(plural(14, modules)).toBe('модулей')
    expect(plural(25, modules)).toBe('модулей')
  })
  it('реальные факты курса ai-basics: 4 модуля / 12 уроков / 72 часа', () => {
    expect(`4 ${plural(4, ['модуль', 'модуля', 'модулей'])}`).toBe('4 модуля')
    expect(`12 ${plural(12, ['урок', 'урока', 'уроков'])}`).toBe('12 уроков')
    expect(`72 ${plural(72, ['час', 'часа', 'часов'])}`).toBe('72 часа')
  })
})
