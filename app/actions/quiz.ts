'use server'
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth/current-user'
import { hasCourseAccess } from '@/lib/progress/access'
import { getCourse } from '@/lib/content'
import { recordAnswer } from '@/lib/progress'

/** Ответ на вопрос квиз-шага (LES-07): каждый клик по варианту — отдельный POST.
 *  Идемпотентный повтор (двойной клик, ревью T2) тоже возвращает ok — студент видит то же
 *  пояснение обычным redirect'ом. Реальный сбой (чужая/завершённая попытка, out-of-order) → назад к уроку.
 *  Ф7в T3 (MC-04/07): courseSlug — из hidden input формы, но перепроверяется здесь
 *  (существует+опубликован+доступ) — форма не источник истины. */
export async function answerAction(formData: FormData) {
  const courseSlug = String(formData.get('courseSlug'))
  const user = await currentUser()
  const course = getCourse(courseSlug)
  if (!user || !course?.published || !(await hasCourseAccess(user, courseSlug))) redirect('/login')
  const lessonId = String(formData.get('lessonId'))
  const attemptId = String(formData.get('attemptId'))
  const questionIndex = Number(formData.get('questionIndex'))
  const chosen = Number(formData.get('chosen'))
  const r = await recordAnswer(user.id, courseSlug, lessonId, attemptId, questionIndex, chosen)
  if (!r.ok) redirect(`/app/${courseSlug}/lessons/${lessonId}`) // чужая/завершённая попытка → назад к уроку (новая начнётся кнопкой)
  redirect(`/app/${courseSlug}/lessons/${lessonId}/quiz?attempt=${attemptId}&feedback=${questionIndex}`)
}
