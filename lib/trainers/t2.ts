import Anthropic from '@anthropic-ai/sdk'
import { tryConsume } from './limits'
import { extractText } from './t1'

const MODEL = 'claude-sonnet-5' // основная модель; смена — здесь (совпадает с t1)
const MAX_TOKENS = 1000 // TRN-03/TRN-08

const SYSTEM_INITIAL = `Ты — тренажёр «Дожми ответ» курса CRAT studio для взрослых без технической подготовки.
Студент присылает свой первый, ещё неуточнённый запрос к нейросети. Ответь на него КРАТКО (до ~150 слов)
именно так, как типичный ИИ-ассистент отвечает на неуточнённый запрос: корректно, но обобщённо, без
дополнительных уточняющих вопросов с твоей стороны — студент должен увидеть характерный «средний»
ответ и сам захотеть его уточнить. Пиши по-русски, по существу, без техножаргона.` // [текст на согласование]

const SYSTEM_REFINE = `Ты — тренажёр «Дожми ответ» курса CRAT studio для взрослых без технической подготовки.
Студент уже получил твой первый обобщённый ответ и теперь прислал уточнение. Ответь заново с учётом
уточнения — конкретнее и полезнее первого ответа (до ~150 слов). После ответа ОБЯЗАТЕЛЬНО добавь раздел
с заголовком ровно "Разбор: что изменило ваше уточнение" и 2–3 предложениями объясни, какая именно деталь
уточнения повлияла на ответ и почему. Пиши по-русски, тепло и по существу, без техножаргона.` // [текст на согласование]

export type T2Result = { ok: true; reply: string } | { ok: false; reason: 'daily' | 'minute' | 'error' }

/** TRN-08 первый вызов: краткий обобщённый ответ на неуточнённый промпт студента.
 *  TRN-02: ключ только на сервере; вызывается ТОЛЬКО после проверки enrollment (action). */
export async function askT2Initial(userId: string, prompt: string): Promise<T2Result> {
  const limit = await tryConsume(userId, 't2')
  if (limit !== 'ok') return { ok: false, reason: limit }
  try {
    const client = new Anthropic() // ANTHROPIC_API_KEY из env
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_INITIAL,
      // Sonnet 5: без явного disabled включается adaptive thinking и ест max_tokens — держим
      // выключенным, короткий тренажёрный ответ рассуждений не требует (как в t1).
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: prompt.slice(0, 2000) }],
    })
    const reply = extractText(msg.content)
    return reply ? { ok: true, reply } : { ok: false, reason: 'error' }
  } catch (e) {
    console.error('[t2] Anthropic error (initial):', e)
    return { ok: false, reason: 'error' } // TRN-04: мягко, без технических деталей
  }
}

/** TRN-08 второй вызов: обновлённый ответ с учётом уточнения + разбор «что изменило уточнение».
 *  Диалог не персистится (D-042) — весь контекст (prompt/firstAnswer) приходит из формы. Передаём его
 *  как реальную историю messages (user → assistant → user), а не одним склеенным текстом: так модель
 *  честно видит, что первый ответ — её собственный, и разбор получается точнее. */
export async function askT2Refine(
  userId: string,
  prompt: string,
  firstAnswer: string,
  followUp: string,
): Promise<T2Result> {
  const limit = await tryConsume(userId, 't2')
  if (limit !== 'ok') return { ok: false, reason: limit }
  try {
    const client = new Anthropic() // ANTHROPIC_API_KEY из env
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_REFINE,
      thinking: { type: 'disabled' },
      messages: [
        { role: 'user', content: prompt.slice(0, 2000) },
        { role: 'assistant', content: firstAnswer.slice(0, 4000) },
        { role: 'user', content: followUp.slice(0, 2000) },
      ],
    })
    const reply = extractText(msg.content)
    return reply ? { ok: true, reply } : { ok: false, reason: 'error' }
  } catch (e) {
    console.error('[t2] Anthropic error (refine):', e)
    return { ok: false, reason: 'error' } // TRN-04: мягко, без технических деталей
  }
}
