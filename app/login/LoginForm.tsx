'use client'
import { useActionState } from 'react'
import Link from 'next/link'
import { loginAction, type LoginActionState } from '@/app/actions/login'
import { t } from '@/lib/i18n'

const initialState: LoginActionState = {}

/** F10/AUTH-21: email+пароль, useActionState — тот же паттерн, что T1Form/GrantForm.
 *  Без JS форма всё равно постится на loginAction (прогрессивная деградация). */
export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState)

  return (
    <>
      <form action={formAction} className="signup-form crat-card">
        {state.error && <p role="alert" className="form-alert">{state.error}</p>}
        <label>{t.auth.emailLabel}<input name="email" type="email" required autoComplete="email" defaultValue={state.email} /></label>
        <label>{t.auth.passwordLabel}<input name="password" type="password" required autoComplete="current-password" /></label>
        <button type="submit" className="crat-button primary" disabled={pending}>{t.auth.submit}</button>
      </form>
      <p><Link href="/reset">{t.auth.forgotPasswordLink}</Link></p>
    </>
  )
}
