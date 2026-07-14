import { describe, it, expect, vi, beforeEach } from 'vitest'
import { T3_TASKS } from './t3-tasks'

const tryConsumeMock = vi.fn()
vi.mock('./limits', () => ({ tryConsume: (...args: unknown[]) => tryConsumeMock(...args) }))

const createMock = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function AnthropicMock() {
    return { messages: { create: createMock } }
  }),
}))

const { evaluateT3 } = await import('./t3')

beforeEach(() => {
  tryConsumeMock.mockReset()
  createMock.mockReset()
})

describe('evaluateT3', () => {
  it('неизвестный taskId → error-результат без tryConsume и без вызова Anthropic (испорченная форма, не тратим лимит)', async () => {
    const result = await evaluateT3('user-1', 'no-such-task', 'Тут была ошибка')
    expect(result).toEqual({ ok: false, reason: 'error' })
    expect(tryConsumeMock).not.toHaveBeenCalled()
    expect(createMock).not.toHaveBeenCalled()
  })

  it('лимит дня исчерпан → error-результат без вызова Anthropic (TRN-09/D-042: tryConsume per-trainer t3)', async () => {
    tryConsumeMock.mockResolvedValue('daily')
    const taskId = T3_TASKS[0].id
    const result = await evaluateT3('user-1', taskId, 'Мне показалось, что тут ошибка')
    expect(result).toEqual({ ok: false, reason: 'daily' })
    expect(tryConsumeMock).toHaveBeenCalledWith('user-1', 't3')
    expect(createMock).not.toHaveBeenCalled()
  })

  it('минутный лимит исчерпан → error-результат', async () => {
    tryConsumeMock.mockResolvedValue('minute')
    const result = await evaluateT3('user-1', T3_TASKS[0].id, 'Ответ студента')
    expect(result).toEqual({ ok: false, reason: 'minute' })
    expect(createMock).not.toHaveBeenCalled()
  })

  it('успешный вызов: system содержит текст задания и заложенные ошибки, ответ студента идёт user-сообщением, thinking disabled, max_tokens 1000', async () => {
    tryConsumeMock.mockResolvedValue('ok')
    createMock.mockResolvedValue({ content: [{ type: 'text', text: 'Вердикт: нашли частично.' }] })

    const task = T3_TASKS[0]
    const result = await evaluateT3('user-1', task.id, 'Мне показалось подозрительным про антибиотики')

    expect(result).toEqual({ ok: true, reply: 'Вердикт: нашли частично.' })
    expect(createMock).toHaveBeenCalledTimes(1)
    const call = createMock.mock.calls[0][0]
    expect(call.thinking).toEqual({ type: 'disabled' })
    expect(call.max_tokens).toBe(1000)
    expect(call.system).toContain(task.text)
    for (const err of task.errors) {
      expect(call.system).toContain(err.what)
      expect(call.system).toContain(err.truth)
    }
    expect(call.messages).toEqual([
      { role: 'user', content: 'Мне показалось подозрительным про антибиотики' },
    ])
  })

  it('пустой ответ модели (нет text-блоков) → error', async () => {
    tryConsumeMock.mockResolvedValue('ok')
    createMock.mockResolvedValue({ content: [{ type: 'tool_use', id: 'x', name: 'noop', input: {} }] })
    const result = await evaluateT3('user-1', T3_TASKS[0].id, 'Ответ')
    expect(result).toEqual({ ok: false, reason: 'error' })
  })

  it('исключение Anthropic-клиента → мягкий error, без деталей наружу (TRN-04)', async () => {
    tryConsumeMock.mockResolvedValue('ok')
    createMock.mockRejectedValue(new Error('network down'))
    const result = await evaluateT3('user-1', T3_TASKS[0].id, 'Ответ')
    expect(result).toEqual({ ok: false, reason: 'error' })
  })
})
