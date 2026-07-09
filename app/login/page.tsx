import { requestLinkAction } from '@/app/actions/request-link'
import { t } from '@/lib/i18n'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'
import { SectionLabel } from '@/components/site/SectionLabel'

export default function Login() {
  return (
    <>
      <SiteHeader />
      <main className="crat-page">
        <section className="crat-section">
          <div className="crat-shell">
            <SectionLabel kicker={t.auth.kicker} />
            <h1 className="crat-display">{t.auth.title}</h1>
            <form action={requestLinkAction} className="signup-form crat-card">
              <label>{t.auth.emailLabel}<input name="email" type="email" required autoComplete="email" /></label>
              <button type="submit" className="crat-button primary">{t.auth.submit}</button>
            </form>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
