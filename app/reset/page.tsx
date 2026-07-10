import { requestResetAction } from '@/app/actions/reset'
import { t } from '@/lib/i18n'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'
import { SectionLabel } from '@/components/site/SectionLabel'

// T6 (F12/AUTH-16): «Забыли пароль» — ответ всегда один и тот же экран (SEC-06), без разбора,
// найден email или нет.
export default async function ResetRequest({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const { sent } = await searchParams
  return (
    <>
      <SiteHeader />
      <main className="crat-page">
        <section className="crat-section">
          <div className="crat-shell">
            <SectionLabel kicker={t.auth.kicker} />
            {sent ? (
              <div className="crat-card accepted-card">
                <h1 className="crat-display">{t.auth.sentTitle}</h1>
                <p className="crat-muted">{t.auth.sentBody}</p>
              </div>
            ) : (
              <>
                <h1 className="crat-display">{t.auth.resetTitle}</h1>
                <form action={requestResetAction} className="signup-form crat-card">
                  <label>{t.auth.emailLabel}<input name="email" type="email" required autoComplete="email" /></label>
                  <button type="submit" className="crat-button primary">{t.auth.resetSubmit}</button>
                </form>
              </>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
