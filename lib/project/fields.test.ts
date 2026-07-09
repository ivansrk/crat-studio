import { describe, it, expect } from 'vitest'
import { PROJECT_FIELDS, normalizeDraft, isSubmittable, type ProjectDraft } from './fields'

const full = (): Record<string, string> =>
  Object.fromEntries(PROJECT_FIELDS.map(f => [f, `${f}-значение`]))

describe('normalizeDraft', () => {
  it('обрезает пробелы по краям (trim)', () => {
    const d = normalizeDraft({ task: '  ChatGPT  ' })
    expect(d.task).toBe('ChatGPT')
  })
  it('пустая строка (в т.ч. после trim) → null', () => {
    expect(normalizeDraft({ task: '' }).task).toBeNull()
    expect(normalizeDraft({ task: '   ' }).task).toBeNull()
  })
  it('отсутствующее поле → null', () => {
    expect(normalizeDraft({}).task).toBeNull()
  })
  it('не-строковое значение → null (защита от подделанного FormData)', () => {
    expect(normalizeDraft({ task: 123 as unknown as string }).task).toBeNull()
    expect(normalizeDraft({ task: null }).task).toBeNull()
  })
  it('обрезка длинных значений до 5000 символов', () => {
    const long = 'а'.repeat(5010)
    const d = normalizeDraft({ task: long })
    expect(d.task).toHaveLength(5000)
    expect(d.task).toBe('а'.repeat(5000))
  })
  it('обрезка происходит ПОСЛЕ trim (пробелы по краям не считаются в лимит)', () => {
    const long = ' ' + 'а'.repeat(5010) + ' '
    const d = normalizeDraft({ task: long })
    expect(d.task).toHaveLength(5000)
  })
  it('нормализует все 7 полей независимо', () => {
    const d = normalizeDraft(full())
    for (const f of PROJECT_FIELDS) expect(d[f]).toBe(`${f}-значение`)
  })
  it('лишние ключи вне PROJECT_FIELDS игнорируются', () => {
    const d = normalizeDraft({ task: 'x', extra: 'y' } as Record<string, unknown>)
    expect((d as unknown as Record<string, unknown>).extra).toBeUndefined()
  })
})

describe('isSubmittable', () => {
  const empty: ProjectDraft = Object.fromEntries(PROJECT_FIELDS.map(f => [f, null])) as ProjectDraft

  it('false, когда все поля пусты', () => {
    expect(isSubmittable(empty)).toBe(false)
  })
  it('false, когда не хватает одного поля (PROJ-01)', () => {
    const d = normalizeDraft(full())
    const partial: ProjectDraft = { ...d, verified: null }
    expect(isSubmittable(partial)).toBe(false)
  })
  it('true, когда все 7 полей непустые', () => {
    const d = normalizeDraft(full())
    expect(isSubmittable(d)).toBe(true)
  })
})
