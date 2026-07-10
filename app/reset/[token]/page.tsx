import Link from 'next/link'
import { peekResetToken } from '@/lib/auth/reset'
import { setPasswordAction } from '@/app/actions/reset'
import { t } from '@/lib/i18n'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'
import { SectionLabel } from '@/components/site/SectionLabel'

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="crat-page">
        <section className="crat-section">
          <div className="crat-shell">
            <SectionLabel kicker={t.auth.kicker} />
            {children}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}

const FORM_ERROR_TEXT: Record<string, string> = {
  weak: t.auth.weakPassword,
  mismatch: t.auth.passwordMismatch,
}

// T6 (F12/AUTH-04…06/17): GET рендерит форму или used/expired-экран, НИКОГДА не гасит токен —
// consumeResetToken вызывается только внутри setPasswordAction (POST), см. app/actions/reset.ts.
// Здесь на GET используется только peekResetToken (безопасный findUnique-предпросмотр).
export default async function ResetTokenPage({ params, searchParams }: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ error?: string; done?: string }>
}) {
  const { token } = await params
  const { error, done } = await searchParams

  if (done) {
    return (
      <Frame>
        <div className="crat-card accepted-card">
          <h1 className="crat-display">{t.auth.passwordSetTitle}</h1>
          <Link className="crat-button primary" href="/login">{t.auth.goToLogin}</Link>
        </div>
      </Frame>
    )
  }

  const state = await peekResetToken(token)

  if (state.status !== 'ok') {
    return (
      <Frame>
        <div className="crat-card accepted-card">
          <h1 className="crat-display">{state.status === 'expired' ? t.auth.expiredTitle : t.auth.usedTitle}</h1>
          <p className="crat-muted">{t.auth.invalidBody}</p>
          <Link className="crat-button primary" href="/reset">{t.auth.requestAgain}</Link>
        </div>
      </Frame>
    )
  }

  return (
    <Frame>
      <h1 className="crat-display">{t.auth.newPasswordTitle}</h1>
      <form action={setPasswordAction} className="signup-form crat-card">
        <input type="hidden" name="token" value={token} />
        {error && <p role="alert" className="form-alert">{FORM_ERROR_TEXT[error] ?? t.auth.weakPassword}</p>}
        <label>{t.auth.newPasswordLabel}<input name="password" type="password" required autoComplete="new-password" minLength={8} /></label>
        <label>{t.auth.passwordConfirmLabel}<input name="passwordConfirm" type="password" required autoComplete="new-password" minLength={8} /></label>
        <button type="submit" className="crat-button primary">{t.auth.setPasswordSubmit}</button>
      </form>
    </Frame>
  )
}
