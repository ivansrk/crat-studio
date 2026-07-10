import Link from 'next/link'
import { t } from '@/lib/i18n'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'
import { SectionLabel } from '@/components/site/SectionLabel'

/** CONS-02: экран после успешной заявки — тот же паттерн, что /ai-basics/accepted. */
export default function ConsultAccepted() {
  return (
    <>
      <SiteHeader />
      <main className="crat-page">
        <section className="crat-section">
          <div className="crat-shell">
            <SectionLabel kicker={t.consult.kicker} />
            <div className="crat-card accepted-card">
              <h1 className="crat-display">{t.consult.successTitle}</h1>
              <p className="crat-muted">{t.consult.successText}</p>
              <Link className="crat-button primary" href="/">{t.landing.backHome}</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
