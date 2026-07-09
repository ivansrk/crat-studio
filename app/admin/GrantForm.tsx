'use client'
import { useActionState } from 'react'
import { grantAccessAction, type GrantActionState } from '@/app/actions/admin'
import { t } from '@/lib/i18n'

const initialState: GrantActionState = { status: 'idle' }

/** T5 (AUTH-15/F11): пароль показывается один раз — живёт только в памяти этого клиентского
 *  компонента (useActionState), никогда не уходит в query-string/cookie/БД. Перезагрузка страницы
 *  сбрасывает React-состояние → пароль пропадает, что и требуется. */
export function GrantForm({ registrationId }: { registrationId: string }) {
  const [state, formAction, pending] = useActionState(grantAccessAction, initialState)

  if (state.status === 'granted' || state.status === 'granted_email_failed') {
    return (
      <div>
        {state.status === 'granted_email_failed' && <p role="alert" className="form-alert">{t.admin.emailFailed}</p>}
        {state.plainPassword ? (
          <p><strong>{t.admin.passwordOnceLabel}:</strong> <code>{state.plainPassword}</code></p>
        ) : (
          <p className="crat-muted">{t.admin.passwordAlreadySet}</p>
        )}
      </div>
    )
  }

  if (state.status === 'already') {
    return <p className="crat-muted">{t.admin.granted}</p>
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="registrationId" value={registrationId} />
      <button className="crat-button compact" type="submit" disabled={pending}>{t.admin.grant}</button>
    </form>
  )
}
