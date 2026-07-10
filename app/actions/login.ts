'use server'
import { redirect } from 'next/navigation'
import { attemptLogin } from '@/lib/auth/login'
import { setSessionCookie } from '@/lib/auth/session'
import { clientIp } from '@/lib/auth/client-ip'
import { t } from '@/lib/i18n'

export type LoginActionState = { error?: string; email?: string }

/** AUTH-12/13/20 (F10): useActionState-паттерн (как askT1Action/T1Form) — при ok:false банер
 *  ошибки остаётся на месте без потери введённого email; при ok:true redirect() внутри action
 *  прерывает выполнение — новое состояние в этом случае не нужно (страница уже сменилась).
 *  Ревью m2: React 19 сбрасывает несвязанные (uncontrolled) поля формы после экшена — email
 *  возвращаем в состояние и подставляем через defaultValue (LoginForm.tsx), ПАРОЛЬ — никогда
 *  (не нужно, и лишний повод не гонять секрет через состояние/DOM). */
export async function loginAction(_prevState: LoginActionState, formData: FormData): Promise<LoginActionState> {
  const email = String(formData.get('email') ?? '')
  const password = String(formData.get('password') ?? '')
  const result = await attemptLogin(email, password, await clientIp())
  if (!result.ok) return { error: t.auth.loginError, email } // AUTH-13/19: один и тот же текст на все причины отказа

  await setSessionCookie(result.userId)
  redirect(result.isAdmin ? '/admin' : '/app') // AUTH-12
}
