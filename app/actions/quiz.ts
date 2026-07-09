'use server'
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth/current-user'
import { hasCourseAccess } from '@/lib/progress/access'
import { recordAnswer } from '@/lib/progress'

/** Ответ на вопрос квиз-шага (LES-07): каждый клик по варианту — отдельный POST.
 *  Идемпотентный повтор (двойной клик, ревью T2) тоже возвращает ok — студент видит то же
 *  пояснение обычным redirect'ом. Реальный сбой (чужая/завершённая попытка, out-of-order) → назад к уроку. */
export async function answerAction(formData: FormData) {
  const user = await currentUser()
  if (!user || !(await hasCourseAccess(user))) redirect('/login')
  const lessonId = String(formData.get('lessonId'))
  const attemptId = String(formData.get('attemptId'))
  const questionIndex = Number(formData.get('questionIndex'))
  const chosen = Number(formData.get('chosen'))
  const r = await recordAnswer(user.id, lessonId, attemptId, questionIndex, chosen)
  if (!r.ok) redirect(`/app/lessons/${lessonId}`) // чужая/завершённая попытка → назад к уроку (новая начнётся кнопкой)
  redirect(`/app/lessons/${lessonId}/quiz?attempt=${attemptId}&feedback=${questionIndex}`)
}
