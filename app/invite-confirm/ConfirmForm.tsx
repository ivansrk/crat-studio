'use client'
import Link from 'next/link'
import { useActionState } from 'react'
import { confirmAction, type ConfirmActionState } from '@/app/actions/confirm'
import { t } from '@/lib/i18n'

const initialState: ConfirmActionState = { status: 'idle' }

/** Ф7б Task 4 (REG-13, F14/F15): страница /invite-confirm/{token}. GET (page.tsx) только
 *  peek'ает токен и НИКОГДА не гасит его — сама мутация (consumeResetToken → confirmRegistration)
 *  происходит здесь, на клике по единственной кнопке «Подтвердить» (POST через server action).
 *  Тот же приём, что GrantForm.tsx: useActionState держит результат (в т.ч. пароль при авто-выдаче,
 *  D-033) только в памяти этого клиентского компонента — не в query-string/cookie/БД. */
export function ConfirmForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(confirmAction, initialState)

  if (state.status === 'auto') {
    return (
      <div className="crat-card accepted-card">
        <h1 className="crat-display">{t.confirm.autoTitle}</h1>
        {state.plainPassword ? (
          <p>
            <strong>{t.confirm.passwordOnceLabel}:</strong><br />
            <code className="password-once">{state.plainPassword}</code>
          </p>
        ) : (
          <p className="crat-muted">{t.confirm.passwordAlreadySet}</p>
        )}
        <Link className="crat-button primary" href="/login">{t.confirm.goToCourse}</Link>
      </div>
    )
  }

  if (state.status === 'manual') {
    return (
      <div className="crat-card accepted-card">
        <h1 className="crat-display">{t.confirm.manualTitle}</h1>
        <p className="crat-muted">{t.confirm.manualBody}</p>
      </div>
    )
  }

  if (state.status === 'already') {
    return (
      <div className="crat-card accepted-card">
        <h1 className="crat-display">{t.confirm.alreadyTitle}</h1>
        <p className="crat-muted">{t.confirm.alreadyBody}</p>
        <Link className="crat-button primary" href="/login">{t.auth.goToLogin}</Link>
        <Link className="crat-button" href="/reset">{t.confirm.resetLink}</Link>
      </div>
    )
  }

  if (state.status === 'invite_gone') {
    return (
      <div className="crat-card accepted-card">
        <h1 className="crat-display">{t.confirm.inviteGoneTitle}</h1>
        <p className="crat-muted">{t.confirm.inviteGoneBody}</p>
      </div>
    )
  }

  if (state.status === 'invalid') {
    const title = state.reason === 'expired' ? t.confirm.expiredTitle
      : state.reason === 'used' ? t.confirm.usedTitle
      : t.confirm.invalidTitle
    return (
      <div className="crat-card accepted-card">
        <h1 className="crat-display">{title}</h1>
        <p className="crat-muted">{t.confirm.invalidBody}</p>
        <Link className="crat-button primary" href="/ai-basics#signup">{t.confirm.resubmitCta}</Link>
      </div>
    )
  }

  return (
    <form action={formAction} className="signup-form crat-card">
      <input type="hidden" name="token" value={token} />
      <p className="crat-muted">{t.confirm.confirmBody}</p>
      <button type="submit" className="crat-button primary" disabled={pending}>{t.confirm.confirmSubmit}</button>
    </form>
  )
}
