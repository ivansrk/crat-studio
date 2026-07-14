import { describe, it, expect } from 'vitest'
import { certificateHtml } from './template'

const baseOpts = {
  fullName: 'Иванова Мария Сергеевна',
  number: 'CRAT-2026-0001',
  courseTitle: 'Искусственный интеллект в профессиональной и личной деятельности',
  hours: 72,
  periodStr: '14 июля — 14 октября 2026',
  programHtml: '<h3>Модуль 1. Знакомство с ИИ</h3><ol><li>Что такое нейросеть</li></ol>',
}

describe('certificateHtml (D-044, шаблон Ивана lib/cert/certificate.html)', () => {
  it('подставляет все плейсхолдеры, включая период в {{dateStr}} (CERT-08)', () => {
    const html = certificateHtml(baseOpts)
    expect(html).toContain(baseOpts.fullName)
    expect(html).toContain(baseOpts.number)
    expect(html).toContain(baseOpts.courseTitle)
    expect(html).toContain('72')
    expect(html).toContain(baseOpts.periodStr)
    expect(html).toContain(baseOpts.programHtml)
    expect(html).not.toContain('{{')
  })

  it('экранирует ФИО от XSS (M-1) — сырой тег в разметку не попадает', () => {
    const html = certificateHtml({ ...baseOpts, fullName: '<img src=x onerror=alert(1)>' })
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })

  it('экранирует название курса от XSS так же, как ФИО', () => {
    const html = certificateHtml({ ...baseOpts, courseTitle: '<script>alert(1)</script>' })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('НЕ экранирует programHtml повторно — теги модулей/уроков остаются разметкой', () => {
    const html = certificateHtml(baseOpts)
    expect(html).toContain('<h3>Модуль 1. Знакомство с ИИ</h3>')
    expect(html).toContain('<ol><li>Что такое нейросеть</li></ol>')
  })

  it('кэш файла на процесс не ломает повторный вызов с другими данными (нет утечки между вызовами)', () => {
    const first = certificateHtml({ ...baseOpts, fullName: 'Первый Студент' })
    const second = certificateHtml({ ...baseOpts, fullName: 'Второй Студент', number: 'CRAT-2026-0002' })
    expect(first).toContain('Первый Студент')
    expect(first).not.toContain('Второй Студент')
    expect(second).toContain('Второй Студент')
    expect(second).not.toContain('Первый Студент')
    expect(second).toContain('CRAT-2026-0002')
  })
})
