import Anthropic from '@anthropic-ai/sdk'
import type { ContentBlock } from '@anthropic-ai/sdk/resources/messages'
import { tryConsume } from './limits'

const MODEL = 'claude-sonnet-5' // основная модель; смена — здесь
const MAX_TOKENS = 1000 // TRN-03

const SYSTEM = `Ты — тренажёр «Собери запрос» курса CRAT studio для взрослых без технической подготовки.
Студент присылает черновик запроса к нейросети. Твоя задача: (1) коротко скажи, что в запросе уже хорошо;
(2) задай 1–2 уточняющих вопроса ИЛИ предложи улучшенную версию запроса с объяснением, что изменилось и почему.
Пиши по-русски, тепло и уважительно, без техножаргона, без «это просто». Максимум ~150 слов.` // черновик до спек course-factory

export type T1Result = { ok: true; reply: string } | { ok: false; reason: 'daily' | 'minute' | 'error' }

/** Оставляет только text-блоки ответа и склеивает их. Отдельная чистая функция ради юнит-теста —
 *  сам SDK-вызов askT1 не тестируем (сеть/деньги). */
export function extractText(content: ContentBlock[]): string {
  return content
    .filter((b): b is Extract<ContentBlock, { type: 'text' }> => b.type === 'text')
    .map(b => b.text)
    .join('\n')
    .trim()
}

/** TRN-02: ключ только на сервере; вызывается ТОЛЬКО после проверки enrollment (action). */
export async function askT1(userId: string, userText: string): Promise<T1Result> {
  const limit = await tryConsume(userId, 't1')
  if (limit !== 'ok') return { ok: false, reason: limit }
  try {
    const client = new Anthropic() // ANTHROPIC_API_KEY из env
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM,
      messages: [{ role: 'user', content: userText.slice(0, 2000) }],
    })
    const reply = extractText(msg.content)
    return reply ? { ok: true, reply } : { ok: false, reason: 'error' }
  } catch (e) {
    console.error('[t1] Anthropic error:', e)
    return { ok: false, reason: 'error' } // TRN-04: мягко, без технических деталей
  }
}
