import { describe, it, expect, vi } from 'vitest'
import { buildPeriodStr } from './program'

describe('buildPeriodStr (CERT-08, D-044) — период = начало + 3 календарных месяца, Europe/Warsaw', () => {
  it('обычный случай в пределах одного года — год указан один раз, в конце', () => {
    expect(buildPeriodStr(new Date('2026-07-14T10:00:00Z'))).toBe('14 июля — 14 октября 2026')
  })

  it('стык лет — год указан у обеих дат', () => {
    expect(buildPeriodStr(new Date('2026-12-14T10:00:00Z'))).toBe('14 декабря 2026 — 14 марта 2027')
  })

  it('30 ноября + 3 месяца — JS Date нормализует конец месяца сам (29 февраля 2028, високосный)', () => {
    expect(buildPeriodStr(new Date('2027-11-30T10:00:00Z'))).toBe('30 ноября 2027 — 1 марта 2028')
  })

  it('31 января + 3 месяца — апрель короче 31 дня, JS Date переносит на май', () => {
    expect(buildPeriodStr(new Date('2026-01-31T10:00:00Z'))).toBe('31 января — 1 мая 2026')
  })
})

describe('buildProgramHtml (CERT-04, D-044) — программа курса из реального course.yaml', () => {
  it('ai-basics: 4 модуля, 12 уроков, HTML-структура для приложения к сертификату', async () => {
    const { buildProgramHtml } = await import('./program')
    const html = buildProgramHtml('ai-basics')
    expect((html.match(/<h3>/g) ?? []).length).toBe(4)
    expect((html.match(/<li>/g) ?? []).length).toBe(12)
    expect(html).toContain('Модуль 1. Знакомство с ИИ')
    expect(html).toContain('Что такое нейросеть')
  })

  it('неизвестный курс — пустая строка, не падает (правило 6)', async () => {
    const { buildProgramHtml } = await import('./program')
    expect(buildProgramHtml('no-such-course')).toBe('')
  })
})

describe('buildProgramHtml — экранирование заголовков модулей/уроков (XSS)', () => {
  it('escape тегов из course.yaml перед вставкой в PDF-шаблон', async () => {
    vi.resetModules()
    vi.doMock('@/lib/content', () => ({
      getCourse: (slug: string) =>
        slug === 'xss-course'
          ? {
              course: {
                modules: [
                  { id: 1, title: '<b>Модуль</b> 1', lessons: [{ id: '1.1', title: '<script>alert(1)</script>' }] },
                ],
              },
            }
          : null,
    }))
    const { buildProgramHtml } = await import('./program')
    const html = buildProgramHtml('xss-course')
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).not.toContain('<b>Модуль</b>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&lt;b&gt;Модуль&lt;/b&gt; 1')
    vi.doUnmock('@/lib/content')
    vi.resetModules()
  })
})
