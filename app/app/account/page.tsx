import Link from 'next/link'
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth/current-user'
import { changePasswordAction, requestOwnResetAction } from '@/app/actions/account'
import { t } from '@/lib/i18n'

const ERROR_TEXT: Record<string, string> = {
  current: t.auth.currentPasswordWrong,
  weak: t.auth.weakPassword,
  mismatch: t.auth.passwordMismatch,
}

// T6 (F13/AUTH-18): смена пароля в кабинете. У юзера без пароля (passwordHash=null, D-034) —
// вместо формы смены блок «задать пароль» (шлёт reset-письмо себе).
export default async function AccountPage({ searchParams }: {
  searchParams: Promise<{ error?: string; done?: string; sent?: string }>
}) {
  const user = await currentUser()
  if (!user) redirect('/login') // layout уже гейтит (app/app/layout.tsx) — TS-подстраховка, как в остальных app/app/*

  const { error, done, sent } = await searchParams

  return (
    <main className="crat-page">
      <section className="crat-section">
        <div className="crat-shell">
          <h1 className="crat-display">{t.auth.accountTitle}</h1>
          {/* T5 дизайн-аудита (П8): собственный email виден на странице аккаунта. */}
          <p className="crat-muted account-email">{t.auth.accountEmailLabel}: {user.email}</p>

          {done && <div className="crat-card accepted-card"><p>{t.auth.passwordChanged}</p></div>}
          {sent && <div className="crat-card accepted-card"><p>{t.auth.sentBody}</p></div>}
          {error && <p role="alert" className="form-alert">{ERROR_TEXT[error] ?? t.auth.currentPasswordWrong}</p>}

          {user.passwordHash ? (
            <form action={changePasswordAction} className="signup-form crat-card">
              <label>{t.auth.currentPasswordLabel}<input name="currentPassword" type="password" required autoComplete="current-password" /></label>
              <label>
                {t.auth.newPasswordLabel}
                <input name="newPassword" type="password" required autoComplete="new-password" minLength={8} />
                <span className="crat-muted field-hint">{t.auth.minPasswordHint}</span>
              </label>
              <label>{t.auth.passwordConfirmLabel}<input name="newPasswordConfirm" type="password" required autoComplete="new-password" minLength={8} /></label>
              <button type="submit" className="crat-button primary">{t.auth.changePasswordSubmit}</button>
            </form>
          ) : (
            <div className="crat-card">
              <p className="crat-muted">{t.auth.noPasswordYet}</p>
              <form action={requestOwnResetAction}>
                <button type="submit" className="crat-button primary">{t.auth.sendSetPasswordLink}</button>
              </form>
            </div>
          )}

          <p><Link href="/app">{t.review.backToCabinet}</Link></p>
        </div>
      </section>
    </main>
  )
}
