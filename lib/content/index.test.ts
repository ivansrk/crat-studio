import { describe, it, expect } from 'vitest'
import { getContent, contentErrors } from './index'

describe('контент репозитория', () => {
  it.skip('12 уроков из content/ai-basics валидны', () => {
    // skip до Task 8 (контента ещё нет)
    expect(contentErrors()).toEqual([])
    expect(getContent().lessons.size).toBe(12)
  })
  it('getContent кэширует результат на процесс', () => {
    expect(getContent()).toBe(getContent())
  })
})
