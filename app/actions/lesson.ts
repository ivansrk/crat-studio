'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { currentUser } from '@/lib/auth/current-user'
import { hasCourseAccess } from '@/lib/progress/access'
import { startAttempt, setPractice } from '@/lib/progress'
import { getLesson } from '@/lib/content'
import { db } from '@/lib/db'

async function requireStudent() {
  const user = await currentUser()
  if (!user || !(await hasCourseAccess(user))) redirect('/login')
  return user
}

/** Кнопка «Завершить урок» (LES-01, D-019): создаёт попытку и ведёт в квиз-шаг. */
export async function startQuizAction(formData: FormData) {
  const user = await requireStudent()
  const lessonId = String(formData.get('lessonId'))
  const attempt = await startAttempt(user.id, lessonId)
  redirect(`/app/lessons/${lessonId}/quiz?attempt=${attempt.id}`)
}

export async function togglePracticeAction(formData: FormData) {
  const user = await requireStudent()
  const lessonId = String(formData.get('lessonId'))
  await setPractice(user.id, lessonId, formData.get('done') === 'on')
  revalidatePath(`/app/lessons/${lessonId}`)
}

/** LES-14/CAB-02: личная миссия — редактируема из урока с mission_prompt и кабинета.
 *  mission_prompt — контент-флаг, урок может быть любым → returnTo валидируется по форме,
 *  а не по хардкоду 1.1 (против open redirect: только /app или существующий урок). */
export async function saveMissionAction(formData: FormData) {
  const user = await requireStudent()
  const mission = String(formData.get('mission') ?? '').trim().slice(0, 2000)
  await db.user.update({ where: { id: user.id }, data: { mission: mission || null } })
  const returnTo = String(formData.get('returnTo') ?? '/app')
  const LESSONS = '/app/lessons/'
  const ok = returnTo === '/app' || (returnTo.startsWith(LESSONS) && !!getLesson(returnTo.slice(LESSONS.length)))
  redirect(ok ? returnTo : '/app')
}
