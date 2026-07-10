'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { currentUser } from '@/lib/auth/current-user'
import { hasCourseAccess } from '@/lib/progress/access'
import { startAttempt, setPractice } from '@/lib/progress'
import { getCourse, getLesson } from '@/lib/content'
import { db } from '@/lib/db'

/** Ф7в T3 (MC-04/07): courseSlug приходит из formData (hidden input на странице), но
 *  ЗДЕСЬ перепроверяется — курс существует и опубликован, доступ есть — форма не источник
 *  истины (не доверять форме). */
async function requireStudent(courseSlug: string) {
  const user = await currentUser()
  const course = getCourse(courseSlug)
  if (!user || !course?.published || !(await hasCourseAccess(user, courseSlug))) redirect('/login')
  return user
}

/** Кнопка «Завершить урок» (LES-01, D-019): создаёт попытку и ведёт в квиз-шаг. */
export async function startQuizAction(formData: FormData) {
  const courseSlug = String(formData.get('courseSlug'))
  const user = await requireStudent(courseSlug)
  const lessonId = String(formData.get('lessonId'))
  const attempt = await startAttempt(user.id, courseSlug, lessonId)
  redirect(`/app/${courseSlug}/lessons/${lessonId}/quiz?attempt=${attempt.id}`)
}

export async function togglePracticeAction(formData: FormData) {
  const courseSlug = String(formData.get('courseSlug'))
  const user = await requireStudent(courseSlug)
  const lessonId = String(formData.get('lessonId'))
  await setPractice(user.id, courseSlug, lessonId, formData.get('done') === 'on')
  revalidatePath(`/app/${courseSlug}/lessons/${lessonId}`)
}

/** LES-14/CAB-02: личная миссия — редактируема из урока с mission_prompt и кабинета.
 *  mission_prompt — контент-флаг, урок может быть любым → returnTo валидируется по форме,
 *  а не по хардкоду 1.1 (против open redirect: только /app, курсовой кабинет или существующий
 *  урок ЭТОГО courseSlug — Ф7в T3). */
export async function saveMissionAction(formData: FormData) {
  const courseSlug = String(formData.get('courseSlug'))
  const user = await requireStudent(courseSlug)
  const mission = String(formData.get('mission') ?? '').trim().slice(0, 2000)
  await db.user.update({ where: { id: user.id }, data: { mission: mission || null } })
  const returnTo = String(formData.get('returnTo') ?? '/app')
  const LESSONS = `/app/${courseSlug}/lessons/`
  const ok = returnTo === '/app' || returnTo === `/app/${courseSlug}`
    || (returnTo.startsWith(LESSONS) && !!getLesson(courseSlug, returnTo.slice(LESSONS.length)))
  redirect(ok ? returnTo : '/app')
}
