'use server'
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth/current-user'
import { hasCourseAccess } from '@/lib/progress/access'
import { saveDraft, submitProject } from '@/lib/project'
import { PROJECT_FIELDS } from '@/lib/project/fields'

async function requireStudent() {
  const user = await currentUser()
  if (!user || !(await hasCourseAccess(user, 'ai-basics'))) redirect('/login') // Ф7в T3: из маршрута
  return user
}

/** Собирает черновик из formData по PROJECT_FIELDS — контракт saveDraft (lib/project)
 *  ожидает все 7 ключей на каждый вызов (форма всегда шлёт все поля, см. T5-план). */
function draftFromForm(formData: FormData): Record<string, unknown> {
  return Object.fromEntries(PROJECT_FIELDS.map(f => [f, formData.get(f)]))
}

/** PROJ-02: «Сохранить черновик» — не блокирует незаполненные поля. */
export async function saveDraftAction(formData: FormData) {
  const user = await requireStudent()
  const result = await saveDraft(user.id, 'ai-basics', draftFromForm(formData)) // Ф7в T3: из маршрута
  redirect(`/app/project?project=${result === 'saved' ? 'saved' : 'locked'}`)
}

/** PROJ-01/03: «Отправить на проверку» — сначала сохраняет текущее состояние формы черновиком
 *  (иначе последние правки перед отправкой потерялись бы), затем пробует перевести в SUBMITTED. */
export async function submitProjectAction(formData: FormData) {
  const user = await requireStudent()
  const saveResult = await saveDraft(user.id, 'ai-basics', draftFromForm(formData)) // Ф7в T3: из маршрута
  if (saveResult === 'locked') redirect('/app/project?project=locked')
  const result = await submitProject(user.id, 'ai-basics') // Ф7в T3: из маршрута
  redirect(`/app/project?project=${result}`)
}
