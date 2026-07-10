'use server'
import { confirmRegistration } from '@/lib/registration/confirm'

// Ф7б Task 4 (REG-13): useActionState вместо redirect — тот же приём, что grantAccessAction
// (app/actions/admin.ts): при авто-выдаче пароль должен показаться РОВНО один раз и жить только
// в памяти клиентского компонента (app/invite-confirm/ConfirmForm.tsx), не в query-string/cookie/БД.
export type ConfirmActionState =
  | { status: 'idle' }
  | { status: 'auto'; plainPassword: string | null; courseSlug: string }
  | { status: 'manual' }
  | { status: 'already' }
  | { status: 'invite_gone' }
  | { status: 'invalid'; reason: 'invalid' | 'used' | 'expired' }

/** Погашение OPT_IN-токена (consumeResetToken внутри confirmRegistration) происходит ТОЛЬКО
 *  здесь, на POST — GET в app/invite-confirm/[token]/page.tsx вызывает лишь peekResetToken
 *  (не гасит). См. комментарий в page.tsx про GET-vs-мутация компромисс (форма с одной кнопкой). */
export async function confirmAction(_prevState: ConfirmActionState, formData: FormData): Promise<ConfirmActionState> {
  const token = String(formData.get('token') ?? '')
  const result = await confirmRegistration(token)
  if (result.mode === 'auto') return { status: 'auto', plainPassword: result.plainPassword, courseSlug: result.courseSlug }
  if (result.mode === 'invalid') return { status: 'invalid', reason: result.reason }
  return { status: result.mode }
}
