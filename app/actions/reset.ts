'use server'
import { redirect } from 'next/navigation'
import { clientIp } from '@/lib/auth/client-ip'
import { requestPasswordReset, setPasswordViaToken } from '@/lib/auth/reset'

/** AUTH-16/SEC-06: ответ ВСЕГДА одинаковый — /reset?sent=1 рендерит один и тот же экран
 *  независимо от того, нашёлся email в базе или нет. */
export async function requestResetAction(formData: FormData) {
  await requestPasswordReset(String(formData.get('email') ?? ''), await clientIp())
  redirect('/reset?sent=1')
}

/** AUTH-17: погашение токена (consumeResetToken внутри setPasswordViaToken) происходит
 *  ТОЛЬКО здесь, на POST — GET в app/reset/[token]/page.tsx вызывает лишь peekResetToken
 *  (не гасит). Совпадение паролей проверяем ДО setPasswordViaToken, чтобы не тратить
 *  единственную попытку консюминга токена на опечатку в повторе. */
export async function setPasswordAction(formData: FormData) {
  const token = String(formData.get('token') ?? '')
  const password = String(formData.get('password') ?? '')
  const passwordConfirm = String(formData.get('passwordConfirm') ?? '')

  if (password !== passwordConfirm) redirect(`/reset/${token}?error=mismatch`)

  const result = await setPasswordViaToken(token, password)
  if (!result.ok) redirect(`/reset/${token}?error=${result.reason}`) // weak — токен цел; used/expired/invalid/no_user — уже погашен

  redirect(`/reset/${token}?done=1`)
}
