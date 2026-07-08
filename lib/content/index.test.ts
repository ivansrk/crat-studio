import { describe, it, expect } from 'vitest'
import { getContent, contentErrors } from './index'

describe('контент репозитория', () => {
  it('12 уроков из content/ai-basics валидны', () => {
    expect(contentErrors()).toEqual([])
    expect(getContent().lessons.size).toBe(12)
  })
  it('getContent кэширует результат на процесс', () => {
    expect(getContent()).toBe(getContent())
  })
})
