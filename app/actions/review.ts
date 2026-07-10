'use server'
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth/current-user'
import { getDueDeferred, answerDeferred } from '@/lib/progress/deferred'
import { isValidChoice, type StoredAnswer } from '@/lib/progress/quiz-logic'

/** /app/review остаётся БЕЗ courseSlug — due-блок (F19) выбирает самый давний
 *  отложенный вопрос ПО ВСЕМ курсам студента разом (deferred.ts getDueDeferred, без фильтра
 *  курса), так что единственный courseSlug в URL не мог бы однозначно выразить, какой курс
 *  сейчас показан. hasCourseAccess('ai-basics') здесь был латентным багом мультикурса
 *  (блокировал бы студента, у которого есть due-вопрос по другому курсу, но нет enrollment
 *  на ai-basics) — убран; сам доступ к строке уже гарантирован тем, что DeferredQuizState
 *  создаётся только для уроков, пройденных с действующим enrollment. */
async function requireStudent() {
  const user = await currentUser()
  if (!user) redirect('/login')
  return user
}

/** CAB-05: сдача отложенного блока (форма /app/review). Вопросы и score считает СЕРВЕР —
 *  deferredId из формы перепроверяется против актуального getDueDeferred (та же выборка,
 *  что рендерила форму): совпадение id — защита и от подмены deferredId, и от устаревшей формы
 *  (блок уже сдан или урок сменился между открытием формы и сабмитом) — редирект в кабинет.
 *  Неполный ответ (не все q{i} пришли/невалидны) → баннер на /app/review, а не молчаливый сбой. */
export async function answerReviewAction(formData: FormData) {
  const user = await requireStudent()
  const deferredId = String(formData.get('deferredId'))

  const due = await getDueDeferred(user.id)
  if (!due || due.deferred.id !== deferredId) redirect('/app')

  const answers: StoredAnswer[] = []
  for (let i = 0; i < due.questions.length; i++) {
    const raw = formData.get(`q${i}`)
    const chosen = raw === null ? NaN : Number(raw)
    if (!isValidChoice(chosen, due.questions[i].options.length)) redirect('/app/review?error=1')
    answers.push({ questionIndex: i, chosen, correct: chosen === due.questions[i].correct })
  }

  const result = await answerDeferred(user.id, deferredId, answers)
  if (!result.ok) redirect('/app') // 'already' — двойной сабмит, блок уже сдан
  redirect(`/app/review?done=${deferredId}`)
}
