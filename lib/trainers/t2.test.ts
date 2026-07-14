import { describe, it, expect, vi, beforeEach } from 'vitest'

const tryConsumeMock = vi.fn()
vi.mock('./limits', () => ({ tryConsume: (...args: unknown[]) => tryConsumeMock(...args) }))

const createMock = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function AnthropicMock() {
    return { messages: { create: createMock } }
  }),
}))

const { askT2Initial, askT2Refine } = await import('./t2')

beforeEach(() => {
  tryConsumeMock.mockReset()
  createMock.mockReset()
})

describe('askT2Initial', () => {
  it('лимит дня исчерпан → error-результат без вызова Anthropic (TRN-08/D-042: tryConsume per-trainer)', async () => {
    tryConsumeMock.mockResolvedValue('daily')
    const result = await askT2Initial('user-1', 'Напиши письмо клиенту')
    expect(result).toEqual({ ok: false, reason: 'daily' })
    expect(tryConsumeMock).toHaveBeenCalledWith('user-1', 't2')
    expect(createMock).not.toHaveBeenCalled()
  })

  it('минутный лимит исчерпан → error-результат', async () => {
    tryConsumeMock.mockResolvedValue('minute')
    const result = await askT2Initial('user-1', 'Напиши письмо клиенту')
    expect(result).toEqual({ ok: false, reason: 'minute' })
    expect(createMock).not.toHaveBeenCalled()
  })

  it('успешный вызов: краткий обобщённый первый ответ, thinking disabled, max_tokens 1000', async () => {
    tryConsumeMock.mockResolvedValue('ok')
    createMock.mockResolvedValue({ content: [{ type: 'text', text: 'Обобщённый ответ.' }] })

    const result = await askT2Initial('user-1', 'Напиши письмо клиенту')

    expect(result).toEqual({ ok: true, reply: 'Обобщённый ответ.' })
    expect(createMock).toHaveBeenCalledTimes(1)
    const call = createMock.mock.calls[0][0]
    expect(call.thinking).toEqual({ type: 'disabled' })
    expect(call.max_tokens).toBe(1000)
    expect(call.system).toContain('КРАТКО')
    expect(call.messages).toEqual([{ role: 'user', content: 'Напиши письмо клиенту' }])
  })

  it('пустой ответ модели (нет text-блоков) → error', async () => {
    tryConsumeMock.mockResolvedValue('ok')
    createMock.mockResolvedValue({ content: [{ type: 'tool_use', id: 'x', name: 'noop', input: {} }] })
    const result = await askT2Initial('user-1', 'Промпт')
    expect(result).toEqual({ ok: false, reason: 'error' })
  })

  it('исключение Anthropic-клиента → мягкий error, без деталей наружу (TRN-04)', async () => {
    tryConsumeMock.mockResolvedValue('ok')
    createMock.mockRejectedValue(new Error('network down'))
    const result = await askT2Initial('user-1', 'Промпт')
    expect(result).toEqual({ ok: false, reason: 'error' })
  })
})

describe('askT2Refine', () => {
  it('лимит дня исчерпан → error-результат без вызова Anthropic', async () => {
    tryConsumeMock.mockResolvedValue('daily')
    const result = await askT2Refine('user-1', 'Промпт', 'Первый ответ', 'Уточнение')
    expect(result).toEqual({ ok: false, reason: 'daily' })
    expect(createMock).not.toHaveBeenCalled()
  })

  it('успешный вызов: передаёт prompt/firstAnswer/followUp как историю диалога, system требует раздел «Разбор»', async () => {
    tryConsumeMock.mockResolvedValue('ok')
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: 'Уточнённый ответ.\n\nРазбор: что изменило ваше уточнение\nПояснение.' }],
    })

    const result = await askT2Refine('user-1', 'Промпт', 'Первый ответ', 'Уточнение')

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect(result.reply).toContain('Разбор: что изменило ваше уточнение')

    const call = createMock.mock.calls[0][0]
    expect(call.thinking).toEqual({ type: 'disabled' })
    expect(call.max_tokens).toBe(1000)
    expect(call.system).toContain('Разбор: что изменило ваше уточнение')
    expect(call.messages).toEqual([
      { role: 'user', content: 'Промпт' },
      { role: 'assistant', content: 'Первый ответ' },
      { role: 'user', content: 'Уточнение' },
    ])
  })

  it('пустой ответ модели → error', async () => {
    tryConsumeMock.mockResolvedValue('ok')
    createMock.mockResolvedValue({ content: [] })
    const result = await askT2Refine('user-1', 'Промпт', 'Первый ответ', 'Уточнение')
    expect(result).toEqual({ ok: false, reason: 'error' })
  })
})
