'use server'
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth/current-user'
import { verifyPassword, hashPassword } from '@/lib/auth/password'
import { requestPasswordReset } from '@/lib/auth/reset'
import { clientIp } from '@/lib/auth/client-ip'
import { db } from '@/lib/db'

async function requireUser() {
  const user = await currentUser()
  if (!user) redirect('/login') // AUTH-11 — на прямой POST после истечения сессии
  return user
}

/** AUTH-18 (F13): текущий пароль → новый (≥8) → повтор совпадает, именно в этом порядке —
 *  неверный текущий пароль не должен тратить проверку длины/совпадения нового. У юзера без
 *  пароля (passwordHash=null) форма на странице не рендерится (см. page.tsx), но прямой POST
 *  сюда — тот же путь, что и неверный текущий пароль. */
export async function changePasswordAction(formData: FormData) {
  const user = await requireUser()
  const current = String(formData.get('currentPassword') ?? '')
  const next = String(formData.get('newPassword') ?? '')
  const confirm = String(formData.get('newPasswordConfirm') ?? '')

  if (!user.passwordHash || !(await verifyPassword(current, user.passwordHash))) {
    redirect('/app/account?error=current')
  }
  if (next.length < 8) redirect('/app/account?error=weak')
  if (next !== confirm) redirect('/app/account?error=mismatch')

  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } })
  redirect('/app/account?done=1')
}

/** Для юзеров без пароля (passwordHash=null, D-034/AUTH-19) — вместо формы смены отправляет
 *  reset-письмо самому себе (тот же механизм, что и публичный /reset, AUTH-16). */
export async function requestOwnResetAction() {
  const user = await requireUser()
  await requestPasswordReset(user.email, await clientIp())
  redirect('/app/account?sent=1')
}
