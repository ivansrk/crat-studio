import { describe, it, expect } from 'vitest'
import { extractH2, slugifyHeading, readingTimeMin } from './toc'

describe('slugifyHeading', () => {
  it('кириллица сохраняется, регистр вниз, пробелы/пунктуация → дефис', () => {
    expect(slugifyHeading('Признаки поддельного видео')).toBe('признаки-поддельного-видео')
    expect(slugifyHeading('Главная защита: не вглядываться, а проверять')).toBe(
      'главная-защита-не-вглядываться-а-проверять',
    )
  })
  it('края без дефисов', () => {
    expect(slugifyHeading('  …Итог!  ')).toBe('итог')
  })
})

describe('extractH2', () => {
  it('берёт только h2 (## …), не h1/h3', () => {
    const h = extractH2('# Заголовок\n\n## Раздел А\n\nтекст\n\n### Подраздел\n\n## Раздел Б')
    expect(h.map(x => x.text)).toEqual(['Раздел А', 'Раздел Б'])
    expect(h.map(x => x.slug)).toEqual(['раздел-а', 'раздел-б'])
  })
  it('inline-разметка (**bold**) снимается из текста пункта', () => {
    expect(extractH2('## Что **важно**')[0].text).toBe('Что важно')
  })
  it('дубли слагов разводятся суффиксом', () => {
    const h = extractH2('## Итог\n\n## Итог')
    expect(h.map(x => x.slug)).toEqual(['итог', 'итог-1'])
  })
})

describe('readingTimeMin', () => {
  it('≥1 минуты даже для короткого текста', () => {
    expect(readingTimeMin('пара слов')).toBe(1)
  })
  it('≈ слов / 200, теги компонентов не считаются словами', () => {
    const text = Array.from({ length: 400 }, () => 'слово').join(' ')
    expect(readingTimeMin(`<Lead>${text}</Lead>`)).toBe(2)
  })
})
