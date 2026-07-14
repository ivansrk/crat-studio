import Anthropic from '@anthropic-ai/sdk'
import { tryConsume } from './limits'
import { extractText } from './t1'
import { T3_TASKS, type T3Task } from './t3-tasks'

const MODEL = 'claude-sonnet-5' // основная модель; смена — здесь (совпадает с t1/t2)
const MAX_TOKENS = 1000 // TRN-03/TRN-09

/** Собирает системный промпт под конкретное задание: текст с заложенными ошибками + сами ошибки
 *  (what/truth), чтобы модель судила по смыслу ответа студента, а не по дословному совпадению
 *  формулировок. Ответ студента идёт отдельным user-сообщением (как в askT1/askT2Initial), не
 *  склеен в системный текст — тот же паттерн передачи контекста, что и в остальных тренажёрах;
 *  errors[].truth/howToCheck попадают студенту только внутри готового вердикта модели, никогда
 *  напрямую (см. app/app/trainers/t3 — клиенту передаётся только id/topic/text задания). */
function buildSystem(task: T3Task): string {
  const errorsList = task.errors
    .map((e, i) => `${i + 1}. Что неверно: ${e.what}\n   Как на самом деле: ${e.truth}`)
    .join('\n')
  return `Ты — проверяющий тренажёра «Найди ошибку» курса CRAT studio для взрослых без технической подготовки.
Студенту показали короткий текст «от ИИ» с заложенными фактическими ошибками:
"""
${task.text}
"""
Заложенные ошибки:
${errorsList}

Студент своими словами написал, что показалось ему неверным в этом тексте (следующим сообщением).
Оцени по каждой заложенной ошибке отдельно — нашёл ли её студент, даже если сформулировал не так
дословно, как выше (важен смысл, а не точное совпадение слов): «нашёл», «нашёл частично» или
«не нашёл». По каждой ошибке дай короткий разбор: как на самом деле и как это можно проверить
самостоятельно (howToCheck из описания ошибки). Пиши по-русски, тепло и по существу, без
снисходительности и без «это же очевидно». Максимум ~200 слов.` // [текст на согласование]
}

export type T3Result = { ok: true; reply: string } | { ok: false; reason: 'daily' | 'minute' | 'error' }

/** TRN-09: студент прошёл задание T3 «Найди ошибку» (taskId — id из фиксированного пула
 *  lib/trainers/t3-tasks; позиция ротации живёт в query-параметре страницы, не в БД — D-042) и
 *  написал, что показалось ему неверным. Один вызов = одна единица дневного/минутного лимита t3
 *  (per-trainer, как t1/t2 — D-042, свой независимый счётчик TrainerUsage).
 *  TRN-02: ключ только на сервере; вызывается ТОЛЬКО после проверки enrollment (action). */
export async function evaluateT3(userId: string, taskId: string, studentAnswer: string): Promise<T3Result> {
  const task = T3_TASKS.find(t => t.id === taskId)
  if (!task) return { ok: false, reason: 'error' } // испорченный/чужой taskId из формы — не тратим лимит на мусор

  const limit = await tryConsume(userId, 't3')
  if (limit !== 'ok') return { ok: false, reason: limit }
  try {
    const client = new Anthropic() // ANTHROPIC_API_KEY из env
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: buildSystem(task),
      // Sonnet 5: без явного disabled включается adaptive thinking и ест max_tokens — держим
      // выключенным, короткий тренажёрный вердикт рассуждений не требует (как в t1/t2).
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: studentAnswer.slice(0, 2000) }],
    })
    const reply = extractText(msg.content)
    return reply ? { ok: true, reply } : { ok: false, reason: 'error' }
  } catch (e) {
    console.error('[t3] Anthropic error:', e)
    return { ok: false, reason: 'error' } // TRN-04: мягко, без технических деталей
  }
}
