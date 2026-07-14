import { describe, it, expect } from 'vitest'
import { T3_TASKS } from './t3-tasks'

describe('T3_TASKS (TRN-09: пул фиксирован в коде, не генерируется моделью)', () => {
  it('в пуле 6 заданий', () => {
    expect(T3_TASKS.length).toBe(6)
  })

  it('id уникальны', () => {
    const ids = T3_TASKS.map(t => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('у каждого задания непустые id/topic/text и хотя бы одна заложенная ошибка', () => {
    for (const task of T3_TASKS) {
      expect(task.id.trim().length).toBeGreaterThan(0)
      expect(task.topic.trim().length).toBeGreaterThan(0)
      expect(task.text.trim().length).toBeGreaterThan(0)
      expect(task.errors.length).toBeGreaterThanOrEqual(1)
      expect(task.errors.length).toBeLessThanOrEqual(2) // спека TRN-09: 1–2 заложенные ошибки
    }
  })

  it('у каждой заложенной ошибки непустые what/truth/howToCheck', () => {
    for (const task of T3_TASKS) {
      for (const err of task.errors) {
        expect(err.what.trim().length).toBeGreaterThan(0)
        expect(err.truth.trim().length).toBeGreaterThan(0)
        expect(err.howToCheck.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('текст задания — 5–8 предложений (грубая проверка по точкам/!/?, без сокращений вида «т.д.»)', () => {
    for (const task of T3_TASKS) {
      const sentences = task.text.split(/(?<=[.!?])\s+(?=[А-ЯA-Z])/).filter(s => s.trim().length > 0)
      expect(sentences.length).toBeGreaterThanOrEqual(5)
      expect(sentences.length).toBeLessThanOrEqual(8)
    }
  })
})
