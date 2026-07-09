import { describe, it, expect } from 'vitest'
import { extractText } from './t1'
import type { ContentBlock } from '@anthropic-ai/sdk/resources/messages'

describe('extractText', () => {
  it('text вперемешку с tool_use → только text-блоки, склеенные через \\n', () => {
    const content = [
      { type: 'text', text: 'Хорошее начало.' },
      { type: 'tool_use', id: 'toolu_1', name: 'noop', input: {} },
      { type: 'text', text: 'А вот и уточнение.' },
    ] as unknown as ContentBlock[]
    expect(extractText(content)).toBe('Хорошее начало.\nА вот и уточнение.')
  })

  it('пустой ответ (нет text-блоков) → пустая строка', () => {
    const content = [
      { type: 'tool_use', id: 'toolu_1', name: 'noop', input: {} },
    ] as unknown as ContentBlock[]
    expect(extractText(content)).toBe('')
  })
})
