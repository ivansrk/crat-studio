'use server'
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth/current-user'
import { hasCourseAccess } from '@/lib/progress/access'
import { getCourse } from '@/lib/content'
import { saveDraft, submitProject } from '@/lib/project'
import { PROJECT_FIELDS } from '@/lib/project/fields'

/** MC-04/07: courseSlug — из hidden input формы, перепроверяется здесь
 *  (существует+опубликован+доступ) — форма не источник истины. */
async function requireStudent(courseSlug: string) {
  const user = await currentUser()
  const course = getCourse(courseSlug)
  if (!user || !course?.published || !(await hasCourseAccess(user, courseSlug))) redirect('/login')
  return user
}

/** Собирает черновик из formData по PROJECT_FIELDS — контракт saveDraft (lib/project)
 *  ожидает все 7 ключей на каждый вызов (форма всегда шлёт все поля, см. T5-план). */
function draftFromForm(formData: FormData): Record<string, unknown> {
  return Object.fromEntries(PROJECT_FIELDS.map(f => [f, formData.get(f)]))
}

/** PROJ-02: «Сохранить черновик» — не блокирует незаполненные поля. */
export async function saveDraftAction(formData: FormData) {
  const courseSlug = String(formData.get('courseSlug'))
  const user = await requireStudent(courseSlug)
  const result = await saveDraft(user.id, courseSlug, draftFromForm(formData))
  redirect(`/app/${courseSlug}/project?project=${result === 'saved' ? 'saved' : 'locked'}`)
}

/** PROJ-01/03: «Отправить на проверку» — сначала сохраняет текущее состояние формы черновиком
 *  (иначе последние правки перед отправкой потерялись бы), затем пробует перевести в SUBMITTED. */
export async function submitProjectAction(formData: FormData) {
  const courseSlug = String(formData.get('courseSlug'))
  const user = await requireStudent(courseSlug)
  const saveResult = await saveDraft(user.id, courseSlug, draftFromForm(formData))
  if (saveResult === 'locked') redirect(`/app/${courseSlug}/project?project=locked`)
  const result = await submitProject(user.id, courseSlug)
  redirect(`/app/${courseSlug}/project?project=${result}`)
}
