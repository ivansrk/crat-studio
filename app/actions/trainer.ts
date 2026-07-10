'use server'
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth/current-user'
import { hasCourseAccess } from '@/lib/progress/access'
import { askT1 } from '@/lib/trainers/t1'
import { t } from '@/lib/i18n'

async function requireStudent() {
  const user = await currentUser()
  if (!user || !(await hasCourseAccess(user, 'ai-basics'))) redirect('/login') // Ф7в T3: из маршрута
  return user
}

export type T1FormState = { reply?: string; message?: string }

const REASON_MESSAGE: Record<'daily' | 'minute' | 'error', string> = {
  daily: t.trainers.limitDaily,
  minute: t.trainers.limitMinute,
  error: t.trainers.error,
}

/** TRN-02/05: серверный экшен для T1Form (useActionState) — вызывается ТОЛЬКО после проверки
 *  enrollment (requireStudent), ключ Anthropic наружу не уходит. Возвращает уже готовую
 *  локализованную строку (не ключ словаря) — компонент её просто рендерит. */
export async function askT1Action(_prevState: T1FormState, formData: FormData): Promise<T1FormState> {
  const user = await requireStudent()

  const text = String(formData.get('text') ?? '').trim()
  if (!text) return { message: t.trainers.emptyInput }

  const result = await askT1(user.id, text)
  return result.ok ? { reply: result.reply } : { message: REASON_MESSAGE[result.reason] }
}
